/**
 * Model layer — the last known session, kept on the device.
 *
 * Supabase already stores the session (see config/secureAuthStorage), but it
 * only hands it back through `getSession()`, and that call is not local: when
 * the access token has expired — which after an hour it always has — it tries
 * to refresh it first. With no connection that attempt retries with backoff for
 * about thirty seconds and then reports no session at all, so a cold start in
 * airplane mode showed a long spinner and then the login screen. The app was
 * not broken and the user was not signed out; there was simply no way to say so
 * from what `getSession()` returns.
 *
 * This is that missing answer: a copy of the session written whenever one
 * arrives, readable without touching the network, so the app can open on what
 * the device already knows and reconcile with the server afterwards.
 *
 * It lives in SecureStore for the same reason the original does — it carries
 * the same refresh token, and plaintext on disk would be a worse place for it.
 *
 * Every operation swallows its failures. This layer exists to make the app open
 * when things go wrong; being the reason it does not would defeat the point.
 */
import type { Session } from "@supabase/supabase-js";
import { secureAuthStorage } from "@/config/secureAuthStorage";

const CHIAVE = "turboripassi.sessione-locale";

/**
 * Enough of a check to refuse a truncated or foreign value.
 *
 * The user id is what the rest of the app reads off the session, and the
 * tokens are what makes it usable again once there is a connection: a value
 * missing any of them would open the app into a state nothing can repair.
 */
function isSessione(v: unknown): v is Session {
  if (v === null || typeof v !== "object") return false;
  const s = v as Partial<Session>;
  return (
    typeof s.access_token === "string" &&
    typeof s.refresh_token === "string" &&
    typeof s.user?.id === "string"
  );
}

/** Records the session as the one to open with next time. */
export async function salvaSessione(session: Session): Promise<void> {
  try {
    await secureAuthStorage.setItem(CHIAVE, JSON.stringify(session));
  } catch {
    // The next launch simply falls back to asking Supabase.
  }
}

/** The session the device last saw, or null when there is none to trust. */
export async function leggiSessione(): Promise<Session | null> {
  try {
    const grezzo = await secureAuthStorage.getItem(CHIAVE);
    if (!grezzo) return null;
    const valore: unknown = JSON.parse(grezzo);
    return isSessione(valore) ? valore : null;
  } catch {
    // Unreadable or not valid JSON: treat it as absent rather than as a crash.
    return null;
  }
}

/**
 * Drops the copy. Called when the session is genuinely over — a sign-out, or a
 * server that says the session no longer exists — and never merely because the
 * server could not be reached.
 */
export async function dimenticaSessione(): Promise<void> {
  try {
    await secureAuthStorage.removeItem(CHIAVE);
  } catch {
    // Nothing to do: the reconciliation at the next launch clears it anyway.
  }
}
