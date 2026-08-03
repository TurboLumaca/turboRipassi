/**
 * Model layer — pure file utilities (no network or UI dependency).
 */

/**
 * Whether a mime type denotes an image. Single home for a check the repo (to
 * decide on compression), the controller (to decide how to open it) and the
 * View (to decide between thumbnail and icon) all need to agree on.
 */
export function isImmagine(mime: string | null | undefined): boolean {
  return (mime ?? "").startsWith("image/");
}

/** Extension (with dot) from the file name or, failing that, from the mime type. */
export function estensione(name: string, mime?: string | null): string {
  const dot = name.lastIndexOf(".");
  if (dot !== -1 && dot < name.length - 1) return name.slice(dot);
  if (mime === "application/pdf") return ".pdf";
  if (mime === "image/png") return ".png";
  if (mime === "image/jpeg") return ".jpg";
  return "";
}

// Character → value lookup table: much faster than repeated indexOf
// (compressed photos are still hundreds of KB of base64).
const B64_LOOKUP: Int16Array = (() => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < chars.length; i++) table[chars.charCodeAt(i)] = i;
  return table;
})();

/** base64 → Uint8Array, no native dependencies (for direct binary uploads). */
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
