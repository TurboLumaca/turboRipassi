/**
 * Model layer — cache locale SQLite + filesystem (sezioni 5 e 7).
 * Tabella `cache_allegati` esiste SOLO on-device, mai su Supabase.
 * Finestra mantenuta: ieri, oggi, domani.
 */
import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";
import { downloadAllegato } from "./allegatiRepo";
import type { Allegato, CacheAllegato } from "./types";

const DB_NAME = "ripassa-cache.db";
const CACHE_DIR = FileSystem.documentDirectory + "allegati-cache/";

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

function oggiISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Finestra [ieri, oggi, domani] come set di stringhe YYYY-MM-DD. */
export function finestraGiorni(riferimento = new Date()): Set<string> {
  const giorni = new Set<string>();
  for (let delta = -1; delta <= 1; delta++) {
    const d = new Date(riferimento);
    d.setDate(d.getDate() + delta);
    giorni.add(d.toISOString().slice(0, 10));
  }
  return giorni;
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

/** Scarica un allegato in cache se non presente, e registra la riga. */
export async function cacheAllegato(allegato: Allegato): Promise<string> {
  const existing = await getLocalUri(allegato.id);
  if (existing) {
    const info = await FileSystem.getInfoAsync(existing);
    if (info.exists) return existing;
  }

  await ensureDir();
  const ext = allegato.storage_path.slice(allegato.storage_path.lastIndexOf("."));
  const dest = `${CACHE_DIR}${allegato.id}${ext.startsWith(".") ? ext : ""}`;
  const localUri = await downloadAllegato(allegato.storage_path, dest);

  const db = await getDb();
  await db.runAsync(
    "INSERT OR REPLACE INTO cache_allegati (allegato_id, local_uri, cached_at) VALUES (?, ?, ?)",
    allegato.id,
    localUri,
    oggiISO()
  );
  return localUri;
}

async function removeCacheRow(allegatoId: string, localUri: string): Promise<void> {
  const db = await getDb();
  try {
    await FileSystem.deleteAsync(localUri, { idempotent: true });
  } catch {
    // file già assente: ignora
  }
  await db.runAsync("DELETE FROM cache_allegati WHERE allegato_id = ?", allegatoId);
}

/**
 * Rotazione cache (sezione 7):
 * - scarica gli allegati delle occorrenze nella finestra [ieri, oggi, domani];
 * - elimina i file locali con cached_at fuori finestra.
 * Il dato remoto su Storage non viene mai toccato.
 */
export async function ruotaCache(
  allegatiInFinestra: Allegato[],
  riferimento = new Date()
): Promise<void> {
  // 1. Assicura in cache tutti gli allegati in finestra.
  for (const a of allegatiInFinestra) {
    try {
      await cacheAllegato(a);
    } catch {
      // rete assente o file mancante: si riproverà alla prossima apertura
    }
  }

  // 2. Elimina le righe di cache con cached_at fuori dalla finestra.
  const giorni = finestraGiorni(riferimento);
  const rows = await getCacheRows();
  for (const row of rows) {
    if (!giorni.has(row.cached_at)) {
      await removeCacheRow(row.allegato_id, row.local_uri);
    }
  }
}

export async function svuotaCache(): Promise<void> {
  const rows = await getCacheRows();
  for (const row of rows) {
    await removeCacheRow(row.allegato_id, row.local_uri);
  }
}
