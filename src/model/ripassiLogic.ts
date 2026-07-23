/**
 * Model layer — pure domain logic for classifying and ordering reviews.
 * Extracted from HomeScreen so the rules live next to the data (project rule:
 * the View holds no business logic) and are unit-testable without a device.
 */
import type { Occorrenza, RipassoCompleto } from "./types";

/** True when the occurrence is still pending: not completed and not in the past. */
export function isPendente(o: Occorrenza, ora: number = Date.now()): boolean {
  return !o.is_completed && new Date(o.scheduled_at).getTime() >= ora;
}

/**
 * Next pending occurrence (soonest first). If none is pending, falls back to
 * the chronologically last occurrence, so the UI can still show "when it
 * ended". Returns null only for a ripasso with no occurrences at all.
 */
export function prossimaOccorrenza(
  r: RipassoCompleto,
  ora: number = Date.now()
): Occorrenza | null {
  const pendenti = r.occorrenze
    .filter((o) => isPendente(o, ora))
    .sort(
      (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );
  if (pendenti.length > 0) return pendenti[0];

  const perData = [...r.occorrenze].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
  return perData[perData.length - 1] ?? null;
}

/**
 * A ripasso is "storico" (archived) when nothing is pending: every occurrence
 * is completed or in the past. A ripasso with no occurrences counts as
 * archived — there is nothing left to do.
 */
export function isStorico(r: RipassoCompleto, ora: number = Date.now()): boolean {
  return !r.occorrenze.some((o) => isPendente(o, ora));
}

/**
 * Sort key for a ripasso, in milliseconds. Never NaN: falls back to the next
 * occurrence, then to created_at, then to 0. Keeping this total matters
 * because a NaN key makes the comparator inconsistent and the resulting order
 * unpredictable between renders.
 */
export function chiaveOrdinamento(r: RipassoCompleto, ora: number = Date.now()): number {
  const prossima = prossimaOccorrenza(r, ora);
  const candidati = [prossima?.scheduled_at, r.created_at];
  for (const iso of candidati) {
    if (!iso) continue;
    const t = new Date(iso).getTime();
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

/**
 * Splits reviews into active and archived, each ordered for display:
 * active soonest-first, archived most-recent-first. Ties break on id so the
 * order stays stable across reloads regardless of how the server returned the
 * rows.
 */
export function suddividiRipassi(
  ripassi: RipassoCompleto[],
  ora: number = Date.now()
): { attivi: RipassoCompleto[]; storico: RipassoCompleto[] } {
  const attivi: RipassoCompleto[] = [];
  const storico: RipassoCompleto[] = [];
  for (const r of ripassi) {
    (isStorico(r, ora) ? storico : attivi).push(r);
  }

  attivi.sort((a, b) => {
    const d = chiaveOrdinamento(a, ora) - chiaveOrdinamento(b, ora);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });
  storico.sort((a, b) => {
    const d = chiaveOrdinamento(b, ora) - chiaveOrdinamento(a, ora);
    return d !== 0 ? d : a.id.localeCompare(b.id);
  });

  return { attivi, storico };
}

/** Case-insensitive match on title and notes. Empty query matches everything. */
export function corrispondeRicerca(r: RipassoCompleto, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return (
    r.titolo.toLowerCase().includes(q) || (r.note ?? "").toLowerCase().includes(q)
  );
}
