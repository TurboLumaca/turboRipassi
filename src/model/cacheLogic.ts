/**
 * Model layer — logica PURA della rotazione cache (sezione 7).
 * Nessuna dipendenza da SQLite/FileSystem/rete: solo date e selezione,
 * così è testabile in isolamento. L'I/O sta in localCache.ts.
 *
 * Nota fusi orari: "ieri/oggi/domani" sono giorni LOCALI del dispositivo
 * (non UTC): un ripasso all'1:00 di notte deve contare per il giorno locale
 * giusto anche quando l'ISO UTC cade nel giorno precedente.
 */
import type { Allegato, CacheAllegato, RipassoCompleto } from "./types";

/** Data → YYYY-MM-DD nel fuso orario locale del dispositivo. */
export function giornoLocale(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const g = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${g}`;
}

/** Finestra [ieri, oggi, domani] come set di stringhe YYYY-MM-DD locali. */
export function finestraGiorni(riferimento = new Date()): Set<string> {
  const giorni = new Set<string>();
  for (let delta = -1; delta <= 1; delta++) {
    const d = new Date(riferimento);
    d.setDate(d.getDate() + delta);
    giorni.add(giornoLocale(d));
  }
  return giorni;
}

/**
 * Allegati dei ripassi con almeno un'occorrenza nella finestra (sezione 7.2).
 * Gli allegati appartengono al ripasso, quindi un'occorrenza in finestra
 * rende rilevanti tutti gli allegati del suo ripasso.
 */
export function allegatiInFinestra(
  ripassi: RipassoCompleto[],
  riferimento = new Date()
): Allegato[] {
  const giorni = finestraGiorni(riferimento);
  const out: Allegato[] = [];
  for (const r of ripassi) {
    const rilevante = r.occorrenze.some((o) =>
      giorni.has(giornoLocale(new Date(o.scheduled_at)))
    );
    if (rilevante) out.push(...r.allegati);
  }
  return out;
}

/**
 * Righe di cache da eliminare (sezione 7.3): quelle il cui allegato NON è
 * più nella finestra corrente. Decidere per appartenenza (e non per data di
 * download) evita di cancellare file ancora in finestra ma scaricati giorni fa.
 */
export function righeDaEliminare(
  righe: CacheAllegato[],
  idsInFinestra: Set<string>
): CacheAllegato[] {
  return righe.filter((r) => !idsInFinestra.has(r.allegato_id));
}
