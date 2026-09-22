/**
 * Controller — il richiamo: la micro-sheet che sta fra il tondino e la spunta.
 *
 * È l'intervento che rende il test T2 strutturalmente irrefutabile. Finché
 * completare è un tocco su un cerchio, "vincere il meccanismo" e "aver
 * imparato" sono due cose diverse e la prima è molto più facile; quando il
 * completamento *è* un tentativo di richiamo, non lo sono più. Non c'è modo di
 * far salire il contatore senza aver provato a ricordare.
 *
 * Tre passi e non uno: la domanda (la risposta non si vede), la risposta, e —
 * solo quando il richiamo è andato a metà — l'errore produttivo. Il terzo è
 * l'unico momento in cui l'app aggiunge qualcosa invece di registrare: dice
 * che cosa è appena successo alla memoria, e quando il concetto rientra.
 */
import { useCallback, useState } from "react";
import { useRipassiCtx } from "../RipassiContext";
import { messaggioErrore } from "@/model/shared/errorMessages";
import {
  FRASI_ERRORE_PRODUTTIVO,
  domandaDi,
  frasePerConcetto,
  rientroDopoErrore,
  testoRientro,
  type EsitoRichiamo,
} from "@/model/ripassi/richiamoLogic";
import type { VoceRipasso } from "@/model/ripassi/ripassiLogic";

/** Dove si trova la micro-sheet. `null` quando è chiusa. */
export type PassoRichiamoAperto = "domanda" | "risposta" | "erroreProduttivo";

/** Che cosa dire dopo un richiamo andato a metà. */
export interface FeedbackErroreProduttivo {
  /** La frase sul valore del tentativo fallito, scelta per concetto. */
  frase: string;
  /** Quando il concetto rientra, in chiaro. */
  rientro: string;
}

export interface StatoRichiamo {
  voce: VoceRipasso | null;
  passo: PassoRichiamoAperto;
  /** La domanda da porre, già risolta (propria o generica). */
  domanda: string;
  feedback: FeedbackErroreProduttivo | null;
  inCaricamento: boolean;
  errore: string | null;
  /** Apre la sheet sulla domanda. */
  apri: (voce: VoceRipasso) => void;
  /** Scopre la risposta. Il curiosity gap si chiude qui e non prima. */
  mostraRisposta: () => void;
  /** Registra l'esito e chiude, o passa all'errore produttivo. */
  rispondi: (esito: EsitoRichiamo) => Promise<void>;
  /**
   * Completa senza passare dalla domanda: la via d'uscita per chi ha già
   * richiamato fuori dall'app. Esiste perché punire chi ha studiato davvero
   * sul tram sarebbe il modo più rapido di insegnare che la spunta conta più
   * del richiamo.
   */
  completaDiretto: (voce: VoceRipasso) => Promise<void>;
  chiudi: () => void;
}

export function useRichiamo(): StatoRichiamo {
  const { completaOccorrenza, aggiungiRichiamo } = useRipassiCtx();

  const [voce, setVoce] = useState<VoceRipasso | null>(null);
  const [passo, setPasso] = useState<PassoRichiamoAperto>("domanda");
  const [feedback, setFeedback] = useState<FeedbackErroreProduttivo | null>(null);
  const [inCaricamento, setInCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const apri = useCallback((v: VoceRipasso) => {
    setVoce(v);
    setPasso("domanda");
    setFeedback(null);
    setErrore(null);
  }, []);

  const chiudi = useCallback(() => {
    setVoce(null);
    setPasso("domanda");
    setFeedback(null);
    setInCaricamento(false);
    setErrore(null);
  }, []);

  const mostraRisposta = useCallback(() => setPasso("risposta"), []);

  const rispondi = useCallback(
    async (esito: EsitoRichiamo) => {
      if (!voce) return;
      setInCaricamento(true);
      setErrore(null);
      try {
        await completaOccorrenza(voce.occorrenza.id, true);

        if (esito === "ricordato") {
          setVoce(null);
          setPasso("domanda");
          return;
        }

        // Il rientro è una scrittura a parte, e volutamente non è dentro la
        // stessa operazione del completamento: se fallisce, il richiamo
        // resta registrato — lo scheduling normale riporterà comunque il
        // concetto — e l'unica cosa che manca è l'anticipo di tre giorni.
        const quando = rientroDopoErrore();
        try {
          await aggiungiRichiamo(voce.ripasso.id, quando);
        } catch (e) {
          setErrore(messaggioErrore(e));
        }
        setFeedback({
          frase: frasePerConcetto(FRASI_ERRORE_PRODUTTIVO, voce.ripasso.id),
          rientro: testoRientro(quando),
        });
        setPasso("erroreProduttivo");
      } catch (e) {
        setErrore(messaggioErrore(e));
      } finally {
        setInCaricamento(false);
      }
    },
    [voce, completaOccorrenza, aggiungiRichiamo]
  );

  const completaDiretto = useCallback(
    async (v: VoceRipasso) => {
      setInCaricamento(true);
      setErrore(null);
      try {
        await completaOccorrenza(v.occorrenza.id, !v.occorrenza.is_completed);
      } catch (e) {
        setErrore(messaggioErrore(e));
      } finally {
        setInCaricamento(false);
      }
    },
    [completaOccorrenza]
  );

  return {
    voce,
    passo,
    domanda: voce ? domandaDi(voce.ripasso) : "",
    feedback,
    inCaricamento,
    errore,
    apri,
    mostraRisposta,
    rispondi,
    completaDiretto,
    chiudi,
  };
}
