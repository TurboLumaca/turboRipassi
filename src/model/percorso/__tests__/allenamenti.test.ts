/**
 * Tests for the training catalogue and the grouping that drives the Allenati
 * screen. The point of most of them is that nothing is ever dropped from the
 * list: a locked training stays visible and says when it opens.
 */
import {
  CATALOGO,
  RICHIESTI_PRIMA_DEL_CORSO,
  SOGLIA_PADRONANZA,
  allenamentoPerId,
  gruppiAllenamenti,
  isSbloccato,
  padronanzaDi,
  statoAllenamento,
} from "../allenamenti";

const nessuna = {};

describe("catalogo", () => {
  it("gli id sono unici", () => {
    const ids = CATALOGO.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("ogni allenamento del corso dichiara il giorno di sblocco", () => {
    for (const a of CATALOGO.filter((x) => x.fase === "corso")) {
      expect(typeof a.giornoSblocco).toBe("number");
    }
  });

  it("i due richiesti prima del corso esistono e sono della fase pre", () => {
    for (const id of RICHIESTI_PRIMA_DEL_CORSO) {
      const a = allenamentoPerId(id);
      expect(a?.fase).toBe("pre");
    }
  });

  it("un id sconosciuto non trova nulla", () => {
    expect(allenamentoPerId("inesistente")).toBeUndefined();
  });
});

describe("padronanzaDi", () => {
  it("un valore mancante vale zero", () => {
    expect(padronanzaDi(nessuna, "fonetica")).toBe(0);
  });

  it("resta dentro [0, soglia]", () => {
    expect(padronanzaDi({ x: -3 }, "x")).toBe(0);
    expect(padronanzaDi({ x: 99 }, "x")).toBe(SOGLIA_PADRONANZA);
  });

  it("ignora un valore non numerico", () => {
    expect(padronanzaDi({ x: Number.NaN }, "x")).toBe(0);
  });
});

describe("isSbloccato", () => {
  const puntini = allenamentoPerId("puntini")!;
  const fonetica = allenamentoPerId("fonetica")!;

  it("le basi sono sempre aperte, anche a giorno zero", () => {
    expect(isSbloccato(fonetica, 0)).toBe(true);
  });

  it("un allenamento del corso si apre al suo giorno", () => {
    expect(isSbloccato(puntini, 1)).toBe(false);
    expect(isSbloccato(puntini, 2)).toBe(true);
  });
});

describe("statoAllenamento", () => {
  const fonetica = allenamentoPerId("fonetica")!;
  const griglia = allenamentoPerId("griglia")!;

  it("bloccato batte qualsiasi padronanza", () => {
    expect(statoAllenamento(griglia, 1, { griglia: 5 })).toBe("bloccato");
  });

  it("distingue da fare, in corso e raggiunto", () => {
    expect(statoAllenamento(fonetica, 0, nessuna)).toBe("da-fare");
    expect(statoAllenamento(fonetica, 0, { fonetica: 3 })).toBe("in-corso");
    expect(statoAllenamento(fonetica, 0, { fonetica: SOGLIA_PADRONANZA })).toBe("raggiunto");
  });
});

describe("gruppiAllenamenti", () => {
  it("in fase pre la batteria sta solo sul primo gruppo", () => {
    const gruppi = gruppiAllenamenti("pre", 0, nessuna);
    expect(gruppi.map((g) => g.batteria)).toEqual([true, false, false]);
  });

  it("in fase pre tutti gli allenamenti del corso sono visibili e bloccati", () => {
    const [, corso] = gruppiAllenamenti("pre", 0, nessuna);
    expect(corso.voci).toHaveLength(6);
    expect(corso.voci.every((v) => v.stato === "bloccato")).toBe(true);
    expect(corso.voci[0].nota).toMatch(/Si sblocca al Giorno/);
  });

  it("l'ospite vede la stessa mappa dell'iscritto prima del corso", () => {
    expect(gruppiAllenamenti("ospite", 0, nessuna)).toEqual(gruppiAllenamenti("pre", 0, nessuna));
  });

  it("durante il corso la batteria sparisce da ogni gruppo", () => {
    const gruppi = gruppiAllenamenti("durante", 7, nessuna);
    expect(gruppi.some((g) => g.batteria)).toBe(false);
  });

  it("al giorno 7 è aperto quello del giorno 5 e non quello del giorno 8", () => {
    const [corso] = gruppiAllenamenti("durante", 7, nessuna);
    const per = (id: string) => corso.voci.find((v) => v.allenamento.id === id);
    expect(per("copri")?.stato).not.toBe("bloccato");
    expect(per("parole")?.stato).toBe("bloccato");
  });

  it("durante il corso il chip dice il giorno, non la fase", () => {
    const [corso] = gruppiAllenamenti("durante", 7, nessuna);
    expect(per(corso.voci, "puntini")).toBe("Giorno 2");
  });

  it("dopo il corso ogni chip diventa Mantenimento", () => {
    const gruppi = gruppiAllenamenti("post", 30, nessuna);
    const chips = gruppi.flatMap((g) => g.voci.map((v) => v.chip));
    expect(new Set(chips)).toEqual(new Set(["Mantenimento"]));
  });

  it("dopo il corso l'archivio contiene tutto il catalogo", () => {
    const gruppi = gruppiAllenamenti("post", 30, nessuna);
    expect(gruppi[1].voci).toHaveLength(CATALOGO.length);
  });

  it("un allenamento bloccato non mostra padronanza", () => {
    const [corso] = gruppiAllenamenti("durante", 2, { griglia: 5 });
    expect(corso.voci.find((v) => v.allenamento.id === "griglia")?.padronanza).toBe(0);
  });
});

function per(voci: { allenamento: { id: string }; chip: string }[], id: string) {
  return voci.find((v) => v.allenamento.id === id)?.chip;
}
