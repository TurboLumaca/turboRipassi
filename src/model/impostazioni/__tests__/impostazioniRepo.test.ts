/**
 * Tests for the settings persistence repository (impostazioniRepo.ts).
 */
import * as FileSystem from "expo-file-system/legacy";
import {
  IMPOSTAZIONI_INIZIALI,
  impostazioniRepo,
} from "../impostazioniRepo";

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///test-fs/",
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));

jest.mock("@/config/crashReporting", () => ({
  reportError: jest.fn(),
}));

const mockGetInfo = FileSystem.getInfoAsync as jest.Mock;
const mockRead = FileSystem.readAsStringAsync as jest.Mock;
const mockWrite = FileSystem.writeAsStringAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("impostazioniRepo", () => {
  it("restituisce i default quando il file non esiste", async () => {
    mockGetInfo.mockResolvedValue({ exists: false });
    const impostazioni = await impostazioniRepo.leggi();
    expect(impostazioni).toEqual(IMPOSTAZIONI_INIZIALI);
    // La domanda al richiamo è il comportamento storico dell'app: il default
    // non può essere il cambiamento, deve essere ciò che c'era prima.
    expect(impostazioni.chiediDomandaAlRichiamo).toBe(true);
  });

  it("legge e normalizza le impostazioni salvate", async () => {
    mockGetInfo.mockResolvedValue({ exists: true });
    mockRead.mockResolvedValue(JSON.stringify({ chiediDomandaAlRichiamo: false }));

    const impostazioni = await impostazioniRepo.leggi();
    expect(impostazioni).toEqual({ chiediDomandaAlRichiamo: false });
  });

  it("normalizza dati corrotti o incompleti senza andare in crash", async () => {
    mockGetInfo.mockResolvedValue({ exists: true });
    mockRead.mockResolvedValue("{non è json");

    expect(await impostazioniRepo.leggi()).toEqual(IMPOSTAZIONI_INIZIALI);

    mockRead.mockResolvedValue(JSON.stringify({ chiediDomandaAlRichiamo: "sì" }));
    expect(await impostazioniRepo.leggi()).toEqual(IMPOSTAZIONI_INIZIALI);
  });

  it("scrive le impostazioni su file", async () => {
    mockWrite.mockResolvedValue(undefined);
    await impostazioniRepo.scrivi({ chiediDomandaAlRichiamo: false });
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining("impostazioni.json"),
      JSON.stringify({ chiediDomandaAlRichiamo: false })
    );
  });

  it("non propaga un fallimento di scrittura: il file è una preferenza, non un dato", async () => {
    mockWrite.mockRejectedValue(new Error("disco pieno"));
    await expect(
      impostazioniRepo.scrivi({ chiediDomandaAlRichiamo: false })
    ).resolves.toBeUndefined();
  });
});
