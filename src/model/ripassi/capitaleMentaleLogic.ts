/**
 * Model layer — pure domain logic for Mental Capital & Permanent Knowledge.
 * (Endowment Effect & Identity-Based Habits).
 *
 * Classifies reviews into cognitive maturity levels:
 *  - "nuovo": initial learning (1st-2nd review, interval < 14 days)
 *  - "consolidamento": active consolidation (intervals 2 weeks - 3 months, 2-3 reviews)
 *  - "permanente": long-term permanent asset (interval >= 6 months / 180 days and >= 4 reviews)
 *
 * Everything here is derived from one reading of the occurrences,
 * `progressoMaturazione`: the level, the countdown the card draws, and the
 * spacing story the promotion ceremony tells are the same measurement seen
 * from three distances. They used to be three readings, and three readings of
 * the same rule drift — the card would have promised a promotion the level
 * function refused to grant.
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
/** Completed recalls a concept must have collected to count as permanent. */
export const RICHIAMI_PERMANENTE = 4;

/**
 * How far a concept is along the way to Permanente — the honest pity timer.
 *
 * The loot-box pity timer works because a guaranteed prize sits at the end of
 * a visible countdown; what makes it predatory is that the prize is invented
 * and expires. Here the prize is the concept still being in your head in six
 * months, which is neither invented nor perishable, so the same structure can
 * be shown as it is.
 *
 * The two components are measured differently on purpose and neither is
 * rounded in the app's favour:
 *
 *  - `richiami` counts recalls actually ticked off.
 *  - `giorni` counts days elapsed since the first scheduled occurrence, so it
 *    advances on its own while the app is closed. That is the true and useful
 *    thing to say — the spacing is doing the work, not the opening of the app.
 *
 * Both full does not by itself mean promoted: the rule (unchanged) measures
 * retention up to the *last completed* recall, so a concept reviewed four
 * times in its first month and then left alone has elapsed six months without
 * having been found still there at the end of them. `attendeRichiamoFinale`
 * is that state, and the UI says so rather than showing two full bars beside
 * a badge that never arrives.
 */
export interface ProgressoMaturazione {
  /** Completed recalls so far. */
  richiami: number;
  /** Recalls required for Permanente. */
  richiamiRichiesti: number;
  /** Days elapsed since the first scheduled occurrence. Advances by itself. */
  giorni: number;
  /** Days required for Permanente. */
  giorniRichiesti: number;
  /** Retention actually observed: first scheduled → last completed recall. */
  giorniOsservati: number;
  /** The level this progress amounts to. */
  livello: LivelloConsolidamento;
  /**
   * True when both counters are satisfied but the last recall happened before
   * the six-month mark: one more recall, now, completes the maturation.
   */
  attendeRichiamoFinale: boolean;
  /**
   * The dates of the completed recalls, chronological — the spacing story.
   * Each is capped at `adesso` for the same reason the interval is.
   */
  storia: string[];
}

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
  if (
    occorrenzeCompletate >= RICHIAMI_PERMANENTE &&
    ultimoIntervalloGiorni >= GIORNI_PERMANENTE
  ) {
    return "permanente";
  }
  if (occorrenzeCompletate >= 2 && ultimoIntervalloGiorni >= GIORNI_CONSOLIDAMENTO) {
    return "consolidamento";
  }
  return "nuovo";
}

/** Milliseconds in a day. */
const GIORNO_MS = 1000 * 60 * 60 * 24;

function inGiorni(daMs: number, aMs: number): number {
  if (!Number.isFinite(daMs) || !Number.isFinite(aMs)) return 0;
  return Math.max(0, Math.round((aMs - daMs) / GIORNO_MS));
}

/**
 * The single reading of a concept's occurrences every other function here
 * derives from.
 *
 * The interval that decides the level is measured from the first scheduled
 * occurrence — the study itself — to the last one actually ticked off: the
 * span over which the concept has been brought back and found still there.
 * Occurrences that are merely scheduled contribute nothing; a six-month date
 * on the calendar is a plan, not a retention.
 *
 * A completed occurrence counts no later than `adesso`. Ticking the six-month
 * review off early (or marking a whole ripasso done) leaves its `scheduled_at`
 * in the future, and measuring up to that planned date credited months that
 * have not happened yet — seven notions "stable for six months" in an app a
 * few weeks old. The schema has no completion timestamp, so today is the
 * latest moment the review can honestly be said to have taken place.
 */
export function progressoMaturazione<T extends object>(
  voce: VoceRipassoConOccorrenze<T>,
  adesso: Date = new Date()
): ProgressoMaturazione {
  const vuoto: ProgressoMaturazione = {
    richiami: 0,
    richiamiRichiesti: RICHIAMI_PERMANENTE,
    giorni: 0,
    giorniRichiesti: GIORNI_PERMANENTE,
    giorniOsservati: 0,
    livello: "nuovo",
    attendeRichiamoFinale: false,
    storia: [],
  };

  const occorrenze = voce.occorrenze ?? [];
  if (occorrenze.length === 0) return vuoto;

  const oraMs = adesso.getTime();
  const ordinate = [...occorrenze].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
  const primaData = new Date(ordinate[0].scheduled_at).getTime();
  if (!Number.isFinite(primaData)) return vuoto;

  // Completed recalls, each dated no later than today, chronological.
  const storiaMs = ordinate
    .filter((o) => o.is_completed)
    .map((o) => new Date(o.scheduled_at).getTime())
    .filter((t) => Number.isFinite(t))
    .map((t) => Math.min(t, oraMs))
    .sort((a, b) => a - b);

  const richiami = storiaMs.length;
  // Elapsed time: the half of the countdown that moves while the app is shut.
  const giorni = inGiorni(primaData, oraMs);
  const giorniOsservati =
    richiami === 0 ? 0 : inGiorni(primaData, storiaMs[storiaMs.length - 1]);

  const livello = calcolaLivelloConsolidamento(richiami, giorniOsservati);

  return {
    richiami,
    richiamiRichiesti: RICHIAMI_PERMANENTE,
    giorni,
    giorniRichiesti: GIORNI_PERMANENTE,
    giorniOsservati,
    livello,
    attendeRichiamoFinale:
      livello !== "permanente" &&
      richiami >= RICHIAMI_PERMANENTE &&
      giorni >= GIORNI_PERMANENTE,
    storia: storiaMs.map((t) => new Date(t).toISOString()),
  };
}

/**
 * Consolidation level of one ripasso, read off its occurrences.
 * A thin reading of `progressoMaturazione`, kept as its own name because it is
 * what most callers actually want to ask.
 */
export function calcolaLivelloVoce<T extends object>(
  voce: VoceRipassoConOccorrenze<T>,
  adesso: Date = new Date()
): LivelloConsolidamento {
  return progressoMaturazione(voce, adesso).livello;
}

/**
 * Computes aggregated Mental Capital metrics for a list of reviews.
 */
export function calcolaStatisticheCapitale<T extends object>(
  vociConOccorrenze: VoceRipassoConOccorrenze<T>[],
  adesso: Date = new Date()
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
    const livello = calcolaLivelloVoce(voce, adesso);
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
