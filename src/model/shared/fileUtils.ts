/**
 * Model layer — pure file utilities (no network or UI dependency).
 */

/**
 * Whether a mime type denotes an image. Single home for a check the repo (to
 * decide on compression), the controller (to decide how to open it) and the
 * View (to decide between thumbnail and icon) all need to agree on.
 */
/**
 * Subfolder of the system cache directory holding the temporary copies made
 * to open an attachment outside the cached window.
 *
 * A folder of their own rather than a `tmp-` prefix loose in the cache
 * directory: pruning them then means listing a directory that contains
 * nothing else, instead of filtering by a naming convention two modules have
 * to agree on. Declared here because the repo writes them and the cache
 * prunes them, and neither should import the other.
 */
export const SOTTOCARTELLA_TEMPORANEI = "allegati-tmp/";

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
