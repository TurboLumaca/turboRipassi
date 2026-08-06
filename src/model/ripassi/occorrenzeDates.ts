/**
 * Model layer — pure logic for computing review dates (spec section 5).
 * No network or UI dependency: only deterministic date functions.
 */
import type { Occorrenza, OffsetOccorrenza } from "../types";

/** Automatic offsets always generated when a ripasso is created. */
export const OFFSET_AUTOMATICI: OffsetOccorrenza[] = ["1d", "1w", "1m", "6m"];

/**
 * Chronological comparator, soonest first. Structurally typed on
 * `scheduled_at` so it sorts both stored occurrences and the freshly computed
 * ones, which have no id yet.
 */
export function perDataProgrammata(
  a: { scheduled_at: string },
  b: { scheduled_at: string }
): number {
  return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
}

/** Applies an offset to a base date, returning a new Date. */
export function applicaOffset(base: Date, offset: OffsetOccorrenza): Date {
  const d = new Date(base.getTime());
  switch (offset) {
    case "1h":
      d.setHours(d.getHours() + 1);
      break;
    case "1d":
      d.setDate(d.getDate() + 1);
      break;
    case "1w":
      d.setDate(d.getDate() + 7);
      break;
    case "1m":
      d.setMonth(d.getMonth() + 1);
      break;
    case "6m":
      d.setMonth(d.getMonth() + 6);
      break;
  }
  return d;
}

/**
 * An occurrence that has been computed but not stored yet: no id and no
 * ripasso to belong to. Carries the offset it came from, which the form shows
 * as a label ("+1 settimana") while a stored occurrence only shows its date.
 */
export interface OccorrenzaCalcolata {
  offset: OffsetOccorrenza;
  scheduled_at: string;
  is_manual_1h: boolean;
}

/**
 * Computes review dates starting from a base date.
 * `includi1h` adds the +1 hour occurrence (manual toggle, spec section 5).
 * The result is ready for insert once a ripasso_id and user_id are added.
 */
export function calcolaOccorrenze(
  base: Date,
  includi1h: boolean
): OccorrenzaCalcolata[] {
  const offsets: OffsetOccorrenza[] = includi1h
    ? ["1h", ...OFFSET_AUTOMATICI]
    : [...OFFSET_AUTOMATICI];

  return offsets.map((offset) => ({
    offset,
    scheduled_at: applicaOffset(base, offset).toISOString(),
    is_manual_1h: offset === "1h",
  }));
}

/** A new date to write onto one stored occurrence. */
export interface SpostamentoOccorrenza {
  id: string;
  scheduled_at: string;
}

/**
 * The dates that follow `idModificata`, shifted by the same amount that
 * occurrence is being moved by.
 *
 * The case this exists for: you write down today something you actually
 * studied two days ago. Moving only the first date back leaves the remaining
 * four measured from the wrong day, and the whole schedule silently drifts —
 * the point of the spacing is the distance from the *study*, not from the day
 * you got round to typing it in.
 *
 * The shift is a rigid translation, not a recomputation from the offsets. The
 * two agree whenever the dates were never touched, and where they disagree the
 * translation is the one that is right: a later date the user had already
 * dragged onto a free Sunday keeps its Sunday instead of being overwritten by
 * `base + 1m`. It also needs no record of which offset a row came from, which
 * the schema does not store.
 *
 * Left alone:
 *  - earlier occurrences, which have already happened;
 *  - completed ones, wherever they sit — that you revised on a given day is a
 *    fact about the past, and moving it would falsify the storico;
 *  - anything with an unreadable date, which is skipped rather than turned
 *    into an `Invalid Date` written back to the database.
 */
export function ricalcolaSuccessive(
  occorrenze: readonly Occorrenza[],
  idModificata: string,
  nuovaData: Date
): SpostamentoOccorrenza[] {
  const modificata = occorrenze.find((o) => o.id === idModificata);
  if (!modificata) return [];

  const partenza = new Date(modificata.scheduled_at).getTime();
  const arrivo = nuovaData.getTime();
  if (!Number.isFinite(partenza) || !Number.isFinite(arrivo)) return [];

  const delta = arrivo - partenza;
  if (delta === 0) return [];

  const spostamenti: SpostamentoOccorrenza[] = [];
  for (const o of occorrenze) {
    if (o.id === idModificata || o.is_completed) continue;
    const t = new Date(o.scheduled_at).getTime();
    if (!Number.isFinite(t) || t <= partenza) continue;
    spostamenti.push({ id: o.id, scheduled_at: new Date(t + delta).toISOString() });
  }
  return spostamenti;
}

export const ETICHETTE_OFFSET: Record<OffsetOccorrenza, string> = {
  "1h": "+1 ora",
  "1d": "+1 giorno",
  "1w": "+1 settimana",
  "1m": "+1 mese",
  "6m": "+6 mesi",
};
