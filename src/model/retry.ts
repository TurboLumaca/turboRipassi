/**
 * Model layer — retry with exponential backoff for transient failures.
 * Only network/5xx errors are retried: retrying a duplicate-key or permission
 * error just delays the same failure. Pure logic apart from the injectable
 * sleep, so it is unit-testable without real timers.
 */
import { traduciErrore } from "./errorMessages";

export interface OpzioniRetry {
  /** Total attempts, including the first one. Default 3. */
  tentativi?: number;
  /** Delay before the first retry, in ms; doubles each time. Default 500. */
  attesaInizialeMs?: number;
  /** Upper bound on a single wait, in ms. Default 4000. */
  attesaMassimaMs?: number;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Called before each retry, for logging/telemetry. */
  onRitento?: (tentativo: number, errore: unknown) => void;
}

const sleepReale = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Backoff delay for a given retry number (1-based), capped at attesaMassimaMs.
 * Exported for testing and for UI that wants to show "retrying in Ns".
 */
export function attesaBackoff(
  tentativo: number,
  attesaInizialeMs = 500,
  attesaMassimaMs = 4000
): number {
  const grezza = attesaInizialeMs * Math.pow(2, tentativo - 1);
  return Math.min(grezza, attesaMassimaMs);
}

/**
 * Runs `azione`, retrying only when the failure looks transient (connectivity
 * or 5xx). The last error is rethrown unchanged so callers can still translate
 * it for the user.
 */
export async function conRetry<T>(
  azione: () => Promise<T>,
  opzioni: OpzioniRetry = {}
): Promise<T> {
  const {
    tentativi = 3,
    attesaInizialeMs = 500,
    attesaMassimaMs = 4000,
    sleep = sleepReale,
    onRitento,
  } = opzioni;

  let ultimoErrore: unknown;
  for (let i = 1; i <= tentativi; i++) {
    try {
      return await azione();
    } catch (e) {
      ultimoErrore = e;
      const transitorio = traduciErrore(e).ritentabile;
      const ultimoTentativo = i === tentativi;
      if (!transitorio || ultimoTentativo) throw e;
      onRitento?.(i, e);
      await sleep(attesaBackoff(i, attesaInizialeMs, attesaMassimaMs));
    }
  }
  // Unreachable: the loop either returns or throws.
  throw ultimoErrore;
}
