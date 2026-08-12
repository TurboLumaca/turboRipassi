/**
 * Tests for the battery. The one behaviour worth protecting is the one the
 * redesign is built on: the charge reads mastery, so training without
 * improving does not move it.
 */
import { SOGLIA_PADRONANZA } from "../allenamenti";
import {
  TACCHE_TOTALI,
  caricaBatteria,
  prontoPerIlCorso,
  taccheMancanti,
  valoreDiUnaTacca,
} from "../batteria";

describe("caricaBatteria", () => {
  it("è 0 senza padronanza", () => {
    expect(caricaBatteria({})).toBe(0);
  });

  it("è 100 quando entrambi i richiesti sono a soglia", () => {
    expect(
      caricaBatteria({ fonetica: SOGLIA_PADRONANZA, schedario: SOGLIA_PADRONANZA })
    ).toBe(100);
  });

  it("4/5 e 3/5 fanno 70%, come nella specifica", () => {
    expect(caricaBatteria({ fonetica: 4, schedario: 3 })).toBe(70);
  });

  it("gli allenamenti non richiesti non la caricano", () => {
    expect(caricaBatteria({ puntini: 5, rombo: 5 })).toBe(0);
  });

  it("una padronanza oltre la soglia non porta sopra il 100%", () => {
    expect(caricaBatteria({ fonetica: 50, schedario: 50 })).toBe(100);
  });
});

describe("taccheMancanti", () => {
  it("parte dal totale e scende", () => {
    expect(taccheMancanti({})).toBe(TACCHE_TOTALI);
    expect(taccheMancanti({ fonetica: 4, schedario: 3 })).toBe(3);
  });
});

describe("prontoPerIlCorso", () => {
  it("è vero solo quando non manca nessuna tacca", () => {
    expect(prontoPerIlCorso({ fonetica: 5, schedario: 4 })).toBe(false);
    expect(prontoPerIlCorso({ fonetica: 5, schedario: 5 })).toBe(true);
  });
});

describe("valoreDiUnaTacca", () => {
  it("una tacca vale il 10% con due allenamenti da cinque", () => {
    expect(valoreDiUnaTacca()).toBe(10);
  });
});
