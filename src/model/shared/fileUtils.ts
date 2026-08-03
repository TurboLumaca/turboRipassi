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
