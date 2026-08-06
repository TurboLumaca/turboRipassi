/**
 * Tests for the pure reminder-selection and diffing logic. No I/O: nothing
 * here touches expo-notifications, which is what makes it testable without a
 * device.
 */
import {
  diffPromemoria,
  occorrenzeDaRicordare,
  type PromemoriaOccorrenza,
} from "../notificheLogic";
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

describe("occorrenzeDaRicordare", () => {
  it("include un'occorrenza futura non completata", () => {
    const r = ripasso({
      id: "r1",
      titolo: "Bayes",
      occorrenze: [occ({ id: "o1", scheduled_at: "2026-07-20T00:00:00.000Z" })],
    });
    const out = occorrenzeDaRicordare([r], ORA);
    expect(out).toEqual([{ id: "o1", titolo: "Bayes", quando: new Date("2026-07-20T00:00:00.000Z") }]);
  });

  it("esclude un'occorrenza gia' completata", () => {
    const r = ripasso({
      id: "r1",
      occorrenze: [occ({ id: "o1", scheduled_at: "2026-07-20T00:00:00.000Z", is_completed: true })],
    });
    expect(occorrenzeDaRicordare([r], ORA)).toEqual([]);
  });

  it("esclude un'occorrenza gia' passata", () => {
    const r = ripasso({
      id: "r1",
      occorrenze: [occ({ id: "o1", scheduled_at: "2026-07-10T00:00:00.000Z" })],
    });
    expect(occorrenzeDaRicordare([r], ORA)).toEqual([]);
  });

  it("esclude l'istante esatto di adesso: il promemoria per 'ora' non ha piu' senso", () => {
    const r = ripasso({
      id: "r1",
      occorrenze: [occ({ id: "o1", scheduled_at: new Date(ORA).toISOString() })],
    });
    expect(occorrenzeDaRicordare([r], ORA)).toEqual([]);
  });

  it("esclude una data non leggibile", () => {
    const r = ripasso({ id: "r1", occorrenze: [occ({ id: "o1", scheduled_at: "non-una-data" })] });
    expect(occorrenzeDaRicordare([r], ORA)).toEqual([]);
  });

  it("raccoglie da piu' ripassi, ognuno con il proprio titolo", () => {
    const a = ripasso({
      id: "a",
      titolo: "A",
      occorrenze: [occ({ id: "oa", scheduled_at: "2026-07-20T00:00:00.000Z" })],
    });
    const b = ripasso({
      id: "b",
      titolo: "B",
      occorrenze: [occ({ id: "ob", scheduled_at: "2026-07-21T00:00:00.000Z" })],
    });
    const out = occorrenzeDaRicordare([a, b], ORA);
    expect(out.map((p) => p.titolo)).toEqual(["A", "B"]);
  });
});

describe("diffPromemoria", () => {
  const p = (id: string, titolo: string, iso: string): PromemoriaOccorrenza => ({
    id,
    titolo,
    quando: new Date(iso),
  });

  it("pianifica tutto quando non c'era niente prima", () => {
    const desiderati = [p("o1", "T1", "2026-07-20T00:00:00.000Z")];
    const out = diffPromemoria(desiderati, new Map());
    expect(out.daPianificare).toEqual(desiderati);
    expect(out.daCancellare).toEqual([]);
  });

  it("non tocca un promemoria invariato", () => {
    const attuale = p("o1", "T1", "2026-07-20T00:00:00.000Z");
    const precedenti = new Map([["o1", attuale]]);
    const out = diffPromemoria([attuale], precedenti);
    expect(out.daPianificare).toEqual([]);
    expect(out.daCancellare).toEqual([]);
  });

  it("ripianifica se la data e' cambiata (spostaOccorrenza)", () => {
    const precedenti = new Map([["o1", p("o1", "T1", "2026-07-20T00:00:00.000Z")]]);
    const nuovo = p("o1", "T1", "2026-07-22T00:00:00.000Z");
    const out = diffPromemoria([nuovo], precedenti);
    expect(out.daPianificare).toEqual([nuovo]);
    expect(out.daCancellare).toEqual([]);
  });

  it("ripianifica se e' cambiato solo il titolo", () => {
    const precedenti = new Map([["o1", p("o1", "Vecchio", "2026-07-20T00:00:00.000Z")]]);
    const nuovo = p("o1", "Nuovo", "2026-07-20T00:00:00.000Z");
    const out = diffPromemoria([nuovo], precedenti);
    expect(out.daPianificare).toEqual([nuovo]);
  });

  it("cancella un promemoria che non e' piu' desiderato (completato o eliminato)", () => {
    const precedenti = new Map([["o1", p("o1", "T1", "2026-07-20T00:00:00.000Z")]]);
    const out = diffPromemoria([], precedenti);
    expect(out.daPianificare).toEqual([]);
    expect(out.daCancellare).toEqual(["o1"]);
  });

  it("gestisce insieme pianificazioni e cancellazioni nello stesso giro", () => {
    const precedenti = new Map([["vecchio", p("vecchio", "T", "2026-07-20T00:00:00.000Z")]]);
    const nuovo = p("nuovo", "T2", "2026-07-21T00:00:00.000Z");
    const out = diffPromemoria([nuovo], precedenti);
    expect(out.daPianificare).toEqual([nuovo]);
    expect(out.daCancellare).toEqual(["vecchio"]);
  });
});
