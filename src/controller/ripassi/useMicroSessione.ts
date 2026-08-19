/**
 * Controller — hook managing the state and actions of a Quick Review (Micro-Sessione 60s).
 */
import { useCallback, useRef, useState } from "react";
import { useRipassiCtx } from "../RipassiContext";
import {
  selezionaElementiMicroSessione,
  aggiungiMicroNota,
} from "@/model/ripassi/microSessioneLogic";
import type { VoceRipasso } from "@/model/ripassi/ripassiLogic";

export interface StatoMicroSessione {
  aperta: boolean;
  elementi: VoceRipasso[];
  indiceCorrente: number;
  elementoCorrente: VoceRipasso | null;
  completata: boolean;
  conteggioCompletati: number;
  secondiTrascorsi: number;
  inCaricamento: boolean;
  avvia: (limite?: number) => void;
  confermaCorrente: (microNota?: string) => Promise<void>;
  posticipaCorrente: () => Promise<void>;
  chiudi: () => void;
}

export function useMicroSessione(): StatoMicroSessione {
  const { ripassi, completaOccorrenza, spostaOccorrenza, modifica } = useRipassiCtx();

  const [aperta, setAperta] = useState(false);
  const [elementi, setElementi] = useState<VoceRipasso[]>([]);
  const [indiceCorrente, setIndiceCorrente] = useState(0);
  const [completata, setCompletata] = useState(false);
  const [conteggioCompletati, setConteggioCompletati] = useState(0);
  const [secondiTrascorsi, setSecondiTrascorsi] = useState(0);
  const [inCaricamento, setInCaricamento] = useState(false);

  const tempoInizioRef = useRef<number>(0);

  const elementoCorrente =
    !completata && indiceCorrente < elementi.length ? elementi[indiceCorrente] : null;

  const avvia = useCallback(
    (limite: number = 2) => {
      const sel = selezionaElementiMicroSessione(ripassi, { limiteElementi: limite });
      setElementi(sel);
      setIndiceCorrente(0);
      setCompletata(false);
      setConteggioCompletati(0);
      setSecondiTrascorsi(0);
      tempoInizioRef.current = Date.now();
      setAperta(true);
    },
    [ripassi]
  );

  const calcolaDurata = useCallback(() => {
    const ora = Date.now();
    const trascorso = Math.max(1, Math.round((ora - (tempoInizioRef.current || ora)) / 1000));
    setSecondiTrascorsi(trascorso);
  }, []);

  const confermaCorrente = useCallback(
    async (microNota?: string) => {
      if (!elementoCorrente) return;

      setInCaricamento(true);
      try {
        await completaOccorrenza(elementoCorrente.occorrenza.id, true);

        if (microNota && microNota.trim()) {
          const nuoveNote = aggiungiMicroNota(
            elementoCorrente.ripasso.note,
            microNota
          );
          await modifica(elementoCorrente.ripasso.id, { note: nuoveNote });
        }

        setConteggioCompletati((c) => c + 1);

        if (indiceCorrente + 1 < elementi.length) {
          setIndiceCorrente((i) => i + 1);
        } else {
          calcolaDurata();
          setCompletata(true);
        }
      } finally {
        setInCaricamento(false);
      }
    },
    [elementoCorrente, completaOccorrenza, modifica, indiceCorrente, elementi.length, calcolaDurata]
  );

  const posticipaCorrente = useCallback(async () => {
    if (!elementoCorrente) return;

    setInCaricamento(true);
    try {
      const dataOrig = new Date(elementoCorrente.occorrenza.scheduled_at);
      const domani = new Date();
      domani.setDate(domani.getDate() + 1);
      if (Number.isFinite(dataOrig.getTime())) {
        domani.setHours(
          dataOrig.getHours(),
          dataOrig.getMinutes(),
          dataOrig.getSeconds(),
          dataOrig.getMilliseconds()
        );
      } else {
        domani.setHours(9, 0, 0, 0);
      }

      await spostaOccorrenza(elementoCorrente.occorrenza.id, domani, false);

      if (indiceCorrente + 1 < elementi.length) {
        setIndiceCorrente((i) => i + 1);
      } else {
        calcolaDurata();
        setCompletata(true);
      }
    } finally {
      setInCaricamento(false);
    }
  }, [elementoCorrente, spostaOccorrenza, indiceCorrente, elementi.length, calcolaDurata]);

  const chiudi = useCallback(() => {
    setAperta(false);
    setCompletata(false);
    setElementi([]);
    setIndiceCorrente(0);
    setInCaricamento(false);
  }, []);

  return {
    aperta,
    elementi,
    indiceCorrente,
    elementoCorrente,
    completata,
    conteggioCompletati,
    secondiTrascorsi,
    inCaricamento,
    avvia,
    confermaCorrente,
    posticipaCorrente,
    chiudi,
  };
}
