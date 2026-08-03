/**
 * Test — codici di autorizzazione OAuth già spesi.
 *
 * Piccolo ma non banale: è la primitiva che impedisce a un redirect consegnato
 * due volte (una come risultato del browser, una come deep link) di provare a
 * scambiare lo stesso codice monouso due volte. Prima esisteva in due copie
 * con cicli di vita diversi, di cui una non veniva svuotata mai.
 */
import { dimenticaCodiciUsati, marcaUsato } from "../codiciUsati";

beforeEach(() => {
  dimenticaCodiciUsati();
});

describe("marcaUsato", () => {
  it("la prima volta dice che il codice è nuovo, la seconda che è già visto", () => {
    expect(marcaUsato("abc")).toBe(false);
    expect(marcaUsato("abc")).toBe(true);
  });

  it("tiene i codici distinti fra loro", () => {
    marcaUsato("uno");
    expect(marcaUsato("due")).toBe(false);
    expect(marcaUsato("uno")).toBe(true);
  });

  it("dimentica i più vecchi: nessuna crescita illimitata", () => {
    // Il vecchio Set a livello di modulo cresceva per tutta la vita del
    // processo. Solo i redirect recenti possono ancora tornare indietro.
    for (let i = 0; i < 25; i++) marcaUsato(`code-${i}`);

    expect(marcaUsato("code-0")).toBe(false); // dimenticato
    expect(marcaUsato("code-24")).toBe(true); // ancora ricordato
  });
});

describe("dimenticaCodiciUsati", () => {
  it("azzera tutto: dopo un logout un nuovo giro riparte pulito", () => {
    marcaUsato("abc");
    dimenticaCodiciUsati();
    expect(marcaUsato("abc")).toBe(false);
  });
});
