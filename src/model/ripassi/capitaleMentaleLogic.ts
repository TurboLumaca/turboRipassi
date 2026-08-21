/**
 * Model layer — pure domain logic for Mental Capital & Permanent Knowledge.
 * (Endowment Effect & Identity-Based Habits).
 *
 * Classifies reviews into cognitive maturity levels:
 *  - "nuovo": initial learning (1st-2nd review, interval < 14 days)
 *  - "consolidamento": active consolidation (intervals 2 weeks - 3 months, 2-3 reviews)
 *  - "permanente": long-term permanent asset (interval >= 6 months / 180 days or >= 4 reviews)
 */
import type { Occorrenza } from "../types";

export type LivelloConsolidamento = "nuovo" | "consolidamento" | "permanente";

export interface StatisticheCapitaleMentale {
  totaleVoci: number;
  totalePermanenti: number;
  totaleInConsolidamento: number;
  totaleNuovi: number;
  percentualePermanente: number;
}

/** Minimal structure needed to evaluate a review's consolidation status. */
export type VoceRipassoConOccorrenze<T extends object = object> = T & {
  id?: string;
  occorrenze: Pick<Occorrenza, "scheduled_at" | "is_completed">[];
};

/**
 * Classifies the consolidation stage of a concept based on the number
 * of completed repetitions and the interval in days of the latest completed review.
 *
 * Default rule:
 * - "permanente": interval >= 180 days (6 months) OR >= 4 completed review cycles.
 * - "consolidamento": interval >= 14 days (2 weeks) OR >= 2 completed reviews.
 * - "nuovo": fewer than 2 reviews and interval < 14 days.
 */
export function calcolaLivelloConsolidamento(
  occorrenzeCompletate: number,
  ultimoIntervalloGiorni: number
): LivelloConsolidamento {
  if (occorrenzeCompletate >= 4 || ultimoIntervalloGiorni >= 180) {
    return "permanente";
  }
  if (occorrenzeCompletate >= 2 || ultimoIntervalloGiorni >= 14) {
    return "consolidamento";
  }
  return "nuovo";
}

/**
 * Helper to compute the consolidation level directly from a review item's occurrences.
 */
export function calcolaLivelloVoce<T extends object>(
  voce: VoceRipassoConOccorrenze<T>
): LivelloConsolidamento {
  if (!voce.occorrenze || voce.occorrenze.length === 0) {
    return "nuovo";
  }

  const completate = voce.occorrenze.filter((o) => o.is_completed);
  if (completate.length === 0) {
    return "nuovo";
  }

  // Sort occurrences chronologically to determine span
  const ordinate = [...voce.occorrenze].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
  const primaData = new Date(ordinate[0].scheduled_at).getTime();

  // Find the latest completed occurrence
  const completateOrdinate = [...completate].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
  const ultimaCompletataData = new Date(
    completateOrdinate[completateOrdinate.length - 1].scheduled_at
  ).getTime();

  const intervalloGiorni = Number.isFinite(primaData) && Number.isFinite(ultimaCompletataData)
    ? Math.max(0, Math.round((ultimaCompletataData - primaData) / (1000 * 60 * 60 * 24)))
    : 0;

  return calcolaLivelloConsolidamento(completate.length, intervalloGiorni);
}

/**
 * Computes aggregated Mental Capital metrics for a list of reviews.
 */
export function calcolaStatisticheCapitale<T extends object>(
  vociConOccorrenze: VoceRipassoConOccorrenze<T>[]
): StatisticheCapitaleMentale {
  const totaleVoci = vociConOccorrenze.length;
  if (totaleVoci === 0) {
    return {
      totaleVoci: 0,
      totalePermanenti: 0,
      totaleInConsolidamento: 0,
      totaleNuovi: 0,
      percentualePermanente: 0,
    };
  }

  let totalePermanenti = 0;
  let totaleInConsolidamento = 0;
  let totaleNuovi = 0;

  for (const voce of vociConOccorrenze) {
    const livello = calcolaLivelloVoce(voce);
    if (livello === "permanente") {
      totalePermanenti += 1;
    } else if (livello === "consolidamento") {
      totaleInConsolidamento += 1;
    } else {
      totaleNuovi += 1;
    }
  }

  const percentualePermanente = Math.round((totalePermanenti / totaleVoci) * 100);

  return {
    totaleVoci,
    totalePermanenti,
    totaleInConsolidamento,
    totaleNuovi,
    percentualePermanente,
  };
}
