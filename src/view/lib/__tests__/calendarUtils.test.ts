import {
  conGiornoDi,
  grigliaMese,
  stessoGiorno,
} from "../calendarUtils";

describe("grigliaMese", () => {
  it("produce sempre 42 celle (6 righe × 7)", () => {
    expect(grigliaMese(2026, 0)).toHaveLength(42);
    expect(grigliaMese(2026, 1)).toHaveLength(42);
  });

  it("inizia di lunedì: gennaio 2026 (1 gen = giovedì) parte dal 29 dic", () => {
    const celle = grigliaMese(2026, 0);
    // Lunedì della settimana che contiene il 1° gennaio 2026 = 29 dicembre 2025.
    expect(celle[0].data.getFullYear()).toBe(2025);
    expect(celle[0].data.getMonth()).toBe(11);
    expect(celle[0].data.getDate()).toBe(29);
    expect(celle[0].nelMese).toBe(false);
  });

  it("marca nelMese solo i giorni del mese richiesto", () => {
    const celle = grigliaMese(2026, 0);
    const gennaio = celle.filter((c) => c.nelMese);
    expect(gennaio).toHaveLength(31);
    expect(gennaio.every((c) => c.data.getMonth() === 0)).toBe(true);
  });
});

describe("stessoGiorno", () => {
  it("ignora l'orario", () => {
    const a = new Date(2026, 5, 10, 9, 0);
    const b = new Date(2026, 5, 10, 23, 59);
    expect(stessoGiorno(a, b)).toBe(true);
  });

  it("distingue giorni diversi", () => {
    expect(stessoGiorno(new Date(2026, 5, 10), new Date(2026, 5, 11))).toBe(false);
  });
});

describe("conGiornoDi", () => {
  it("applica il giorno mantenendo l'ora originale", () => {
    const base = new Date(2026, 0, 1, 14, 30, 15);
    const giorno = new Date(2026, 7, 20, 0, 0, 0);
    const out = conGiornoDi(base, giorno);
    expect(out.getFullYear()).toBe(2026);
    expect(out.getMonth()).toBe(7);
    expect(out.getDate()).toBe(20);
    expect(out.getHours()).toBe(14);
    expect(out.getMinutes()).toBe(30);
    expect(out.getSeconds()).toBe(15);
  });
});
