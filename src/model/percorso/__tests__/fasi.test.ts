/**
 * Tests for the phase derivation. Every function takes an explicit "ora", so
 * none of this depends on the clock — and the local-midnight arithmetic is
 * exercised on purpose, because the bug it was written against (a bare date
 * read as UTC) only shows up in some time zones.
 */
import {
  DURATA_CORSO,
  batteriaVisibile,
  faseCorrente,
  giorniAllInizio,
  giornoDiCorso,
  settimaneDalCorso,
  type Iscrizione,
} from "../fasi";

/** Local midnight of a YYYY-MM-DD day, plus a few hours into the day. */
function alle(giorno: string, ore = 12): number {
  const [y, m, d] = giorno.split("-").map(Number);
  return new Date(y, m - 1, d, ore).getTime();
}

const iscritto: Iscrizione = { inizio: "2026-09-12", sede: "Rimini" };
const ospite: Iscrizione = { inizio: null };

describe("faseCorrente", () => {
  it("senza iscrizione è ospite", () => {
    expect(faseCorrente(ospite, alle("2026-09-12"))).toBe("ospite");
  });

  it("prima dell'inizio è pre", () => {
    expect(faseCorrente(iscritto, alle("2026-09-11", 23))).toBe("pre");
  });

  it("dal primo minuto del primo giorno è durante", () => {
    expect(faseCorrente(iscritto, alle("2026-09-12", 0))).toBe("durante");
  });

  it("l'ultimo giorno del corso è ancora durante", () => {
    expect(giornoDiCorso(iscritto, alle("2026-10-02"))).toBe(DURATA_CORSO);
    expect(faseCorrente(iscritto, alle("2026-10-02"))).toBe("durante");
  });

  it("il giorno dopo la fine è post", () => {
    expect(faseCorrente(iscritto, alle("2026-10-03"))).toBe("post");
  });

  it("una data illeggibile lascia l'iscritto in pre, non fra gli ospiti", () => {
    expect(faseCorrente({ inizio: "non una data" }, alle("2026-09-12"))).toBe("pre");
  });
});

describe("giornoDiCorso", () => {
  it("è 0 prima dell'inizio e 1 il primo giorno", () => {
    expect(giornoDiCorso(iscritto, alle("2026-09-01"))).toBe(0);
    expect(giornoDiCorso(iscritto, alle("2026-09-12"))).toBe(1);
  });

  it("conta i giorni, non le ore", () => {
    expect(giornoDiCorso(iscritto, alle("2026-09-18", 0))).toBe(7);
    expect(giornoDiCorso(iscritto, alle("2026-09-18", 23))).toBe(7);
  });

  it("prosegue oltre la fine del corso", () => {
    expect(giornoDiCorso(iscritto, alle("2026-10-09"))).toBe(28);
  });

  it("è 0 senza iscrizione o con una data illeggibile", () => {
    expect(giornoDiCorso(ospite, alle("2026-09-12"))).toBe(0);
    expect(giornoDiCorso({ inizio: "12/09/2026" }, alle("2026-09-12"))).toBe(0);
  });
});

describe("giorniAllInizio", () => {
  it("conta i giorni mancanti", () => {
    expect(giorniAllInizio(iscritto, alle("2026-08-31"))).toBe(12);
  });

  it("non diventa negativo a corso iniziato", () => {
    expect(giorniAllInizio(iscritto, alle("2026-09-20"))).toBe(0);
  });

  it("è 0 senza iscrizione", () => {
    expect(giorniAllInizio(ospite, alle("2026-08-31"))).toBe(0);
  });

  it("è 0 quando la data non si legge", () => {
    expect(giorniAllInizio({ inizio: "domani" }, alle("2026-08-31"))).toBe(0);
  });
});

describe("settimaneDalCorso", () => {
  it("è 0 prima e durante", () => {
    expect(settimaneDalCorso(iscritto, alle("2026-09-01"))).toBe(0);
    expect(settimaneDalCorso(iscritto, alle("2026-09-20"))).toBe(0);
  });

  it("parte da 1 il giorno dopo la fine", () => {
    expect(settimaneDalCorso(iscritto, alle("2026-10-03"))).toBe(1);
    expect(settimaneDalCorso(iscritto, alle("2026-10-10"))).toBe(2);
  });
});

describe("batteriaVisibile", () => {
  it("esiste solo prima del corso", () => {
    expect(batteriaVisibile("pre")).toBe(true);
    expect(batteriaVisibile("ospite")).toBe(true);
    expect(batteriaVisibile("durante")).toBe(false);
    expect(batteriaVisibile("post")).toBe(false);
  });
});
