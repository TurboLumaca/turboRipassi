/**
 * Model layer — local SQLite + filesystem cache (spec sections 5 and 7).
 * The `cache_allegati` table exists ONLY on-device, never sent to Supabase.
 * Window kept: yesterday, today, tomorrow. Pure logic (window, selection)
 * lives in cacheLogic.ts; this file is I/O only.
 */
import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";
import { driveClient } from "@/model/drive/driveRepo";
import {
  giornoLocale,
  righeDaEliminare,
  temporaneiScaduti,
  type FileTemporaneo,
} from "./cacheLogic";
import { estensione, SOTTOCARTELLA_TEMPORANEI } from "@/model/shared/fileUtils";
import { isErroreDiRete } from "@/model/shared/errorMessages";
import { reportError } from "@/config/crashReporting";
import type { Allegato, CacheAllegato } from "../types";

const DB_NAME = "ripassa-cache.db";
const CACHE_DIR = FileSystem.documentDirectory + "allegati-cache/";

/** How the cache obtains a file it doesn't have yet. */
export type ScaricaAllegato = (storagePath: string, destUri: string) => Promise<string>;

/**
 * Default source: the Drive client directly.
 *
 * Injected rather than imported from the attachments repo, which is what this
 * used to do: that pulled Supabase (and therefore an authenticated session)
 * into a module whose whole job is copying bytes to disk. The cache now needs
 * only "something that can fetch a storage_path", which is also what makes it
 * substitutable in a test.
 */
const scaricaDaDrive: ScaricaAllegato = (storagePath, destUri) =>
  driveClient.downloadFile(storagePath, destUri);

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS cache_allegati (
          allegato_id TEXT PRIMARY KEY NOT NULL,
          local_uri   TEXT NOT NULL,
          cached_at   TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

export async function getCacheRows(): Promise<CacheAllegato[]> {
  const db = await getDb();
  return db.getAllAsync<CacheAllegato>("SELECT * FROM cache_allegati");
}

export async function getLocalUri(allegatoId: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CacheAllegato>(
    "SELECT * FROM cache_allegati WHERE allegato_id = ?",
    allegatoId
  );
  return row?.local_uri ?? null;
}

/**
 * Downloads an attachment into the cache if missing and records/refreshes
 * its row. `cached_at` is always bumped to today: it marks "last day this
 * attachment was in the window", not the date of the first download.
 */
export async function cacheAllegato(
  allegato: Allegato,
  scarica: ScaricaAllegato = scaricaDaDrive
): Promise<string> {
  const db = await getDb();
  const oggi = giornoLocale(new Date());

  const existing = await getLocalUri(allegato.id);
  if (existing) {
    const info = await FileSystem.getInfoAsync(existing);
    if (info.exists) {
      await db.runAsync(
        "UPDATE cache_allegati SET cached_at = ? WHERE allegato_id = ?",
        oggi,
        allegato.id
      );
      return existing;
    }
  }

  await ensureDir();
  // Extension from the original file name (storage_path is a Drive file ID,
  // not a file name — it carries no extension of its own).
  const ext = estensione(allegato.original_file_name, allegato.mime_type);
  const dest = `${CACHE_DIR}${allegato.id}${ext}`;
  const localUri = await scarica(allegato.storage_path, dest);

  await db.runAsync(
    "INSERT OR REPLACE INTO cache_allegati (allegato_id, local_uri, cached_at) VALUES (?, ?, ?)",
    allegato.id,
    localUri,
    oggi
  );
  return localUri;
}

async function removeCacheRow(allegatoId: string, localUri: string): Promise<void> {
  const db = await getDb();
  try {
    await FileSystem.deleteAsync(localUri, { idempotent: true });
  } catch {
    // File already gone: ignore.
  }
  await db.runAsync("DELETE FROM cache_allegati WHERE allegato_id = ?", allegatoId);
}

/** Removes a single attachment from the cache (e.g. after remote deletion). */
export async function rimuoviDaCache(allegatoId: string): Promise<void> {
  const uri = await getLocalUri(allegatoId);
  if (uri) await removeCacheRow(allegatoId, uri);
}

/** How a rotation went, so the UI can say when offline reading is incomplete. */
export interface EsitoRotazione {
  /** Attachments available locally at the end of the rotation. */
  disponibili: number;
  /** Attachments in the window that could not be fetched. */
  falliti: number;
}

/**
 * Cache rotation (spec section 7):
 * 1. downloads (or confirms) the attachments of occurrences in the window;
 * 2. deletes local files for attachments NO LONGER in the window — including
 *    ones deleted remotely, which no longer appear in the list.
 * The remote data on Drive is never touched.
 *
 * A single failure must not stop the others, so each download is guarded —
 * but the result is counted and reported instead of being dropped. Offline
 * reading is the feature this whole module exists for, and a cache that never
 * fills up used to be invisible: the user discovered it on a train, with no
 * connection, and crash reporting had never heard of it.
 *
 * Deliberately NOT retried: the rotation can span dozens of files, and three
 * attempts with backoff on each would hold the app hostage exactly when the
 * network is bad. The next app open runs the rotation again.
 */
export async function ruotaCache(
  allegatiInFinestra: Allegato[],
  scarica: ScaricaAllegato = scaricaDaDrive
): Promise<EsitoRotazione> {
  // 1. Make sure every attachment in the window is cached (and refresh cached_at).
  const falliti: unknown[] = [];
  for (const a of allegatiInFinestra) {
    try {
      await cacheAllegato(a, scarica);
    } catch (e) {
      falliti.push(e);
    }
  }

  // Being offline is an expected outcome, not an anomaly: reporting it would
  // fill the dashboard with events nobody can act on. Anything else — revoked
  // Drive access, a file deleted from Drive, no space on the device — is a
  // real failure of the offline promise and deserves one event per rotation.
  const anomali = falliti.filter((e) => !isErroreDiRete(e));
  if (anomali.length > 0) {
    reportError(anomali[0], {
      operazione: "ruotaCache",
      falliti: anomali.length,
      inFinestra: allegatiInFinestra.length,
    });
  }

  // 2. Same occasion, same purpose: prune the temporary copies made to open
  // attachments outside the window. Rotation runs at most once a day, which
  // is the right cadence for a policy measured in days.
  await potaTemporanei();

  // 3. Delete anything that no longer belongs to the current window.
  const idsInFinestra = new Set(allegatiInFinestra.map((a) => a.id));
  const daEliminare = righeDaEliminare(await getCacheRows(), idsInFinestra);
  for (const row of daEliminare) {
    await removeCacheRow(row.allegato_id, row.local_uri);
  }

  return {
    disponibili: allegatiInFinestra.length - falliti.length,
    falliti: falliti.length,
  };
}

/**
 * Removes the temporary copies that have outlived their usefulness.
 *
 * These do not live in `cache_allegati` and are therefore invisible to
 * `svuotaCache`, which works from the table: they used to accumulate with no
 * ceiling and no way to see them. The policy is deliberately time-based and
 * not size-based — the cost of a wrong guess is one extra download, and the
 * whole point is that the total stops growing.
 *
 * Failures are swallowed on purpose: this is housekeeping running alongside
 * the rotation, and it must never be the reason an app open fails.
 */
export async function potaTemporanei(ora: number = Date.now()): Promise<number> {
  const dir = `${FileSystem.cacheDirectory}${SOTTOCARTELLA_TEMPORANEI}`;
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) return 0;

    const nomi = await FileSystem.readDirectoryAsync(dir);
    const file: FileTemporaneo[] = await Promise.all(
      nomi.map(async (nome) => {
        const i = await FileSystem.getInfoAsync(`${dir}${nome}`);
        return { nome, modificatoSecondi: i.exists ? i.modificationTime : undefined };
      })
    );

    const scaduti = temporaneiScaduti(file, ora);
    for (const f of scaduti) {
      await FileSystem.deleteAsync(`${dir}${f.nome}`, { idempotent: true });
    }
    return scaduti.length;
  } catch {
    return 0;
  }
}

export async function svuotaCache(): Promise<void> {
  const rows = await getCacheRows();
  for (const row of rows) {
    await removeCacheRow(row.allegato_id, row.local_uri);
  }
  // Logging out means the files are not this user's business any more, so the
  // age policy does not apply: everything goes.
  const dir = `${FileSystem.cacheDirectory}${SOTTOCARTELLA_TEMPORANEI}`;
  await FileSystem.deleteAsync(dir, { idempotent: true }).catch(() => undefined);
}
