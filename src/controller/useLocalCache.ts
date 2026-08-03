/**
 * Controller — local attachment cache rotation (spec section 7).
 * Called when the app opens / when reviews change: keeps only the
 * attachments of occurrences in the [yesterday, today, tomorrow] window locally.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { getLocalUri, ruotaCache } from "@/model/cache/localCache";
import { allegatiInFinestra, giornoLocale } from "@/model/cache/cacheLogic";
import type { RipassoCompleto } from "@/model/types";

export function useLocalCache(ripassi: RipassoCompleto[], enabled: boolean) {
  const [ultimaRotazione, setUltimaRotazione] = useState<string | null>(null);

  const rotazione = useCallback(async () => {
    const oggi = giornoLocale(new Date());
    // At most one rotation per day per session (spec section 7).
    if (ultimaRotazione === oggi) return;
    await ruotaCache(allegatiInFinestra(ripassi));
    setUltimaRotazione(oggi);
  }, [ripassi, ultimaRotazione]);

  useEffect(() => {
    if (!enabled || ripassi.length === 0) return;
    rotazione();
  }, [enabled, ripassi, rotazione]);

  const forzaRotazione = useCallback(async () => {
    await ruotaCache(allegatiInFinestra(ripassi));
    setUltimaRotazione(giornoLocale(new Date()));
  }, [ripassi]);

  return useMemo(() => ({ getLocalUri, forzaRotazione }), [forzaRotazione]);
}
