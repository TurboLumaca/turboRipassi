/**
 * Controller — la sessione di oggi: una coda chiusa e una fine dichiarata.
 *
 * L'infinite scroll non entra mai dalla porta dell'interfaccia, entra da
 * quella dei contenuti: nessuno propone "togliamo la fine", si propone "un
 * altro concetto consigliato". L'unico modo di tenerlo fuori è che la fine
 * sia una cosa che il sistema *sa* — un numero deciso in partenza e una
 * schermata che dice di aver finito di chiedere attenzione — e non
 * un'assenza accidentale di contenuti.
 *
 * La schermata di chiusura non è un ponte verso altro: è il punteggio della
 * sessione, e il punteggio è quel che è successo ai concetti.
 */
import { useCallback, useMemo, useState } from "react";
import { useRipassiCtx } from "../RipassiContext";
import { isPausaAttiva } from "@/model/ripassi/pausaLogic";
import { domandaDi } from "@/model/ripassi/richiamoLogic";
import {
  anticipoDomani,
  codaDiOggi,
  riepilogoChiusura,
  type AnticipoDomani,
  type CodaGiornaliera,
} from "@/model/ripassi/sessioneLogic";

export interface StatoSessioneGiornaliera extends CodaGiornaliera {
  /** Quanti dei concetti di oggi sono stati chiusi: il "2 di 5". */
  fatti: number;
  /** Il totale su cui si misura il "2 di 5": coda più già fatti oggi. */
  totale: number;
  /** True quando la coda di oggi è finita e la chiusura va mostrata. */
  chiusuraAperta: boolean;
  /** La frase al centro della chiusura. */
  riepilogo: string;
  /**
   * Che cosa c'è domani. Null in Modalità Riposo: l'anticipo è
   * un'informazione utile, ma in riposo diventa una ragione per tornare, e il
   * riposo esiste esattamente per non averne.
   */
  domani: AnticipoDomani | null;
  chiudiChiusura: () => void;
}

export function useSessioneGiornaliera(): StatoSessioneGiornaliera {
  const { ripassi, pausa } = useRipassiCtx();
  /**
   * La chiusura si può congedare, e una volta congedata non torna finché la
   * coda non si riapre da sola (domani, o perché è arrivato un rientro).
   */
  const [congedata, setCongedata] = useState(false);

  const coda = useMemo(() => codaDiOggi(ripassi), [ripassi]);

  const domani = useMemo(
    () =>
      isPausaAttiva(pausa)
        ? null
        : anticipoDomani(ripassi, new Date(), (r) => domandaDi(r)),
    [ripassi, pausa]
  );

  const fatti = coda.completatiOggi;
  const totale = coda.voci.length + fatti;

  // Aperta quando c'è stato qualcosa da fare e non c'è più. Senza la prima
  // condizione la chiusura comparirebbe a chi apre l'app in un giorno vuoto,
  // trasformando "oggi non c'era niente" in una celebrazione di niente.
  const chiusuraAperta = !congedata && coda.voci.length === 0 && fatti > 0;

  const chiudiChiusura = useCallback(() => setCongedata(true), []);

  return {
    ...coda,
    fatti,
    totale,
    chiusuraAperta,
    riepilogo: riepilogoChiusura(fatti),
    domani,
    chiudiChiusura,
  };
}
