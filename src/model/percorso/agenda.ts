/**
 * Model layer — the things the drawer opens: appointments, courses, goals and
 * the study programmes.
 *
 * None of these has a server yet: the redesign specifies the screens, not an
 * API. They live here as data with the selectors the View needs, so that the
 * day a repository appears only this file changes — the screens already ask
 * their questions in domain terms ("the next appointment", "the goals in
 * progress") rather than reaching into an array.
 */
import { inizioGiornata, mezzanotteLocale } from "@/model/shared/giorni";

/** Short month names for the date block of a card. */
const MESI_BREVI = [
  "GEN",
  "FEB",
  "MAR",
  "APR",
  "MAG",
  "GIU",
  "LUG",
  "AGO",
  "SET",
  "OTT",
  "NOV",
  "DIC",
];

export type StatoAppuntamento = "confermato" | "da-confermare";

export interface Appuntamento {
  id: string;
  /** Local day, YYYY-MM-DD. */
  giorno: string;
  titolo: string;
  /** Free text: "09:00 – 23:30 · Rimini", or the place alone. */
  quando: string;
  stato: StatoAppuntamento;
}

/**
 * The old app printed "Da Definire" as if it were the content of the card. It
 * is not content, it is a state — so it is one here, and the View draws it as
 * a tag instead of as a title.
 */
export const ETICHETTE_APPUNTAMENTO: Record<StatoAppuntamento, string> = {
  confermato: "Confermato",
  "da-confermare": "Orario da confermare",
};

export const APPUNTAMENTI: readonly Appuntamento[] = [
  {
    id: "camp-1",
    giorno: "2026-08-31",
    titolo: "Summer Camp — giornata intera",
    quando: "09:00 – 23:30 · Rimini",
    stato: "da-confermare",
  },
  {
    id: "camp-2",
    giorno: "2026-09-01",
    titolo: "Summer Camp — secondo giorno",
    quando: "09:00 – 23:30 · Rimini",
    stato: "da-confermare",
  },
  {
    id: "tutor",
    giorno: "2026-09-05",
    titolo: "Colloquio con il tutor",
    quando: "17:30 – 18:00 · videochiamata",
    stato: "confermato",
  },
  {
    id: "giorno-1",
    giorno: "2026-09-12",
    titolo: "Primo giorno di corso",
    quando: "09:00 – 13:00 · Rimini",
    stato: "confermato",
  },
];

/** Appointments from today on, soonest first. Unreadable days are dropped. */
export function appuntamentiFuturi(
  ora: number = Date.now(),
  elenco: readonly Appuntamento[] = APPUNTAMENTI
): Appuntamento[] {
  const oggi = inizioGiornata(ora);
  return elenco
    .filter((a) => {
      const t = mezzanotteLocale(a.giorno);
      return Number.isFinite(t) && t >= oggi;
    })
    .sort((a, b) => mezzanotteLocale(a.giorno) - mezzanotteLocale(b.giorno));
}

/**
 * The one appointment the Home shows. The old carousel put four half-cut cards
 * on screen; only the first of them was ever the answer to "what's next".
 */
export function prossimoAppuntamento(
  ora: number = Date.now(),
  elenco: readonly Appuntamento[] = APPUNTAMENTI
): Appuntamento | undefined {
  return appuntamentiFuturi(ora, elenco)[0];
}

/** Day number and short month, for the date block on the left of a card. */
export function giornoEMese(giorno: string): { giorno: string; mese: string } {
  const t = mezzanotteLocale(giorno);
  if (!Number.isFinite(t)) return { giorno: "—", mese: "" };
  const d = new Date(t);
  return { giorno: String(d.getDate()).padStart(2, "0"), mese: MESI_BREVI[d.getMonth()] };
}

// ── Corsi ────────────────────────────────────────────────────────────────

export type StatoCorso = "in-corso" | "disponibile";

export interface Corso {
  id: string;
  stato: StatoCorso;
  titolo: string;
  descrizione: string;
  meta: string;
}

export const CORSI: readonly Corso[] = [
  {
    id: "genio",
    stato: "in-corso",
    titolo: "Genio in 21 giorni",
    descrizione:
      "Lettura veloce, memoria e metodo di studio. Aula di Rimini, tutor Antonio Colucci.",
    meta: "Inizio 12 settembre",
  },
  {
    id: "memoria",
    stato: "disponibile",
    titolo: "Memoria avanzata",
    descrizione:
      "Schedari estesi, palazzi della memoria e applicazione a materie tecniche.",
    meta: "8 incontri · online",
  },
  {
    id: "english",
    stato: "disponibile",
    titolo: "English Genius",
    descrizione:
      "Le tecniche del metodo applicate all’apprendimento della lingua inglese.",
    meta: "12 incontri · online",
  },
];

// ── Obiettivi ────────────────────────────────────────────────────────────

/**
 * A personal target. There is no comparison with anybody: the Classifica was
 * removed as a project constraint, and Obiettivi is where its remains would
 * otherwise have collected — so it carries no points and no position.
 */
export interface Obiettivo {
  id: string;
  titolo: string;
  fatti: number;
  totale: number;
  nota: string;
}

export const OBIETTIVI: readonly Obiettivo[] = [
  {
    id: "libri",
    titolo: "Leggere 12 libri quest’anno",
    fatti: 5,
    totale: 12,
    nota: "Ultimo: “Il nome della rosa”, 4 agosto",
  },
  {
    id: "analisi",
    titolo: "Preparare Analisi II",
    fatti: 18,
    totale: 30,
    nota: "Esame il 14 settembre",
  },
  {
    id: "costanza",
    titolo: "Allenarmi 5 giorni su 7",
    fatti: 4,
    totale: 5,
    nota: "Questa settimana",
  },
];

/** Completion of a goal, 0–100. A zero total is 0%, never a division by zero. */
export function percentualeObiettivo(o: Obiettivo): number {
  if (o.totale <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((o.fatti / o.totale) * 100)));
}

// ── Programmi di studio ──────────────────────────────────────────────────

export interface Programma {
  id: string;
  titolo: string;
  descrizione: string;
  meta: string;
}

export const PROGRAMMI: readonly Programma[] = [
  {
    id: "rimini",
    titolo: "Diventa un genio a Rimini",
    descrizione:
      "Il percorso completo in 21 giorni: lettura veloce, memoria, metodo di studio.",
    meta: "21 giorni · in aula",
  },
  {
    id: "stili",
    titolo: "Gli stili cognitivi",
    descrizione:
      "Riconosci come apprendi e adatta il metodo al tuo modo di ragionare.",
    meta: "4 incontri · online",
  },
  {
    id: "tempio",
    titolo: "Il tempio dello studio",
    descrizione:
      "Organizzazione del tempo, ambiente e sessioni di studio profondo.",
    meta: "6 incontri · online",
  },
];
