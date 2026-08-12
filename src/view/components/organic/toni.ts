/**
 * View — le tre voci del sistema di design, come triplette di colore.
 *
 * Sta in un file suo perché è l'unica cosa che tutti gli altri moduli di
 * `organic/` importano: tenerla dentro uno di loro avrebbe fatto dipendere le
 * schede dai controlli per una costante.
 */
import { theme } from "@/view/theme/theme";

/** Which of the three phase voices a component speaks in. */
export type Tono = "accento" | "salvia" | "neutro";

/**
 * The three phases as a colour triplet each: the tint behind an icon, the ink
 * on top of that tint, and the solid base.
 *
 * A `Record` rather than a chain of ternaries, for the reason the button
 * variants already give: a missing case is then a compile error, not an
 * unreadable pairing.
 */
export const TONI: Record<Tono, { tinta: string; inchiostro: string; base: string }> = {
  accento: {
    tinta: theme.ramp.accent[200],
    inchiostro: theme.ramp.accent[700],
    base: theme.colors.accent,
  },
  salvia: {
    tinta: theme.ramp.sage[200],
    inchiostro: theme.ramp.sage[800],
    base: theme.colors.sage,
  },
  neutro: {
    tinta: theme.ramp.neutral[200],
    inchiostro: theme.ramp.neutral[800],
    base: theme.ramp.neutral[700],
  },
};
