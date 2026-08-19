/**
 * Tests for the Pausa Consapevole domain logic (pausaLogic.ts).
 * Pure and deterministic functions with no I/O dependencies.
 */
import {
  applicaPausaAOccorrenze,
  calcolaGiorniTrascorsi,
  isPausaAttiva,
  creaConfigurazionePausa,
  completaPausa,
  type ConfigurazionePausa,
} from "../pausaLogic";
import type { Occorrenza } from "../../types";

const ORA = new Date("2026-07-15T12:00:00.000Z");

function occ(over: Partial<Occorrenza> & { scheduled_at: string }): Occorrenza {
  return {
    id: over.id ?? `occ-${over.scheduled_at}`,
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    is_manual_1h: false,
    is_completed: false,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

describe("applicaPausaAOccorrenze", () => {
  it("trasla in avanti di N giorni le occorrenze future o non completate", () => {
    const o1 = occ({ id: "o1", scheduled_at: "2026-07-16T10:00:00.000Z" });
    const o2 = occ({ id: "o2", scheduled_at: "2026-07-20T15:30:00.000Z" });

    const risultato = applicaPausaAOccorrenze([o1, o2], 7);

    expect(risultato[0].scheduled_at).toBe("2026-07-23T10:00:00.000Z");
    expect(risultato[1].scheduled_at).toBe("2026-07-27T15:30:00.000Z");
  });

  it("non tocca le occorrenze già completate (fatti storici passati)", () => {
    const fatta = occ({
      id: "fatta",
      scheduled_at: "2026-07-10T10:00:00.000Z",
      is_completed: true,
    });
    const daFare = occ({
      id: "daFare",
      scheduled_at: "2026-07-16T10:00:00.000Z",
      is_completed: false,
    });

    const risultato = applicaPausaAOccorrenze([fatta, daFare], 3);

    expect(risultato.find((o) => o.id === "fatta")?.scheduled_at).toBe(fatta.scheduled_at);
    expect(risultato.find((o) => o.id === "daFare")?.scheduled_at).toBe("2026-07-19T10:00:00.000Z");
  });

  it("con 0 giorni di pausa restituisce copie identiche", () => {
    const o1 = occ({ id: "o1", scheduled_at: "2026-07-16T10:00:00.000Z" });
    const risultato = applicaPausaAOccorrenze([o1], 0);
    expect(risultato[0].scheduled_at).toBe(o1.scheduled_at);
  });

  it("ignora le date non valide senza crash", () => {
    const bad = occ({ id: "bad", scheduled_at: "invalid-date" });
    const risultato = applicaPausaAOccorrenze([bad], 5);
    expect(risultato[0].scheduled_at).toBe("invalid-date");
  });
});

describe("calcolaGiorniTrascorsi", () => {
  it("calcola correttamente i giorni interi trascorsi", () => {
    const inizio = "2026-07-10T12:00:00.000Z";
    const oggi = new Date("2026-07-15T12:00:00.000Z");
    expect(calcolaGiorniTrascorsi(inizio, oggi)).toBe(5);
  });

  it("ritorna almeno 1 se è trascorso meno di un giorno (arrotondamento per eccesso)", () => {
    const inizio = "2026-07-15T08:00:00.000Z";
    const oggi = new Date("2026-07-15T14:00:00.000Z");
    expect(calcolaGiorniTrascorsi(inizio, oggi)).toBe(1);
  });
});

describe("isPausaAttiva", () => {
  it("ritorna false se attiva è false", () => {
    expect(isPausaAttiva({ attiva: false }, ORA)).toBe(false);
  });

  it("ritorna true se attiva è true e non c'è dataFine (pausa aperta)", () => {
    expect(isPausaAttiva({ attiva: true, dataInizio: "2026-07-10T00:00:00.000Z" }, ORA)).toBe(true);
  });

  it("ritorna true se la data corrente è prima o durante la dataFine", () => {
    const config: ConfigurazionePausa = {
      attiva: true,
      dataInizio: "2026-07-10T00:00:00.000Z",
      dataFine: "2026-07-20T23:59:59.999Z",
    };
    expect(isPausaAttiva(config, ORA)).toBe(true);
  });

  it("ritorna false se la dataFine è già passata", () => {
    const config: ConfigurazionePausa = {
      attiva: true,
      dataInizio: "2026-07-01T00:00:00.000Z",
      dataFine: "2026-07-10T00:00:00.000Z",
    };
    expect(isPausaAttiva(config, ORA)).toBe(false);
  });
});

describe("creaConfigurazionePausa", () => {
  it("crea una pausa weekend di 2 giorni", () => {
    const config = creaConfigurazionePausa("weekend", ORA);
    expect(config.attiva).toBe(true);
    expect(config.dataInizio).toBe(ORA.toISOString());
    expect(config.dataFine).toBe(new Date("2026-07-17T12:00:00.000Z").toISOString());
  });

  it("crea una pausa settimana di 7 giorni", () => {
    const config = creaConfigurazionePausa("settimana", ORA);
    expect(config.attiva).toBe(true);
    expect(config.dataFine).toBe(new Date("2026-07-22T12:00:00.000Z").toISOString());
  });

  it("crea una pausa manuale senza dataFine", () => {
    const config = creaConfigurazionePausa("manuale", ORA);
    expect(config.attiva).toBe(true);
    expect(config.dataFine).toBeUndefined();
  });

  it("crea una pausa fino a una data specifica", () => {
    const finoA = new Date("2026-07-30T00:00:00.000Z");
    const config = creaConfigurazionePausa({ finoA }, ORA);
    expect(config.attiva).toBe(true);
    expect(config.dataFine).toBe(finoA.toISOString());
  });
});

describe("completaPausa", () => {
  it("disattiva la pausa e calcola lo slittamento basato sui giorni effettivi trascorsi", () => {
    const config: ConfigurazionePausa = {
      attiva: true,
      dataInizio: "2026-07-10T12:00:00.000Z",
      dataFine: "2026-07-20T12:00:00.000Z",
    };
    const o = occ({ id: "o1", scheduled_at: "2026-07-16T12:00:00.000Z" });

    // Ripresa oggi (15 luglio) -> 5 giorni effettivi trascorsi
    const { nuovaConfig, nuoveOccorrenze, giorniEffettivi } = completaPausa(
      config,
      [o],
      ORA
    );

    expect(nuovaConfig.attiva).toBe(false);
    expect(giorniEffettivi).toBe(5);
    expect(nuoveOccorrenze[0].scheduled_at).toBe("2026-07-21T12:00:00.000Z");
  });
});
