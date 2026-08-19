/**
 * Model layer — pure domain logic for Pausa Consapevole (Rest & Travel mode).
 * Enables freezing and shifting review schedules by N days without penalties or guilt.
 */
import type { Occorrenza } from "../types";

export interface ConfigurazionePausa {
  attiva: boolean;
  dataInizio?: string; // ISO date string
  dataFine?: string; // ISO date string (if undefined = open-ended manual pause)
  motivo?: string;
}

/**
 * Shifts future and pending occurrences forward by `giorniPausa` days.
 * Completed occurrences are historical records and are never shifted.
 */
export function applicaPausaAOccorrenze(
  occorrenze: readonly Occorrenza[],
  giorniPausa: number
): Occorrenza[] {
  if (giorniPausa <= 0) {
    return [...occorrenze];
  }

  const shiftMs = giorniPausa * 86_400_000;

  return occorrenze.map((o) => {
    if (o.is_completed) {
      return o;
    }

    const t = new Date(o.scheduled_at).getTime();
    if (!Number.isFinite(t)) {
      return o;
    }

    const nuovaData = new Date(t + shiftMs);
    return {
      ...o,
      scheduled_at: nuovaData.toISOString(),
    };
  });
}

/**
 * Computes elapsed days since `dataInizio` (minimum 1 day).
 */
export function calcolaGiorniTrascorsi(
  dataInizio: string,
  dataRiferimento: Date = new Date()
): number {
  const startMs = new Date(dataInizio).getTime();
  if (!Number.isFinite(startMs)) return 1;

  const deltaMs = dataRiferimento.getTime() - startMs;
  return Math.max(1, Math.ceil(deltaMs / 86_400_000));
}

/**
 * Checks whether the pause is actively running at `dataRiferimento`.
 */
export function isPausaAttiva(
  config: ConfigurazionePausa,
  dataRiferimento: Date = new Date()
): boolean {
  if (!config.attiva) return false;
  if (!config.dataFine) return true;

  const endMs = new Date(config.dataFine).getTime();
  if (!Number.isFinite(endMs)) return true;

  return dataRiferimento.getTime() <= endMs;
}

export type TipoDurataPausa = "weekend" | "settimana" | "manuale" | { finoA: Date };

/**
 * Creates a pause configuration for convenient quick presets.
 */
export function creaConfigurazionePausa(
  durata: TipoDurataPausa,
  dataRiferimento: Date = new Date()
): ConfigurazionePausa {
  const dataInizio = dataRiferimento.toISOString();

  if (durata === "weekend") {
    const fine = new Date(dataRiferimento.getTime() + 2 * 86_400_000);
    return { attiva: true, dataInizio, dataFine: fine.toISOString(), motivo: "Weekend di riposo" };
  }

  if (durata === "settimana") {
    const fine = new Date(dataRiferimento.getTime() + 7 * 86_400_000);
    return { attiva: true, dataInizio, dataFine: fine.toISOString(), motivo: "Settimana di pausa" };
  }

  if (durata === "manuale") {
    return { attiva: true, dataInizio, dataFine: undefined, motivo: "Pausa aperta" };
  }

  return {
    attiva: true,
    dataInizio,
    dataFine: durata.finoA.toISOString(),
    motivo: "Pausa programmata",
  };
}

/**
 * Completes / resumes from a pause, applying the shift corresponding to actual days elapsed.
 */
export function completaPausa(
  config: ConfigurazionePausa,
  occorrenze: readonly Occorrenza[],
  dataRipresa: Date = new Date()
): {
  nuovaConfig: ConfigurazionePausa;
  nuoveOccorrenze: Occorrenza[];
  giorniEffettivi: number;
} {
  const giorniEffettivi = config.dataInizio
    ? calcolaGiorniTrascorsi(config.dataInizio, dataRipresa)
    : 0;

  const nuoveOccorrenze = applicaPausaAOccorrenze(occorrenze, giorniEffettivi);
  const nuovaConfig: ConfigurazionePausa = {
    ...config,
    attiva: false,
  };

  return {
    nuovaConfig,
    nuoveOccorrenze,
    giorniEffettivi,
  };
}
