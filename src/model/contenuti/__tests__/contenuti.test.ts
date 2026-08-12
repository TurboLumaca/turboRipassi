/**
 * Tests for the material list: the segmented control, the filter chips and the
 * search box all narrow the same array, and this is where that is checked.
 */
import {
  CONTENUTI,
  FILTRO_TUTTI,
  filtraContenuti,
  moduliDi,
  primoDaVedere,
  statoContenuto,
} from "../contenuti";

describe("statoContenuto", () => {
  it("legge il progresso, non un campo a parte", () => {
    expect(statoContenuto({ ...CONTENUTI[0], progresso: 0 })).toBe("nuovo");
    expect(statoContenuto({ ...CONTENUTI[0], progresso: 45 })).toBe("a-meta");
    expect(statoContenuto({ ...CONTENUTI[0], progresso: 100 })).toBe("visto");
  });
});

describe("moduliDi", () => {
  it("comincia sempre da Tutti", () => {
    expect(moduliDi("video")[0]).toBe(FILTRO_TUTTI);
  });

  it("elenca ogni modulo una volta sola", () => {
    const moduli = moduliDi("video");
    expect(new Set(moduli).size).toBe(moduli.length);
  });

  it("non mescola i moduli delle letture con quelli dei video", () => {
    expect(moduliDi("lettura")).not.toContain("Eserciziari");
  });
});

describe("filtraContenuti", () => {
  it("separa video e letture", () => {
    expect(filtraContenuti("video", FILTRO_TUTTI, "").every((c) => c.tipo === "video")).toBe(true);
  });

  it("il chip Tutti non toglie niente", () => {
    const tutti = filtraContenuti("lettura", FILTRO_TUTTI, "");
    expect(tutti).toHaveLength(CONTENUTI.filter((c) => c.tipo === "lettura").length);
  });

  it("un chip di modulo restringe a quel modulo", () => {
    expect(filtraContenuti("lettura", "Dispense", "").map((c) => c.id)).toEqual(["l3"]);
  });

  it("la ricerca ignora maiuscole e accenti di battitura", () => {
    expect(filtraContenuti("video", FILTRO_TUTTI, "GIORNO 3").map((c) => c.id)).toEqual(["v3"]);
  });

  it("la ricerca guarda anche il modulo, non solo il titolo", () => {
    expect(filtraContenuti("lettura", FILTRO_TUTTI, "dispense").map((c) => c.id)).toEqual(["l3"]);
  });

  it("chip e ricerca si combinano", () => {
    expect(filtraContenuti("video", "Eserciziari", "lettura veloce")).toEqual([]);
  });
});

describe("primoDaVedere", () => {
  it("è il primo non ancora aperto", () => {
    expect(primoDaVedere("video")?.id).toBe("v3");
  });

  it("non esiste se è stato visto tutto", () => {
    const visti = CONTENUTI.map((c) => ({ ...c, progresso: 100 }));
    expect(primoDaVedere("video", visti)).toBeUndefined();
  });
});
