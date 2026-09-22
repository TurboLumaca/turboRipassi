/**
 * Il Patrimonio e il canarino.
 *
 * Due cose si verificano qui, e la seconda è quella che vale.
 *
 * La prima: la data di promozione è il *primo* richiamo in cui entrambe le
 * condizioni sono soddisfatte, e non l'ultimo richiamo fatto. Prendere
 * l'ultimo avrebbe dato una data sbagliata a ogni concetto ripassato ancora
 * dopo la promozione — e la cerimonia racconta proprio quella data.
 *
 * La seconda: il rendimento formativo conta promozioni, non sessioni. È la
 * sola cifra che distingue chi torna e impara da chi torna e basta, ed è la
 * ragione per cui esiste.
 */
import type { Occorrenza, RipassoCompleto } from "@/model/types";
import {
  GIORNI_TRIMESTRE,
  concettiPermanenti,
  dataPromozione,
  rendimentoFormativo,
} from "../patrimonioLogic";

const ORA = new Date("2026-09-21T12:00:00.000Z");
const GIORNO = 86_400_000;

function giorniFa(n: number): string {
  return new Date(ORA.getTime() - n * GIORNO).toISOString();
}

function occ(scheduled_at: string, is_completed: boolean): Occorrenza {
  return {
    id: `o-${scheduled_at}-${String(is_completed)}`,
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    scheduled_at,
    is_manual_1h: false,
    is_completed,
    created_at: scheduled_at,
    updated_at: scheduled_at,
  };
}

function ripasso(id: string, occorrenze: Occorrenza[]): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    user_id: "u1",
    titolo: id,
    domanda: null,
    note: null,
    ceremony_shown_at: null,
    created_at: giorniFa(400),
    updated_at: giorniFa(400),
    occorrenze,
    allegati: [],
  };
}

/**
 * Quattro richiami distribuiti su oltre sei mesi: il caso canonico. È il
 * quarto a promuovere, perché è il primo in cui *entrambe* le condizioni
 * valgono.
 */
function maturo(id: string, ultimoGiorniFa = 1): RipassoCompleto {
  return ripasso(id, [
    occ(giorniFa(300), true),
    occ(giorniFa(280), true),
    occ(giorniFa(250), true),
    occ(giorniFa(ultimoGiorniFa), true),
  ]);
}

describe("dataPromozione", () => {
  it("null su un concetto che non è permanente", () => {
    expect(dataPromozione(ripasso("r1", [occ(giorniFa(10), true)]), ORA)).toBeNull();
  });

  it("è il primo richiamo in cui entrambe le condizioni valgono", () => {
    // Quattro richiami entro il primo mese (troppo presto), poi il quinto a
    // 200 giorni: è quello a promuovere, non il sesto.
    const r = ripasso("r1", [
      occ(giorniFa(400), true),
      occ(giorniFa(395), true),
      occ(giorniFa(390), true),
      occ(giorniFa(380), true),
      occ(giorniFa(200), true),
      occ(giorniFa(5), true),
    ]);
    expect(dataPromozione(r, ORA)).toBe(giorniFa(200));
  });

  // Un concetto permanente continua a essere ripassato: la promozione resta
  // il momento in cui è avvenuta, e non scivola in avanti a ogni richiamo.
  it("non è l'ultimo richiamo quando il concetto è stato ripassato ancora", () => {
    const r = ripasso("r1", [
      occ(giorniFa(400), true),
      occ(giorniFa(380), true),
      occ(giorniFa(350), true),
      occ(giorniFa(200), true),
      occ(giorniFa(30), true),
      occ(giorniFa(2), true),
    ]);
    expect(dataPromozione(r, ORA)).toBe(giorniFa(200));
  });
});

describe("concettiPermanenti", () => {
  it("elenca solo i permanenti, dal più recente al più antico", () => {
    const vecchio = ripasso("vecchio", [
      occ(giorniFa(500), true),
      occ(giorniFa(480), true),
      occ(giorniFa(460), true),
      occ(giorniFa(300), true),
    ]); // promosso 300 giorni fa
    const nuovo = maturo("nuovo");
    const acerbo = ripasso("acerbo", [occ(giorniFa(3), true)]);

    const out = concettiPermanenti([vecchio, acerbo, nuovo], ORA);
    expect(out.map((c) => c.ripasso.id)).toEqual(["nuovo", "vecchio"]);
    expect(out[0].storia).toHaveLength(4);
  });

  it("su una lista vuota risponde con una lista vuota", () => {
    expect(concettiPermanenti([], ORA)).toEqual([]);
  });
});

describe("rendimentoFormativo", () => {
  it("conta le promozioni cadute nella finestra, non quelle di sempre", () => {
    // Promosso duecento giorni fa: fuori dall'ultimo trimestre, dentro l'anno.
    const antico = ripasso("antico", [
      occ(giorniFa(400), true),
      occ(giorniFa(380), true),
      occ(giorniFa(350), true),
      occ(giorniFa(200), true),
    ]);

    expect(rendimentoFormativo([antico], 30, ORA).promozioniNellaFinestra).toBe(0);
    expect(rendimentoFormativo([antico], 365, ORA).promozioniNellaFinestra).toBe(1);
  });

  it("normalizza per trimestre, così un mese e l'altro sono confrontabili", () => {
    const r = rendimentoFormativo([maturo("a"), maturo("b")], GIORNI_TRIMESTRE * 2, ORA);
    // Due promozioni in due trimestri: una per trimestre.
    expect(r.promozioniNellaFinestra).toBe(2);
    expect(r.perTrimestre).toBe(1);
  });

  // Il serbatoio da cui verranno le prossime promozioni. Un concetto mai
  // richiamato non sta maturando: sta solo esistendo.
  it("conta come in maturazione solo chi ha almeno un richiamo alle spalle", () => {
    const iniziato = ripasso("iniziato", [occ(giorniFa(20), true), occ(giorniFa(1), false)]);
    const maiToccato = ripasso("mai", [occ(giorniFa(1), false)]);

    const r = rendimentoFormativo([iniziato, maiToccato, maturo("m")], GIORNI_TRIMESTRE, ORA);
    expect(r.inMaturazione).toBe(1);
  });

  it("una finestra di zero giorni non divide per zero", () => {
    const r = rendimentoFormativo([maturo("m")], 0, ORA);
    expect(Number.isFinite(r.perTrimestre)).toBe(true);
    expect(r.giorniFinestra).toBe(1);
  });
});
