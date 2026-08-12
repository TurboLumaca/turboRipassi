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

/**
 * The four buckets the redesigned list is built out of.
 *
 * A ripasso is only worth anything if it is done on the right day, so the
 * deadline has to *be* the structure of the list rather than a column of text
 * inside it. With twenty rows the old flat list could not answer "what is for
 * today and what have I let slip"; these four groups are that answer.
 */
export type GruppoScadenza = "ritardo" | "oggi" | "settimana" | "avanti";

export const ETICHETTE_SCADENZA: Record<GruppoScadenza, string> = {
  ritardo: "In ritardo",
  oggi: "Oggi",
  settimana: "Questa settimana",
  avanti: "Più avanti",
};

/** The order the groups are drawn in: what is most urgent, first. */
export const ORDINE_SCADENZA: readonly GruppoScadenza[] = [
  "ritardo",
  "oggi",
  "settimana",
  "avanti",
];

/**
 * Which bucket one occurrence falls in.
 *
 * "In ritardo" is the one bucket that asks about completion as well as about
 * the day: a past occurrence already ticked off is finished business and
 * belongs to the storico, while one that was skipped is the first thing the
 * list has to say. An unreadable date lands in "oggi" — in sight, where it can
 * be noticed and fixed, rather than filed under a week that will never come.
 */
export function gruppoScadenza(o: Occorrenza, ora: number = Date.now()): GruppoScadenza {
  const t = new Date(o.scheduled_at).getTime();
  if (!Number.isFinite(t)) return "oggi";

  const oggi = new Date(ora);
  oggi.setHours(0, 0, 0, 0);
  const giorno = new Date(t);
  giorno.setHours(0, 0, 0, 0);

  const delta = Math.round((giorno.getTime() - oggi.getTime()) / 86_400_000);
  if (delta < 0) return "ritardo";
  if (delta === 0) return "oggi";
  return delta <= 7 ? "settimana" : "avanti";
}

/** One heading and the rows under it. */
export interface GruppoRipassi {
  gruppo: GruppoScadenza;
  etichetta: string;
  voci: VoceRipasso[];
}

/**
 * The main list, grouped by deadline. Empty groups are dropped rather than
 * drawn as a heading with nothing under it.
 *
 * Only what is still to do appears: a completed occurrence has no deadline
 * left to miss. The storico tab is where a done row is found again, and it is
 * built by `suddividiVoci`, which splits on the day alone.
 */
export function raggruppaPerScadenza(
  ripassi: RipassoCompleto[],
  ora: number = Date.now()
): GruppoRipassi[] {
  const per: Record<GruppoScadenza, VoceRipasso[]> = {
    ritardo: [],
    oggi: [],
    settimana: [],
    avanti: [],
  };

  for (const ripasso of ripassi) {
    for (const occorrenza of ripasso.occorrenze) {
      if (occorrenza.is_completed) continue;
      per[gruppoScadenza(occorrenza, ora)].push({ ripasso, occorrenza });
    }
  }

  for (const voci of Object.values(per)) {
    voci.sort((a, b) => {
      const d = chiaveVoce(a) - chiaveVoce(b);
      return d !== 0 ? d : a.occorrenza.id.localeCompare(b.occorrenza.id);
    });
  }

  return ORDINE_SCADENZA.filter((g) => per[g].length > 0).map((g) => ({
    gruppo: g,
    etichetta: ETICHETTE_SCADENZA[g],
    voci: per[g],
  }));
}

/** Case-insensitive match on title and notes. Empty query matches everything. */
export function corrispondeRicerca(r: RipassoCompleto, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return (
    r.titolo.toLowerCase().includes(q) || (r.note ?? "").toLowerCase().includes(q)
  );
}
