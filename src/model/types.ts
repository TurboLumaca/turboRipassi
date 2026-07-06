/**
 * Model layer — tipi TypeScript del dominio (sezione 5 della spec).
 * Nessuna dipendenza dalla UI. Questi tipi rispecchiano lo schema Postgres.
 */

export interface Ripasso {
  id: string;
  user_id: string;
  titolo: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Occorrenza {
  id: string;
  ripasso_id: string;
  user_id: string;
  scheduled_at: string;
  is_manual_1h: boolean;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Allegato {
  id: string;
  ripasso_id: string;
  user_id: string;
  display_name: string;
  original_file_name: string;
  storage_path: string;
  order_index: number;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

/** Ripasso arricchito con occorrenze e allegati, usato dalla View. */
export interface RipassoCompleto extends Ripasso {
  occorrenze: Occorrenza[];
  allegati: Allegato[];
}

/** Offset temporali generati automaticamente alla creazione (sezione 5). */
export type OffsetOccorrenza = "1h" | "1d" | "1w" | "1m" | "6m";

/** Riga della cache locale SQLite (sezione 5 / 7), mai su Supabase. */
export interface CacheAllegato {
  allegato_id: string;
  local_uri: string;
  cached_at: string; // YYYY-MM-DD
}
