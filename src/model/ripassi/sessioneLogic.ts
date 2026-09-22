/**
 * Model layer — la coda finita e la chiusura della sessione (l'anti-scroll).
 *
 * Un feed non finisce mai: è la sua definizione, e il motivo per cui
 * un'unità da quindici secondi costa sempre meno della decisione di
 * smettere. Qui l'unità è la stessa — un concetto, un minuto — ma la coda è
 * chiusa e dichiarata in testa: *Oggi: 5 concetti*. La differenza non è di
 * grado, è di verso: il sistema di engagement non ti lascia mai finire, il
 * sistema di apprendimento deve farti finire, dirtelo, e chiuderti la porta
 * con dignità.
 *
 * Il tetto non è una restrizione arbitraria calata dall'alto: è ciò che
 * rende la sessione una cosa che si può *completare*. Senza un win-state
 * raggiungibile e dichiarato la lista è solo un arretrato che cresce, che è
 * poi il modo in cui Anki perde le persone.
 */
import type { RipassoCompleto } from "../types";
import { calcolaPrioritaRipasso } from "./reschedulingLogic";
import type { VoceRipasso } from "./ripassiLogic";

/**
 * Quanti concetti al massimo entrano nella coda di oggi.
 *
 * Otto. Non un numero tondo scelto per bellezza: è il punto oltre il quale
 * una sessione smette di sembrare finibile in una pausa, e una sessione che
 * non sembra finibile è una che non si comincia. Ciò che avanza non sparisce
 * — resta in lista, e la lista lo dice.
 */
export const TETTO_CODA_GIORNALIERA = 8;

export interface CodaGiornaliera {
  /** I concetti di oggi, in ordine di urgenza mnemonica. */
  voci: VoceRipasso[];
  /** Quanti ne erano dovuti in tutto, tetto escluso. */
  totaleDovuti: number;
  /** Quanti sono già stati completati oggi, fra i dovuti. */
  completatiOggi: number;
  /** Quanti restano oltre il tetto: zero quando la coda li contiene tutti. */
  oltreIlTetto: number;
}

/** Mezzanotte locale del giorno che contiene `t`. */
function inizioGiornata(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Fine del giorno locale che contiene `t`. */
function fineGiornata(t: number): number {
  const d = new Date(t);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * La coda chiusa di oggi: gli arretrati e le scadenze di oggi, i più urgenti
 * per primi, fino al tetto.
 *
 * L'ordinamento è quello dell'urgenza mnemonica già usato dalla pausa rapida
 * (`calcolaPrioritaRipasso`): è adattività per ritenzione, non per sessione.
 * Sceglie il concetto che rende di più adesso, e non quello che tratterrebbe
 * più a lungo — la differenza fra un matchmaking che ottimizza
 * l'apprendimento e uno che ottimizza il tempo sul dispositivo.
 */
export function codaDiOggi(
  ripassi: readonly RipassoCompleto[],
  tetto: number = TETTO_CODA_GIORNALIERA,
  ora: Date = new Date()
): CodaGiornaliera {
  const oraMs = ora.getTime();
  const fineOggi = fineGiornata(oraMs);
  const inizioOggi = inizioGiornata(oraMs);

  const dovuti: { voce: VoceRipasso; priorita: number }[] = [];
  let completatiOggi = 0;

  for (const ripasso of ripassi) {
    for (const occorrenza of ripasso.occorrenze) {
      const t = new Date(occorrenza.scheduled_at).getTime();
      if (!Number.isFinite(t) || t > fineOggi) continue;

      if (occorrenza.is_completed) {
        // Solo quelle di oggi: ciò che è stato spuntato la settimana scorsa
        // non è un merito di questa sessione, e contarlo gonfierebbe il "2 di
        // 5" fino a renderlo una misura di niente.
        if (t >= inizioOggi) completatiOggi += 1;
        continue;
      }

      dovuti.push({
        voce: { ripasso, occorrenza },
        priorita: calcolaPrioritaRipasso(occorrenza, ora),
      });
    }
  }

  dovuti.sort((a, b) => {
    const d = b.priorita - a.priorita;
    if (d !== 0) return d;
    return a.voce.occorrenza.id.localeCompare(b.voce.occorrenza.id);
  });

  const limite = Math.max(1, tetto);
  return {
    voci: dovuti.slice(0, limite).map((x) => x.voce),
    totaleDovuti: dovuti.length,
    completatiOggi,
    oltreIlTetto: Math.max(0, dovuti.length - limite),
  };
}

/** Il concetto che la schermata di chiusura anticipa per domani. */
export interface AnticipoDomani {
  ripassoId: string;
  titolo: string;
  /** La domanda, così com'è già scritta nello scheduler. Mai la risposta. */
  domanda: string;
}

/**
 * Che cosa c'è domani — informazione vera, non pressione.
 *
 * È uno Zeigarnik deliberato: la sessione si chiude e lascia aperto un anello
 * che si chiuderà da solo domani, secondo lo spacing, senza che nessuno debba
 * tornare stasera. Per questo non è un ponte verso altro contenuto adesso: è
 * una frase che dice che oggi è finito.
 *
 * Restituisce null quando domani non c'è niente: inventare un'anticipazione
 * dove non c'è nulla da anticipare sarebbe il primo passo verso la notifica
 * che serve alla metrica e non alla persona.
 */
export function anticipoDomani(
  ripassi: readonly RipassoCompleto[],
  ora: Date = new Date(),
  domandaDi: (r: RipassoCompleto) => string = (r) => r.titolo
): AnticipoDomani | null {
  const domani = new Date(ora.getTime());
  domani.setDate(domani.getDate() + 1);
  const da = inizioGiornata(domani.getTime());
  const a = fineGiornata(domani.getTime());

  let migliore: { ripasso: RipassoCompleto; quando: number } | null = null;

  for (const ripasso of ripassi) {
    for (const occorrenza of ripasso.occorrenze) {
      if (occorrenza.is_completed) continue;
      const t = new Date(occorrenza.scheduled_at).getTime();
      if (!Number.isFinite(t) || t < da || t > a) continue;
      if (migliore === null || t < migliore.quando) {
        migliore = { ripasso, quando: t };
      }
    }
  }

  if (migliore === null) return null;
  return {
    ripassoId: migliore.ripasso.id,
    titolo: migliore.ripasso.titolo,
    domanda: domandaDi(migliore.ripasso),
  };
}

/**
 * La frase che la schermata di chiusura mette al centro.
 *
 * Racconta che cosa è successo ai concetti, non quanto è durata la sessione
 * né quanti giorni di fila si sono fatti: il punteggio della sessione è il
 * passo avanti che ha fatto la conoscenza, e non c'è nessun'altra cifra che
 * abbia il diritto di stare lì.
 */
export function riepilogoChiusura(concettiAvanzati: number): string {
  if (concettiAvanzati <= 0) return "Oggi è tutto.";
  if (concettiAvanzati === 1) return "Oggi è tutto. 1 concetto ha fatto un passo avanti.";
  return `Oggi è tutto. ${concettiAvanzati} concetti hanno fatto un passo avanti.`;
}
