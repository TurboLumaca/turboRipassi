/**
 * Model layer — accesso dati per ripassi e occorrenze.
 * Funzioni pure di I/O verso Supabase, nessun JSX, nessuno stato React.
 */
import { supabase } from "@/config/supabase";
import type { Occorrenza, Ripasso, RipassoCompleto } from "./types";
import { calcolaOccorrenze } from "./occorrenzeDates";

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Utente non autenticato.");
  return data.user.id;
}

/** Elenco completo dei ripassi con occorrenze e allegati (una fetch per l'utente). */
export async function fetchRipassiCompleti(): Promise<RipassoCompleto[]> {
  const { data, error } = await supabase
    .from("ripassi")
    .select("*, occorrenze(*), allegati(*)")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((r: any) => ({
    ...(r as Ripasso),
    occorrenze: ((r.occorrenze ?? []) as Occorrenza[]).sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    ),
    allegati: (r.allegati ?? []).sort(
      (a: any, b: any) => a.order_index - b.order_index
    ),
  }));
}

export async function fetchRipassoCompleto(id: string): Promise<RipassoCompleto | null> {
  const { data, error } = await supabase
    .from("ripassi")
    .select("*, occorrenze(*), allegati(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    ...(data as Ripasso),
    occorrenze: ((data as any).occorrenze ?? []).sort(
      (a: Occorrenza, b: Occorrenza) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    ),
    allegati: ((data as any).allegati ?? []).sort(
      (a: any, b: any) => a.order_index - b.order_index
    ),
  };
}

/**
 * Crea un ripasso e genera le occorrenze automatiche (sezione 5).
 * `includi1h` = true attiva anche l'occorrenza +1 ora.
 * La data base delle occorrenze è "adesso" (momento di creazione).
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

/** Elimina un ripasso; occorrenze e allegati cadono per ON DELETE CASCADE. */
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
