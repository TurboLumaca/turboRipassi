/**
 * Controller — local attachment cache rotation (spec section 7).
 * Called when the app opens / when reviews change: keeps only the
 * attachments of occurrences in the [yesterday, today, tomorrow] window locally.
 *
 * It also answers the question the home screen asks on the user's behalf:
 * *which* of those three days' ripassi cannot be read without a connection.
 * That is deliberately not derived from how the rotation went — see
 * `ripassiNonDisponibili`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getLocalUri, idsInCache, ruotaCache } from "@/model/cache/localCache";
import {
  allegatiInFinestra,
  giornoLocale,
  ripassiNonDisponibili,
  type RipassoNonDisponibile,
} from "@/model/cache/cacheLogic";
import { reportError } from "@/config/crashReporting";
import type { RipassoCompleto } from "@/model/types";

export interface StatoCache {
  /** Local uri of a cached attachment, or null when it isn't cached. */
  getLocalUri: (allegatoId: string) => Promise<string | null>;
  /**
   * The ripassi of the window whose attachments are not all on this device,
   * with how many are missing from each. Empty when everything is readable
   * offline — which is the normal state, and the reason this is a list and not
   * a count: a number tells the user something is wrong without telling them
   * which ripasso to open while they still have a connection.
   */
  nonDisponibili: RipassoNonDisponibile[];
}

/**
 * `idsProtetti` are the attachments whose only copy is on this device: picked
 * offline, queued for Drive, and impossible to fetch again. The rotation must
 * neither try to download them nor evict them.
 */
export function useLocalCache(
  ripassi: RipassoCompleto[],
  idsProtetti: Set<string>
): StatoCache {
  const [nonDisponibili, setNonDisponibili] = useState<RipassoNonDisponibile[]>([]);
  // Local day of the rotation already started in this session (spec section 7:
  // at most one per day). A ref, not state: it is claimed *before* awaiting, so
  // a re-render arriving mid-rotation cannot start a second one in parallel.
  const rotazioneIniziata = useRef<string | null>(null);
  const montato = useRef(true);

  useEffect(() => {
    montato.current = true;
    return () => {
      montato.current = false;
    };
  }, []);

  /**
   * Recomputes what is missing, from what the device actually holds.
   *
   * Run after every rotation and whenever the list changes — a ripasso added
   * this morning belongs to today's window without any rotation having heard of
   * it, and until this ran again it was silently counted as available.
   */
  const aggiornaDisponibilita = useCallback(
    async (lista: RipassoCompleto[], protetti: Set<string>) => {
      try {
        const disponibili = await idsInCache();
        for (const id of protetti) disponibili.add(id);
        const mancanti = ripassiNonDisponibili(lista, disponibili);
        if (montato.current) setNonDisponibili(mancanti);
      } catch (e) {
        // The cache database is unreadable. Saying "everything is available"
        // would be the one lie this list exists to prevent, but so would
        // listing every ripasso as missing: leave the last known answer alone
        // and report it.
        reportError(e, { operazione: "aggiornaDisponibilita" });
      }
    },
    []
  );

  useEffect(() => {
    // Fire-and-forget through an async IIFE, the same shape the other effects
    // in this layer use: every state update inside happens after an await, so
    // none of them schedules a second render before the first has been shown.
    void (async () => {
      await aggiornaDisponibilita(ripassi, idsProtetti);
    })();
  }, [ripassi, idsProtetti, aggiornaDisponibilita]);

  useEffect(() => {
    if (ripassi.length === 0) return;
    const oggi = giornoLocale(new Date());
    if (rotazioneIniziata.current === oggi) return;
    rotazioneIniziata.current = oggi;

    ruotaCache(allegatiInFinestra(ripassi), idsProtetti)
      .then(async (esito) => {
        // A rotation that failed for want of a connection has not used up the
        // day: it never had a chance. This matters now that the list can come
        // from the device — the app opens offline, the rotation runs against a
        // network that isn't there, and claiming the day would mean the
        // attachments of the next ripassi are never fetched, however long the
        // connection is back before midnight. Releasing the claim lets the
        // next change to the list — which is what a reconnection produces —
        // finish the job.
        if (esito.perRete > 0) rotazioneIniziata.current = null;
        // What the rotation achieved is not reported as a count any more: the
        // screen asks which ripassi are missing, and that is answered from
        // what the device actually holds, a moment from now.
        await aggiornaDisponibilita(ripassi, idsProtetti);
      })
      .catch((e) => {
        // The rotation swallows individual download failures itself; reaching
        // here means the cache database or the file system is unusable, which
        // no future rotation will fix on its own.
        rotazioneIniziata.current = null;
        reportError(e, { operazione: "ruotaCache" });
      });
  }, [ripassi, idsProtetti, aggiornaDisponibilita]);

  return { getLocalUri, nonDisponibili };
}
