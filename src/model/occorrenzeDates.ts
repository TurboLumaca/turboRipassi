/**
 * Model layer — logica pura di calcolo delle date di ripasso (sezione 5).
 * Nessuna dipendenza da rete o UI: solo funzioni deterministiche sulle date.
 */
import type { OffsetOccorrenza } from "./types";

/** Offset automatici generati sempre alla creazione di un ripasso. */
export const OFFSET_AUTOMATICI: OffsetOccorrenza[] = ["1d", "1w", "1m", "6m"];

/** Applica un offset a una data base, restituendo una nuova Date. */
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
 * Calcola le date di ripasso a partire da una data base.
 * `includi1h` aggiunge l'occorrenza +1 ora (interruttore manuale, sezione 5).
 * Ritorna coppie { offset, scheduled_at ISO, is_manual_1h } pronte per l'insert.
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
