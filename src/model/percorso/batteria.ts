/**
 * Model layer — the pre-course battery.
 *
 * The battery is the one number the pre-course phase is built around, and the
 * whole point of the redesign's version of it is what it does *not* count:
 * sessions. Training a lot without getting better does not charge it. It reads
 * mastery, which is the only thing that says you are ready for day 1.
 */
import {
  padronanzaDi,
  RICHIESTI_PRIMA_DEL_CORSO,
  SOGLIA_PADRONANZA,
  type Padronanze,
} from "./allenamenti";

/** Ticks that make a full charge: every required training at its threshold. */
export const TACCHE_TOTALI = RICHIESTI_PRIMA_DEL_CORSO.length * SOGLIA_PADRONANZA;

/**
 * Charge, 0–100.
 *
 * The average of the ticks reached over the ticks required: 4/5 and 3/5 is
 * 70%. Rounded, because a battery drawn to the tenth of a percent invites a
 * reading it cannot support.
 */
export function caricaBatteria(padronanze: Padronanze): number {
  if (TACCHE_TOTALI === 0) return 0;
  const raggiunte = RICHIESTI_PRIMA_DEL_CORSO.reduce(
    (somma, id) => somma + padronanzaDi(padronanze, id),
    0
  );
  return Math.round((raggiunte / TACCHE_TOTALI) * 100);
}

/** How much one more tick is worth. The detail screen says it out loud. */
export function valoreDiUnaTacca(): number {
  return TACCHE_TOTALI === 0 ? 0 : Math.round(100 / TACCHE_TOTALI);
}

/** Ticks still missing, across every required training. */
export function taccheMancanti(padronanze: Padronanze): number {
  return RICHIESTI_PRIMA_DEL_CORSO.reduce(
    (somma, id) => somma + (SOGLIA_PADRONANZA - padronanzaDi(padronanze, id)),
    0
  );
}

/** True when every required training has reached its threshold. */
export function prontoPerIlCorso(padronanze: Padronanze): boolean {
  return taccheMancanti(padronanze) === 0;
}
