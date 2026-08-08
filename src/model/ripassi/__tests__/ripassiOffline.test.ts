/**
 * Tests for the reviews list kept on the device.
 *
 * The file system is faked with a single string, which is all this module
 * needs: what is being checked is the round trip and, above all, what happens
 * to a snapshot that cannot be trusted. A list written by an older shape, a
 * file truncated by a kill mid-write, a disk that refuses to answer — each one
 * must read as "nothing saved", because the alternative is rows of an unknown
 * shape rendered into the home screen, or an exception on the first frame.
 */
let mockFile: string | null = null;
let mockLetturaFallisce = false;
let mockScritturaFallisce = false;
const mockCancellati: string[] = [];

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///documenti/",
  getInfoAsync: async () => ({ exists: mockFile !== null }),
  readAsStringAsync: async () => {
    if (mockLetturaFallisce) throw new Error("I/O error");
    return mockFile;
  },
  writeAsStringAsync: async (_uri: string, contenuto: string) => {
    if (mockScritturaFallisce) throw new Error("No space left on device");
    mockFile = contenuto;
  },
  deleteAsync: async (uri: string) => {
    mockCancellati.push(uri);
    mockFile = null;
  },
}));

import type { RipassoCompleto } from "@/model/types";
import { dimenticaRipassiSalvati, leggiRipassiSalvati, salvaRipassi } from "../ripassiOffline";

function ripasso(id: string): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    user_id: "u1",
    titolo: id,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    occorrenze: [],
    allegati: [],
  };
}

beforeEach(() => {
  mockFile = null;
  mockLetturaFallisce = false;
  mockScritturaFallisce = false;
  mockCancellati.length = 0;
});

it("restituisce la lista salvata", async () => {
  await salvaRipassi([ripasso("r1"), ripasso("r2")]);

  const salvati = await leggiRipassiSalvati();

  expect(salvati?.ripassi.map((r) => r.id)).toEqual(["r1", "r2"]);
});

/** L'età è metà del messaggio: una lista di stamattina si legge diversamente da una di settimana scorsa. */
it("registra quando la lista è stata confermata dal server", async () => {
  jest.useFakeTimers().setSystemTime(new Date("2026-08-08T09:30:00.000Z"));
  try {
    await salvaRipassi([ripasso("r1")]);

    const salvati = await leggiRipassiSalvati();

    expect(salvati?.salvatoIl.toISOString()).toBe("2026-08-08T09:30:00.000Z");
  } finally {
    jest.useRealTimers();
  }
});

it("non trova niente prima del primo caricamento riuscito", async () => {
  expect(await leggiRipassiSalvati()).toBeNull();
});

it("una lista salvata sostituisce la precedente", async () => {
  await salvaRipassi([ripasso("vecchio")]);
  await salvaRipassi([ripasso("nuovo")]);

  const salvati = await leggiRipassiSalvati();

  expect(salvati?.ripassi.map((r) => r.id)).toEqual(["nuovo"]);
});

it("dimentica la lista", async () => {
  await salvaRipassi([ripasso("r1")]);

  await dimenticaRipassiSalvati();

  expect(await leggiRipassiSalvati()).toBeNull();
  expect(mockCancellati).toEqual(["file:///documenti/ripassi-offline.json"]);
});

/**
 * Il motivo della versione. Righe di una forma che questa versione non
 * conosce, disegnate nella lista, sono peggio di una sessione che comincia
 * senza niente: il caricamento successivo riscrive tutto in pochi secondi.
 */
it("scarta un'istantanea scritta da una forma precedente", async () => {
  mockFile = JSON.stringify({
    versione: 0,
    salvatoIl: "2026-08-08T09:30:00.000Z",
    ripassi: [{ id: "vecchio" }],
  });

  expect(await leggiRipassiSalvati()).toBeNull();
});

it("scarta un file troncato", async () => {
  mockFile = '{"versione":1,"ripa';

  expect(await leggiRipassiSalvati()).toBeNull();
});

it("un disco illeggibile è «nessuna lista», non un errore", async () => {
  mockFile = "{}";
  mockLetturaFallisce = true;

  await expect(leggiRipassiSalvati()).resolves.toBeNull();
});

/**
 * Il salvataggio avviene dopo un caricamento già riuscito, con l'utente che
 * guarda il risultato: un dispositivo pieno non deve trasformare una schermata
 * che funziona in un errore.
 */
it("una scrittura fallita non risale al chiamante", async () => {
  mockScritturaFallisce = true;

  await expect(salvaRipassi([ripasso("r1")])).resolves.toBeUndefined();
});
