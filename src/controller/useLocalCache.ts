/**
 * Controller — rotazione cache locale allegati (sezione 7).
 * Chiamato all'apertura dell'app / al variare dei ripassi: mantiene in locale
 * solo gli allegati delle occorrenze nella finestra [ieri, oggi, domani].
 */
import { useCallback, useEffect, useState } from "react";
import { finestraGiorni, getLocalUri, ruotaCache } from "@/model/localCache";
import type { Allegato, RipassoCompleto } from "@/model/types";

/** Estrae gli allegati dei ripassi che hanno un'occorrenza nella finestra. */
function allegatiInFinestra(ripassi: RipassoCompleto[]): Allegato[] {
  const giorni = finestraGiorni();
  const out: Allegato[] = [];
  for (const r of ripassi) {
    const rilevante = r.occorrenze.some((o) =>
      giorni.has(o.scheduled_at.slice(0, 10))
    );
    if (rilevante) out.push(...r.allegati);
  }
  return out;
}

export function useLocalCache(ripassi: RipassoCompleto[], enabled: boolean) {
  const [ultimaRotazione, setUltimaRotazione] = useState<string | null>(null);

  const rotazione = useCallback(async () => {
    const oggi = new Date().toISOString().slice(0, 10);
    // Al massimo una rotazione al giorno (sezione 7).
    if (ultimaRotazione === oggi) return;
    await ruotaCache(allegatiInFinestra(ripassi));
    setUltimaRotazione(oggi);
  }, [ripassi, ultimaRotazione]);

  useEffect(() => {
    if (!enabled || ripassi.length === 0) return;
    rotazione();
  }, [enabled, ripassi, rotazione]);

  return {
    getLocalUri,
    forzaRotazione: async () => {
      await ruotaCache(allegatiInFinestra(ripassi));
      setUltimaRotazione(new Date().toISOString().slice(0, 10));
    },
  };
}
