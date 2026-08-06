/**
 * Model layer — pure logic for what should have a reminder scheduled.
 * No I/O: only deterministic selection and diffing, so the policy is
 * unit-testable without touching expo-notifications.
 */
import type { RipassoCompleto } from "../types";

/** One occurrence worth reminding about. */
export interface PromemoriaOccorrenza {
  id: string;
  titolo: string;
  quando: Date;
}

/**
 * Which occurrences should currently have a reminder: not completed, and
 * scheduled strictly in the future. A occurrence already past is not
 * rescheduled — the reminder for "now" has no meaning once "now" has gone by,
 * and the storico is where a skipped ripasso is found again, not a
 * notification queue.
 *
 * A malformed date is excluded rather than defaulting to "now" or "never":
 * scheduling a reminder for an unreadable instant is not a safe fallback in
 * either direction.
 */
export function occorrenzeDaRicordare(
  ripassi: RipassoCompleto[],
  ora: number = Date.now()
): PromemoriaOccorrenza[] {
  const out: PromemoriaOccorrenza[] = [];
  for (const ripasso of ripassi) {
    for (const occorrenza of ripasso.occorrenze) {
      if (occorrenza.is_completed) continue;
      const t = new Date(occorrenza.scheduled_at).getTime();
      if (!Number.isFinite(t) || t <= ora) continue;
      out.push({ id: occorrenza.id, titolo: ripasso.titolo, quando: new Date(t) });
    }
  }
  return out;
}

/** What changed since the last sync, so the Controller knows what to do with each id. */
export interface DiffPromemoria {
  daPianificare: PromemoriaOccorrenza[];
  daCancellare: string[];
}

/**
 * Diffs the desired set against what was scheduled last time.
 *
 * An occurrence already scheduled for the exact same instant and title is
 * left alone — rescheduling it would mean cancelling and recreating a
 * reminder that was already correct, on every reload the Realtime
 * subscription triggers.
 */
export function diffPromemoria(
  desiderati: PromemoriaOccorrenza[],
  precedenti: ReadonlyMap<string, PromemoriaOccorrenza>
): DiffPromemoria {
  const daPianificare: PromemoriaOccorrenza[] = [];
  const idsDesiderati = new Set<string>();

  for (const p of desiderati) {
    idsDesiderati.add(p.id);
    const prima = precedenti.get(p.id);
    const invariato =
      prima !== undefined && prima.quando.getTime() === p.quando.getTime() && prima.titolo === p.titolo;
    if (!invariato) daPianificare.push(p);
  }

  const daCancellare = [...precedenti.keys()].filter((id) => !idsDesiderati.has(id));
  return { daPianificare, daCancellare };
}
