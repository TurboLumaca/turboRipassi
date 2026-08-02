/**
 * Controller — state and operations for reviews.
 * Mediates between the Model (ripassiRepo) and the View. Exposes the list
 * plus CRUD actions. Includes the Realtime subscription (spec section 6)
 * for cross-device sync.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  createRipasso,
  deleteRipasso,
  fetchRipassiCompleti,
  toggleCompletata,
  updateOccorrenza,
  updateRipasso,
} from "@/model/ripassiRepo";
import { supabase } from "@/config/supabase";
import { messaggioErrore } from "@/model/errorMessages";
import { conRetry } from "@/model/retry";
import { reportError } from "@/config/crashReporting";
import type { Ripasso, RipassoCompleto } from "@/model/types";

export function useRipassi(enabled: boolean) {
  const [ripassi, setRipassi] = useState<RipassoCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    try {
      setError(null);
      // Transient network failures are common on mobile: retry before
      // surfacing an error the user has to act on.
      const data = await conRetry(fetchRipassiCompleti);
      if (mounted.current) setRipassi(data);
    } catch (e) {
      reportError(e, { operazione: "fetchRipassiCompleti" });
      if (mounted.current) setError(messaggioErrore(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Initial load + Realtime subscription on all tables (spec section 6).
  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    reload();

    const channel = supabase
      .channel("ripassa-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "ripassi" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "occorrenze" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "allegati" }, reload)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, reload]);

  const azioni = {
    reload,
    /**
     * Deliberately NOT retried: an insert is not idempotent, and a network
     * error can mean "the request arrived but the reply was lost". Retrying
     * would risk creating the same ripasso twice, which is worse than asking
     * the user to tap again.
     *
     * Returns the new row: attachments picked before saving can only be
     * uploaded once the ripasso has an id.
     */
    async crea(input: {
      titolo: string;
      note: string | null;
      includi1h: boolean;
    }): Promise<Ripasso> {
      const creato = await createRipasso(input);
      await reload();
      return creato;
    },
    // The operations below are idempotent (same input, same final state), so
    // retrying a transient network failure is safe.
    async modifica(id: string, patch: { titolo?: string; note?: string | null }) {
      await conRetry(() => updateRipasso(id, patch));
      await reload();
    },
    async elimina(id: string) {
      await conRetry(() => deleteRipasso(id));
      await reload();
    },
    async completaOccorrenza(occId: string, done: boolean) {
      await conRetry(() => toggleCompletata(occId, done));
      await reload();
    },
    async spostaOccorrenza(occId: string, nuovaData: Date) {
      await conRetry(() =>
        updateOccorrenza(occId, { scheduled_at: nuovaData.toISOString() })
      );
      await reload();
    },
  };

  return { ripassi, loading, error, ...azioni };
}
