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

/** Retention interval a concept must have survived to count as permanent. */
export const GIORNI_PERMANENTE = 180;
/** Retention interval that opens the consolidation stage. */
export const GIORNI_CONSOLIDAMENTO = 14;

/**
 * Classifies the consolidation stage of a concept from the number of completed
 * repetitions *and* the retention interval those repetitions actually spanned.
 *
 * Both conditions are required, and that is the whole point. The rule used to
 * be an OR, so four ticks in one afternoon bought a concept the "stabile a
 * lungo termine" badge — an app one month old was reporting knowledge it had
 * had no time to observe surviving, which is exactly the claim the card
 * exists to make. Retention is a statement about elapsed time: no number of
 * repetitions can stand in for six months not yet passed, and no amount of
 * elapsed time can stand in for reviews never done.
 *
 * - "permanente": >= 4 completed reviews AND >= 180 days (6 months) spanned.
 * - "consolidamento": >= 2 completed reviews AND >= 14 days spanned.
 * - "nuovo": everything else.
 */
export function calcolaLivelloConsolidamento(
  occorrenzeCompletate: number,
  ultimoIntervalloGiorni: number
): LivelloConsolidamento {
  if (occorrenzeCompletate >= 4 && ultimoIntervalloGiorni >= GIORNI_PERMANENTE) {
    return "permanente";
  }
  if (occorrenzeCompletate >= 2 && ultimoIntervalloGiorni >= GIORNI_CONSOLIDAMENTO) {
    return "consolidamento";
  }
  return "nuovo";
}

/**
 * Consolidation level of one ripasso, read off its occurrences.
 *
 * The interval measured is the distance from the first scheduled occurrence —
 * the study itself — to the last one actually ticked off: the span over which
 * the concept has been brought back and found still there. Occurrences that
 * are merely scheduled contribute nothing; a six-month date on the calendar is
 * a plan, not a retention.
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
