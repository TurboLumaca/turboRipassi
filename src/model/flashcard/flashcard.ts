/**
 * Model layer — flashcards, and the spacing of the words that come back.
 *
 * The same idea as TurboRipassi, applied to vocabulary: what you already know
 * moves away, what you do not returns tomorrow. The three answers are explicit
 * because "I'm not sure" is a real state and folding it into "no" throws away
 * the only information that separates a word being learned from one that never
 * started.
 */

/** The twelve languages of the deck selector. */
export const LINGUE = [
  "Inglese",
  "Francese",
  "Spagnolo",
  "Tedesco",
  "Portoghese",
  "Russo",
  "Cinese",
  "Giapponese",
  "Arabo",
  "Latino",
  "Greco antico",
  "Italiano",
] as const;

export type Lingua = (typeof LINGUE)[number];

export const LINGUA_PREDEFINITA: Lingua = "Inglese";

export function isLingua(v: string): v is Lingua {
  return (LINGUE as readonly string[]).includes(v);
}

export type Risposta = "so" | "incerto" | "non-so";

export const ETICHETTE_RISPOSTA: Record<Risposta, string> = {
  so: "La so",
  incerto: "Non sono sicuro",
  "non-so": "Non la so",
};

/** Answers in the order they are drawn, best first. */
export const RISPOSTE: readonly Risposta[] = ["so", "incerto", "non-so"];

export interface Carta {
  id: string;
  lingua: Lingua;
  fronte: string;
  retro: string;
  /** How many correct answers in a row. Drives the interval. */
  livello: number;
}

/**
 * Days before a card comes back, by level.
 *
 * The last step repeats: past a month the exact interval stops mattering, and
 * a table that keeps doubling would push a word out of reach for a year over
 * one lucky session.
 */
const INTERVALLI = [1, 2, 4, 8, 16, 30] as const;

/** The level after an answer. Never below zero, never above the last step. */
export function livelloDopo(livello: number, risposta: Risposta): number {
  const base = Number.isFinite(livello) ? Math.max(0, Math.round(livello)) : 0;
  if (risposta === "so") return Math.min(INTERVALLI.length - 1, base + 1);
  if (risposta === "incerto") return base;
  return 0;
}

/** Days until the card is due again, after that answer. */
export function giorniAlRitorno(livello: number, risposta: Risposta): number {
  return INTERVALLI[livelloDopo(livello, risposta)];
}

/** A demo deck, until the words come from a server. */
export const MAZZO: readonly Carta[] = [
  { id: "en-1", lingua: "Inglese", fronte: "to overcome", retro: "superare", livello: 1 },
  { id: "en-2", lingua: "Inglese", fronte: "to acknowledge", retro: "riconoscere", livello: 0 },
  { id: "en-3", lingua: "Inglese", fronte: "thorough", retro: "accurato, approfondito", livello: 2 },
  { id: "en-4", lingua: "Inglese", fronte: "to hoard", retro: "accumulare", livello: 0 },
  { id: "en-5", lingua: "Inglese", fronte: "sheer", retro: "puro, assoluto", livello: 3 },
  { id: "fr-1", lingua: "Francese", fronte: "aboutir", retro: "sfociare, riuscire", livello: 0 },
  { id: "fr-2", lingua: "Francese", fronte: "davantage", retro: "di più", livello: 1 },
  { id: "es-1", lingua: "Spagnolo", fronte: "alcanzar", retro: "raggiungere", livello: 0 },
  { id: "es-2", lingua: "Spagnolo", fronte: "el reto", retro: "la sfida", livello: 2 },
  { id: "de-1", lingua: "Tedesco", fronte: "bewältigen", retro: "affrontare, superare", livello: 0 },
];

/** The cards of one language, in the order they are asked. */
export function mazzoDi(lingua: Lingua, carte: readonly Carta[] = MAZZO): Carta[] {
  return carte.filter((c) => c.lingua === lingua);
}

/**
 * How many of that language's cards are due today.
 *
 * Without a per-card due date on the server, "due" means "not yet mastered":
 * anything below the last level. It is the honest reading of the data the app
 * actually has, and it is the number the intro screen shows.
 */
export function daRivedere(lingua: Lingua, carte: readonly Carta[] = MAZZO): number {
  return mazzoDi(lingua, carte).filter((c) => c.livello < INTERVALLI.length - 1).length;
}
