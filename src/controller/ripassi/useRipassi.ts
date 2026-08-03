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
import { supabase } from "@/config/supabase";
import { messaggioErrore } from "@/model/shared/errorMessages";
import { conRetry } from "@/model/shared/retry";
import { reportError } from "@/config/crashReporting";
import type { Ripasso, RipassoCompleto } from "@/model/types";

/**
 * What the reviews Controller offers to the rest of the app. Declared
 * explicitly rather than inferred: this is the contract RipassiContext hands
 * to every screen, and an inferred one changes shape silently on refactor.
 */
export interface StatoRipassi {
  ripassi: RipassoCompleto[];
  /** True until the first load has produced a list (or failed). */
  loading: boolean;
  /** Translated message for a failed load; null when there is none. */
  error: string | null;
  reload: () => Promise<void>;
  /** Creates a ripasso and returns it: attachments need its id. */
  crea: (input: Omit<NuovoRipasso, "base">) => Promise<Ripasso>;
  modifica: (id: string, patch: { titolo?: string; note?: string | null }) => Promise<void>;
  elimina: (id: string) => Promise<void>;
  completaOccorrenza: (occId: string, completata: boolean) => Promise<void>;
  spostaOccorrenza: (occId: string, nuovaData: Date) => Promise<void>;
}

export function useRipassi(repo: RipassiRepo = ripassiRepo): StatoRipassi {
  const [ripassi, setRipassi] = useState<RipassoCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  /**
   * Reloads the list. Every state update happens after the await on purpose:
   * called straight from an effect, a synchronous setState here would schedule
   * a second render before the first one has even been shown.
   */
  const reload = useCallback(async () => {
    try {
      // Transient network failures are common on mobile: retry before
      // surfacing an error the user has to act on.
      const data = await conRetry(() => repo.leggiCompleti());
      if (mounted.current) {
        setRipassi(data);
        setError(null);
      }
    } catch (e) {
      reportError(e, { operazione: "leggiRipassiCompleti" });
      if (mounted.current) setError(messaggioErrore(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "ripassi" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "occorrenze" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "allegati" }, reload)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reload]);

  /**
   * The idempotent mutations all follow the same shape: same input, same final
   * state, so a transient network failure is safe to retry, and the list is
   * reloaded once the write lands.
   */
  const eseguiERicarica = useCallback(
    async (azione: () => Promise<void>) => {
      await conRetry(azione);
      await reload();
    },
    [reload]
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
    (occId: string, completata: boolean) =>
      eseguiERicarica(() => repo.completaOccorrenza(occId, completata)),
    [repo, eseguiERicarica]
  );

  const spostaOccorrenza = useCallback(
    (occId: string, nuovaData: Date) =>
      eseguiERicarica(() =>
        repo.aggiornaOccorrenza(occId, { scheduled_at: nuovaData.toISOString() })
      ),
    [repo, eseguiERicarica]
  );

  // Not wrapped in useMemo: the React Compiler (enabled in app.json) memoizes
  // this object from the same dependencies a hand-written list would carry.
  // The useCallback above stay — their identity feeds effect dependencies.
  return {
    ripassi,
    loading,
    error,
    reload,
    crea,
    modifica,
    elimina,
    completaOccorrenza,
    spostaOccorrenza,
  };
}
