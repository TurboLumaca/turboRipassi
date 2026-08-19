/**
 * Controller layer — Hook for Flashback / "Ricordi" feature.
 * Coordinates daily memory selection and manages dismissal and celebration states.
 */
import { useCallback, useMemo, useState } from "react";
import {
  trovaFlashbackDelGiorno,
  type FlashbackItem,
} from "@/model/ripassi/flashbackLogic";
import { useRipassiCtx } from "@/controller/RipassiContext";
import type { RipassoCompleto } from "@/model/types";

export interface StatoFlashback {
  flashback: FlashbackItem | null;
  celebrato: boolean;
  dismiss: () => void;
  confermaRicordo: () => void;
}

export function useFlashback(
  ripassiProp?: RipassoCompleto[],
  dataRiferimento?: Date
): StatoFlashback {
  const ctx = useRipassiCtx();
  const ripassi = ripassiProp ?? ctx.ripassi;

  const [esclusiIds, setEsclusiIds] = useState<string[]>([]);
  const [celebrato, setCelebrato] = useState(false);

  const flashback = useMemo(() => {
    return trovaFlashbackDelGiorno(ripassi, dataRiferimento ?? new Date(), esclusiIds);
  }, [ripassi, dataRiferimento, esclusiIds]);

  const dismiss = useCallback(() => {
    if (flashback) {
      setEsclusiIds((prev) => [...prev, flashback.voceId]);
      setCelebrato(false);
    }
  }, [flashback]);

  const confermaRicordo = useCallback(() => {
    if (flashback) {
      setCelebrato(true);
    }
  }, [flashback]);

  return {
    flashback,
    celebrato,
    dismiss,
    confermaRicordo,
  };
}
