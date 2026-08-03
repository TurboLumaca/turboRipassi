/**
 * Controller — local attachment cache rotation (spec section 7).
 * Called when the app opens / when reviews change: keeps only the
 * attachments of occurrences in the [yesterday, today, tomorrow] window locally.
 */
import { useEffect, useRef, useState } from "react";
import { getLocalUri, ruotaCache, type EsitoRotazione } from "@/model/cache/localCache";
import { allegatiInFinestra, giornoLocale } from "@/model/cache/cacheLogic";
import { reportError } from "@/config/crashReporting";
import type { RipassoCompleto } from "@/model/types";

export interface StatoCache {
  /** Local uri of a cached attachment, or null when it isn't cached. */
  getLocalUri: (allegatoId: string) => Promise<string | null>;
  /** How the last rotation went; null until one has run in this session. */
  ultimoEsito: EsitoRotazione | null;
}

export function useLocalCache(ripassi: RipassoCompleto[]): StatoCache {
  const [ultimoEsito, setUltimoEsito] = useState<EsitoRotazione | null>(null);
  // Local day of the rotation already started in this session (spec section 7:
  // at most one per day). A ref, not state: it is claimed *before* awaiting, so
  // a re-render arriving mid-rotation cannot start a second one in parallel.
  const rotazioneIniziata = useRef<string | null>(null);

  useEffect(() => {
    if (ripassi.length === 0) return;
    const oggi = giornoLocale(new Date());
    if (rotazioneIniziata.current === oggi) return;
    rotazioneIniziata.current = oggi;

    let vivo = true;
    ruotaCache(allegatiInFinestra(ripassi))
      .then((esito) => {
        if (vivo) setUltimoEsito(esito);
      })
      .catch((e) => {
        // The rotation swallows individual download failures itself; reaching
        // here means the cache database or the file system is unusable, which
        // no future rotation will fix on its own.
        rotazioneIniziata.current = null;
        reportError(e, { operazione: "ruotaCache" });
      });
    return () => {
      vivo = false;
    };
  }, [ripassi]);

  return { getLocalUri, ultimoEsito };
}
