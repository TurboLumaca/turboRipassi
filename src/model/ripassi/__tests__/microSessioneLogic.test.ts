/**
 * Unit tests for microSessioneLogic.ts
 */
import {
  selezionaElementiMicroSessione,
  aggiungiMicroNota,
} from "../microSessioneLogic";
import type { Occorrenza, RipassoCompleto } from "../../types";

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

function ripasso(
  id: string,
  titolo: string,
  occorrenze: Occorrenza[],
  note: string | null = null
): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    user_id: "u1",
    titolo,
    note,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    occorrenze,
    allegati: [],
  };
}

describe("selezionaElementiMicroSessione", () => {
  it("restituisce un array vuoto se non ci sono ripassi", () => {
    const res = selezionaElementiMicroSessione([], { limiteElementi: 2 }, ORA);
    expect(res).toEqual([]);
  });

  it("ignora le occorrenze già completate", () => {
    const r1 = ripasso("r1", "Concetto Fatto", [
      occ({ id: "o1", scheduled_at: "2026-07-15T09:00:00.000Z", is_completed: true }),
    ]);

    const res = selezionaElementiMicroSessione([r1], { limiteElementi: 2 }, ORA);
    expect(res).toEqual([]);
  });

  it("seleziona al massimo N elementi prioritari per la giornata odierna", () => {
    const r1 = ripasso("r1", "1h Rapido", [
      occ({
        id: "o1",
        scheduled_at: "2026-07-15T09:00:00.000Z",
        is_manual_1h: true,
      }),
    ]);
    const r2 = ripasso("r2", "6 Mesi", [
      occ({
        id: "o2",
        scheduled_at: "2026-07-15T08:00:00.000Z",
        is_manual_1h: false,
        created_at: "2026-01-15T00:00:00.000Z",
      }),
    ]);
    const r3 = ripasso("r3", "1 Mese", [
      occ({
        id: "o3",
        scheduled_at: "2026-07-15T10:00:00.000Z",
        is_manual_1h: false,
        created_at: "2026-06-15T00:00:00.000Z",
      }),
    ]);

    const res = selezionaElementiMicroSessione([r1, r2, r3], { limiteElementi: 2 }, ORA);
    expect(res).toHaveLength(2);
    // Il ripasso manuale 1h ha massima priorità
    expect(res[0].ripasso.id).toBe("r1");
  });

  it("se non ci sono scadenze oggi, riempie con i primi elementi futuri disponibili", () => {
    const r1 = ripasso("r1", "Futuro Prossimo", [
      occ({ id: "o1", scheduled_at: "2026-07-18T10:00:00.000Z" }),
    ]);
    const r2 = ripasso("r2", "Futuro Lontano", [
      occ({ id: "o2", scheduled_at: "2026-07-25T10:00:00.000Z" }),
    ]);

    const res = selezionaElementiMicroSessione([r1, r2], { limiteElementi: 2 }, ORA);
    expect(res).toHaveLength(2);
    expect(res[0].occorrenza.id).toBe("o1");
    expect(res[1].occorrenza.id).toBe("o2");
  });

  it("combina elementi di oggi ed elementi futuri se quelli di oggi sono meno del limite", () => {
    const r1 = ripasso("r1", "Oggi", [
      occ({ id: "o1", scheduled_at: "2026-07-15T10:00:00.000Z" }),
    ]);
    const r2 = ripasso("r2", "Futuro", [
      occ({ id: "o2", scheduled_at: "2026-07-20T10:00:00.000Z" }),
    ]);

    const res = selezionaElementiMicroSessione([r1, r2], { limiteElementi: 2 }, ORA);
    expect(res).toHaveLength(2);
    expect(res[0].occorrenza.id).toBe("o1");
    expect(res[1].occorrenza.id).toBe("o2");
  });
});

describe("aggiungiMicroNota", () => {
  it("restituisce solo la nuova nota se non ce n'erano di precedenti", () => {
    expect(aggiungiMicroNota(null, "Intuizione")).toBe("Intuizione");
    expect(aggiungiMicroNota("", "Intuizione")).toBe("Intuizione");
  });

  it("concatena con bullet point se esistevano note", () => {
    expect(aggiungiMicroNota("Nota base", "Nuova intuizione")).toBe(
      "Nota base\n\n• Nuova intuizione"
    );
  });

  it("non modifica le note se la nuova nota è vuota o solo spazi", () => {
    expect(aggiungiMicroNota("Nota base", "   ")).toBe("Nota base");
  });
});
