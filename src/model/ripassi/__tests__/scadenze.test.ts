/**
 * Tests for the deadline grouping the redesigned TurboRipassi list is built
 * out of. As everywhere else in this Model, "ora" is passed in, so none of
 * this depends on the clock.
 */
import {
  ORDINE_SCADENZA,
  gruppoScadenza,
  raggruppaPerScadenza,
} from "../ripassiLogic";
import type { Occorrenza, RipassoCompleto } from "../../types";

/** Local noon of a YYYY-MM-DD day: the tests reason in local days. */
function alle(giorno: string, ore = 12): number {
  const [y, m, d] = giorno.split("-").map(Number);
  return new Date(y, m - 1, d, ore).getTime();
}

const OGGI = alle("2026-07-15");

function occ(over: Partial<Occorrenza> & { id: string; scheduled_at: string }): Occorrenza {
  return {
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

function ripasso(id: string, occorrenze: Occorrenza[]): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    user_id: "u1",
    titolo: `Ripasso ${id}`,
    note: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    occorrenze,
    allegati: [],
  };
}

describe("gruppoScadenza", () => {
  it("ieri sera è in ritardo, per quanto vicina sia l'ora", () => {
    const ieriSera = new Date(alle("2026-07-14", 23)).toISOString();
    expect(gruppoScadenza(occ({ id: "a", scheduled_at: ieriSera }), OGGI)).toBe("ritardo");
  });

  it("oggi resta oggi a qualsiasi ora, anche già passata", () => {
    const mattina = new Date(alle("2026-07-15", 8)).toISOString();
    expect(gruppoScadenza(occ({ id: "b", scheduled_at: mattina }), OGGI)).toBe("oggi");
  });

  it("entro sette giorni è questa settimana", () => {
    const fraSei = new Date(alle("2026-07-21")).toISOString();
    expect(gruppoScadenza(occ({ id: "c", scheduled_at: fraSei }), OGGI)).toBe("settimana");
  });

  it("l'ottavo giorno passa a più avanti", () => {
    const fraOtto = new Date(alle("2026-07-23")).toISOString();
    expect(gruppoScadenza(occ({ id: "d", scheduled_at: fraOtto }), OGGI)).toBe("avanti");
  });

  it("una data illeggibile finisce sotto gli occhi, in oggi", () => {
    expect(gruppoScadenza(occ({ id: "e", scheduled_at: "non una data" }), OGGI)).toBe("oggi");
  });
});

describe("raggruppaPerScadenza", () => {
  const dati = [
    ripasso("r1", [
      occ({ id: "o-ieri", scheduled_at: new Date(alle("2026-07-13")).toISOString() }),
      occ({ id: "o-oggi", scheduled_at: new Date(alle("2026-07-15", 9)).toISOString() }),
    ]),
    ripasso("r2", [
      occ({ id: "o-settimana", scheduled_at: new Date(alle("2026-07-18")).toISOString() }),
      occ({ id: "o-avanti", scheduled_at: new Date(alle("2026-08-20")).toISOString() }),
    ]),
  ];

  it("mette i gruppi nell'ordine dell'urgenza", () => {
    const gruppi = raggruppaPerScadenza(dati, OGGI);
    expect(gruppi.map((g) => g.gruppo)).toEqual([...ORDINE_SCADENZA]);
  });

  it("dà a ogni gruppo la sua etichetta", () => {
    const gruppi = raggruppaPerScadenza(dati, OGGI);
    expect(gruppi[0].etichetta).toBe("In ritardo");
    expect(gruppi[1].etichetta).toBe("Oggi");
  });

  it("non disegna intestazioni vuote", () => {
    const soloOggi = [ripasso("r", [occ({ id: "x", scheduled_at: new Date(OGGI).toISOString() })])];
    expect(raggruppaPerScadenza(soloOggi, OGGI).map((g) => g.gruppo)).toEqual(["oggi"]);
  });

  it("un'occorrenza completata esce dalla lista: non ha più una scadenza da mancare", () => {
    const fatti = [
      ripasso("r", [
        occ({
          id: "fatto",
          scheduled_at: new Date(alle("2026-07-10")).toISOString(),
          is_completed: true,
        }),
      ]),
    ];
    expect(raggruppaPerScadenza(fatti, OGGI)).toEqual([]);
  });

  it("dentro un gruppo ordina dal più vicino", () => {
    const dueOggi = [
      ripasso("r", [
        occ({ id: "b", scheduled_at: new Date(alle("2026-07-15", 18)).toISOString() }),
        occ({ id: "a", scheduled_at: new Date(alle("2026-07-15", 7)).toISOString() }),
      ]),
    ];
    const [gruppo] = raggruppaPerScadenza(dueOggi, OGGI);
    expect(gruppo.voci.map((v) => v.occorrenza.id)).toEqual(["a", "b"]);
  });

  it("porta con sé il ripasso, non solo l'occorrenza", () => {
    const [gruppo] = raggruppaPerScadenza(dati, OGGI);
    expect(gruppo.voci[0].ripasso.id).toBe("r1");
  });
});
