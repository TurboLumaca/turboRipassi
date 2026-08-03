/**
 * Model layer — data access for reviews and occurrences.
 * Pure I/O functions against Supabase, no JSX, no React state.
 */
import { supabase } from "@/config/supabase";
import { currentUserId } from "@/model/shared/currentUser";
import type { Allegato, Occorrenza, Ripasso, RipassoCompleto } from "../types";
import { calcolaOccorrenze, perDataProgrammata } from "./occorrenzeDates";

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
  return {
    ...(row as unknown as Ripasso),
    occorrenze: ((row.occorrenze ?? []) as Occorrenza[]).slice().sort(perDataProgrammata),
    allegati: ((row.allegati ?? []) as Allegato[])
      .slice()
      .sort((a, b) => a.order_index - b.order_index),
  };
}

/** Full list of reviews with occurrences and attachments (one fetch per user). */
export async function fetchRipassiCompleti(): Promise<RipassoCompleto[]> {
  const { data, error } = await supabase
    .from("ripassi")
    .select(SELECT_COMPLETO)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(componiRipassoCompleto);
}

export async function fetchRipassoCompleto(id: string): Promise<RipassoCompleto | null> {
  const { data, error } = await supabase
    .from("ripassi")
    .select(SELECT_COMPLETO)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? componiRipassoCompleto(data) : null;
}

/**
 * Creates a ripasso and generates the automatic occurrences (spec section 5).
 * `includi1h` = true also enables the +1 hour occurrence.
 * The occurrences' base date is "now" (creation time).
 */
export async function createRipasso(input: {
  titolo: string;
  note: string | null;
  includi1h: boolean;
  base?: Date;
}): Promise<Ripasso> {
  const user_id = await currentUserId();
  const base = input.base ?? new Date();

  const { data: ripasso, error } = await supabase
    .from("ripassi")
    .insert({ titolo: input.titolo, note: input.note, user_id })
    .select()
    .single();

  if (error) throw error;

  const occorrenze = calcolaOccorrenze(base, input.includi1h).map((o) => ({
    ripasso_id: ripasso.id,
    user_id,
    scheduled_at: o.scheduled_at,
    is_manual_1h: o.is_manual_1h,
  }));

  const { error: errOcc } = await supabase.from("occorrenze").insert(occorrenze);
  if (errOcc) throw errOcc;

  return ripasso as Ripasso;
}

export async function updateRipasso(
  id: string,
  patch: { titolo?: string; note?: string | null }
): Promise<void> {
  const { error } = await supabase.from("ripassi").update(patch).eq("id", id);
  if (error) throw error;
}

/** Deletes a ripasso; occurrences and attachments cascade via ON DELETE CASCADE. */
export async function deleteRipasso(id: string): Promise<void> {
  const { error } = await supabase.from("ripassi").delete().eq("id", id);
  if (error) throw error;
}

export async function updateOccorrenza(
  id: string,
  patch: { scheduled_at?: string; is_completed?: boolean }
): Promise<void> {
  const { error } = await supabase.from("occorrenze").update(patch).eq("id", id);
  if (error) throw error;
}

export async function toggleCompletata(id: string, is_completed: boolean): Promise<void> {
  return updateOccorrenza(id, { is_completed });
}
