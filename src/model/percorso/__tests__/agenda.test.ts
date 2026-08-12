/**
 * Tests for the drawer's data: appointments, goals, courses and programmes.
 */
import {
  APPUNTAMENTI,
  CORSI,
  OBIETTIVI,
  PROGRAMMI,
  appuntamentiFuturi,
  giornoEMese,
  percentualeObiettivo,
  prossimoAppuntamento,
  type Appuntamento,
} from "../agenda";

function alle(giorno: string, ore = 12): number {
  const [y, m, d] = giorno.split("-").map(Number);
  return new Date(y, m - 1, d, ore).getTime();
}

describe("appuntamentiFuturi", () => {
  it("tiene quelli di oggi e li ordina dal più vicino", () => {
    const futuri = appuntamentiFuturi(alle("2026-08-31"));
    expect(futuri[0].id).toBe("camp-1");
    expect(futuri.map((a) => a.giorno)).toEqual([...futuri.map((a) => a.giorno)].sort());
  });

  it("scarta quelli passati", () => {
    expect(appuntamentiFuturi(alle("2026-09-06")).map((a) => a.id)).toEqual(["giorno-1"]);
  });

  it("scarta le date illeggibili invece di ordinarle su NaN", () => {
    const rotto: Appuntamento[] = [
      { id: "x", giorno: "quando capita", titolo: "T", quando: "", stato: "confermato" },
      ...APPUNTAMENTI,
    ];
    expect(appuntamentiFuturi(alle("2026-01-01"), rotto).some((a) => a.id === "x")).toBe(false);
  });
});

describe("prossimoAppuntamento", () => {
  it("è il primo dei futuri", () => {
    expect(prossimoAppuntamento(alle("2026-09-02"))?.id).toBe("tutor");
  });

  it("non esiste quando sono tutti passati", () => {
    expect(prossimoAppuntamento(alle("2027-01-01"))).toBeUndefined();
  });
});

describe("giornoEMese", () => {
  it("dà giorno a due cifre e mese abbreviato", () => {
    expect(giornoEMese("2026-08-31")).toEqual({ giorno: "31", mese: "AGO" });
    expect(giornoEMese("2026-09-01")).toEqual({ giorno: "01", mese: "SET" });
  });

  it("degrada senza rompersi su una data illeggibile", () => {
    expect(giornoEMese("boh")).toEqual({ giorno: "—", mese: "" });
  });
});

describe("percentualeObiettivo", () => {
  it("arrotonda al punto percentuale", () => {
    expect(percentualeObiettivo({ id: "x", titolo: "", fatti: 5, totale: 12, nota: "" })).toBe(42);
  });

  it("un totale a zero non divide per zero", () => {
    expect(percentualeObiettivo({ id: "x", titolo: "", fatti: 3, totale: 0, nota: "" })).toBe(0);
  });

  it("non supera il 100%", () => {
    expect(percentualeObiettivo({ id: "x", titolo: "", fatti: 9, totale: 5, nota: "" })).toBe(100);
  });
});

describe("cataloghi", () => {
  it("hanno id unici", () => {
    for (const elenco of [CORSI, OBIETTIVI, PROGRAMMI, APPUNTAMENTI]) {
      const ids = elenco.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("un solo corso è in corso", () => {
    expect(CORSI.filter((c) => c.stato === "in-corso")).toHaveLength(1);
  });
});
