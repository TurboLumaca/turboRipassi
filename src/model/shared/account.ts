/**
 * Model layer — the account the session belongs to.
 *
 * Rows are owned by an *account*, not by a login: the same person signing in
 * with a password and with Google is one account with two identities, and
 * sees one set of ripassi either way (see
 * supabase/migrations/0001_account_identita.sql).
 *
 * Inserts never carry the ownership columns — Postgres fills `account_id` and
 * `user_id` from the session — so nothing here is needed to write a row. What
 * is needed is the guarantee that the session *has* an account at all.
 */
import { supabase } from "@/config/supabase";

/**
 * Makes sure the signed-in identity is attached to an account, and returns it.
 *
 * An identity with no account can neither read nor write: every RLS policy
 * compares against it, and a missing one matches nothing. The database
 * normally creates it on sign-up; this repairs the case where it did not
 * (an account created while the migration was running, most plausibly).
 *
 * Cheap and idempotent — one round trip that does nothing on the normal path.
 */
export async function assicuraAccount(): Promise<string> {
  const { data, error } = await supabase.rpc("assicura_account");
  if (error) throw error;
  if (!data) throw new Error("Utente non autenticato.");
  return data as string;
}
