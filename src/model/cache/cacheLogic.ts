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
 * The ripassi with an occurrence in the window, in the order they were given.
 *
 * The window is a fact about days, and which ripassi fall in it is the same
 * question `allegatiInFinestra` already answers — but asked about the ripassi
 * themselves, because "which of the next three days' ripassi can I not open on
 * a train" is a question about ripassi, not about files.
 */
export function ripassiInFinestra(
  ripassi: RipassoCompleto[],
  riferimento = new Date()
): RipassoCompleto[] {
  const giorni = finestraGiorni(riferimento);
  return ripassi.filter((r) =>
    r.occorrenze.some((o) => giorni.has(giornoLocale(new Date(o.scheduled_at))))
  );
}

/** A ripasso of the window that cannot be read in full without a connection. */
export interface RipassoNonDisponibile {
  id: string;
  titolo: string;
  /** How many of its attachments are not on the device. */
  mancanti: number;
  /** How many it has in total, so the View can say "2 di 3". */
  totali: number;
}

/**
 * Which of the window's ripassi are not fully readable offline.
 *
 * Answered from what is actually on the device — the ids the cache holds —
 * rather than from how the last rotation went. The two differ more often than
 * it looks: a rotation that has not run yet, one that ran before a ripasso was
 * added this morning, or one interrupted halfway all leave attachments missing
 * that no failure was ever recorded for. Reporting the rotation's failures
 * counted those as available, which is the one direction the answer must never
 * be wrong in: it is read on a train, and being told a file is there when it is
 * not is worse than not being told at all.
 *
 * A ripasso with no attachments is never listed. There is nothing to download,
 * so it is already entirely readable offline — the title, the notes and the
 * dates come from the saved list.
 */
export function ripassiNonDisponibili(
  ripassi: RipassoCompleto[],
  idsDisponibili: Set<string>,
  riferimento = new Date()
): RipassoNonDisponibile[] {
  const out: RipassoNonDisponibile[] = [];
  for (const r of ripassiInFinestra(ripassi, riferimento)) {
    if (r.allegati.length === 0) continue;
    const mancanti = r.allegati.filter((a) => !idsDisponibili.has(a.id)).length;
    if (mancanti > 0) {
      out.push({ id: r.id, titolo: r.titolo, mancanti, totali: r.allegati.length });
    }
  }
  return out;
}

/**
 * Cache rows to delete (spec section 7.3): those whose attachment is NO
 * LONGER in the current window. Deciding by membership (rather than download
 * date) avoids deleting files that are still in the window but were
 * downloaded days ago.
 *
 * `idsProtetti` are attachments whose only copy is the one on this device —
 * files picked while offline and still queued for Drive. They are in the cache
 * so they can be opened like any other, but they cannot be re-fetched: deleting
 * one because its ripasso happens to fall outside the window would destroy the
 * photo the user took this morning, minutes before the upload that was going
 * to save it.
 */
export function righeDaEliminare(
  righe: CacheAllegato[],
  idsInFinestra: Set<string>,
  idsProtetti: Set<string> = new Set()
): CacheAllegato[] {
  return righe.filter(
    (r) => !idsInFinestra.has(r.allegato_id) && !idsProtetti.has(r.allegato_id)
  );
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
