/**
 * Model layer — pure domain logic for classifying and ordering reviews.
 * Extracted from HomeScreen so the rules live next to the data (project rule:
 * the View holds no business logic) and are unit-testable without a device.
 *
 * The unit the list shows is the *occurrence*, not the ripasso: one study
 * subject comes back five times, and each return is its own line with its own
 * date and its own "done" mark.
 */
import type { Occorrenza, RipassoCompleto } from "../types";

/** One line of the list: an occurrence together with the ripasso it belongs to. */
export interface VoceRipasso {
  ripasso: RipassoCompleto;
  occorrenza: Occorrenza;
}

/**
 * Local midnight of the day containing `t`. Classification works by day, not
 * by instant: a ripasso scheduled for 9:00 is still something to do at 15:00
 * of the same day.
 */
function inizioGiornata(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * True when the occurrence was scheduled on a day before today, which is what
 * moves it out of the main list and into the storico. Completion has no say
 * here: what you did on time and what you let slip are both yesterday's, and
 * the storico filter is where the difference is asked for.
 *
 * A malformed date is not "past": leaving it in the main list keeps it in
 * sight instead of quietly filing it away.
 */
export function isPassata(o: Occorrenza, ora: number = Date.now()): boolean {
  const t = new Date(o.scheduled_at).getTime();
  if (!Number.isFinite(t)) return false;
  return t < inizioGiornata(ora);
}

/**
 * True when the occurrence falls on today's local day. Same day-granularity as
 * `isPassata`: what matters is the day the ripasso lands on, not whether its
 * hour has already gone by. The View uses it to give today's lines their own
 * colour, so a malformed date is not "today" — an unreadable line must not be
 * highlighted as the thing to do now.
 */
export function isOggi(o: Occorrenza, ora: number = Date.now()): boolean {
  const t = new Date(o.scheduled_at).getTime();
  if (!Number.isFinite(t)) return false;
  return inizioGiornata(t) === inizioGiornata(ora);
}

/**
 * Sort key for a line, in milliseconds. Never NaN: falls back to the parent
 * ripasso's creation date, then to 0. Keeping this total matters because a NaN
 * key makes the comparator inconsistent and the resulting order unpredictable
 * between renders.
 */
export function chiaveVoce(v: VoceRipasso): number {
  for (const iso of [v.occorrenza.scheduled_at, v.ripasso.created_at]) {
    if (!iso) continue;
    const t = new Date(iso).getTime();
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

/**
 * Splits every occurrence into the two lists the Home shows: "ripassi" (today
 * and later, soonest first, so the next thing to do sits at the top) and
 * "storico" (earlier days, most recent first). Ties break on the occurrence id
 * so the order stays stable across reloads regardless of how the server
 * returned the rows.
 */
export function suddividiVoci(
  ripassi: RipassoCompleto[],
  ora: number = Date.now()
): { attive: VoceRipasso[]; storico: VoceRipasso[] } {
  const attive: VoceRipasso[] = [];
  const storico: VoceRipasso[] = [];

  for (const ripasso of ripassi) {
    for (const occorrenza of ripasso.occorrenze) {
      const voce = { ripasso, occorrenza };
      (isPassata(occorrenza, ora) ? storico : attive).push(voce);
    }
  }

  attive.sort((a, b) => {
    const d = chiaveVoce(a) - chiaveVoce(b);
    return d !== 0 ? d : a.occorrenza.id.localeCompare(b.occorrenza.id);
  });
  storico.sort((a, b) => {
    const d = chiaveVoce(b) - chiaveVoce(a);
    return d !== 0 ? d : a.occorrenza.id.localeCompare(b.occorrenza.id);
  });

  return { attive, storico };
}

/** The storico filter: only what was never marked as done. */
export function soloDaCompletare(voci: VoceRipasso[]): VoceRipasso[] {
  return voci.filter((v) => !v.occorrenza.is_completed);
}

/** Case-insensitive match on title and notes. Empty query matches everything. */
export function corrispondeRicerca(r: RipassoCompleto, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return (
    r.titolo.toLowerCase().includes(q) || (r.note ?? "").toLowerCase().includes(q)
  );
}
