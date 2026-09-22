/**
 * La coda chiusa e la fine dichiarata.
 *
 * Il test che porta il peso è quello sul tetto: una coda che non ha un fondo
 * non è una sessione, è un arretrato. Subito dopo viene l'anticipo di domani,
 * che deve restare *informazione* — quello che c'è davvero in calendario — e
 * non diventare una ragione fabbricata per tornare stasera.
 */
import type { Occorrenza, RipassoCompleto } from "@/model/types";
import {
  TETTO_CODA_GIORNALIERA,
  anticipoDomani,
  codaDiOggi,
  riepilogoChiusura,
} from "../sessioneLogic";

const ORA = new Date("2026-09-21T12:00:00.000Z");
const GIORNO = 86_400_000;
const sposta = (ms: number) => new Date(ORA.getTime() + ms).toISOString();

function occ(id: string, scheduled_at: string, is_completed = false): Occorrenza {
  return {
    id,
    ripasso_id: "r",
    account_id: "a1",
    user_id: "u1",
    scheduled_at,
    is_manual_1h: false,
    is_completed,
    created_at: scheduled_at,
    updated_at: scheduled_at,
  };
}

function ripasso(
  id: string,
  occorrenze: Occorrenza[],
  over: Partial<RipassoCompleto> = {}
): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    user_id: "u1",
    titolo: id,
    domanda: null,
    note: null,
    ceremony_shown_at: null,
    created_at: sposta(-10 * GIORNO),
    updated_at: sposta(-10 * GIORNO),
    occorrenze,
    allegati: [],
    ...over,
  };
}

describe("codaDiOggi", () => {
  it("prende arretrati e scadenze di oggi, e lascia fuori il futuro", () => {
    const coda = codaDiOggi(
      [
        ripasso("ieri", [occ("o1", sposta(-GIORNO))]),
        ripasso("oggi", [occ("o2", sposta(2 * 3600_000))]),
        ripasso("domani", [occ("o3", sposta(GIORNO))]),
      ],
      TETTO_CODA_GIORNALIERA,
      ORA
    );
    expect(coda.voci.map((v) => v.occorrenza.id).sort()).toEqual(["o1", "o2"]);
    expect(coda.totaleDovuti).toBe(2);
  });

  // Il tetto è ciò che rende la sessione una cosa che si può finire. Quello
  // che avanza non sparisce: resta in lista, e la coda lo dice.
  it("taglia al tetto e dice quanti restano fuori", () => {
    const molti = Array.from({ length: 20 }, (_, i) =>
      ripasso(`r${i}`, [occ(`o${i}`, sposta(-GIORNO * (i + 1)))])
    );
    const coda = codaDiOggi(molti, 5, ORA);
    expect(coda.voci).toHaveLength(5);
    expect(coda.totaleDovuti).toBe(20);
    expect(coda.oltreIlTetto).toBe(15);
  });

  // L'ordine è quello dell'urgenza mnemonica già usata dalla pausa rapida:
  // adattività per ritenzione, non per sessione. Sceglie il concetto che rende
  // di più adesso — qui il richiamo a un'ora, il più esposto al decadimento —
  // e non quello che tratterrebbe più a lungo.
  it("ordina per urgenza mnemonica, non per data di inserimento", () => {
    const manuale = occ("manuale", sposta(-3600_000));
    const coda = codaDiOggi(
      [
        ripasso("lento", [occ("lento", sposta(-GIORNO))]),
        ripasso("subito", [{ ...manuale, is_manual_1h: true }]),
      ],
      TETTO_CODA_GIORNALIERA,
      ORA
    );
    expect(coda.voci[0].occorrenza.id).toBe("manuale");
  });

  // Contare i completamenti di ieri gonfierebbe il "2 di 5" fino a renderlo
  // la misura di niente.
  it("conta come fatti solo i completamenti di oggi", () => {
    const coda = codaDiOggi(
      [
        ripasso("a", [occ("oggi-fatto", sposta(-3600_000), true)]),
        ripasso("b", [occ("ieri-fatto", sposta(-2 * GIORNO), true)]),
      ],
      TETTO_CODA_GIORNALIERA,
      ORA
    );
    expect(coda.completatiOggi).toBe(1);
    expect(coda.voci).toHaveLength(0);
  });

  it("una data illeggibile non entra in coda", () => {
    const coda = codaDiOggi([ripasso("x", [occ("rotta", "non-una-data")])], 5, ORA);
    expect(coda.voci).toHaveLength(0);
  });

  it("un tetto a zero resta una coda, non una lista vuota", () => {
    const coda = codaDiOggi([ripasso("a", [occ("o1", sposta(-GIORNO))])], 0, ORA);
    expect(coda.voci).toHaveLength(1);
  });
});

describe("anticipoDomani", () => {
  it("è il primo concetto di domani, con la sua domanda", () => {
    const out = anticipoDomani(
      [
        ripasso("tardi", [occ("o1", sposta(GIORNO + 20 * 3600_000))]),
        ripasso("presto", [occ("o2", sposta(GIORNO + 3600_000))], {
          domanda: "Perché ~2,25?",
        }),
      ],
      ORA,
      (r) => r.domanda ?? r.titolo
    );
    expect(out?.ripassoId).toBe("presto");
    expect(out?.domanda).toBe("Perché ~2,25?");
  });

  // Inventare un'anticipazione dove non c'è nulla da anticipare è il primo
  // passo verso la notifica che serve alla metrica e non alla persona.
  it("è null quando domani non c'è niente", () => {
    expect(anticipoDomani([ripasso("oggi", [occ("o1", sposta(-3600_000))])], ORA)).toBeNull();
  });

  it("non anticipa ciò che è già stato fatto", () => {
    const out = anticipoDomani(
      [ripasso("gia", [occ("o1", sposta(GIORNO + 3600_000), true)])],
      ORA
    );
    expect(out).toBeNull();
  });

  it("senza una funzione per la domanda ripiega sul titolo", () => {
    const out = anticipoDomani(
      [ripasso("Bayes", [occ("o1", sposta(GIORNO + 3600_000))])],
      ORA
    );
    expect(out?.domanda).toBe("Bayes");
  });
});

describe("riepilogoChiusura", () => {
  // Il punteggio della sessione è il passo avanti della conoscenza. Nessuna
  // altra cifra — minuti, giorni di fila, punti — ha il diritto di stare lì.
  it("parla di concetti, al singolare e al plurale, e di nient'altro", () => {
    expect(riepilogoChiusura(0)).toBe("Oggi è tutto.");
    expect(riepilogoChiusura(1)).toBe("Oggi è tutto. 1 concetto ha fatto un passo avanti.");
    expect(riepilogoChiusura(4)).toBe("Oggi è tutto. 4 concetti hanno fatto un passo avanti.");
  });
});
