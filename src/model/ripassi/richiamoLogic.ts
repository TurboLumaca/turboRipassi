/**
 * Model layer — il richiamo: che cosa succede quando si spunta un concetto.
 *
 * È l'intervento strutturale del question-first: il tondino della lista non è
 * più un interruttore, è un richiamo. Il fallimento silenzioso delle app a
 * checkbox è lo *zombie-completion* — si spuntano voci senza richiamare
 * niente, e la spunta diventa un premio slegato dall'apprendimento. Qui la
 * spunta passa da una domanda, e quindi non è più "vincere il meccanismo":
 * non si può completare senza aver provato a ricordare.
 *
 * Il modulo è puro: sa che cosa mostrare, con che parole e quando torna il
 * concetto. Chi scrive sul server è il Controller.
 */
import type { RipassoCompleto } from "../types";

/** Le due risposte possibili alla domanda, dopo aver visto la risposta. */
export type EsitoRichiamo = "ricordato" | "parziale";

/**
 * I passi della micro-sheet, nell'ordine in cui si attraversano.
 *
 * `domanda` è il momento che fa il lavoro: la risposta è nascosta e il
 * curiosity gap (Loewenstein) resta aperto finché non si è provato a
 * colmarlo da soli. Saltarlo è possibile, ma solo con un gesto diverso
 * (long-press), mai per distrazione.
 */
export type PassoRichiamo = "domanda" | "risposta" | "esito";

/**
 * Giorni dopo i quali un concetto richiamato solo in parte torna in lista.
 *
 * Tre e non uno: un errore ripresentato il giorno dopo è ripetizione massiva,
 * che dà la sensazione di aver imparato senza l'apprendimento (Bjork). Tre e
 * non sette: il richiamo fallito ha appena aperto la finestra in cui il
 * feedback vale di più.
 */
export const GIORNI_RIENTRO_ERRORE = 3;

/**
 * La domanda da porre per un concetto.
 *
 * Quando l'utente non ne ha scritta una — e all'inizio non l'avrà fatto per
 * nessuno dei concetti già esistenti — non se ne inventa una: si chiede la
 * cosa vera, cioè di richiamare quel che si sa del titolo. È più debole di
 * una domanda scritta bene, ed è il motivo per cui il form ne chiede una.
 */
export function domandaDi(ripasso: Pick<RipassoCompleto, "titolo" | "domanda">): string {
  const scritta = (ripasso.domanda ?? "").trim();
  if (scritta !== "") return scritta;
  return `Che cosa ricordi di «${ripasso.titolo}»?`;
}

/** True quando la domanda mostrata è quella scritta dall'utente. */
export function haDomandaPropria(
  ripasso: Pick<RipassoCompleto, "domanda">
): boolean {
  return (ripasso.domanda ?? "").trim() !== "";
}

/**
 * Le frasi dell'errore produttivo (M2 trasfigurato).
 *
 * Variano nella forma e mai nella sostanza, ed è la distinzione che separa
 * questo dal near-miss delle slot: il near-miss simula una quasi-vittoria che
 * non c'è stata, questo riferisce un fatto documentato — i tentativi di
 * richiamo falliti seguiti da feedback producono apprendimento quanto i
 * successi (Kornell, Hays & Bjork, 2009). La palette è neutra-calda e non
 * rossa perché non è una colpa: è la parte dello studio che funziona.
 */
export const FRASI_ERRORE_PRODUTTIVO: readonly string[] = [
  "Un richiamo mancato con feedback rafforza la memoria quanto uno riuscito. Questo tentativo ha appena reso più forte il prossimo.",
  "Provare e non arrivarci prepara il terreno: è il momento in cui la risposta si fissa meglio di quando la rileggi soltanto.",
  "Questo è il tipo di errore che serve. Averci provato prima di vedere la risposta è ciò che la rende difficile da perdere.",
];

/** Le frasi della cerimonia di promozione: certe nella consegna, varie nella forma. */
export const FRASI_PROMOZIONE: readonly string[] = [
  "Questo ora è tuo per sempre.",
  "Sei riuscito a tenerlo per sei mesi.",
  "Non è più una cosa che hai studiato: è una cosa che sai.",
  "Sei mesi dopo, era ancora lì.",
];

/**
 * Sceglie una frase da una rotazione in modo deterministico.
 *
 * Deterministico e non casuale per una ragione precisa: una frase estratta a
 * caso a ogni render è una ricompensa a rapporto variabile, cioè esattamente
 * la meccanica che questo documento scarta. Legata all'id del concetto, la
 * varietà resta (concetti diversi dicono cose diverse) senza che ci sia nulla
 * da rigiocare.
 */
export function frasePerConcetto(frasi: readonly string[], seme: string): string {
  if (frasi.length === 0) return "";
  let acc = 0;
  for (let i = 0; i < seme.length; i++) acc = (acc * 31 + seme.charCodeAt(i)) >>> 0;
  return frasi[acc % frasi.length];
}

/** Quando torna in lista un concetto richiamato solo in parte. */
export function rientroDopoErrore(adesso: Date = new Date()): Date {
  const d = new Date(adesso.getTime());
  d.setDate(d.getDate() + GIORNI_RIENTRO_ERRORE);
  return d;
}

/**
 * Come si legge la riprogrammazione, in chiaro.
 *
 * Lo scheduling lo farebbe comunque; dirlo è la scelta di design. Il
 * desiderio che ne nasce è per il prossimo incontro con *quel* concetto —
 * dove serve che sia — e non per la prossima apertura dell'app.
 */
export function testoRientro(quando: Date, adesso: Date = new Date()): string {
  const giorni = Math.max(
    1,
    Math.round((quando.getTime() - adesso.getTime()) / 86_400_000)
  );
  return giorni === 1 ? "Rientra domani." : `Rientra fra ${giorni} giorni.`;
}
