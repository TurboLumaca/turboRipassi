/**
 * Model layer — the three phases of the course, and where today falls in them.
 *
 * The redesign's first principle is that time, not content type, is the
 * structure of the app: everything the interface groups, unlocks or hides is
 * decided by which phase the student is in. That decision is made here, once,
 * from two dates — so the View never compares a date to `Date.now()` itself.
 *
 * Phase boundaries are days, not instants: the morning of day 1 and its
 * evening are the same day of course, and a course starting "today" has
 * already started at 00:05. That is why the two date primitives below come
 * from `shared/giorni` and work on local midnights.
 */
import { inizioGiornata, mezzanotteLocale } from "@/model/shared/giorni";

/**
 * Where the student is in the journey.
 *
 * `ospite` is not a moment in time but the absence of an enrolment: it is the
 * lead-gen state, in which only TurboRipassi is usable. It is kept in the same
 * union as the other three because every screen has to answer the same
 * question ("which phase am I drawing?") and a separate boolean would let a
 * caller forget the case.
 */
export type Fase = "ospite" | "pre" | "durante" | "post";

/** The course is 21 days. The name is the product. */
export const DURATA_CORSO = 21;

/** What the app knows about the student's enrolment. */
export interface Iscrizione {
  /**
   * Local day the course starts, as YYYY-MM-DD. `null` means not enrolled,
   * which is the only thing that produces the `ospite` phase.
   */
  inizio: string | null;
  /** Where the course is held. Shown, never used to decide anything. */
  sede?: string;
  /** The tutor's full name, for the Home card. */
  tutor?: string;
}

/** Whole days from local midnight of `giorno` to local midnight of `ora`. */
function giorniTrascorsi(giorno: string, ora: number): number {
  const inizio = mezzanotteLocale(giorno);
  if (!Number.isFinite(inizio)) return NaN;
  return Math.round((inizioGiornata(ora) - inizio) / 86_400_000);
}

/**
 * Which day of the course today is: 1 on the first day, 21 on the last.
 *
 * Returns 0 before the course starts and `DURATA_CORSO + n` after it ends —
 * the caller that needs "how long since it finished" already has it, and the
 * one that only needs "is it over" compares against DURATA_CORSO.
 */
export function giornoDiCorso(iscrizione: Iscrizione, ora: number = Date.now()): number {
  if (!iscrizione.inizio) return 0;
  const trascorsi = giorniTrascorsi(iscrizione.inizio, ora);
  if (!Number.isFinite(trascorsi)) return 0;
  return trascorsi < 0 ? 0 : trascorsi + 1;
}

/**
 * Days left before the course begins. 0 once it has started (or if the date is
 * unreadable — the honest answer to "how long to wait" when we cannot tell is
 * not a negative number).
 */
export function giorniAllInizio(iscrizione: Iscrizione, ora: number = Date.now()): number {
  if (!iscrizione.inizio) return 0;
  const trascorsi = giorniTrascorsi(iscrizione.inizio, ora);
  if (!Number.isFinite(trascorsi)) return 0;
  return trascorsi < 0 ? -trascorsi : 0;
}

/**
 * The phase today falls in.
 *
 * An enrolment with an unreadable start date resolves to `pre`, not to
 * `ospite`: the person *is* enrolled, and showing them the sales pitch because
 * a date failed to parse would be the worse of the two mistakes.
 */
export function faseCorrente(iscrizione: Iscrizione, ora: number = Date.now()): Fase {
  if (!iscrizione.inizio) return "ospite";
  const giorno = giornoDiCorso(iscrizione, ora);
  if (giorno === 0) return "pre";
  return giorno > DURATA_CORSO ? "post" : "durante";
}

/**
 * How many weeks have passed since the course ended. 0 during and before it.
 * Only the maintenance Home shows it ("Settimana 6 dal corso").
 */
export function settimaneDalCorso(iscrizione: Iscrizione, ora: number = Date.now()): number {
  const giorno = giornoDiCorso(iscrizione, ora);
  if (giorno <= DURATA_CORSO) return 0;
  return Math.floor((giorno - DURATA_CORSO) / 7) + 1;
}

/**
 * Is the battery part of the interface right now?
 *
 * Asked in three places (Home, Allenati, notifications) and answered here so
 * they cannot disagree. The battery measures readiness for an event: once the
 * event has happened it would become a score, which is the one thing the
 * redesign removed.
 */
export function batteriaVisibile(fase: Fase): boolean {
  return fase === "pre" || fase === "ospite";
}
