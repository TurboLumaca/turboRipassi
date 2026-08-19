/**
 * Controller layer — Hook for aggregated review statistics.
 * Combines Mental Capital metrics with Ebbinghaus Study Time Saved calculations.
 */
import { useMemo } from "react";
import {
  calcolaStatisticheCapitale,
  type StatisticheCapitaleMentale,
} from "@/model/ripassi/capitaleMentaleLogic";
import {
  calcolaTempoRisparmiato,
  type RisparmioTempoResult,
} from "@/model/ripassi/savingsLogic";
import { useRipassiCtx } from "@/controller/RipassiContext";
import type { RipassoCompleto } from "@/model/types";

export interface StatoStatisticheRipassi extends StatisticheCapitaleMentale {
  statistiche: StatisticheCapitaleMentale;
  risparmioTempo: RisparmioTempoResult;
}

export function useStatisticheRipassi(
  ripassiProp?: RipassoCompleto[]
): StatoStatisticheRipassi {
  const ctx = useRipassiCtx();
  const ripassi = ripassiProp ?? ctx.ripassi;

  const statistiche = useMemo(
    () => calcolaStatisticheCapitale(ripassi),
    [ripassi]
  );

  const risparmioTempo = useMemo(
    () => calcolaTempoRisparmiato(ripassi),
    [ripassi]
  );

  return {
    ...statistiche,
    statistiche,
    risparmioTempo,
  };
}
