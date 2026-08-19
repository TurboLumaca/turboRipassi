/**
 * Model layer — pure domain logic for Flashback / "Ricordi" (Apple Memories style).
 * (Bandura Self-Efficacy Theory & Spontaneous Memory Reconsolidation).
 *
 * Identifies reviews created ~1 month, ~6 months, or ~1+ year ago (+/- 2 days tolerance)
 * to provide friction-free validation and long-term recall without mandatory testing.
 */
import type { Occorrenza, RipassoCompleto } from "../types";
import type { VoceRipasso } from "./ripassiLogic";

export type TraguardoFlashback = "1_mese" | "6_mesi" | "1_anno" | "x_anni";

export interface FlashbackItem {
  voceId: string;
  titolo: string;
  anteprima: string;
  dataCreazioneOriginale: string;
  traguardo: TraguardoFlashback;
  giorniTrascorsi: number;
}

export type ElementoConData =
  | RipassoCompleto
  | VoceRipasso
  | {
      id: string;
      titolo: string;
      note?: string | null;
      created_at: string;
      occorrenze?: Occorrenza[];
    };

/** Normalized extraction of ripasso fields. */
function estraiDati(elemento: ElementoConData): {
  id: string;
  titolo: string;
  note: string | null;
  created_at: string;
} {
  if ("ripasso" in elemento && elemento.ripasso) {
    return {
      id: elemento.ripasso.id,
      titolo: elemento.ripasso.titolo,
      note: elemento.ripasso.note,
      created_at: elemento.ripasso.created_at,
    };
  }
  const r = elemento as {
    id: string;
    titolo: string;
    note?: string | null;
    created_at: string;
  };
  return {
    id: r.id,
    titolo: r.titolo,
    note: r.note ?? null,
    created_at: r.created_at,
  };
}

/** Midnight timestamp for day-level comparisons. */
function inizioGiorno(d: Date): number {
  const copia = new Date(d.getTime());
  copia.setHours(0, 0, 0, 0);
  return copia.getTime();
}

/**
 * Calculates whether the elapsed days match one of the milestone windows (+/- 2 days).
 */
export function calcolaTraguardo(giorniTrascorsi: number): TraguardoFlashback | null {
  // 1 month window (30 +/- 2 days: 28..32)
  if (giorniTrascorsi >= 28 && giorniTrascorsi <= 32) {
    return "1_mese";
  }
  // 6 months window (180 +/- 2 days: 178..182)
  if (giorniTrascorsi >= 178 && giorniTrascorsi <= 182) {
    return "6_mesi";
  }
  // 1 year window (365 +/- 2 days: 363..367)
  if (giorniTrascorsi >= 363 && giorniTrascorsi <= 367) {
    return "1_anno";
  }
  // Multi-year window (2+ years)
  if (giorniTrascorsi >= 728) {
    const anni = Math.round(giorniTrascorsi / 365);
    const targetGiorni = anni * 365;
    if (Math.abs(giorniTrascorsi - targetGiorni) <= 2) {
      return "x_anni";
    }
  }
  return null;
}

/** Priority weight: older memories have higher display priority. */
const PESO_TRAGUARDO: Record<TraguardoFlashback, number> = {
  x_anni: 4,
  "1_anno": 3,
  "6_mesi": 2,
  "1_mese": 1,
};

/**
 * Formats a user-facing Italian label for the memory milestone.
 */
export function etichettaTraguardo(
  traguardo: TraguardoFlashback,
  giorniTrascorsi: number = 30
): string {
  switch (traguardo) {
    case "1_mese":
      return "Esattamente 1 mese fa";
    case "6_mesi":
      return "Esattamente 6 mesi fa";
    case "1_anno":
      return "Esattamente 1 anno fa";
    case "x_anni": {
      const anni = Math.max(2, Math.round(giorniTrascorsi / 365));
      return `Esattamente ${anni} anni fa`;
    }
  }
}

/**
 * Searches across reviews for a candidate created ~30, ~180, or ~365+ days ago.
 * Excludes reviews already shown/dismissed today.
 */
export function trovaFlashbackDelGiorno(
  voci: ElementoConData[],
  dataRiferimento: Date = new Date(),
  vociGiaMostrateOggiIds: string[] = []
): FlashbackItem | null {
  const oggiTimestamp = inizioGiorno(dataRiferimento);
  const giaMostrati = new Set(vociGiaMostrateOggiIds);

  const candidati: FlashbackItem[] = [];

  for (const el of voci) {
    const { id, titolo, note, created_at } = estraiDati(el);
    if (!id || giaMostrati.has(id)) continue;

    const dataCreazione = new Date(created_at);
    if (!Number.isFinite(dataCreazione.getTime())) continue;

    const creazioneTimestamp = inizioGiorno(dataCreazione);
    const giorniTrascorsi = Math.round(
      (oggiTimestamp - creazioneTimestamp) / (86_400_000)
    );

    if (giorniTrascorsi <= 0) continue;

    const traguardo = calcolaTraguardo(giorniTrascorsi);
    if (traguardo) {
      const anteprima = note && note.trim().length > 0
        ? (note.trim().length > 120 ? `${note.trim().slice(0, 117)}…` : note.trim())
        : "Nozione custodita nella tua memoria.";

      candidati.push({
        voceId: id,
        titolo,
        anteprima,
        dataCreazioneOriginale: created_at,
        traguardo,
        giorniTrascorsi,
      });
    }
  }

  if (candidati.length === 0) return null;

  // Sort candidates by priority (older milestone first, then most days elapsed)
  candidati.sort((a, b) => {
    const pesoDiff = PESO_TRAGUARDO[b.traguardo] - PESO_TRAGUARDO[a.traguardo];
    if (pesoDiff !== 0) return pesoDiff;
    return b.giorniTrascorsi - a.giorniTrascorsi;
  });

  return candidati[0];
}
