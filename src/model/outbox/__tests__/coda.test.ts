/**
 * Tests for the queue on disk.
 *
 * This module holds the only copy of things the user has saved, so the
 * assertions are mostly about not losing them: folding repeated saves into one
 * entry instead of replaying them, keeping a private copy of files the system
 * cache would reclaim, writing through a temporary file so a crash cannot
 * truncate the queue into an empty one, and cleaning up after itself when a
 * write fails.
 *
 * The file system is a fake that keeps contents in a Map, so what is asserted
 * is behaviour — "is the photo still referenced?" — and not the shape of the
 * JSON.
 */

/** uri → contents. Stands in for the documents directory. */
const mockFile = new Map<string, string>();
const mockCartelle = new Set<string>();
const mockCopie: { from: string; to: string }[] = [];
let mockScritturaFallisce = false;

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///doc/",
  cacheDirectory: "file:///cache/",
  getInfoAsync: async (uri: string) => ({
    exists: mockFile.has(uri) || mockCartelle.has(uri),
  }),
  makeDirectoryAsync: async (uri: string) => {
    mockCartelle.add(uri);
  },
  readAsStringAsync: async (uri: string) => {
    const contenuto = mockFile.get(uri);
    if (contenuto === undefined) throw new Error("ENOENT");
    return contenuto;
  },
  writeAsStringAsync: async (uri: string, contenuto: string) => {
    if (mockScritturaFallisce) throw new Error("ENOSPC: no space left on device");
    mockFile.set(uri, contenuto);
  },
  deleteAsync: async (uri: string) => {
    mockFile.delete(uri);
    mockCartelle.delete(uri);
  },
  moveAsync: async ({ from, to }: { from: string; to: string }) => {
    const contenuto = mockFile.get(from);
    if (contenuto === undefined) throw new Error("ENOENT");
    mockFile.set(to, contenuto);
    mockFile.delete(from);
  },
  copyAsync: async ({ from, to }: { from: string; to: string }) => {
    mockCopie.push({ from, to });
    mockFile.set(to, `copia di ${from}`);
  },
}));

let mockContatoreId = 0;
jest.mock("@/model/shared/idLocale", () => ({
  idLocale: () => `id-${mockContatoreId++}`,
}));

import {
  accodaSalvataggio,
  aggiornaVoce,
  dimenticaCoda,
  leggiCoda,
  rimuoviVoce,
  segnaCompletati,
} from "../coda";

const FILE_CODA = "file:///doc/coda-uscita.json";

function fileScelto(nome: string, orderIndex = 0) {
  return {
    uri: `file:///cache/picker/${nome}`,
    nome,
    mimeType: "image/jpeg",
    sizeBytes: 100,
    orderIndex,
  };
}

function salvataggio(over: Partial<Parameters<typeof accodaSalvataggio>[0]> = {}) {
  return {
    id: "r1",
    titolo: "Teorema di Bayes",
    note: null,
    occorrenze: [{ id: "o1", scheduled_at: "2026-08-12T09:00:00.000Z", is_manual_1h: false }],
    campiModificati: true,
    file: [],
    ...over,
  };
}

beforeEach(async () => {
  mockFile.clear();
  mockCartelle.clear();
  mockCopie.length = 0;
  mockScritturaFallisce = false;
  mockContatoreId = 0;
});

describe("lettura", () => {
  it("una coda che non esiste ancora è vuota, non un errore", async () => {
    expect(await leggiCoda()).toEqual([]);
  });

  it("un file illeggibile conta come coda vuota invece di far esplodere l'avvio", async () => {
    mockFile.set(FILE_CODA, "{ questo non è json");
    expect(await leggiCoda()).toEqual([]);
  });

  it("scarta un'istantanea scritta da una versione diversa", async () => {
    mockFile.set(FILE_CODA, JSON.stringify({ versione: 99, voci: [{ id: "r1" }] }));
    expect(await leggiCoda()).toEqual([]);
  });
});

describe("accodaSalvataggio", () => {
  it("mette in coda il ripasso con le sue date", async () => {
    await accodaSalvataggio(salvataggio());

    const coda = await leggiCoda();
    expect(coda).toHaveLength(1);
    expect(coda[0].titolo).toBe("Teorema di Bayes");
    expect(coda[0].occorrenze).toHaveLength(1);
  });

  it("copia i file scelti fuori dalla cache di sistema", async () => {
    // Il picker restituisce roba nella cache di sistema, che il sistema
    // operativo svuota quando gli pare: una coda che può aspettare giorni non
    // può tenere un riferimento a qualcosa che stanotte forse non c'è più.
    await accodaSalvataggio(salvataggio({ file: [fileScelto("foto.jpg")] }));

    expect(mockCopie).toHaveLength(1);
    expect(mockCopie[0].from).toBe("file:///cache/picker/foto.jpg");
    expect(mockCopie[0].to).toMatch(/^file:\/\/\/doc\/coda-file\//);

    const [voce] = await leggiCoda();
    expect(voce.allegati[0].uri).toBe(mockCopie[0].to);
    expect(voce.allegati[0].driveFileId).toBeNull();
  });

  it("un secondo salvataggio dello stesso ripasso NON crea una seconda voce", async () => {
    // Un ripasso creato offline, poi corretto, poi arricchito di una foto è
    // UNA cosa che l'utente aspetta di veder caricata, non tre operazioni da
    // rigiocare in ordine.
    await accodaSalvataggio(salvataggio({ file: [fileScelto("a.jpg")] }));
    await accodaSalvataggio(
      salvataggio({ titolo: "Titolo corretto", occorrenze: null, file: [fileScelto("b.jpg", 1)] })
    );

    const coda = await leggiCoda();
    expect(coda).toHaveLength(1);
    expect(coda[0].titolo).toBe("Titolo corretto");
    expect(coda[0].allegati.map((a) => a.nome)).toEqual(["a.jpg", "b.jpg"]);
  });

  it("non ricalcola le date di una voce già in coda", async () => {
    // Ricalcolarle da «adesso» sposterebbe in silenzio tutto il calendario a
    // ogni correzione del titolo.
    await accodaSalvataggio(salvataggio());
    const primeDate = (await leggiCoda())[0].occorrenze;

    await accodaSalvataggio(
      salvataggio({
        occorrenze: [{ id: "altro", scheduled_at: "2027-01-01T00:00:00.000Z", is_manual_1h: true }],
      })
    );

    expect((await leggiCoda())[0].occorrenze).toEqual(primeDate);
  });

  it("una modifica accodata resta una modifica anche se poi arriva solo una foto", async () => {
    await accodaSalvataggio(salvataggio({ occorrenze: null, campiModificati: true }));
    await accodaSalvataggio(
      salvataggio({ occorrenze: null, campiModificati: false, file: [fileScelto("foto.jpg")] })
    );

    expect((await leggiCoda())[0].campiModificati).toBe(true);
  });

  it("restituisce i tentativi a una voce su cui l'utente è appena tornato", async () => {
    await accodaSalvataggio(salvataggio());
    await aggiornaVoce("r1", (v) => ({ ...v, tentativi: 4, ultimoErrore: "qualcosa" }));

    await accodaSalvataggio(salvataggio({ titolo: "Riprovo" }));

    const [voce] = await leggiCoda();
    expect(voce.tentativi).toBe(0);
    expect(voce.ultimoErrore).toBeNull();
  });

  it("se la scrittura fallisce non lascia in giro le copie appena fatte", async () => {
    mockScritturaFallisce = true;

    await expect(
      accodaSalvataggio(salvataggio({ file: [fileScelto("foto.jpg")] }))
    ).rejects.toThrow(/ENOSPC/);

    expect(mockFile.has(mockCopie[0].to)).toBe(false);
  });

  it("propaga il fallimento: chi salva deve poterlo dire all'utente", async () => {
    // A differenza dell'istantanea offline, questa non la ricostruisce
    // nessuno: fingere che sia andata sarebbe far credere che il ripasso
    // esista.
    mockScritturaFallisce = true;
    await expect(accodaSalvataggio(salvataggio())).rejects.toThrow();
    expect(await leggiCoda()).toEqual([]);
  });
});

describe("segnaCompletati", () => {
  it("toglie la voce e le copie quando non resta più niente da mandare", async () => {
    await accodaSalvataggio(salvataggio({ file: [fileScelto("foto.jpg")] }));
    const uriCopia = (await leggiCoda())[0].allegati[0].uri;

    await segnaCompletati("r1", ["id-0"], true);

    expect(await leggiCoda()).toEqual([]);
    expect(mockFile.has(uriCopia)).toBe(false);
  });

  it("una sincronizzazione parziale conserva quello che manca ancora", async () => {
    await accodaSalvataggio(
      salvataggio({ file: [fileScelto("a.jpg"), fileScelto("b.jpg", 1)] })
    );
    const [prima] = await leggiCoda();
    const [primo, secondo] = prima.allegati;

    await segnaCompletati("r1", [primo.id], true);

    const [dopo] = await leggiCoda();
    expect(dopo.occorrenze).toBeNull();
    expect(dopo.campiModificati).toBe(false);
    expect(dopo.allegati.map((a) => a.id)).toEqual([secondo.id]);
    // La copia del file già salito se ne va con lui; l'altra resta.
    expect(mockFile.has(primo.uri)).toBe(false);
    expect(mockFile.has(secondo.uri)).toBe(true);
  });

  it("su una voce che non c'è più non fa niente invece di rompersi", async () => {
    await expect(segnaCompletati("mai-esistita", [], true)).resolves.toBeUndefined();
  });
});

describe("aggiornaVoce", () => {
  it("applica la modifica alla voce COME È SU DISCO, non a una copia in mano al chiamante", async () => {
    // Il worker legge la coda, passa un minuto a caricare e poi registra cosa
    // ha ottenuto: in quel minuto l'utente può benissimo aver aggiunto una
    // foto allo stesso ripasso.
    await accodaSalvataggio(salvataggio());
    const vecchia = (await leggiCoda())[0];

    await accodaSalvataggio(salvataggio({ occorrenze: null, file: [fileScelto("tardiva.jpg")] }));
    await aggiornaVoce("r1", (v) => ({ ...v, tentativi: v.tentativi + 1 }));

    const [voce] = await leggiCoda();
    expect(voce.tentativi).toBe(1);
    expect(voce.allegati).toHaveLength(1);
    expect(vecchia.allegati).toHaveLength(0);
  });

  it("su una voce assente restituisce null", async () => {
    expect(await aggiornaVoce("mai-esistita", (v) => v)).toBeNull();
  });
});

describe("rimuovere e dimenticare", () => {
  it("rimuoviVoce butta via anche i file", async () => {
    await accodaSalvataggio(salvataggio({ file: [fileScelto("foto.jpg")] }));
    const uriCopia = (await leggiCoda())[0].allegati[0].uri;

    await rimuoviVoce("r1");

    expect(await leggiCoda()).toEqual([]);
    expect(mockFile.has(uriCopia)).toBe(false);
  });

  it("dimenticaCoda svuota tutto: al logout non è più roba di questo dispositivo", async () => {
    await accodaSalvataggio(salvataggio({ file: [fileScelto("foto.jpg")] }));

    await dimenticaCoda();

    expect(await leggiCoda()).toEqual([]);
    expect(mockFile.has(FILE_CODA)).toBe(false);
  });
});

describe("accessi concorrenti", () => {
  it("due salvataggi in parallelo non si sovrascrivono a vicenda", async () => {
    // Il caso vero: l'utente salva mentre il worker sta svuotando la coda.
    // Senza serializzazione uno dei due legge l'istantanea vecchia e la
    // riscrive sopra quella nuova.
    await Promise.all([
      accodaSalvataggio(salvataggio({ id: "r1" })),
      accodaSalvataggio(salvataggio({ id: "r2" })),
      accodaSalvataggio(salvataggio({ id: "r3" })),
    ]);

    expect((await leggiCoda()).map((v) => v.id).sort()).toEqual(["r1", "r2", "r3"]);
  });

  it("un fallimento non blocca chi viene dopo", async () => {
    mockScritturaFallisce = true;
    await expect(accodaSalvataggio(salvataggio({ id: "r1" }))).rejects.toThrow();

    mockScritturaFallisce = false;
    await accodaSalvataggio(salvataggio({ id: "r2" }));

    expect((await leggiCoda()).map((v) => v.id)).toEqual(["r2"]);
  });
});
