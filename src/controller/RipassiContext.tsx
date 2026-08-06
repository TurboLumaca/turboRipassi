/**
 * Controller — shared reviews context for the authenticated area.
 * A single useRipassi + useLocalCache instance for all screens, so the
 * Realtime subscription is unique and every screen sees the same state.
 */
import React, { createContext, use } from "react";
import { useRipassi, type StatoRipassi } from "./ripassi/useRipassi";
import { useLocalCache, type StatoCache } from "./useLocalCache";
import { useNotificheRipassi } from "./useNotificheRipassi";

/** What the authenticated area reads: the reviews, plus the offline cache. */
export interface ContestoRipassi extends StatoRipassi {
  cache: StatoCache;
}

const Ctx = createContext<ContestoRipassi | null>(null);

export function RipassiProvider({ children }: { children: React.ReactNode }) {
  const ripassi = useRipassi();
  const cache = useLocalCache(ripassi.ripassi);
  useNotificheRipassi(ripassi.ripassi);
  const valore: ContestoRipassi = { ...ripassi, cache };
  return <Ctx value={valore}>{children}</Ctx>;
}

export function useRipassiCtx(): ContestoRipassi {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useRipassiCtx must be used inside <RipassiProvider>.");
  return ctx;
}
