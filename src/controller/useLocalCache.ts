/**
 * Controller — rotazione cache locale allegati (sezione 7).
 * Chiamato all'apertura dell'app / al variare dei ripassi: mantiene in locale
 * solo gli allegati delle occorrenze nella finestra [ieri, oggi, domani].
 */
import { useCallback, useEffect, useState } from "react";
import { getLocalUri, ruotaCache } from "@/model/localCache";
import { allegatiInFinestra, giornoLocale } from "@/model/cacheLogic";
import type { RipassoCompleto } from "@/model/types";

export function useLocalCache(ripassi: RipassoCompleto[], enabled: boolean) {
  const [ultimaRotazione, setUltimaRotazione] = useState<string | null>(null);

  const rotazione = useCallback(async () => {
    const oggi = giornoLocale(new Date());
    // Al massimo una rotazione al giorno per sessione (sezione 7).
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
      setUltimaRotazione(giornoLocale(new Date()));
    },
  };
}
