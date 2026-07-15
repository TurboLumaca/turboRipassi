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
import type { RipassoCompleto } from "@/model/types";

export function useRipassi(enabled: boolean) {
  const [ripassi, setRipassi] = useState<RipassoCompleto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchRipassiCompleti();
      if (mounted.current) setRipassi(data);
    } catch (e: any) {
      if (mounted.current) setError(e?.message ?? "Errore di caricamento.");
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
    async crea(input: { titolo: string; note: string | null; includi1h: boolean }) {
      await createRipasso(input);
      await reload();
    },
    async modifica(id: string, patch: { titolo?: string; note?: string | null }) {
      await updateRipasso(id, patch);
      await reload();
    },
    async elimina(id: string) {
      await deleteRipasso(id);
      await reload();
    },
    async completaOccorrenza(occId: string, done: boolean) {
      await toggleCompletata(occId, done);
      await reload();
    },
    async spostaOccorrenza(occId: string, nuovaData: Date) {
      await updateOccorrenza(occId, { scheduled_at: nuovaData.toISOString() });
      await reload();
    },
  };

  return { ripassi, loading, error, ...azioni };
}
