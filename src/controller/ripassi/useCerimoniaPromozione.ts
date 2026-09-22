/**
 * Controller — la Cerimonia di Promozione.
 *
 * È il juice più grande dell'app, e sta qui e in nessun altro posto. La
 * gerarchia è a tre livelli — silenzio per la spunta quotidiana, un accenno
 * per la fine sessione, la cerimonia piena solo per una promozione — e la
 * regola che la tiene in piedi è che il livello segue il *valore* e non la
 * frequenza. È l'unico argine noto contro l'inflazione del rinforzo: un
 * sistema che celebra tutto deve celebrare sempre più forte, e finisce per
 * non dire più niente.
 *
 * L'evento non viene inventato qui: è già nel Model. Questo hook si limita a
 * trovare il primo concetto diventato permanente che non è ancora stato
 * celebrato, e a ricordarsi — sul server — che lo è stato.
 */
import { useCallback, useState } from "react";
import { useRipassiCtx } from "../RipassiContext";
import { reportError } from "@/config/crashReporting";
import { progressoMaturazione } from "@/model/ripassi/capitaleMentaleLogic";
import { dataPromozione } from "@/model/ripassi/patrimonioLogic";
import {
  FRASI_PROMOZIONE,
  frasePerConcetto,
} from "@/model/ripassi/richiamoLogic";
import type { RipassoCompleto } from "@/model/types";

/** Tutto ciò che la schermata di cerimonia disegna. */
export interface CerimoniaDaMostrare {
  ripasso: RipassoCompleto;
  /** Le date dei richiami che hanno fatto la maturazione, in ordine. */
  storia: string[];
  /** Quando la promozione è avvenuta. */
  promossoIl: string;
  /** La frase al centro: certa nella consegna, varia solo nella forma. */
  frase: string;
}

export interface StatoCerimonia {
  /** Il concetto da celebrare adesso, o null quando non ce n'è nessuno. */
  cerimonia: CerimoniaDaMostrare | null;
  /** Chiude la cerimonia e la segna come mostrata. */
  chiudi: () => Promise<void>;
}

export function useCerimoniaPromozione(): StatoCerimonia {
  const { ripassi, segnaCerimoniaMostrata } = useRipassiCtx();
  /**
   * I concetti già celebrati in questa sessione.
   *
   * Il server è la memoria vera (`ceremony_shown_at`), ma la scrittura e il
   * reload che la riporta indietro richiedono un viaggio: senza questo insieme
   * la cerimonia riapparirebbe per il tempo di quel viaggio, cioè ogni volta
   * che la connessione è lenta.
   */
  const [celebratiOra, setCelebratiOra] = useState<Set<string>>(new Set());

  // Non avvolto in useMemo: il React Compiler (attivo in app.json) memoizza
  // questo calcolo dalle stesse dipendenze che una lista scritta a mano
  // porterebbe — e la versione a mano non era preservabile, quindi era
  // memoizzazione dichiarata e non ottenuta.
  const cerimonia = ((): CerimoniaDaMostrare | null => {
    for (const ripasso of ripassi) {
      if (ripasso.ceremony_shown_at !== null && ripasso.ceremony_shown_at !== undefined) {
        continue;
      }
      if (celebratiOra.has(ripasso.id)) continue;
      const progresso = progressoMaturazione(ripasso);
      if (progresso.livello !== "permanente") continue;
      const promossoIl = dataPromozione(ripasso);
      if (promossoIl === null) continue;
      return {
        ripasso,
        storia: progresso.storia,
        promossoIl,
        frase: frasePerConcetto(FRASI_PROMOZIONE, ripasso.id),
      };
    }
    return null;
  })();

  const chiudi = useCallback(async () => {
    const id = cerimonia?.ripasso.id;
    if (!id) return;
    // Chiude comunque: la scrittura può fallire — è una scrittura — e una
    // cerimonia che resta sullo schermo perché il server non risponde è una
    // schermata da cui non si esce.
    setCelebratiOra((precedenti) => new Set(precedenti).add(id));
    try {
      await segnaCerimoniaMostrata(id);
    } catch (e) {
      reportError(e, { operazione: "segnaCerimoniaMostrata", ripassoId: id });
    }
  }, [cerimonia, segnaCerimoniaMostrata]);

  return { cerimonia, chiudi };
}
