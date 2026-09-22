/**
 * Model layer — TypeScript domain types (spec section 5).
 * No UI dependency. These types mirror the Postgres schema.
 */

/**
 * Ownership, shared by every synced row.
 *
 * `account_id` is the owner: one person, however many ways they sign in.
 * `user_id` only records *which* login created the row, and is null once that
 * login is removed — never read it to decide who something belongs to.
 * Neither is ever sent on insert: Postgres fills them from the session.
 */
interface Proprieta {
  account_id: string;
  user_id: string | null;
}

export interface Ripasso extends Proprieta {
  id: string;
  titolo: string;
  /**
   * La domanda che apre il richiamo, separata dalle note.
   *
   * È il campo che rende esplicita la struttura prompt/risposta al momento in
   * cui si scrive il concetto: la lista mostra la domanda e mai la risposta,
   * e la spunta passa di lì. Resta nullable perché ogni ripasso creato prima
   * di questo campo non ne ha una, e non se ne inventa una al posto suo.
   */
  domanda: string | null;
  note: string | null;
  /**
   * Quando la Cerimonia di Promozione è stata mostrata per questo concetto.
   *
   * Sul server e non sul dispositivo: la cerimonia è una volta sola per
   * concetto, non una volta sola per telefono, e tenerla in locale l'avrebbe
   * ripetuta a ogni reinstallazione — una celebrazione ripetibile è una
   * celebrazione che non significa niente.
   */
  ceremony_shown_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Occorrenza extends Proprieta {
  id: string;
  ripasso_id: string;
  scheduled_at: string;
  is_manual_1h: boolean;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Allegato extends Proprieta {
  id: string;
  ripasso_id: string;
  display_name: string;
  original_file_name: string;
  /**
   * Reference to the binary file. After the Google Drive migration this holds
   * the Drive file ID (inside the user's "ripassiProgrammati" folder) instead
   * of a Supabase Storage bucket path. The field name is kept for
   * compatibility with the existing Postgres schema.
   */
  storage_path: string;
  order_index: number;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
}

/** Ripasso enriched with occurrences and attachments, used by the View. */
export interface RipassoCompleto extends Ripasso {
  occorrenze: Occorrenza[];
  allegati: Allegato[];
}

/** Time offsets auto-generated on creation (spec section 5). */
export type OffsetOccorrenza = "1h" | "1d" | "1w" | "1m" | "6m";

/** Local SQLite cache row (spec section 5 / 7), never sent to Supabase. */
export interface CacheAllegato {
  allegato_id: string;
  local_uri: string;
  cached_at: string; // YYYY-MM-DD
}
