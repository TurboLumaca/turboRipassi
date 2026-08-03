/**
 * Controller — shared reviews context for the authenticated area.
 * A single useRipassi + useLocalCache instance for all screens, so the
 * Realtime subscription is unique and every screen sees the same state.
 */
import React, { createContext, use, useMemo } from "react";
import { useRipassi } from "./ripassi/useRipassi";
import { useLocalCache } from "./useLocalCache";

type RipassiCtx = ReturnType<typeof useRipassi> & {
  cache: ReturnType<typeof useLocalCache>;
};

const Ctx = createContext<RipassiCtx | null>(null);

export function RipassiProvider({ children }: { children: React.ReactNode }) {
  const ripassi = useRipassi(true);
  const cache = useLocalCache(ripassi.ripassi, true);
  // Spreading inline would hand every consumer a new object on each render,
  // defeating the memoization the two hooks already do.
  const valore = useMemo(() => ({ ...ripassi, cache }), [ripassi, cache]);
  return <Ctx value={valore}>{children}</Ctx>;
}

export function useRipassiCtx(): RipassiCtx {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useRipassiCtx must be used inside <RipassiProvider>.");
  return ctx;
}
