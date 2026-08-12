/**
 * Model — the two day-level date primitives the domain keeps needing.
 *
 * They lived twice, copied between `percorso/fasi.ts` and `percorso/agenda.ts`,
 * and the copies had already started to drift: one normalised the parsed date
 * with `setHours(0,0,0,0)` and the other trusted the constructor. Equivalent
 * today, but two functions with the same name and different bodies is how a
 * date bug gets fixed in one place only.
 */

/** Local midnight of the day `t` falls in. */
export function inizioGiornata(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Parse a YYYY-MM-DD day into local midnight. Returns NaN for anything else.
 *
 * Built from the three numbers rather than handed to `new Date(string)`: that
 * constructor reads a bare date as UTC, which puts the start of the course on
 * the previous day for anyone west of Greenwich — a whole day of the wrong
 * phase for a bug that only shows up in half the world.
 */
export function mezzanotteLocale(giorno: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(giorno.trim());
  if (!m) return NaN;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
