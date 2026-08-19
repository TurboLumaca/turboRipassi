/**
 * Model layer — pure domain logic for Study Time Saved (Ebbinghaus Savings Method).
 *
 * Quantifies cognitive ROI by calculating the difference between the time needed
 * to research and relearn a forgotten topic from scratch (default 20 min) vs.
 * the total time spent in spaced micro-reviews (0.5 min per review).
 */
import type { VoceRipassoConOccorrenze } from "./capitaleMentaleLogic";

export const MINUTI_STUDIO_INIZIALE_DEFAULT = 20;
export const MINUTI_SINGOLO_RIPASSO_DEFAULT = 0.5;

export interface RisparmioTempoResult {
  minutiTotaliRisparmiati: number;
  oreFormattate: string; // e.g. "45 min", "3 ore", "18.5 ore"
  dettaglioPerVoce: Record<string, number>;
}

/**
 * Formats total saved minutes into human-friendly Italian string ("X min" or "X ore" / "X.X ore").
 */
export function formattaTempoRisparmiato(minutiTotali: number): string {
  const min = Math.max(0, Math.round(minutiTotali * 10) / 10);
  if (min < 60) {
    return `${Math.round(min)} min`;
  }
  const ore = min / 60;
  const arrotondato = Math.round(ore * 10) / 10;
  const str = arrotondato % 1 === 0 ? arrotondato.toFixed(0) : arrotondato.toFixed(1);
  return `${str} ore`;
}

/**
 * Computes study time saved for a list of reviews using the Ebbinghaus Savings Method.
 *
 * Formula for each voice with >= 1 completed reviews:
 *   TempoRisparmiato = max(0, T_studio - (N_completati * T_ripasso))
 */
export function calcolaTempoRisparmiato(
  vociConOccorrenze: VoceRipassoConOccorrenze[],
  tempoStudioMinuti: number = MINUTI_STUDIO_INIZIALE_DEFAULT,
  tempoRipassoMinuti: number = MINUTI_SINGOLO_RIPASSO_DEFAULT
): RisparmioTempoResult {
  let minutiTotali = 0;
  const dettaglioPerVoce: Record<string, number> = {};

  vociConOccorrenze.forEach((voce, index) => {
    const id = voce.id ?? `voce-${index}`;
    const completate = (voce.occorrenze ?? []).filter((o) => o.is_completed).length;

    if (completate > 0) {
      const spesi = completate * tempoRipassoMinuti;
      const risparmiati = Math.max(0, tempoStudioMinuti - spesi);
      dettaglioPerVoce[id] = risparmiati;
      minutiTotali += risparmiati;
    } else {
      dettaglioPerVoce[id] = 0;
    }
  });

  return {
    minutiTotaliRisparmiati: minutiTotali,
    oreFormattate: formattaTempoRisparmiato(minutiTotali),
    dettaglioPerVoce,
  };
}
