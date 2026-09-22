/**
 * Model layer — il Patrimonio: quali concetti sono diventati permanenti,
 * quando, e a che ritmo.
 *
 * Due cose vivono qui e stanno insieme per una ragione.
 *
 * La prima è la rarità autentica. Un gioco riserva la tipografia più grande
 * al drop leggendario, che è raro perché qualcuno ha deciso una percentuale;
 * qui il numero grande è la quota di conoscenza che ha attraversato sei mesi,
 * che è rara perché sei mesi sono sei mesi. È la stessa grammatica visiva
 * applicata a un fatto invece che a un'estrazione.
 *
 * La seconda è il canarino: il *rendimento formativo*, promozioni per
 * trimestre. Sta nel codice e non in una slide perché una metrica che vive
 * solo in un documento è una metrica che alla terza riunione non esiste più.
 * Se un giorno la retention sale e questo numero no, l'app è diventata un
 * casinò con un piano di studi — e il numero lo dirà prima che lo dica
 * qualcuno.
 */
import type { RipassoCompleto } from "../types";
import {
  GIORNI_PERMANENTE,
  RICHIAMI_PERMANENTE,
  progressoMaturazione,
} from "./capitaleMentaleLogic";

const GIORNO_MS = 1000 * 60 * 60 * 24;

/** Un concetto permanente, con la storia che lo ha reso tale. */
export interface ConcettoPermanente {
  ripasso: RipassoCompleto;
  /** ISO del richiamo che ha completato la maturazione. */
  promossoIl: string;
  /** Le date dei richiami completati, in ordine — la storia di spacing. */
  storia: string[];
}

/**
 * Quando un concetto è diventato permanente, o null se non lo è.
 *
 * Il momento esatto è il primo richiamo in cui *entrambe* le condizioni
 * risultano soddisfatte: il quarto richiamo o successivo, e almeno sei mesi
 * dal primo appuntamento. Prenderne uno qualsiasi (l'ultimo, per dire)
 * avrebbe dato una data sbagliata a ogni concetto ripassato ancora dopo la
 * promozione, e la cerimonia racconta proprio quella data.
 */
export function dataPromozione<T extends object>(
  voce: { occorrenze: RipassoCompleto["occorrenze"] } & T,
  adesso: Date = new Date()
): string | null {
  const progresso = progressoMaturazione(voce, adesso);
  if (progresso.livello !== "permanente") return null;

  const ordinate = [...voce.occorrenze].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );
  const primaMs = new Date(ordinate[0].scheduled_at).getTime();

  for (let i = 0; i < progresso.storia.length; i++) {
    if (i + 1 < RICHIAMI_PERMANENTE) continue;
    const t = new Date(progresso.storia[i]).getTime();
    if (Math.round((t - primaMs) / GIORNO_MS) >= GIORNI_PERMANENTE) {
      return progresso.storia[i];
    }
  }
  // Irraggiungibile finché `progressoMaturazione` e questa funzione leggono la
  // stessa regola; resta come rete perché sono due letture e le letture
  // divergono.
  return null;
}

/**
 * I concetti permanenti, dal più recente al più antico.
 *
 * Ordinati per data di promozione e non per titolo: la galleria racconta una
 * cronologia, e la prima cosa che si vuole rivedere è l'ultima cosa che ce
 * l'ha fatta.
 */
export function concettiPermanenti(
  ripassi: readonly RipassoCompleto[],
  adesso: Date = new Date()
): ConcettoPermanente[] {
  const esito: ConcettoPermanente[] = [];
  for (const ripasso of ripassi) {
    const promossoIl = dataPromozione(ripasso, adesso);
    if (promossoIl === null) continue;
    esito.push({
      ripasso,
      promossoIl,
      storia: progressoMaturazione(ripasso, adesso).storia,
    });
  }
  return esito.sort(
    (a, b) => new Date(b.promossoIl).getTime() - new Date(a.promossoIl).getTime()
  );
}

/** Giorni in un trimestre, per la normalizzazione del canarino. */
export const GIORNI_TRIMESTRE = 91;

/** Il canarino, e le due cifre che servono a leggerlo. */
export interface RendimentoFormativo {
  /** Promozioni cadute nella finestra osservata. */
  promozioniNellaFinestra: number;
  /** Giorni osservati. */
  giorniFinestra: number;
  /** Promozioni per trimestre, la cifra da sorvegliare. */
  perTrimestre: number;
  /** Concetti che stanno maturando: il serbatoio da cui verranno le prossime. */
  inMaturazione: number;
}

/**
 * Promozioni per trimestre.
 *
 * Normalizzato e non assoluto perché deve restare confrontabile fra un mese e
 * l'altro; e contato sulle promozioni e non sulle sessioni perché è
 * esattamente la differenza fra *retention by value* e *retention by anxiety*.
 * Chi torna tutti i giorni e non promuove niente è il caso che nessuna
 * dashboard di engagement distingue da chi sta imparando, ed è il caso che
 * questa funzione esiste per distinguere.
 */
export function rendimentoFormativo(
  ripassi: readonly RipassoCompleto[],
  giorniFinestra: number = GIORNI_TRIMESTRE,
  adesso: Date = new Date()
): RendimentoFormativo {
  const finestra = Math.max(1, giorniFinestra);
  const daMs = adesso.getTime() - finestra * GIORNO_MS;

  let promozioniNellaFinestra = 0;
  let inMaturazione = 0;

  for (const ripasso of ripassi) {
    const progresso = progressoMaturazione(ripasso, adesso);
    if (progresso.livello === "permanente") {
      const quando = dataPromozione(ripasso, adesso);
      if (quando !== null && new Date(quando).getTime() >= daMs) {
        promozioniNellaFinestra += 1;
      }
      continue;
    }
    if (progresso.richiami > 0) inMaturazione += 1;
  }

  return {
    promozioniNellaFinestra,
    giorniFinestra: finestra,
    perTrimestre:
      Math.round((promozioniNellaFinestra * GIORNI_TRIMESTRE * 10) / finestra) / 10,
    inMaturazione,
  };
}
