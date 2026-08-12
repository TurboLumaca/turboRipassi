/**
 * Tests for the flashcard spacing. The middle answer is the one that carries
 * its weight here: "non sono sicuro" has to be neither a promotion nor a
 * reset, or there was no reason to offer three buttons instead of two.
 */
import {
  LINGUE,
  MAZZO,
  daRivedere,
  giorniAlRitorno,
  isLingua,
  livelloDopo,
  mazzoDi,
} from "../flashcard";

describe("livelloDopo", () => {
  it("«la so» sale di un livello", () => {
    expect(livelloDopo(1, "so")).toBe(2);
  });

  it("«non sono sicuro» lascia dov'era", () => {
    expect(livelloDopo(3, "incerto")).toBe(3);
  });

  it("«non la so» riporta all'inizio", () => {
    expect(livelloDopo(4, "non-so")).toBe(0);
  });

  it("non sale oltre l'ultimo intervallo", () => {
    expect(livelloDopo(99, "so")).toBe(livelloDopo(5, "so"));
  });

  it("regge un livello assurdo in ingresso", () => {
    expect(livelloDopo(-4, "incerto")).toBe(0);
    expect(livelloDopo(Number.NaN, "so")).toBe(1);
  });
});

describe("giorniAlRitorno", () => {
  it("una parola sbagliata torna domani", () => {
    expect(giorniAlRitorno(4, "non-so")).toBe(1);
  });

  it("una parola saputa si allontana", () => {
    expect(giorniAlRitorno(0, "so")).toBeGreaterThan(giorniAlRitorno(0, "non-so"));
  });

  it("l'intervallo massimo non cresce all'infinito", () => {
    expect(giorniAlRitorno(20, "so")).toBe(30);
  });
});

describe("mazzo", () => {
  it("le dodici lingue sono dodici", () => {
    expect(LINGUE).toHaveLength(12);
  });

  it("riconosce una lingua del catalogo e rifiuta le altre", () => {
    expect(isLingua("Inglese")).toBe(true);
    expect(isLingua("Klingon")).toBe(false);
  });

  it("mazzoDi restituisce solo quella lingua", () => {
    expect(mazzoDi("Francese").every((c) => c.lingua === "Francese")).toBe(true);
  });

  it("le carte hanno id unici", () => {
    expect(new Set(MAZZO.map((c) => c.id)).size).toBe(MAZZO.length);
  });

  it("daRivedere non conta quelle già padroneggiate", () => {
    const carte = [
      { id: "a", lingua: "Inglese" as const, fronte: "a", retro: "a", livello: 5 },
      { id: "b", lingua: "Inglese" as const, fronte: "b", retro: "b", livello: 0 },
    ];
    expect(daRivedere("Inglese", carte)).toBe(1);
  });
});
