/**
 * Model layer — pure domain logic for Graceful Rescheduling.
 * Prevents cognitive overload and performance anxiety by gently smoothing
 * accumulated overdue reviews across upcoming days without modifying legitimate
 * schedules already in place for today or future dates.
 */
import type { Occorrenza, RipassoCompleto } from "../types";

/** Default daily intake quota for recovering overdue reviews. */
export const QUOTA_ARRETRATI_PREDEFINITA = 10;

/**
 * Calculates priority score for an overdue occurrence (higher = more urgent).
 * Occurrences with shorter retention intervals (e.g. 1h, 1d) decay more rapidly
 * and require faster intervention than consolidated multi-month reviews.
 */
export function calcolaPrioritaRipasso(
  o: Occorrenza,
  currentDate: Date = new Date()
): number {
  let score = 0;

  // 1-hour manual items decay rapidly
  if (o.is_manual_1h) {
    score += 1000;
  }

  const schedTime = new Date(o.scheduled_at).getTime();
  const createTime = new Date(o.created_at).getTime();

  if (Number.isFinite(schedTime) && Number.isFinite(createTime)) {
    const intervalloMs = Math.max(1, schedTime - createTime);
    const giorniIntervallo = intervalloMs / 86_400_000;

    // Shorter intervals have higher decay vulnerability
    if (giorniIntervallo <= 1) {
      score += 500;
    } else if (giorniIntervallo <= 7) {
      score += 250;
    } else if (giorniIntervallo <= 30) {
      score += 100;
    }

    // Closer to overdue expiry gets a slight bump
    const ritardoMs = Math.max(0, currentDate.getTime() - schedTime);
    score += Math.max(0, 50 - Math.min(50, Math.floor(ritardoMs / 86_400_000)));
  }

  // Deterministic tie-breaker based on ID hash
  let hash = 0;
  for (let i = 0; i < o.id.length; i++) {
    hash = (hash << 5) - hash + o.id.charCodeAt(i);
    hash |= 0;
  }
  score += (Math.abs(hash) % 100) / 100;

  return score;
}

/**
 * Local midnight of the day containing date `d`.
 */
function inizioGiornata(d: Date): Date {
  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  return res;
}

/**
 * Pure function: redistributes overdue occurrences forward across subsequent days.
 * - Leaves occurrences already scheduled for today and future days ("quelli corretti") completely intact.
 * - Leaves completed occurrences untouched.
 * - Takes overdue uncompleted occurrences, sorts them by priority, puts the top `quotaArretratiGiornaliera`
 *   on today, and spreads the rest smoothly on day +1, day +2, etc.
 * - Preserves original time of day.
 */
export function smoothOverdueReviews(
  occorrenze: readonly Occorrenza[],
  quotaArretratiGiornaliera: number = QUOTA_ARRETRATI_PREDEFINITA,
  currentDate: Date = new Date()
): Occorrenza[] {
  const oggiMidnight = inizioGiornata(currentDate);
  const oggiMs = oggiMidnight.getTime();

  const arretrate: Occorrenza[] = [];
  const corrette: Occorrenza[] = [];

  for (const o of occorrenze) {
    const t = new Date(o.scheduled_at).getTime();
    if (Number.isFinite(t) && t < oggiMs && !o.is_completed) {
      arretrate.push(o);
    } else {
      corrette.push(o);
    }
  }

  if (arretrate.length === 0) {
    return [...occorrenze];
  }

  // Sort overdue occurrences by priority descending (highest first)
  arretrate.sort((a, b) => {
    const diff = calcolaPrioritaRipasso(b, currentDate) - calcolaPrioritaRipasso(a, currentDate);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });

  const quota = Math.max(1, quotaArretratiGiornaliera);
  const smoothedArretrate: Occorrenza[] = arretrate.map((o, index) => {
    const giornoOffset = Math.floor(index / quota);
    if (giornoOffset === 0) {
      return o;
    }

    const dataBase = new Date(oggiMs + giornoOffset * 86_400_000);
    const dataOrig = new Date(o.scheduled_at);

    // Keep the original hours/minutes if valid
    dataBase.setHours(
      dataOrig.getHours(),
      dataOrig.getMinutes(),
      dataOrig.getSeconds(),
      dataOrig.getMilliseconds()
    );

    return {
      ...o,
      scheduled_at: dataBase.toISOString(),
    };
  });

  // Combine while maintaining original structure
  const smoothedMap = new Map<string, Occorrenza>();
  for (const s of smoothedArretrate) {
    smoothedMap.set(s.id, s);
  }

  return occorrenze.map((o) => smoothedMap.get(o.id) ?? o);
}

/**
 * Applies overdue review smoothing to an array of RipassoCompleto domain models.
 */
export function applicaSmoothingARipassi(
  ripassi: readonly RipassoCompleto[],
  quotaArretratiGiornaliera: number = QUOTA_ARRETRATI_PREDEFINITA,
  currentDate: Date = new Date()
): RipassoCompleto[] {
  const tutteOccorrenze = ripassi.flatMap((r) => r.occorrenze);
  const smoothedOccorrenze = smoothOverdueReviews(
    tutteOccorrenze,
    quotaArretratiGiornaliera,
    currentDate
  );

  const occMap = new Map<string, Occorrenza>();
  for (const o of smoothedOccorrenze) {
    occMap.set(o.id, o);
  }

  return ripassi.map((r) => ({
    ...r,
    occorrenze: r.occorrenze.map((o) => occMap.get(o.id) ?? o),
  }));
}
