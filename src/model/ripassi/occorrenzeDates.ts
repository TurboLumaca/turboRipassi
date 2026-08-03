/**
 * Model layer — pure logic for computing review dates (spec section 5).
 * No network or UI dependency: only deterministic date functions.
 */
import type { OffsetOccorrenza } from "../types";

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

export const ETICHETTE_OFFSET: Record<OffsetOccorrenza, string> = {
  "1h": "+1 ora",
  "1d": "+1 giorno",
  "1w": "+1 settimana",
  "1m": "+1 mese",
  "6m": "+6 mesi",
};
