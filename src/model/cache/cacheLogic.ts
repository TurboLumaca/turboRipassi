/**
 * Model layer — PURE cache rotation logic (spec section 7).
 * No dependency on SQLite/FileSystem/network: only dates and selection,
 * so it's testable in isolation. I/O lives in localCache.ts.
 *
 * Timezone note: "yesterday/today/tomorrow" are LOCAL device days
 * (not UTC): a review at 1:00 AM must count for the correct local day
 * even when its UTC ISO timestamp falls on the previous day.
 */
import type { Allegato, CacheAllegato, RipassoCompleto } from "../types";

/** Date → YYYY-MM-DD in the device's local timezone. */
export function giornoLocale(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${g}`;
}

/** [yesterday, today, tomorrow] window as a set of local YYYY-MM-DD strings. */
export function finestraGiorni(riferimento = new Date()): Set<string> {
  const giorni = new Set<string>();
  for (let delta = -1; delta <= 1; delta++) {
    const d = new Date(riferimento);
    d.setDate(d.getDate() + delta);
    giorni.add(giornoLocale(d));
  }
  return giorni;
}

/**
 * Attachments of reviews with at least one occurrence in the window (spec 7.2).
 * Attachments belong to the ripasso, so one occurrence inside the window
 * makes all attachments of its ripasso relevant.
 */
export function allegatiInFinestra(
  ripassi: RipassoCompleto[],
  riferimento = new Date()
): Allegato[] {
  const giorni = finestraGiorni(riferimento);
  const out: Allegato[] = [];
  for (const r of ripassi) {
    const rilevante = r.occorrenze.some((o) =>
      giorni.has(giornoLocale(new Date(o.scheduled_at)))
    );
    if (rilevante) out.push(...r.allegati);
  }
  return out;
}

/**
 * Cache rows to delete (spec section 7.3): those whose attachment is NO
 * LONGER in the current window. Deciding by membership (rather than download
 * date) avoids deleting files that are still in the window but were
 * downloaded days ago.
 */
export function righeDaEliminare(
  righe: CacheAllegato[],
  idsInFinestra: Set<string>
): CacheAllegato[] {
  return righe.filter((r) => !idsInFinestra.has(r.allegato_id));
}

/** A temporary file, as the filesystem describes it. */
export interface FileTemporaneo {
  nome: string;
  /** Last modification, in seconds since the epoch (what expo-file-system gives). */
  modificatoSecondi?: number;
}

/** How long a temporary file is kept after its last use. */
export const GIORNI_TEMPORANEI = 7;

/**
 * Which temporary files have outlived their usefulness.
 *
 * These are the copies materialised to open an attachment that is outside the
 * cached window — storico, mostly. Nothing used to remove them: the name is
 * derived from the attachment id, so reopening the same file overwrites it,
 * but every *distinct* attachment ever opened left a PDF or a photo behind for
 * good. The system cache directory is only pruned by the OS under storage
 * pressure, and on Android that moment tends to arrive well after the user has
 * noticed the app taking hundreds of MB.
 *
 * A file with no readable timestamp counts as expired: it cannot be shown to
 * be recent, and keeping it forever is the outcome this exists to prevent.
 */
export function temporaneiScaduti(
  file: FileTemporaneo[],
  ora: number = Date.now(),
  giorni: number = GIORNI_TEMPORANEI
): FileTemporaneo[] {
  const limite = ora - giorni * 24 * 60 * 60 * 1000;
  return file.filter((f) => {
    const t = (f.modificatoSecondi ?? NaN) * 1000;
    return !Number.isFinite(t) || t < limite;
  });
}
