import {
  erroreNome,
  filtraPerMateria,
  inchiostroSu,
  LUNGHEZZA_MAX_NOME,
  normalizzaNome,
  ordinaMaterie,
  PALETTE_MATERIE,
  perId,
  prossimoColore,
  trovaPerNome,
} from "../materieLogic";
import type { Materia } from "../../types";

function materia(nome: string, colore = PALETTE_MATERIE[0], id = nome): Materia {
  return {
    id,
    account_id: "a1",
    user_id: null,
    nome,
    colore,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("normalizzaNome / trovaPerNome", () => {
  it("toglie gli spazi ai bordi e riduce quelli interni a uno", () => {
    expect(normalizzaNome("  Basi   di  dati ")).toBe("Basi di dati");
  });

  it("trova una materia senza badare a maiuscole e spazi", () => {
    const m = [materia("Basi di dati")];
    expect(trovaPerNome(m, "  basi DI   dati")?.id).toBe("Basi di dati");
    expect(trovaPerNome(m, "Fisica")).toBeNull();
  });
});

describe("erroreNome", () => {
  const m = [materia("Fisica")];

  it("accetta un nome nuovo", () => {
    expect(erroreNome(m, "Chimica")).toBeNull();
  });
  it("rifiuta un nome vuoto o di soli spazi", () => {
    expect(erroreNome(m, "   ")).toMatch(/Scrivi/);
  });
  it("rifiuta un nome troppo lungo", () => {
    expect(erroreNome(m, "x".repeat(LUNGHEZZA_MAX_NOME + 1))).toMatch(/massimo/);
    expect(erroreNome(m, "x".repeat(LUNGHEZZA_MAX_NOME))).toBeNull();
  });
  it("rifiuta un duplicato, anche scritto diversamente", () => {
    expect(erroreNome(m, " fisica ")).toMatch(/Esiste già/);
  });
});

describe("prossimoColore", () => {
  it("parte dal primo colore della tavolozza", () => {
    expect(prossimoColore([])).toBe(PALETTE_MATERIE[0]);
  });

  it("salta i colori già usati, senza badare alle maiuscole", () => {
    const m = [materia("A", PALETTE_MATERIE[0].toLowerCase()), materia("B", PALETTE_MATERIE[1])];
    expect(prossimoColore(m)).toBe(PALETTE_MATERIE[2]);
  });

  it("a tavolozza esaurita sceglie il colore meno usato", () => {
    const tutte = PALETTE_MATERIE.map((c, i) => materia(`m${i}`, c));
    // Il primo colore ora è usato due volte: non deve essere il prossimo.
    const m = [...tutte, materia("doppia", PALETTE_MATERIE[0])];
    expect(prossimoColore(m)).toBe(PALETTE_MATERIE[1]);
  });
});

describe("ordinaMaterie / perId", () => {
  it("ordina alfabeticamente senza badare a maiuscole", () => {
    const o = ordinaMaterie([materia("fisica"), materia("Analisi"), materia("Basi")]);
    expect(o.map((m) => m.nome)).toEqual(["Analisi", "Basi", "fisica"]);
  });

  it("non modifica l'elenco ricevuto", () => {
    const m = [materia("b"), materia("a")];
    ordinaMaterie(m);
    expect(m.map((x) => x.nome)).toEqual(["b", "a"]);
  });

  it("indicizza per id", () => {
    expect(perId([materia("Fisica", "#5AA9E6", "f1")]).get("f1")?.nome).toBe("Fisica");
  });
});

describe("filtraPerMateria", () => {
  const r = [
    { id: "1", materia_id: "f" },
    { id: "2", materia_id: null },
    { id: "3", materia_id: "g" },
  ];

  it("con null non filtra", () => {
    expect(filtraPerMateria(r, null)).toHaveLength(3);
  });
  it("tiene solo i ripassi della materia scelta", () => {
    expect(filtraPerMateria(r, "f").map((x) => x.id)).toEqual(["1"]);
  });
  it("una materia senza ripassi dà una lista vuota", () => {
    expect(filtraPerMateria(r, "zzz")).toEqual([]);
  });
});

describe("inchiostroSu", () => {
  it("scuro sui colori chiari, chiaro sui colori scuri", () => {
    expect(inchiostroSu("#FFFFFF")).toBe("#1C253F");
    expect(inchiostroSu("#000000")).toBe("#FFFFFF");
  });
  it("su un colore malformato ripiega sull'inchiostro scuro", () => {
    expect(inchiostroSu("rosso")).toBe("#1C253F");
  });
});
