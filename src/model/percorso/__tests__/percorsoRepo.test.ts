/**
 * Tests for the file the whole redesign persists into.
 *
 * Phase, enrolment, mastery, language and chosen programme have no table on
 * the server: this one JSON file is the only copy. That makes the interesting
 * assertions defensive rather than functional — what happens when the file is
 * absent, truncated, or written by an older build. A repository that throws on
 * a bad file takes the app down at launch, which is the one failure the user
 * cannot work around.
 *
 * The file system is a fake holding contents in a Map, so the assertions are
 * about behaviour and not about the shape of the JSON.
 */

/** uri → contents. Stands in for the documents directory. */
const mockFile = new Map<string, string>();
let mockLetturaFallisce = false;
let mockScritturaFallisce = false;

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///doc/",
  getInfoAsync: async (uri: string) => ({ exists: mockFile.has(uri) }),
  readAsStringAsync: async (uri: string) => {
    if (mockLetturaFallisce) throw new Error("EIO");
    const contenuto = mockFile.get(uri);
    if (contenuto === undefined) throw new Error("ENOENT");
    return contenuto;
  },
  writeAsStringAsync: async (uri: string, contenuto: string) => {
    if (mockScritturaFallisce) throw new Error("ENOSPC: no space left on device");
    mockFile.set(uri, contenuto);
  },
}));

const mockReportError = jest.fn();
jest.mock("@/config/crashReporting", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}));

import { STATO_INIZIALE, percorsoRepo } from "../percorsoRepo";

const FILE = "file:///doc/percorso.json";

beforeEach(() => {
  mockFile.clear();
  mockLetturaFallisce = false;
  mockScritturaFallisce = false;
  mockReportError.mockClear();
});

describe("percorsoRepo.leggi", () => {
  it("su un'installazione nuova restituisce lo stato iniziale, non un errore", async () => {
    expect(await percorsoRepo.leggi()).toEqual(STATO_INIZIALE);
    expect(mockReportError).not.toHaveBeenCalled();
  });

  it("rilegge quello che è stato scritto", async () => {
    await percorsoRepo.scrivi({
      iscrizione: { inizio: "2026-09-12", sede: "Rimini", tutor: "Anna" },
      padronanze: { fonetica: 3 },
      lingua: "Francese",
      programma: "rimini",
    });

    const stato = await percorsoRepo.leggi();
    expect(stato.iscrizione).toEqual({ inizio: "2026-09-12", sede: "Rimini", tutor: "Anna" });
    expect(stato.padronanze).toEqual({ fonetica: 3 });
    expect(stato.lingua).toBe("Francese");
    expect(stato.programma).toBe("rimini");
  });

  /** Il caso che conta: un file rotto non deve impedire l'avvio. */
  it("un file troncato non propaga l'errore e riparte dallo stato iniziale", async () => {
    mockFile.set(FILE, '{"iscrizione":{"inizio":"2026-09-1');

    expect(await percorsoRepo.leggi()).toEqual(STATO_INIZIALE);
    expect(mockReportError).toHaveBeenCalled();
  });

  it("un errore di lettura del filesystem è segnalato, non lanciato", async () => {
    mockFile.set(FILE, "{}");
    mockLetturaFallisce = true;

    expect(await percorsoRepo.leggi()).toEqual(STATO_INIZIALE);
    expect(mockReportError).toHaveBeenCalled();
  });

  /**
   * Ogni campo ricade sul proprio valore iniziale in modo indipendente: una
   * chiave sbagliata costa una chiave, non l'intero percorso.
   */
  it("scarta i singoli campi non validi e tiene gli altri", async () => {
    mockFile.set(
      FILE,
      JSON.stringify({
        iscrizione: { inizio: 42 },
        padronanze: { fonetica: 4, rotta: "tre", nulla: null },
        lingua: "Klingon",
        programma: 7,
      })
    );

    const stato = await percorsoRepo.leggi();
    expect(stato.iscrizione.inizio).toBeNull();
    expect(stato.padronanze).toEqual({ fonetica: 4 });
    expect(stato.lingua).toBe(STATO_INIZIALE.lingua);
    expect(stato.programma).toBeNull();
  });

  it("un contenuto che non è nemmeno un oggetto non rompe nulla", async () => {
    mockFile.set(FILE, '"percorso"');
    expect(await percorsoRepo.leggi()).toEqual(STATO_INIZIALE);
  });
});

describe("percorsoRepo.scrivi", () => {
  /**
   * La schermata ha già aggiornato lo stato: un avviso qui interromperebbe un
   * allenamento per dire una cosa che il salvataggio successivo risolve.
   */
  it("un disco pieno viene segnalato ma non lanciato al chiamante", async () => {
    mockScritturaFallisce = true;

    await expect(percorsoRepo.scrivi(STATO_INIZIALE)).resolves.toBeUndefined();
    expect(mockReportError).toHaveBeenCalled();
  });
});
