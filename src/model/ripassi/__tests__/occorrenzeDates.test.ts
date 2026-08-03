/**
 * Test — generazione date di ripasso (sezione 5 della spec):
 * +1 giorno, +1 settimana, +1 mese, +6 mesi sempre; +1 ora solo se attivata.
 */
import {
  applicaOffset,
  calcolaOccorrenze,
  OFFSET_AUTOMATICI,
} from "../occorrenzeDates";

describe("applicaOffset", () => {
  const base = new Date(2026, 6, 7, 15, 30, 0); // 7 lug 2026, 15:30 locale

  it("non muta la data di partenza", () => {
    const prima = base.getTime();
    applicaOffset(base, "1d");
    expect(base.getTime()).toBe(prima);
  });

  it("+1 ora", () => {
    expect(applicaOffset(base, "1h").getTime() - base.getTime()).toBe(3600_000);
  });

  it("+1 giorno mantiene l'orario", () => {
    const d = applicaOffset(base, "1d");
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([8, 15, 30]);
  });

  it("+1 settimana", () => {
    expect(applicaOffset(base, "1w").getDate()).toBe(14);
  });

  it("+1 mese e +6 mesi", () => {
    expect(applicaOffset(base, "1m").getMonth()).toBe(7); // agosto
    expect(applicaOffset(base, "6m").getMonth()).toBe(0); // gennaio anno dopo
    expect(applicaOffset(base, "6m").getFullYear()).toBe(2027);
  });

  it("fine mese: 31 gen +1m trabocca su marzo (comportamento JS documentato)", () => {
    const gen31 = new Date(2026, 0, 31, 10, 0);
    const d = applicaOffset(gen31, "1m");
    // 31 feb non esiste: JS normalizza a 2/3 marzo. L'importante è che sia
    // deterministico e non lanci.
    expect(d.getMonth()).toBe(2);
  });
});

describe("calcolaOccorrenze", () => {
  const base = new Date(2026, 6, 7, 15, 30, 0);

  it("senza +1h genera solo i 4 offset automatici", () => {
    const occ = calcolaOccorrenze(base, false);
    expect(occ.map((o) => o.offset)).toEqual(OFFSET_AUTOMATICI);
    expect(occ.every((o) => !o.is_manual_1h)).toBe(true);
  });

  it("con +1h la aggiunge in testa e la marca is_manual_1h", () => {
    const occ = calcolaOccorrenze(base, true);
    expect(occ).toHaveLength(5);
    expect(occ[0].offset).toBe("1h");
    expect(occ[0].is_manual_1h).toBe(true);
    expect(occ.slice(1).every((o) => !o.is_manual_1h)).toBe(true);
  });

  it("scheduled_at è ISO valido e ordinato crescente", () => {
    const occ = calcolaOccorrenze(base, true);
    const times = occ.map((o) => new Date(o.scheduled_at).getTime());
    expect(times.every((t) => Number.isFinite(t))).toBe(true);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});
