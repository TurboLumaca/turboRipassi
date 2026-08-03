/**
 * Model — OAuth authorization codes that have already been spent.
 *
 * Both OAuth flows in this app (identity login through Supabase, and Drive
 * access through Google) face the same problem: an authorization code is
 * single-use, and the redirect that carries it can reach the app twice — once
 * as the result of the browser session, once as a deep link — with no
 * guaranteed order. Whichever arrives second must recognise the code as
 * already handled instead of exchanging it again and failing.
 *
 * The two flows used to keep a Set each, with different lifetimes: one tied to
 * a React component, one living forever in a module and never cleared, not
 * even on logout. One primitive now, with a bound on how much it remembers —
 * only the most recent codes can plausibly still be in flight.
 */

/** Enough for any redirect still in flight; anything older cannot come back. */
const MASSIMO_RICORDATI = 20;

const usati: string[] = [];

/**
 * Records a code as used and reports whether it already was.
 *
 * Returns true when the code had been seen before, i.e. "someone else is
 * already dealing with this one".
 */
export function marcaUsato(code: string): boolean {
  if (usati.includes(code)) return true;
  usati.push(code);
  if (usati.length > MASSIMO_RICORDATI) usati.shift();
  return false;
}

/** Forgets every code. Part of logging out and of revoking Drive access. */
export function dimenticaCodiciUsati(): void {
  usati.length = 0;
}
