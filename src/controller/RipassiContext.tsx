/**
 * Controller — contesto condiviso dei ripassi per l'area autenticata.
 * Una sola istanza di useRipassi + useLocalCache per tutte le schermate,
 * così la subscription Realtime è unica e ogni schermata vede lo stesso stato.
 */
import React, { createContext, use } from "react";
import { useRipassi } from "./useRipassi";
import { useLocalCache } from "./useLocalCache";

type RipassiCtx = ReturnType<typeof useRipassi> & {
  cache: ReturnType<typeof useLocalCache>;
};

const Ctx = createContext<RipassiCtx | null>(null);

export function RipassiProvider({ children }: { children: React.ReactNode }) {
  const ripassi = useRipassi(true);
  const cache = useLocalCache(ripassi.ripassi, true);
  return <Ctx value={{ ...ripassi, cache }}>{children}</Ctx>;
}

export function useRipassiCtx(): RipassiCtx {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useRipassiCtx deve stare dentro <RipassiProvider>.");
  return ctx;
}
