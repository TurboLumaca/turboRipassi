/**
 * Controller — state and operations for reviews.
 * Mediates between the Model (RipassiRepo) and the View. Exposes the list
 * plus CRUD actions. Includes the Realtime subscription (spec section 6)
 * for cross-device sync.
 *
 * The repository arrives as a parameter with a default: the hook depends on
 * the contract, not on a module path, so a test can hand it a fake without
 * mocking the module system.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ripassiRepo, type NuovoRipasso, type RipassiRepo } from "@/model/ripassi/ripassiRepo";
import {
  ricalcolaSuccessive,
  type SpostamentoOccorrenza,
} from "@/model/ripassi/occorrenzeDates";
import { leggiRipassiSalvati, salvaRipassi } from "@/model/ripassi/ripassiOffline";
import {
  pausaRepo,
  STATO_PAUSA_INIZIALE,
  type ConfigurazionePausa,
  type PausaRepo,
} from "@/model/ripassi/pausaRepo";
import { completaPausa } from "@/model/ripassi/pausaLogic";
import { supabase } from "@/config/supabase";
import { isErroreDiRete, messaggioErrore } from "@/model/shared/errorMessages";
import { useRitento } from "../useRitento";
import { reportError } from "@/config/crashReporting";
import type { Ripasso, RipassoCompleto } from "@/model/types";

/**
 * Window in which Realtime events collapse into a single reload. Long enough
 * to catch the events of one operation (a batch upload fires one per file),
 * short enough to be invisible next to the round trip that produced them.
 */
const MS_COALESCENZA = 200;

/**
 * What the reviews Controller offers to the rest of the app. Declared
 * explicitly rather than inferred: this is the contract RipassiContext hands
 * to every screen, and an inferred one changes shape silently on refactor.
 */
export interface StatoRipassi {
  ripassi: RipassoCompleto[];
  /** True until the first load has produced a list (or failed). */
  loading: boolean;
  /**
   * When the list on screen is the one saved on the device rather than one the
   * server has just confirmed, the moment it was last confirmed. Null while the
   * list is live.
   */
  salvatoIl: Date | null;
  /**
   * True while an operation is waiting between two attempts. Separate from
   * `loading`: the screen is not waiting for a first list, it is waiting for
   * something that has already failed once and is being tried again.
   */
  ritentando: boolean;
  /** Translated message for a failed load; null when there is none. */
  error: string | null;
  reload: () => Promise<void>;
  /** Creates a ripasso and returns it: attachments need its id. */
  crea: (input: Omit<NuovoRipasso, "base">) => Promise<Ripasso>;
  modifica: (id: string, patch: { titolo?: string; note?: string | null }) => Promise<void>;
  elimina: (id: string) => Promise<void>;
  completaOccorrenza: (occId: string, completata: boolean) => Promise<void>;
  /**
   * Reschedules one occurrence. With `aCascata`, the later dates of the same
   * ripasso shift by the same amount, so the spacing keeps being measured from
   * the study rather than from the day it was typed in.
   */
  spostaOccorrenza: (occId: string, nuovaData: Date, aCascata?: boolean) => Promise<void>;
  /** Modalità Riposo / Pausa Consapevole */
  pausa: ConfigurazionePausa;
  attivaPausa: (config: ConfigurazionePausa) => Promise<void>;
  riprendiPausa: () => Promise<void>;
}

export function useRipassi(
  repo: RipassiRepo = ripassiRepo,
  pRepo: PausaRepo = pausaRepo
): StatoRipassi {
  const [ripassi, setRipassi] = useState<RipassoCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salvatoIl, setSalvatoIl] = useState<Date | null>(null);
  const [pausa, setPausa] = useState<ConfigurazionePausa>(STATO_PAUSA_INIZIALE);
  const pausaRef = useRef<ConfigurazionePausa>(STATO_PAUSA_INIZIALE);
  const mounted = useRef(true);
  const { ritentando, conRitentoVisibile } = useRitento();
  /** Monotonic id of the most recent reload: older replies are discarded. */
  const sequenza = useRef(0);
  const timerCoalescenza = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Whether the server has answered at least once in this session. */
  const rispostaDalServer = useRef(false);
  /**
   * The list as a ref. `reload` needs to know whether anything is on screen
   * before deciding how loudly to fail, and reading it from state would put
   * the list in its dependencies — which would rebuild `reload` on every
   * change and, through the effect below, tear down and re-open the Realtime
   * subscription each time.
   */
  const ripassiRef = useRef<RipassoCompleto[]>([]);

  /** Keeps the list and its ref the single thing they are meant to be. */
  const mostraRipassi = useCallback((lista: RipassoCompleto[]) => {
    ripassiRef.current = lista;
    setRipassi(lista);
  }, []);

  /**
   * Reloads the list. Every state update happens after the await on purpose:
   * called straight from an effect, a synchronous setState here would schedule
   * a second render before the first one has even been shown.
   */
  const reload = useCallback(async () => {
    // Which reload this is. Several can be in flight at once — a write and the
    // Realtime event it generates, a pull-to-refresh over a slow one — and
    // without this the older reply could land last and put a superseded list
    // back on screen. Exactly when the network is slow, i.e. when it happens.
    const mia = ++sequenza.current;
    try {
      // Transient network failures are common on mobile: retry before
      // surfacing an error the user has to act on.
      const data = await conRitentoVisibile(() => repo.leggiCompleti());
      rispostaDalServer.current = true;
      if (mounted.current && mia === sequenza.current) {
        mostraRipassi(data);
        setError(null);
        setSalvatoIl(null);
      }
      // Written even when a newer reload has superseded this one on screen:
      // what goes on disk is the server's answer, not what is being rendered,
      // and the newer one will overwrite it a moment later anyway.
      await salvaRipassi(data);
    } catch (e) {
      // Being offline is the expected way for this to fail on a phone, and the
      // point of the local copy is that it is not an incident. Anything else
      // still is.
      if (!isErroreDiRete(e)) reportError(e, { operazione: "leggiRipassiCompleti" });
      if (mounted.current && mia === sequenza.current) {
        // With the saved list on screen, the offline banner already explains
        // why nothing is moving; a red line under it would only say the same
        // thing in a more alarming voice.
        const mostrandoIlSalvato = !rispostaDalServer.current && ripassiRef.current.length > 0;
        setError(isErroreDiRete(e) && mostrandoIlSalvato ? null : messaggioErrore(e));
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [repo, conRitentoVisibile, mostraRipassi]);

  /**
   * Incremental reload for Realtime events.
   * Instead of re-fetching the entire database on every single mutation (which
   * causes O(N) bandwidth explosion and GC pauses), this function receives the
   * mutated row's payload, determines the affected ripasso_id, and only fetches
   * that single ripasso, merging it into the local state.
   */
  const gestisciEventoRealtime = useCallback(async (payload: any) => {
    // 1. Identify which ripasso was affected
    let ripassoId: string | null = null;
    
    if (payload.table === "ripassi") {
      ripassoId = payload.record?.id ?? payload.old_record?.id;
    } else if (payload.table === "occorrenze" || payload.table === "allegati") {
      ripassoId = payload.record?.ripasso_id ?? payload.old_record?.ripasso_id;
    }

    if (!ripassoId) {
      // Fallback: if we can't figure it out, do a coalesced full reload.
      if (timerCoalescenza.current !== null) clearTimeout(timerCoalescenza.current);
      timerCoalescenza.current = setTimeout(() => {
        timerCoalescenza.current = null;
        void reload();
      }, MS_COALESCENZA);
      return;
    }

    // 2. Fetch only the affected ripasso
    try {
      if (payload.eventType === "DELETE" && payload.table === "ripassi") {
        if (mounted.current) {
          mostraRipassi(ripassiRef.current.filter((r) => r.id !== ripassoId));
        }
      } else {
        const aggiornato = await repo.leggiSingolo(ripassoId);
        if (mounted.current && aggiornato) {
          const esisteGia = ripassiRef.current.some((r) => r.id === ripassoId);
          mostraRipassi(
            esisteGia
              ? ripassiRef.current.map((r) => (r.id === ripassoId ? aggiornato : r))
              : [aggiornato, ...ripassiRef.current].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          );
        }
      }
    } catch {
      // Silently fall back to full reload if single fetch fails
      void reload();
    }
  }, [repo, reload, mostraRipassi]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Opens on the list saved on the device, then lets the load below replace it.
   *
   * Runs alongside the first load rather than before it: on a working
   * connection the server usually wins the race and nothing here is ever seen,
   * and when it doesn't, a list from this morning is a far better first screen
   * than an empty one. On a phone in airplane mode it is the only screen
   * there is — the home screen has always said "vedi i ripassi già scaricati",
   * and until now nothing was keeping the ripassi themselves.
   *
   * The guard is what makes the race safe: a saved list is only shown while
   * the server still has not answered, so a slow disk can never overwrite
   * fresher rows.
   */
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const salvati = await leggiRipassiSalvati();
      if (!vivo || !salvati || rispostaDalServer.current) return;
      mostraRipassi(salvati.ripassi);
      setSalvatoIl(salvati.salvatoIl);
      setLoading(false);
    })();
    return () => {
      vivo = false;
    };
  }, [mostraRipassi]);

  const impostaPausa = useCallback((p: ConfigurazionePausa) => {
    pausaRef.current = p;
    setPausa(p);
  }, []);

  // Initial load of pause configuration from disk
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const salvata = await pRepo.leggi();
      if (!vivo) return;
      impostaPausa(salvata);
    })();
    return () => {
      vivo = false;
    };
  }, [pRepo, impostaPausa]);

  // Initial load + Realtime subscription on all tables (spec section 6).
  useEffect(() => {
    // Fire-and-forget on purpose: the effect subscribes, it does not wait.
    // Same shape as the startup effect in useAuth, and the state updates it
    // eventually makes all happen after an await, never during this render.
    void (async () => {
      await reload();
    })();

    const channel = supabase
      .channel("ripassa-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "ripassi" }, gestisciEventoRealtime)
      .on("postgres_changes", { event: "*", schema: "public", table: "occorrenze" }, gestisciEventoRealtime)
      .on("postgres_changes", { event: "*", schema: "public", table: "allegati" }, gestisciEventoRealtime)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timerCoalescenza.current !== null) clearTimeout(timerCoalescenza.current);
    };
  }, [reload, gestisciEventoRealtime]);

  /**
   * The idempotent mutations all follow the same shape: same input, same final
   * state, so a transient network failure is safe to retry, and the list is
   * reloaded once the write lands.
   */
  const eseguiERicarica = useCallback(
    async (azione: () => Promise<void>) => {
      await conRitentoVisibile(azione);
      await reload();
    },
    [reload, conRitentoVisibile]
  );

  /**
   * Deliberately NOT retried: an insert is not idempotent, and a network
   * error can mean "the request arrived but the reply was lost". Retrying
   * would risk creating the same ripasso twice, which is worse than asking
   * the user to tap again.
   */
  const crea = useCallback(
    async (input: Omit<NuovoRipasso, "base">): Promise<Ripasso> => {
      const creato = await repo.crea(input);
      await reload();
      return creato;
    },
    [repo, reload]
  );

  const modifica = useCallback(
    (id: string, patch: { titolo?: string; note?: string | null }) =>
      eseguiERicarica(() => repo.aggiorna(id, patch)),
    [repo, eseguiERicarica]
  );

  const elimina = useCallback(
    (id: string) => eseguiERicarica(() => repo.elimina(id)),
    [repo, eseguiERicarica]
  );

  const completaOccorrenza = useCallback(
    async (occId: string, completata: boolean) => {
      await eseguiERicarica(async () => {
        await repo.completaOccorrenza(occId, completata);
        
        // If marking as complete, check if we're doing it late
        if (completata) {
          const tutteOccorrenze = ripassiRef.current.flatMap((r) => r.occorrenze);
          const occ = tutteOccorrenze.find(o => o.id === occId);
          if (occ) {
            const ritardoMs = Date.now() - new Date(occ.scheduled_at).getTime();
            // If completed late by more than an hour, shift the future schedule
            if (ritardoMs > 3600000) {
              const fratelli = tutteOccorrenze.filter(o => occ.ripasso_id && o.ripasso_id === occ.ripasso_id);
              // Use the actual completion time as the new base date for this occurrence
              const nuovaData = new Date();
              // Calculate the shifted dates for subsequent occurrences
              const spostamenti = ricalcolaSuccessive(
                fratelli.length > 0 ? fratelli : tutteOccorrenze.filter(o => ripassiRef.current.some(r => r.occorrenze.some(x => x.id === occId) && r.occorrenze.includes(o))),
                occId,
                nuovaData
              );
              if (spostamenti.length > 0) {
                await repo.spostaOccorrenze(spostamenti);
              }
            }
          }
        }
      });
    },
    [repo, eseguiERicarica]
  );

  /**
   * The cascade is computed here, not in the View: which occurrences follow
   * the edited one is a question about the data, and the answer lives in the
   * list this hook already holds. The View only says whether the user wants
   * it — it does not have to know that a move has siblings at all.
   *
   * Edited date and followers go out as one write: retrying is safe (the dates
   * are absolute, so a second attempt lands on the same state), and a failure
   * leaves the whole schedule untouched instead of partly moved.
   */
  const spostaOccorrenza = useCallback(
    (occId: string, nuovaData: Date, aCascata = false) => {
      const spostamenti: SpostamentoOccorrenza[] = [
        { id: occId, scheduled_at: nuovaData.toISOString() },
      ];
      if (aCascata) {
        const fratelli =
          ripassi.find((r) => r.occorrenze.some((o) => o.id === occId))?.occorrenze ?? [];
        spostamenti.push(...ricalcolaSuccessive(fratelli, occId, nuovaData));
      }
      return eseguiERicarica(() => repo.spostaOccorrenze(spostamenti));
    },
    [ripassi, repo, eseguiERicarica]
  );

  const attivaPausa = useCallback(
    async (config: ConfigurazionePausa) => {
      impostaPausa(config);
      await pRepo.scrivi(config);
    },
    [pRepo, impostaPausa]
  );

  const riprendiPausa = useCallback(async () => {
    const configAttuale = pausaRef.current;
    if (!configAttuale.attiva) return;

    const tutteOccorrenze = ripassiRef.current.flatMap((r) => r.occorrenze);
    const { nuovaConfig, nuoveOccorrenze, giorniEffettivi } = completaPausa(
      configAttuale,
      tutteOccorrenze
    );

    if (giorniEffettivi > 0) {
      const spostamenti: SpostamentoOccorrenza[] = nuoveOccorrenze
        .filter((o) => {
          const orig = tutteOccorrenze.find((x) => x.id === o.id);
          return orig && orig.scheduled_at !== o.scheduled_at;
        })
        .map((o) => ({ id: o.id, scheduled_at: o.scheduled_at }));

      if (spostamenti.length > 0) {
        await eseguiERicarica(() => repo.spostaOccorrenze(spostamenti));
      }
    }

    impostaPausa(nuovaConfig);
    await pRepo.scrivi(nuovaConfig);
  }, [repo, pRepo, eseguiERicarica, impostaPausa]);

  // Not wrapped in useMemo: the React Compiler (enabled in app.json) memoizes
  // this object from the same dependencies a hand-written list would carry.
  // The useCallback above stay — their identity feeds effect dependencies.
  return {
    ripassi,
    loading,
    salvatoIl,
    ritentando,
    error,
    reload,
    crea,
    modifica,
    elimina,
    completaOccorrenza,
    spostaOccorrenza,
    pausa,
    attivaPausa,
    riprendiPausa,
  };
}
