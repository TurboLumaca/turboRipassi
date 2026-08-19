/**
 * Controller layer — Hook for Mental Capital & Permanent Knowledge tracking.
 * Reactively aggregates consolidation levels and metrics from the reviews context.
 */
import { useMemo } from "react";
import {
  calcolaStatisticheCapitale,
  type StatisticheCapitaleMentale,
} from "@/model/ripassi/capitaleMentaleLogic";
import { useRipassiCtx } from "@/controller/RipassiContext";
import type { RipassoCompleto } from "@/model/types";

export interface StatoCapitaleMentale extends StatisticheCapitaleMentale {
  statistiche: StatisticheCapitaleMentale;
}

/**
 * Reactively computes Mental Capital statistics.
 * Defaults to the global reviews list in `RipassiContext` if no custom list is passed.
 */
export function useCapitaleMentale(
  ripassiProp?: RipassoCompleto[]
): StatoCapitaleMentale {
  const ctx = useRipassiCtx();
  const ripassi = ripassiProp ?? ctx.ripassi;

  const statistiche = useMemo(
    () => calcolaStatisticheCapitale(ripassi),
    [ripassi]
  );

  return {
    ...statistiche,
    statistiche,
  };
}
