/**
 * Tests for the Pausa persistence repository (pausaRepo.ts).
 */
import * as FileSystem from "expo-file-system/legacy";
import {
  pausaRepo,
  dimenticaPausa,
  STATO_PAUSA_INIZIALE,
  type ConfigurazionePausa,
} from "../pausaRepo";

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///test-fs/",
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

jest.mock("@/config/crashReporting", () => ({
  reportError: jest.fn(),
}));

const mockGetInfo = FileSystem.getInfoAsync as jest.Mock;
const mockRead = FileSystem.readAsStringAsync as jest.Mock;
const mockWrite = FileSystem.writeAsStringAsync as jest.Mock;
const mockDelete = FileSystem.deleteAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("pausaRepo", () => {
  it("restituisce lo stato iniziale quando il file non esiste", async () => {
    mockGetInfo.mockResolvedValue({ exists: false });
    const stato = await pausaRepo.leggi();
    expect(stato).toEqual(STATO_PAUSA_INIZIALE);
  });

  it("legge e normalizza la configurazione salvata", async () => {
    mockGetInfo.mockResolvedValue({ exists: true });
    mockRead.mockResolvedValue(
      JSON.stringify({
        attiva: true,
        dataInizio: "2026-07-10T10:00:00.000Z",
        dataFine: "2026-07-17T10:00:00.000Z",
        motivo: "Vacanze",
      })
    );

    const stato = await pausaRepo.leggi();
    expect(stato).toEqual({
      attiva: true,
      dataInizio: "2026-07-10T10:00:00.000Z",
      dataFine: "2026-07-17T10:00:00.000Z",
      motivo: "Vacanze",
    });
  });

  it("normalizza dati corrotti o incompleti senza andare in crash", async () => {
    mockGetInfo.mockResolvedValue({ exists: true });
    mockRead.mockResolvedValue("invalid json{}");

    const stato = await pausaRepo.leggi();
    expect(stato).toEqual(STATO_PAUSA_INIZIALE);
  });

  it("scrive lo stato sul file system", async () => {
    mockWrite.mockResolvedValue(undefined);
    const config: ConfigurazionePausa = {
      attiva: true,
      dataInizio: "2026-07-10T10:00:00.000Z",
    };

    await pausaRepo.scrivi(config);
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining("pausa.json"),
      JSON.stringify(config)
    );
  });

  it("dimenticaPausa cancella il file", async () => {
    mockDelete.mockResolvedValue(undefined);
    await dimenticaPausa();
    expect(mockDelete).toHaveBeenCalledWith(
      expect.stringContaining("pausa.json"),
      { idempotent: true }
    );
  });
});
