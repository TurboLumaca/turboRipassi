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
import { supabase } from "@/config/supabase";
import { messaggioErrore } from "@/model/shared/errorMessages";
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
}

export function useRipassi(repo: RipassiRepo = ripassiRepo): StatoRipassi {
  const [ripassi, setRipassi] = useState<RipassoCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const { ritentando, conRitentoVisibile } = useRitento();
  /** Monotonic id of the most recent reload: older replies are discarded. */
  const sequenza = useRef(0);
  const timerCoalescenza = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (mounted.current && mia === sequenza.current) {
        setRipassi(data);
        setError(null);
      }
    } catch (e) {
      reportError(e, { operazione: "leggiRipassiCompleti" });
      if (mounted.current && mia === sequenza.current) setError(messaggioErrore(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [repo, conRitentoVisibile]);

  /**
   * Reload for Realtime events, collapsing a burst into one.
   *
   * Every write this device makes generates its own Realtime event, so each
   * mutation used to reload the list twice: once explicitly, once when its own
   * echo came back. A batch upload of N attachments meant N inserts, N events
   * and N full re-reads (ripassi + occorrenze + allegati) in quick succession,
   * each re-rendering the whole list — while the app was already busy
   * compressing and uploading photos.
   *
   * A short window is enough: the events of one operation arrive together, and
   * a delay this size is invisible next to the round trip that produced them.
   */
  const reloadCoalescente = useCallback(() => {
    if (timerCoalescenza.current !== null) clearTimeout(timerCoalescenza.current);
    timerCoalescenza.current = setTimeout(() => {
      timerCoalescenza.current = null;
      void reload();
    }, MS_COALESCENZA);
  }, [reload]);

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
      .on("postgres_changes", { event: "*", schema: "public", table: "ripassi" }, reloadCoalescente)
      .on("postgres_changes", { event: "*", schema: "public", table: "occorrenze" }, reloadCoalescente)
      .on("postgres_changes", { event: "*", schema: "public", table: "allegati" }, reloadCoalescente)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timerCoalescenza.current !== null) clearTimeout(timerCoalescenza.current);
    };
  }, [reload, reloadCoalescente]);

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
    (occId: string, completata: boolean) =>
      eseguiERicarica(() => repo.completaOccorrenza(occId, completata)),
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

  // Not wrapped in useMemo: the React Compiler (enabled in app.json) memoizes
  // this object from the same dependencies a hand-written list would carry.
  // The useCallback above stay — their identity feeds effect dependencies.
  return {
    ripassi,
    loading,
    ritentando,
    error,
    reload,
    crea,
    modifica,
    elimina,
    completaOccorrenza,
    spostaOccorrenza,
  };
}
