/**
 * Design system — il budget del juice.
 *
 * Il juice (feedback sensoriale su un'azione) è una tecnologia neutra: il
 * problema non è che ci sia, è che ha una dinamica interna. Il rinforzo perde
 * salienza, quindi per ottenere lo stesso effetto bisogna celebrare più
 * eventi, più forte, più spesso — l'inflazione, che è un'azione a spirale e
 * non uno stato. In un anno di roadmap la spirale arriva da sola: ogni
 * designer è misurato sull'adozione, e la cosa che alza l'adozione questa
 * settimana è un'animazione in più.
 *
 * L'argine è un budget dichiarato, con una regola sopra:
 *
 *   **il livello segue il valore, non la frequenza.**
 *
 * L'evento sensoriale più grande dell'app è la promozione di un concetto a
 * Permanente, e nessun altro può arrivarci. Non perché sia il più raro — anche
 * se lo è — ma perché è l'unico che corrisponde a una cosa che resta vera dopo
 * che l'app è stata chiusa.
 *
 * Questo file non disegna niente. È una tabella, e sta qui perché una regola
 * che vive in un documento alla terza riunione non esiste più; qui invece va
 * importata per essere infranta.
 */

/** I tre livelli, dal più quieto al più grande. */
export type LivelloJuice = "quieto" | "medio" | "cerimonia";

export interface BudgetJuice {
  /** Millisecondi dell'animazione d'ingresso. 0 = nessuna. */
  durata: number;
  /** Quanto l'elemento cresce entrando. 1 = non cresce. */
  scala: number;
  /** Se l'evento può occupare lo schermo intero. */
  schermoIntero: boolean;
  /** A che cosa spetta, per esteso. Serve a chi legge il diff fra un anno. */
  spettaA: string;
}

export const JUICE: Record<LivelloJuice, BudgetJuice> = {
  /**
   * La spunta quotidiana. Un segno di spunta e nient'altro: nessun suono,
   * nessuna particella, nessuna parola di lode. Venti volte al giorno, e a
   * venti volte al giorno qualunque celebrazione diventa rumore — o peggio,
   * diventa la cosa per cui si spunta.
   */
  quieto: {
    durata: 0,
    scala: 1,
    schermoIntero: false,
    spettaA: "completamento di un richiamo; ogni cambio di stato ordinario",
  },

  /**
   * La fine della sessione e l'errore produttivo. Un'entrata percepibile, una
   * schermata che si prende il suo momento e poi lascia andare. Non una
   * vittoria: una constatazione.
   */
  medio: {
    durata: 220,
    scala: 1,
    schermoIntero: false,
    spettaA: "chiusura della sessione; feedback dell'errore produttivo; primo passo",
  },

  /**
   * La promozione a Permanente. Schermo intero, una volta sola per concetto,
   * mai riaperta. Se un giorno qualcosa d'altro arriva a questo livello — un
   * tema premium, una celebrazione comprabile, una streak — la cerimonia ha
   * smesso di significare quello che significa, e va tolto l'altro, non
   * alzata lei.
   */
  cerimonia: {
    durata: 520,
    scala: 1.06,
    schermoIntero: true,
    spettaA: "promozione di un concetto a Permanente, e nient'altro",
  },
};
