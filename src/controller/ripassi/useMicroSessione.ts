/**
 * Controller — hook managing the state and actions of a Quick Review (Micro-Sessione 60s).
 */
import { useCallback, useRef, useState } from "react";
import { useRipassiCtx } from "../RipassiContext";
import { messaggioErrore } from "@/model/shared/errorMessages";
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
  /**
   * Why the last tap did nothing, when it did nothing. Without it a failed
   * write left the card exactly as it was: the same concept, the same "1 di 2",
   * no error — indistinguishable from a button that is not wired up.
   */
  errore: string | null;
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
  const [errore, setErrore] = useState<string | null>(null);

  const tempoInizioRef = useRef<number>(0);
  /**
   * The selection and the cursor into it, as refs.
   *
   * Both callers of `avanza` run after an await, and by then the callback that
   * captured them may be a stale closure over a list the Controller has since
   * reloaded. Refs are read at the moment of the move, which is the only
   * reading that can be right.
   */
  const elementiRef = useRef<VoceRipasso[]>([]);
  const indiceRef = useRef(0);

  const impostaIndice = useCallback((i: number) => {
    indiceRef.current = i;
    setIndiceCorrente(i);
  }, []);

  const elementoCorrente =
    !completata && indiceCorrente < elementi.length ? elementi[indiceCorrente] : null;

  const avvia = useCallback(
    (limite: number = 2) => {
      const sel = selezionaElementiMicroSessione(ripassi, { limiteElementi: limite });
      elementiRef.current = sel;
      setElementi(sel);
      impostaIndice(0);
      setCompletata(false);
      setConteggioCompletati(0);
      setSecondiTrascorsi(0);
      setErrore(null);
      tempoInizioRef.current = Date.now();
      setAperta(true);
    },
    [ripassi, impostaIndice]
  );

  const calcolaDurata = useCallback(() => {
    const ora = Date.now();
    const trascorso = Math.max(1, Math.round((ora - (tempoInizioRef.current || ora)) / 1000));
    setSecondiTrascorsi(trascorso);
  }, []);

  /**
   * Moves to the next concept, or to the summary when there is none.
   *
   * Reads the cursor and the list from refs rather than from the closure: the
   * captured version could be one render behind, which is what left the card
   * sitting on the concept it had just saved.
   */
  const avanza = useCallback(() => {
    const prossimo = indiceRef.current + 1;
    if (prossimo < elementiRef.current.length) {
      impostaIndice(prossimo);
      return;
    }
    calcolaDurata();
    setCompletata(true);
  }, [calcolaDurata, impostaIndice]);

  const confermaCorrente = useCallback(
    async (microNota?: string) => {
      if (!elementoCorrente) return;

      setInCaricamento(true);
      setErrore(null);
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
        avanza();
      } catch (e) {
        setErrore(messaggioErrore(e));
      } finally {
        setInCaricamento(false);
      }
    },
    [elementoCorrente, completaOccorrenza, modifica, avanza]
  );

  const posticipaCorrente = useCallback(async () => {
    if (!elementoCorrente) return;

    setInCaricamento(true);
    setErrore(null);
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
      avanza();
    } catch (e) {
      setErrore(messaggioErrore(e));
    } finally {
      setInCaricamento(false);
    }
  }, [elementoCorrente, spostaOccorrenza, avanza]);

  const chiudi = useCallback(() => {
    setAperta(false);
    setCompletata(false);
    elementiRef.current = [];
    setElementi([]);
    impostaIndice(0);
    setInCaricamento(false);
    setErrore(null);
  }, [impostaIndice]);

  return {
    aperta,
    elementi,
    indiceCorrente,
    elementoCorrente,
    completata,
    conteggioCompletati,
    secondiTrascorsi,
    inCaricamento,
    errore,
    avvia,
    confermaCorrente,
    posticipaCorrente,
    chiudi,
  };
}
