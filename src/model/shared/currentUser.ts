/**
 * Model layer — the authenticated user's id, for rows that carry `user_id`.
 *
 * Lives here rather than in each repo because both `ripassi` and `allegati`
 * need it and RLS rejects an insert that gets it wrong: one implementation
 * means one place where "not authenticated" is decided.
 */
import { supabase } from "@/config/supabase";

/** Id of the signed-in user. Throws (in Italian) when there is no session. */
export async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Utente non autenticato.");
  return data.user.id;
}
