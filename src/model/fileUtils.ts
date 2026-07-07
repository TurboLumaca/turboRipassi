/**
 * Model layer — utilità pure sui file (nessuna dipendenza da rete o UI).
 */

/** Estensione (con punto) da nome file o, in mancanza, dal mime type. */
export function estensione(name: string, mime?: string | null): string {
  const dot = name.lastIndexOf(".");
  if (dot !== -1 && dot < name.length - 1) return name.slice(dot);
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  return "";
}

// Tabella di lookup carattere→valore: molto più veloce di indexOf ripetuto
// (le foto compresse sono comunque centinaia di KB di base64).
const B64_LOOKUP: Int16Array = (() => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < chars.length; i++) table[chars.charCodeAt(i)] = i;
  return table;
})();

/** base64 → Uint8Array, senza dipendenze native (per l'upload su Storage). */
export function decodeBase64(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, "");
  const len = clean.length;
  const bytes: number[] = [];
  for (let i = 0; i < len; i += 4) {
    const e1 = B64_LOOKUP[clean.charCodeAt(i)];
    const e2 = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const e3 = i + 2 < len ? B64_LOOKUP[clean.charCodeAt(i + 2)] : -1;
    const e4 = i + 3 < len ? B64_LOOKUP[clean.charCodeAt(i + 3)] : -1;
    bytes.push((e1 << 2) | (e2 >> 4));
    if (e3 !== -1) bytes.push(((e2 & 15) << 4) | (e3 >> 2));
    if (e4 !== -1) bytes.push(((e3 & 3) << 6) | e4);
  }
  return new Uint8Array(bytes);
}
