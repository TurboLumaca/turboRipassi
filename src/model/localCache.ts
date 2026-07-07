/**
 * Model layer — cache locale SQLite + filesystem (sezioni 5 e 7).
 * Tabella `cache_allegati` esiste SOLO on-device, mai su Supabase.
 * Finestra mantenuta: ieri, oggi, domani. La logica pura (finestra, selezione)
 * sta in cacheLogic.ts; qui solo l'I/O.
 */
import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";
import { downloadAllegato } from "./allegatiRepo";
import { giornoLocale, righeDaEliminare } from "./cacheLogic";
import { estensione } from "./fileUtils";
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
 * Scarica un allegato in cache se non presente e registra/aggiorna la riga.
 * `cached_at` viene sempre portato a oggi: indica "ultimo giorno in cui
 * l'allegato è risultato in finestra", non la data del primo download.
 */
export async function cacheAllegato(allegato: Allegato): Promise<string> {
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
  const ext = estensione(allegato.storage_path, allegato.mime_type);
  const dest = `${CACHE_DIR}${allegato.id}${ext}`;
  const localUri = await downloadAllegato(allegato.storage_path, dest);

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
    // file già assente: ignora
  }
  await db.runAsync("DELETE FROM cache_allegati WHERE allegato_id = ?", allegatoId);
}

/** Rimuove un singolo allegato dalla cache (es. dopo l'eliminazione remota). */
export async function rimuoviDaCache(allegatoId: string): Promise<void> {
  const uri = await getLocalUri(allegatoId);
  if (uri) await removeCacheRow(allegatoId, uri);
}

/**
 * Rotazione cache (sezione 7):
 * 1. scarica (o conferma) gli allegati delle occorrenze in finestra;
 * 2. elimina i file locali degli allegati NON più in finestra — inclusi
 *    quelli eliminati da remoto, che non compaiono più nella lista.
 * Il dato remoto su Storage non viene mai toccato.
 */
export async function ruotaCache(allegatiInFinestra: Allegato[]): Promise<void> {
  // 1. Assicura in cache tutti gli allegati in finestra (e rinfresca cached_at).
  for (const a of allegatiInFinestra) {
    try {
      await cacheAllegato(a);
    } catch {
      // rete assente o file mancante: si riproverà alla prossima apertura
    }
  }

  // 2. Elimina ciò che non appartiene alla finestra corrente.
  const idsInFinestra = new Set(allegatiInFinestra.map((a) => a.id));
  const daEliminare = righeDaEliminare(await getCacheRows(), idsInFinestra);
  for (const row of daEliminare) {
    await removeCacheRow(row.allegato_id, row.local_uri);
  }
}

export async function svuotaCache(): Promise<void> {
  const rows = await getCacheRows();
  for (const row of rows) {
    await removeCacheRow(row.allegato_id, row.local_uri);
  }
}
