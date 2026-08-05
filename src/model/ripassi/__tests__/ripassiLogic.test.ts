/**
 * Tests for the review classification/ordering logic extracted from HomeScreen.
 * All functions take an explicit "ora" (now) so the tests are deterministic and
 * don't depend on the clock.
 */
import {
  chiaveVoce,
  corrispondeRicerca,
  isOggi,
  isPassata,
  soloDaCompletare,
  suddividiVoci,
  type VoceRipasso,
} from "../ripassiLogic";
import type { Occorrenza, RipassoCompleto } from "../../types";

const ORA = new Date("2026-07-15T12:00:00.000Z").getTime();

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

function ripasso(over: Partial<RipassoCompleto> & { id: string }): RipassoCompleto {
  return {
    account_id: "a1",
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

/** The occurrence ids of a list of lines, in order. */
function ids(voci: VoceRipasso[]): string[] {
  return voci.map((v) => v.occorrenza.id);
}

describe("isOggi", () => {
  it("is true at any hour of today, even one already gone by", () => {
    const stamattina = new Date(ORA);
    stamattina.setHours(0, 30, 0, 0);
    expect(isOggi(occ({ scheduled_at: stamattina.toISOString() }), ORA)).toBe(true);

    const stasera = new Date(ORA);
    stasera.setHours(23, 59, 0, 0);
    expect(isOggi(occ({ scheduled_at: stasera.toISOString() }), ORA)).toBe(true);
  });

  it("is false on the neighbouring days", () => {
    const ieriSera = new Date(ORA);
    ieriSera.setHours(0, 0, 0, 0);
    ieriSera.setMilliseconds(-1);
    expect(isOggi(occ({ scheduled_at: ieriSera.toISOString() }), ORA)).toBe(false);

    const domani = new Date(ORA);
    domani.setHours(24, 0, 0, 0);
    expect(isOggi(occ({ scheduled_at: domani.toISOString() }), ORA)).toBe(false);
  });

  // An unreadable date must not be highlighted as the thing to do now.
  it("is false for a malformed date", () => {
    expect(isOggi(occ({ scheduled_at: "non-una-data" }), ORA)).toBe(false);
  });

  it("ignores completion", () => {
    const oggi = new Date(ORA).toISOString();
    expect(isOggi(occ({ scheduled_at: oggi, is_completed: true }), ORA)).toBe(true);
  });
});

describe("isPassata", () => {
  it("is false for a future occurrence", () => {
    expect(isPassata(occ({ scheduled_at: "2026-07-20T00:00:00.000Z" }), ORA)).toBe(false);
  });

  it("is true for an earlier day", () => {
    expect(isPassata(occ({ scheduled_at: "2026-07-10T00:00:00.000Z" }), ORA)).toBe(true);
  });

  // Classification is by day, not by instant: today's reviews stay in the main
  // list until the day is over, even once their time has passed.
  it("is false for an earlier hour of today", () => {
    const stamattina = new Date(ORA);
    stamattina.setHours(0, 30, 0, 0);
    expect(isPassata(occ({ scheduled_at: stamattina.toISOString() }), ORA)).toBe(false);
  });

  it("is true from the last instant of the previous day", () => {
    const ieriSera = new Date(ORA);
    ieriSera.setHours(0, 0, 0, 0);
    ieriSera.setMilliseconds(-1);
    expect(isPassata(occ({ scheduled_at: ieriSera.toISOString() }), ORA)).toBe(true);
  });

  // Being done is a separate question from being old: it is the storico filter
  // that asks it, not the split between the two lists.
  it("ignores completion", () => {
    const fatta = occ({ scheduled_at: "2026-07-10T00:00:00.000Z", is_completed: true });
    const daFare = occ({ scheduled_at: "2026-07-10T00:00:00.000Z" });
    expect(isPassata(fatta, ORA)).toBe(isPassata(daFare, ORA));
  });

  it("keeps a malformed date out of the storico", () => {
    expect(isPassata(occ({ scheduled_at: "non-una-data" }), ORA)).toBe(false);
  });
});

describe("chiaveVoce", () => {
  it("uses the occurrence date", () => {
    const r = ripasso({ id: "r1" });
    const o = occ({ scheduled_at: "2026-07-20T00:00:00.000Z" });
    expect(chiaveVoce({ ripasso: r, occorrenza: o })).toBe(
      new Date("2026-07-20T00:00:00.000Z").getTime()
    );
  });

  it("never returns NaN when the date is malformed", () => {
    const r = ripasso({ id: "r1" });
    const o = occ({ scheduled_at: "non-una-data" });
    expect(chiaveVoce({ ripasso: r, occorrenza: o })).toBe(
      new Date("2026-07-01T00:00:00.000Z").getTime()
    );
  });

  it("never returns NaN when every date is malformed", () => {
    const r = ripasso({ id: "r1", created_at: "neanche-questa" });
    const o = occ({ scheduled_at: "non-una-data" });
    expect(Number.isFinite(chiaveVoce({ ripasso: r, occorrenza: o }))).toBe(true);
  });
});

describe("suddividiVoci", () => {
  // One ripasso yields one line per occurrence: this is the list the Home shows.
  const r1 = ripasso({
    id: "r1",
    occorrenze: [
      occ({ id: "vecchia", scheduled_at: "2026-07-05T00:00:00.000Z" }),
      occ({ id: "presto", scheduled_at: "2026-07-16T00:00:00.000Z" }),
      occ({ id: "tardi", scheduled_at: "2026-07-25T00:00:00.000Z" }),
    ],
  });

  it("splits the occurrences of one ripasso across the two lists", () => {
    const { attive, storico } = suddividiVoci([r1], ORA);
    expect(ids(attive)).toEqual(["presto", "tardi"]);
    expect(ids(storico)).toEqual(["vecchia"]);
  });

  it("carries the parent ripasso on every line", () => {
    const { attive } = suddividiVoci([r1], ORA);
    expect(attive.every((v) => v.ripasso.id === "r1")).toBe(true);
  });

  it("keeps completed occurrences in the main list while their day lasts", () => {
    const r = ripasso({
      id: "r2",
      occorrenze: [occ({ id: "fatta", scheduled_at: "2026-07-20T00:00:00.000Z", is_completed: true })],
    });
    expect(ids(suddividiVoci([r], ORA).attive)).toEqual(["fatta"]);
  });

  it("sends a past occurrence to the storico even when completed", () => {
    const r = ripasso({
      id: "r3",
      occorrenze: [occ({ id: "fatta", scheduled_at: "2026-07-05T00:00:00.000Z", is_completed: true })],
    });
    expect(ids(suddividiVoci([r], ORA).storico)).toEqual(["fatta"]);
  });

  it("orders the main list soonest-first regardless of input order", () => {
    const a = ripasso({ id: "a", occorrenze: [occ({ id: "tardi", scheduled_at: "2026-07-25T00:00:00.000Z" })] });
    const b = ripasso({ id: "b", occorrenze: [occ({ id: "presto", scheduled_at: "2026-07-16T00:00:00.000Z" })] });
    expect(ids(suddividiVoci([a, b], ORA).attive)).toEqual(["presto", "tardi"]);
    expect(ids(suddividiVoci([b, a], ORA).attive)).toEqual(["presto", "tardi"]);
  });

  it("orders the storico most-recent-first", () => {
    const r = ripasso({
      id: "r4",
      occorrenze: [
        occ({ id: "vecchissima", scheduled_at: "2026-06-01T00:00:00.000Z" }),
        occ({ id: "recente", scheduled_at: "2026-07-10T00:00:00.000Z" }),
      ],
    });
    expect(ids(suddividiVoci([r], ORA).storico)).toEqual(["recente", "vecchissima"]);
  });

  it("breaks ties deterministically, so reload order doesn't shuffle the list", () => {
    const stessaData = "2026-07-18T00:00:00.000Z";
    const x = ripasso({ id: "x", occorrenze: [occ({ id: "x1", scheduled_at: stessaData })] });
    const y = ripasso({ id: "y", occorrenze: [occ({ id: "y1", scheduled_at: stessaData })] });
    expect(ids(suddividiVoci([x, y], ORA).attive)).toEqual(["x1", "y1"]);
    expect(ids(suddividiVoci([y, x], ORA).attive)).toEqual(["x1", "y1"]);
  });

  it("produces nothing for a ripasso with no occurrences", () => {
    const { attive, storico } = suddividiVoci([ripasso({ id: "vuoto" })], ORA);
    expect(attive).toEqual([]);
    expect(storico).toEqual([]);
  });
});

describe("soloDaCompletare", () => {
  it("keeps only the occurrences never marked as done", () => {
    const r = ripasso({
      id: "r1",
      occorrenze: [
        occ({ id: "fatta", scheduled_at: "2026-07-05T00:00:00.000Z", is_completed: true }),
        occ({ id: "saltata", scheduled_at: "2026-07-06T00:00:00.000Z" }),
      ],
    });
    const { storico } = suddividiVoci([r], ORA);
    expect(ids(soloDaCompletare(storico))).toEqual(["saltata"]);
  });

  it("does not reorder what it keeps", () => {
    const r = ripasso({
      id: "r1",
      occorrenze: [
        occ({ id: "vecchia", scheduled_at: "2026-06-01T00:00:00.000Z" }),
        occ({ id: "recente", scheduled_at: "2026-07-10T00:00:00.000Z" }),
      ],
    });
    const { storico } = suddividiVoci([r], ORA);
    expect(ids(soloDaCompletare(storico))).toEqual(["recente", "vecchia"]);
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
