/**
 * Model layer — pure logic for computing review dates (spec section 5).
 * No network or UI dependency: only deterministic date functions.
 */
import type { OffsetOccorrenza } from "./types";

/** Automatic offsets always generated when a ripasso is created. */
export const OFFSET_AUTOMATICI: OffsetOccorrenza[] = ["1d", "1w", "1m", "6m"];

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
 * Computes review dates starting from a base date.
 * `includi1h` adds the +1 hour occurrence (manual toggle, spec section 5).
 * Returns { offset, scheduled_at ISO, is_manual_1h } tuples ready for insert.
 */
export function calcolaOccorrenze(
  base: Date,
  includi1h: boolean
): { offset: OffsetOccorrenza; scheduled_at: string; is_manual_1h: boolean }[] {
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
