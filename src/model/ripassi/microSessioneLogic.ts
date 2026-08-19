/**
 * Model layer — pure domain logic for Micro-Sessioni (Quick Reviews / 60s coffee break).
 * Implements low-friction retrieval practice based on the Fogg Behavior Model.
 */
import type { RipassoCompleto } from "../types";
import type { VoceRipasso } from "./ripassiLogic";
import { calcolaPrioritaRipasso } from "./reschedulingLogic";

export interface ConfigMicroSessione {
  /** Number of items to select for the quick session (default: 2). */
  limiteElementi?: number;
}

/**
 * Pure function: selects the highest priority uncompleted items for a quick 60-second review.
 *
 * Priority strategy:
 * 1. Uncompleted occurrences scheduled for today or overdue, ordered by memory decay urgency.
 * 2. If fewer than `limiteElementi` are due today, fills remaining slots with upcoming uncompleted items
 *    ordered by soonest scheduled date (allowing on-demand quick review anytime).
 *
 * Deterministic and free of mutations or side effects.
 */
export function selezionaElementiMicroSessione(
  ripassi: readonly RipassoCompleto[],
  config?: ConfigMicroSessione,
  ora: Date = new Date()
): VoceRipasso[] {
  const limite = Math.max(1, config?.limiteElementi ?? 2);
  const fineOggi = new Date(ora);
  fineOggi.setHours(23, 59, 59, 999);
  const fineOggiMs = fineOggi.getTime();

  const inScadenzaVoci: { voce: VoceRipasso; priorita: number }[] = [];
  const futureVoci: { voce: VoceRipasso; dataMs: number }[] = [];

  for (const ripasso of ripassi) {
    for (const occorrenza of ripasso.occorrenze) {
      if (occorrenza.is_completed) continue;

      const schedTime = new Date(occorrenza.scheduled_at).getTime();
      if (!Number.isFinite(schedTime)) continue;

      const voce: VoceRipasso = { ripasso, occorrenza };

      if (schedTime <= fineOggiMs) {
        // Overdue or due today
        const priorita = calcolaPrioritaRipasso(occorrenza, ora);
        inScadenzaVoci.push({ voce, priorita });
      } else {
        // Future upcoming item
        futureVoci.push({ voce, dataMs: schedTime });
      }
    }
  }

  // Sort due items by highest priority score
  inScadenzaVoci.sort((a, b) => {
    const d = b.priorita - a.priorita;
    if (d !== 0) return d;
    return a.voce.occorrenza.id.localeCompare(b.voce.occorrenza.id);
  });

  const selezionati: VoceRipasso[] = inScadenzaVoci
    .slice(0, limite)
    .map((item) => item.voce);

  // If we still have slots open, fill with soonest future items
  if (selezionati.length < limite) {
    futureVoci.sort((a, b) => {
      const d = a.dataMs - b.dataMs;
      if (d !== 0) return d;
      return a.voce.occorrenza.id.localeCompare(b.voce.occorrenza.id);
    });

    const rimanenti = limite - selezionati.length;
    for (let i = 0; i < Math.min(rimanenti, futureVoci.length); i++) {
      selezionati.push(futureVoci[i].voce);
    }
  }

  return selezionati;
}

/**
 * Appends a micro-note to existing notes cleanly.
 */
export function aggiungiMicroNota(
  noteEsistenti: string | null,
  nuovaMicroNota: string
): string {
  const notaPulita = nuovaMicroNota.trim();
  if (!notaPulita) return noteEsistenti ?? "";
  if (!noteEsistenti || !noteEsistenti.trim()) return notaPulita;
  return `${noteEsistenti.trim()}\n\n• ${notaPulita}`;
}
