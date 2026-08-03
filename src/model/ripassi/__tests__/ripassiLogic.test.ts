/**
 * Tests for the review classification/ordering logic extracted from HomeScreen.
 * All functions take an explicit "ora" (now) so the tests are deterministic and
 * don't depend on the clock.
 */
import {
  chiaveOrdinamento,
  corrispondeRicerca,
  isPendente,
  isStorico,
  prossimaOccorrenza,
  suddividiRipassi,
} from "../ripassiLogic";
import type { Occorrenza, RipassoCompleto } from "../../types";

const ORA = new Date("2026-07-15T12:00:00.000Z").getTime();

function occ(over: Partial<Occorrenza> & { scheduled_at: string }): Occorrenza {
  return {
    id: over.id ?? `occ-${over.scheduled_at}`,
    ripasso_id: "r1",
    user_id: "u1",
    is_manual_1h: false,
    is_completed: false,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...over,
  };
}

function ripasso(over: Partial<RipassoCompleto> & { id: string }): RipassoCompleto {
  return {
    user_id: "u1",
    titolo: "Titolo",
    note: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    occorrenze: [],
    allegati: [],
    ...over,
  };
}

describe("isPendente", () => {
  it("is true for a future non-completed occurrence", () => {
    expect(isPendente(occ({ scheduled_at: "2026-07-20T00:00:00.000Z" }), ORA)).toBe(true);
  });

  it("is false when completed, even if in the future", () => {
    expect(
      isPendente(occ({ scheduled_at: "2026-07-20T00:00:00.000Z", is_completed: true }), ORA)
    ).toBe(false);
  });

  it("is false when scheduled on an earlier day", () => {
    expect(isPendente(occ({ scheduled_at: "2026-07-10T00:00:00.000Z" }), ORA)).toBe(false);
  });

  // Classification is by day, not by instant: today's reviews belong in
  // "Da fare" until the day is over, even once their time has passed.
  it("is true for an earlier hour of today", () => {
    const stamattina = new Date(ORA);
    stamattina.setHours(0, 30, 0, 0);
    expect(isPendente(occ({ scheduled_at: stamattina.toISOString() }), ORA)).toBe(true);
  });

  it("is false from the last instant of the previous day", () => {
    const ieriSera = new Date(ORA);
    ieriSera.setHours(0, 0, 0, 0);
    ieriSera.setMilliseconds(-1);
    expect(isPendente(occ({ scheduled_at: ieriSera.toISOString() }), ORA)).toBe(false);
  });
});

describe("prossimaOccorrenza", () => {
  it("returns the soonest pending occurrence, not merely the first in the array", () => {
    const r = ripasso({
      id: "r1",
      occorrenze: [
        occ({ id: "late", scheduled_at: "2026-08-01T00:00:00.000Z" }),
        occ({ id: "soon", scheduled_at: "2026-07-16T00:00:00.000Z" }),
      ],
    });
    expect(prossimaOccorrenza(r, ORA)?.id).toBe("soon");
  });

  it("skips completed occurrences", () => {
    const r = ripasso({
      id: "r1",
      occorrenze: [
        occ({ id: "done", scheduled_at: "2026-07-16T00:00:00.000Z", is_completed: true }),
        occ({ id: "next", scheduled_at: "2026-07-18T00:00:00.000Z" }),
      ],
    });
    expect(prossimaOccorrenza(r, ORA)?.id).toBe("next");
  });

  it("falls back to the chronologically last occurrence when nothing is pending", () => {
    const r = ripasso({
      id: "r1",
      occorrenze: [
        occ({ id: "first", scheduled_at: "2026-07-01T00:00:00.000Z" }),
        occ({ id: "last", scheduled_at: "2026-07-10T00:00:00.000Z" }),
      ],
    });
    expect(prossimaOccorrenza(r, ORA)?.id).toBe("last");
  });

  it("returns null when there are no occurrences", () => {
    expect(prossimaOccorrenza(ripasso({ id: "r1" }), ORA)).toBeNull();
  });
});

describe("isStorico", () => {
  it("is false when at least one occurrence is pending", () => {
    const r = ripasso({
      id: "r1",
      occorrenze: [
        occ({ scheduled_at: "2026-07-01T00:00:00.000Z" }),
        occ({ scheduled_at: "2026-07-20T00:00:00.000Z" }),
      ],
    });
    expect(isStorico(r, ORA)).toBe(false);
  });

  it("is true when everything is completed or past", () => {
    const r = ripasso({
      id: "r1",
      occorrenze: [
        occ({ scheduled_at: "2026-07-01T00:00:00.000Z" }),
        occ({ scheduled_at: "2026-07-20T00:00:00.000Z", is_completed: true }),
      ],
    });
    expect(isStorico(r, ORA)).toBe(true);
  });

  it("treats a ripasso with no occurrences as archived", () => {
    expect(isStorico(ripasso({ id: "r1" }), ORA)).toBe(true);
  });
});

describe("chiaveOrdinamento", () => {
  it("never returns NaN for a ripasso with no occurrences", () => {
    const key = chiaveOrdinamento(ripasso({ id: "r1" }), ORA);
    expect(Number.isFinite(key)).toBe(true);
    expect(key).toBe(new Date("2026-07-01T00:00:00.000Z").getTime());
  });

  it("never returns NaN when dates are malformed", () => {
    const r = ripasso({
      id: "r1",
      created_at: "not-a-date",
      occorrenze: [occ({ scheduled_at: "also-not-a-date" })],
    });
    expect(Number.isFinite(chiaveOrdinamento(r, ORA))).toBe(true);
  });

  it("uses the next occurrence when available", () => {
    const r = ripasso({
      id: "r1",
      occorrenze: [occ({ scheduled_at: "2026-07-20T00:00:00.000Z" })],
    });
    expect(chiaveOrdinamento(r, ORA)).toBe(new Date("2026-07-20T00:00:00.000Z").getTime());
  });
});

describe("suddividiRipassi", () => {
  const attivoPresto = ripasso({
    id: "a-presto",
    occorrenze: [occ({ scheduled_at: "2026-07-16T00:00:00.000Z" })],
  });
  const attivoTardi = ripasso({
    id: "b-tardi",
    occorrenze: [occ({ scheduled_at: "2026-07-25T00:00:00.000Z" })],
  });
  const archiviato = ripasso({
    id: "c-vecchio",
    occorrenze: [occ({ scheduled_at: "2026-07-05T00:00:00.000Z" })],
  });

  it("separates active from archived", () => {
    const { attivi, storico } = suddividiRipassi(
      [archiviato, attivoTardi, attivoPresto],
      ORA
    );
    expect(attivi.map((r) => r.id)).toEqual(["a-presto", "b-tardi"]);
    expect(storico.map((r) => r.id)).toEqual(["c-vecchio"]);
  });

  it("orders active soonest-first regardless of input order", () => {
    const a = suddividiRipassi([attivoTardi, attivoPresto], ORA).attivi;
    const b = suddividiRipassi([attivoPresto, attivoTardi], ORA).attivi;
    expect(a.map((r) => r.id)).toEqual(["a-presto", "b-tardi"]);
    expect(b.map((r) => r.id)).toEqual(["a-presto", "b-tardi"]);
  });

  it("orders archived most-recent-first", () => {
    const vecchio = ripasso({
      id: "vecchio",
      occorrenze: [occ({ scheduled_at: "2026-06-01T00:00:00.000Z" })],
    });
    const recente = ripasso({
      id: "recente",
      occorrenze: [occ({ scheduled_at: "2026-07-10T00:00:00.000Z" })],
    });
    const { storico } = suddividiRipassi([vecchio, recente], ORA);
    expect(storico.map((r) => r.id)).toEqual(["recente", "vecchio"]);
  });

  it("breaks ties deterministically, so reload order doesn't shuffle the list", () => {
    const stessaData = "2026-07-18T00:00:00.000Z";
    const x = ripasso({ id: "x", occorrenze: [occ({ scheduled_at: stessaData })] });
    const y = ripasso({ id: "y", occorrenze: [occ({ scheduled_at: stessaData })] });
    expect(suddividiRipassi([x, y], ORA).attivi.map((r) => r.id)).toEqual(["x", "y"]);
    expect(suddividiRipassi([y, x], ORA).attivi.map((r) => r.id)).toEqual(["x", "y"]);
  });
});

describe("corrispondeRicerca", () => {
  const r = ripasso({ id: "r1", titolo: "Teorema di Bayes", note: "probabilità condizionata" });

  it("matches everything on an empty or blank query", () => {
    expect(corrispondeRicerca(r, "")).toBe(true);
    expect(corrispondeRicerca(r, "   ")).toBe(true);
  });

  it("matches the title case-insensitively", () => {
    expect(corrispondeRicerca(r, "BAYES")).toBe(true);
  });

  it("matches the notes", () => {
    expect(corrispondeRicerca(r, "condizionata")).toBe(true);
  });

  it("does not match unrelated text", () => {
    expect(corrispondeRicerca(r, "integrali")).toBe(false);
  });

  it("handles null notes", () => {
    expect(corrispondeRicerca(ripasso({ id: "r2", note: null }), "qualcosa")).toBe(false);
  });
});
