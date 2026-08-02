/**
 * Model layer — parsing of an OAuth redirect URL. Pure logic, no I/O.
 *
 * Deliberately string-based rather than `new URL()`: the redirect uses a
 * custom scheme ("ripassa://…", "com.example.app:/oauthredirect"), which is a
 * non-special URL, and the parameters land in the query string or in the
 * fragment depending on the flow. Parsing by hand keeps both cases working
 * and, above all, cannot throw on a malformed redirect — the caller is on the
 * login path and must be able to report what happened.
 */

/**
 * Parameters carried by a redirect, from both the query string and the
 * fragment. On a duplicate key the first occurrence wins.
 */
export function parametriRedirect(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const inizio = url.search(/[?#]/);
  if (inizio === -1) return out;

  for (const coppia of url.slice(inizio + 1).split(/[&?#]/)) {
    if (coppia === "") continue;
    const separatore = coppia.indexOf("=");
    if (separatore <= 0) continue;
    const chiave = decodeComponente(coppia.slice(0, separatore));
    if (chiave in out) continue;
    out[chiave] = decodeComponente(coppia.slice(separatore + 1));
  }
  return out;
}

/** decodeURIComponent that degrades to the raw value on malformed input. */
function decodeComponente(valore: string): string {
  const conSpazi = valore.replace(/\+/g, " ");
  try {
    return decodeURIComponent(conSpazi);
  } catch {
    return conSpazi;
  }
}
