/**
 * Controller — helpers for the Google identity login.
 *
 * Pulled out of useAuth so the hook reads as "what happens", not "how a
 * redirect is spelled". None of these touch React state, which also makes
 * them straightforward to reason about (and to test) in isolation.
 */
import * as AuthSession from "expo-auth-session";
import { dettaglioTecnico, traduciErrore } from "@/model/shared/errorMessages";

/** Where Supabase sends the browser back after the Google login. */
export function redirectLogin(): string {
  return AuthSession.makeRedirectUri({ scheme: "ripassa" });
}

/**
 * Login error text, with the original error appended when it fell through to
 * the generic fallback.
 *
 * "Operazione non riuscita, riprova" is all the user got when the Google
 * login broke on a device — true, and useless: the two halves of the flow
 * (Supabase's OAuth start, then the code exchange) fail for entirely
 * different reasons and the message was identical. `passo` says which half,
 * and the raw text says why, but only when translation had nothing better to
 * offer: a recognized error already reads well and must not be polluted.
 */
export function erroreLogin(e: unknown, passo: string): string {
  const tradotto = traduciErrore(e);
  if (tradotto.categoria !== "sconosciuto") return tradotto.messaggio;
  const dettaglio = dettaglioTecnico(e, 200);
  return dettaglio ? `${tradotto.messaggio}\n\n[${passo}] ${dettaglio}` : tradotto.messaggio;
}

/**
 * Gives a redirect that may still be in flight a moment to land.
 *
 * The browser result and the deep link are two sides of the same native
 * transition and arrive in no guaranteed order, so a dismissal is only really
 * a dismissal once nothing has shown up in the meantime.
 */
export async function attendiRedirect(
  inCorso: () => Promise<boolean> | null,
  attesaMs = 1500
): Promise<boolean> {
  const scadenza = Date.now() + attesaMs;
  for (;;) {
    const scambio = inCorso();
    if (scambio) return scambio;
    if (Date.now() >= scadenza) return false;
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Message for a browser that went away without reaching the redirect. The
 * outcome type is included because it separates the two causes: "dismiss" is
 * the browser closing on its own or the redirect never firing, while "locked"
 * means a previous attempt is still open.
 */
export function erroreBrowserChiuso(esito: string, redirectTo: string): string {
  return (
    `Il browser si è chiuso senza tornare all'app (esito: ${esito}). ` +
    `Verifica che "${redirectTo}" sia fra i Redirect URLs di Supabase e riprova.`
  );
}
