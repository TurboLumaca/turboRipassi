/**
 * Controller — shared reviews context for the authenticated area.
 * A single useRipassi + useLocalCache instance for all screens, so the
 * Realtime subscription is unique and every screen sees the same state.
 *
 * This is also where the list stops being "what the server said" and becomes
 * "what the user has": the queue of saves waiting for a connection is merged in
 * here, once, so a ripasso written offline is an ordinary ripasso to every
 * screen, every search and the reminder scheduler. What the merge cannot carry
 * inside a `RipassoCompleto` — whether a row has reached the server yet — is
 * published beside it as a set of ids.
 */
import React, { createContext, use, useMemo } from "react";
import { useRipassi, type StatoRipassi } from "./ripassi/useRipassi";
import { useLocalCache, type StatoCache } from "./useLocalCache";
import { useCoda, type StatoCoda } from "./useCoda";
import { useNotificheRipassi } from "./useNotificheRipassi";
import {
  allegatiInCoda,
  daCaricare as calcolaDaCaricare,
  idRipassiInCoda,
  uniscoConCoda,
  type DaCaricare,
} from "@/model/outbox/codaLogic";

/** What the authenticated area reads: the reviews, the offline cache, the queue. */
export interface ContestoRipassi extends StatoRipassi {
  cache: StatoCache;
  coda: StatoCoda;
  /**
   * Ripassi that exist only on this device. The screens use it to say so, and
   * to refuse the operations that need a row on the server — rescheduling an
   * occurrence, ticking it off — instead of letting them fail.
   */
  idsInCoda: Set<string>;
  /** One line per ripasso still waiting to go up, for the home screen to list. */
  daCaricare: DaCaricare[];
}

const Ctx = createContext<ContestoRipassi | null>(null);

export function RipassiProvider({ children }: { children: React.ReactNode }) {
  const base = useRipassi();
  const coda = useCoda(base.reload);

  const ripassi = useMemo(
    () => uniscoConCoda(base.ripassi, coda.voci),
    [base.ripassi, coda.voci]
  );

  // Memoized because it feeds effect dependencies in useLocalCache: a fresh Set
  // on every render would restart the rotation on every render.
  const allegatiDaCaricare = useMemo(() => allegatiInCoda(coda.voci), [coda.voci]);
  const idsInCoda = useMemo(() => idRipassiInCoda(coda.voci), [coda.voci]);
  const daCaricare = useMemo(() => calcolaDaCaricare(coda.voci), [coda.voci]);

  const cache = useLocalCache(ripassi, allegatiDaCaricare);
  useNotificheRipassi(ripassi, undefined, base.pausa);

  const valore: ContestoRipassi = { ...base, ripassi, cache, coda, idsInCoda, daCaricare };
  return <Ctx value={valore}>{children}</Ctx>;
}

export function useRipassiCtx(): ContestoRipassi {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useRipassiCtx must be used inside <RipassiProvider>.");
  return ctx;
}
