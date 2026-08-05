/**
 * Test — formattazione date della View (italiano, etichette relative).
 */
import {
  etichettaRelativa,
  formatData,
  formatDataBreve,
  formatGiorno,
  formatOra,
  isPassato,
} from "../format";

describe("formatData", () => {
  it("formatta giorno, data, mese, anno e orario in italiano", () => {
    const iso = new Date(2026, 6, 7, 9, 5).toISOString(); // martedì 7 lug 2026
    expect(formatData(iso)).toBe("mar 7 lug 2026 · 09:05");
  });
});

describe("formatGiorno", () => {
  it("data senza giorno della settimana né orario", () => {
    expect(formatGiorno(new Date(2026, 7, 5, 11, 32).toISOString())).toBe("5 ago 2026");
  });
});

describe("formatOra", () => {
  it("ore e minuti a due cifre", () => {
    expect(formatOra(new Date(2026, 7, 5, 9, 5).toISOString())).toBe("09:05");
  });
});

describe("formatDataBreve", () => {
  it("giorno + mese abbreviato", () => {
    expect(formatDataBreve(new Date(2026, 11, 25, 12).toISOString())).toBe("25 dic");
  });
});

describe("etichettaRelativa", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 7, 12, 0)); // "oggi" = 7 lug 2026
  });
  afterEach(() => jest.useRealTimers());

  it("Oggi / Domani / Ieri", () => {
    expect(etichettaRelativa(new Date(2026, 6, 7, 23, 0).toISOString())).toBe("Oggi");
    expect(etichettaRelativa(new Date(2026, 6, 8, 0, 30).toISOString())).toBe("Domani");
    expect(etichettaRelativa(new Date(2026, 6, 6, 1, 0).toISOString())).toBe("Ieri");
  });

  it("oltre ±1 giorno usa la data breve", () => {
    expect(etichettaRelativa(new Date(2026, 6, 9, 10, 0).toISOString())).toBe("9 lug");
  });
});

describe("isPassato", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 7, 12, 0));
  });
  afterEach(() => jest.useRealTimers());

  it("true per date precedenti, false per future", () => {
    expect(isPassato(new Date(2026, 6, 7, 11, 59).toISOString())).toBe(true);
    expect(isPassato(new Date(2026, 6, 7, 12, 1).toISOString())).toBe(false);
  });
});
