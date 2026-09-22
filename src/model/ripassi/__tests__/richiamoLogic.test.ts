/**
 * Il richiamo: che domanda si pone, con che parole si riferisce un errore, e
 * quando il concetto rientra.
 *
 * Il test che conta più di tutti è quello sul determinismo della rotazione
 * delle frasi: una frase estratta a caso a ogni render sarebbe una ricompensa
 * a rapporto variabile — la meccanica delle slot, importata di soppiatto
 * dentro la microcopy.
 */
import {
  FRASI_ERRORE_PRODUTTIVO,
  FRASI_PROMOZIONE,
  GIORNI_RIENTRO_ERRORE,
  domandaDi,
  frasePerConcetto,
  haDomandaPropria,
  rientroDopoErrore,
  testoRientro,
} from "../richiamoLogic";

describe("domandaDi", () => {
  it("usa la domanda scritta dall'utente quando c'è", () => {
    expect(domandaDi({ titolo: "Bayes", domanda: "Che cosa dice?" })).toBe("Che cosa dice?");
  });

  it("non inventa una domanda quando non c'è: chiede la cosa vera", () => {
    expect(domandaDi({ titolo: "Bayes", domanda: null })).toBe(
      "Che cosa ricordi di «Bayes»?"
    );
  });

  it("una domanda fatta di soli spazi non è una domanda", () => {
    expect(domandaDi({ titolo: "Bayes", domanda: "   " })).toBe(
      "Che cosa ricordi di «Bayes»?"
    );
    expect(haDomandaPropria({ domanda: "   " })).toBe(false);
    expect(haDomandaPropria({ domanda: null })).toBe(false);
    expect(haDomandaPropria({ domanda: "Perché?" })).toBe(true);
  });
});

describe("frasePerConcetto", () => {
  // Il punto dell'intero documento in una riga di test: la varietà può
  // esserci, la varianza da rigiocare no.
  it("è deterministica: lo stesso concetto dice sempre la stessa cosa", () => {
    const a = frasePerConcetto(FRASI_PROMOZIONE, "ripasso-42");
    for (let i = 0; i < 20; i++) {
      expect(frasePerConcetto(FRASI_PROMOZIONE, "ripasso-42")).toBe(a);
    }
  });

  it("concetti diversi possono dire cose diverse", () => {
    const dette = new Set(
      Array.from({ length: 40 }, (_, i) => frasePerConcetto(FRASI_PROMOZIONE, `r${i}`))
    );
    expect(dette.size).toBeGreaterThan(1);
  });

  it("sceglie sempre dentro l'elenco, qualunque sia il seme", () => {
    for (const seme of ["", "a", "ZZZZZZZZZZ", "🙂", "0".repeat(200)]) {
      expect(FRASI_ERRORE_PRODUTTIVO).toContain(
        frasePerConcetto(FRASI_ERRORE_PRODUTTIVO, seme)
      );
    }
  });

  it("su un elenco vuoto non esplode: non dice niente", () => {
    expect(frasePerConcetto([], "r1")).toBe("");
  });
});

describe("rientro dopo un richiamo parziale", () => {
  it("riporta il concetto fra tre giorni, non il giorno dopo", () => {
    const adesso = new Date("2026-09-21T10:00:00.000Z");
    const quando = rientroDopoErrore(adesso);
    expect(Math.round((quando.getTime() - adesso.getTime()) / 86_400_000)).toBe(
      GIORNI_RIENTRO_ERRORE
    );
  });

  it("non muta la data che riceve", () => {
    const adesso = new Date("2026-09-21T10:00:00.000Z");
    rientroDopoErrore(adesso);
    expect(adesso.toISOString()).toBe("2026-09-21T10:00:00.000Z");
  });

  it("lo dice in chiaro, al singolare e al plurale", () => {
    const adesso = new Date("2026-09-21T10:00:00.000Z");
    expect(testoRientro(new Date("2026-09-22T10:00:00.000Z"), adesso)).toBe(
      "Rientra domani."
    );
    expect(testoRientro(new Date("2026-09-24T10:00:00.000Z"), adesso)).toBe(
      "Rientra fra 3 giorni."
    );
  });

  it("non promette mai zero giorni: il minimo dicibile è domani", () => {
    const adesso = new Date("2026-09-21T10:00:00.000Z");
    expect(testoRientro(adesso, adesso)).toBe("Rientra domani.");
  });
});
