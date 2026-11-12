/**
 * Controller — the materie, shared by every screen of the authenticated area.
 *
 * A context of its own and not a field of `RipassiContext`: the two have
 * different lifecycles (a handful of rows that change rarely, against a list
 * kept live by Realtime) and the screens that only draw a ripasso should not
 * be re-rendered by either.
 */
import React, { createContext, use } from "react";
import { useMaterie, type StatoMaterie } from "./useMaterie";

const Ctx = createContext<StatoMaterie | null>(null);

export function MaterieProvider({ children }: { children: React.ReactNode }) {
  const stato = useMaterie();
  return <Ctx value={stato}>{children}</Ctx>;
}

export function useMaterieCtx(): StatoMaterie {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useMaterieCtx must be used inside <MaterieProvider>.");
  return ctx;
}
