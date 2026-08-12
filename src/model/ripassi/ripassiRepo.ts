/**
 * Model layer — data access for reviews and occurrences.
 * Pure I/O functions against Supabase, no JSX, no React state.
 *
 * Exposed as an interface with one default implementation, the same shape used
 * for Drive (`DriveClient`): the Controller depends on the contract, not on a
 * module path, which is what makes it substitutable in a test and replaceable
 * by an offline-queue implementation later without touching the hook.
 */
import { supabase } from "@/config/supabase";
import type { Ripasso, RipassoCompleto } from "../types";
import {
  calcolaOccorrenze,
  perDataProgrammata,
  type SpostamentoOccorrenza,
} from "./occorrenzeDates";

/** Fields a new ripasso is created from. */
export interface NuovoRipasso {
  titolo: string;
  note: string | null;
  includi1h: boolean;
  /** Base date for the generated occurrences; defaults to now. */
  base?: Date;
}

/**
 * A ripasso that already exists on the device and now has to reach the server:
 * every id was minted locally when it was saved offline.
 */
export interface RipassoDaCoda {
  id: string;
  titolo: string;
  note: string | null;
  /**
   * The occurrences to create with it. Already computed — they were shown to
   * the user, and the reminders on this device are keyed on these very ids.
   */
  occorrenze: { id: string; scheduled_at: string; is_manual_1h: boolean }[];
}

/** Everything the Controller needs from the reviews store. */
export interface RipassiRepo {
  /** Full list with occurrences and attachments, newest ripasso first. */
  leggiCompleti(): Promise<RipassoCompleto[]>;
  /** Creates a ripasso and its automatic occurrences; returns the new row. */
  crea(input: NuovoRipasso): Promise<Ripasso>;
  /**
   * Writes a ripasso saved offline, ids and all.
   *
   * Idempotent, which `crea` explicitly is not: the queue retries, and a retry
   * of a server-generated insert whose reply was lost produces a duplicate
   * ripasso. Here the row names itself, so the second attempt collides with the
   * first and resolves to an update.
   */
  creaDaCoda(input: RipassoDaCoda): Promise<void>;
  aggiorna(id: string, patch: { titolo?: string; note?: string | null }): Promise<void>;
  /** Deletes a ripasso; occurrences and attachments cascade. */
  elimina(id: string): Promise<void>;
  aggiornaOccorrenza(id: string, patch: { is_completed?: boolean }): Promise<void>;
  completaOccorrenza(id: string, completata: boolean): Promise<void>;
  /**
   * Writes several occurrence dates in one shot. Rescheduling goes through
   * here even for a single date, because moving one occurrence usually moves
   * the ones after it too (`ricalcolaSuccessive`) and a schedule that is half
   * shifted is worse than one that did not move at all.
   */
  spostaOccorrenze(spostamenti: SpostamentoOccorrenza[]): Promise<void>;
}

/**
 * One round trip pulls a ripasso with its children. Kept as a constant because
 * the list and the single-row read must select the same shape: a column added
 * to one and not the other yields rows that typecheck but arrive incomplete.
 */
const SELECT_COMPLETO = "*, occorrenze(*), allegati(*)";

/**
 * Postgres returns children in no guaranteed order, so the ordering the UI
 * relies on is applied here: occurrences chronologically, attachments by the
 * index the user arranged them in.
 */
function componiRipassoCompleto(row: Record<string, unknown>): RipassoCompleto {
  const { occorrenze, allegati, ...ripasso } = row as unknown as RipassoCompleto;
  return {
    ...ripasso,
    occorrenze: (occorrenze ?? []).slice().sort(perDataProgrammata),
    allegati: (allegati ?? []).slice().sort((a, b) => a.order_index - b.order_index),
  };
}

export const ripassiRepo: RipassiRepo = {
  async leggiCompleti(): Promise<RipassoCompleto[]> {
    const { data, error } = await supabase
      .from("ripassi")
      .select(SELECT_COMPLETO)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []).map(componiRipassoCompleto);
  },

  /**
   * Creates a ripasso and generates the automatic occurrences (spec section 5).
   * `includi1h` = true also enables the +1 hour occurrence.
   * The occurrences' base date is "now" (creation time).
   */
  async crea(input: NuovoRipasso): Promise<Ripasso> {
    const base = input.base ?? new Date();

    // No ownership columns here: `account_id` and `user_id` default to the
    // session's account and identity server-side. Sending them meant asking
    // Supabase who the user was — a round trip — before every create, and it
    // is the database that decides ownership anyway.
    const { data: ripasso, error } = await supabase
      .from("ripassi")
      .insert({ titolo: input.titolo, note: input.note })
      .select()
      .single();

    if (error) throw error;

    const occorrenze = calcolaOccorrenze(base, input.includi1h).map((o) => ({
      ripasso_id: ripasso.id,
      scheduled_at: o.scheduled_at,
      is_manual_1h: o.is_manual_1h,
    }));

    const { error: errOcc } = await supabase.from("occorrenze").insert(occorrenze);
    if (errOcc) throw errOcc;

    return ripasso as Ripasso;
  },

  /**
   * The deferred twin of `crea`: same two writes, but with the ids the device
   * already handed out, and safe to repeat.
   *
   * The ripasso goes first because the RLS policy on `occorrenze` checks that
   * the parent exists and belongs to the same account — an occurrence written
   * before its ripasso is not merely orphaned, it is rejected.
   *
   * Ownership columns are omitted here as everywhere else: Postgres fills them
   * from the session. That is what makes a queued ripasso land under whoever is
   * signed in when it is finally sent, rather than under an account id captured
   * on a device days earlier.
   */
  async creaDaCoda(input: RipassoDaCoda): Promise<void> {
    const { error } = await supabase
      .from("ripassi")
      .upsert({ id: input.id, titolo: input.titolo, note: input.note });
    if (error) throw error;

    if (input.occorrenze.length === 0) return;

    // `ignoreDuplicates` because a repeat must not undo anything: between the
    // first attempt and this one the user may have ticked one of these
    // occurrences off on another device, and an ordinary upsert would write
    // `is_completed` back to its default and quietly un-do the ripasso.
    const { error: errOcc } = await supabase.from("occorrenze").upsert(
      input.occorrenze.map((o) => ({
        id: o.id,
        ripasso_id: input.id,
        scheduled_at: o.scheduled_at,
        is_manual_1h: o.is_manual_1h,
      })),
      { ignoreDuplicates: true }
    );
    if (errOcc) throw errOcc;
  },

  async aggiorna(id, patch): Promise<void> {
    const { error } = await supabase.from("ripassi").update(patch).eq("id", id);
    if (error) throw error;
  },

  async elimina(id): Promise<void> {
    const { error } = await supabase.from("ripassi").delete().eq("id", id);
    if (error) throw error;
  },

  async aggiornaOccorrenza(id, patch): Promise<void> {
    const { error } = await supabase.from("occorrenze").update(patch).eq("id", id);
    if (error) throw error;
  },

  completaOccorrenza(id, completata): Promise<void> {
    return ripassiRepo.aggiornaOccorrenza(id, { is_completed: completata });
  },

  /**
   * One transactional call, like `riordina_allegati`: N separate updates would
   * leave the schedule half moved if the connection dropped in the middle, and
   * on mobile it does. The function is not SECURITY DEFINER, so RLS still
   * decides which rows the caller may touch.
   */
  async spostaOccorrenze(spostamenti): Promise<void> {
    if (spostamenti.length === 0) return;
    const { error } = await supabase.rpc("sposta_occorrenze", {
      ids: spostamenti.map((s) => s.id),
      istanti: spostamenti.map((s) => s.scheduled_at),
    });
    if (error) throw error;
  },
};
