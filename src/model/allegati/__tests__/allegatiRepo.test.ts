/**
 * Tests for the attachments repository. Drive, Supabase, the file system and
 * the image compressor are all mocked: what is exercised is the compensation
 * logic between two stores that have no transaction in common.
 *
 * An attachment is two writes — a binary on the user's Drive and a row on
 * Postgres — and nothing makes them atomic. The interesting paths are exactly
 * the ones where the second write fails.
 */
import type { Allegato } from "@/model/types";

interface Risultato {
  data?: unknown;
  error?: unknown;
}

let mockRisultatoInsert: Risultato = { data: null, error: null };
let mockRisultatoRpc: Risultato = { error: null };
const mockPayloadInseriti: Record<string, unknown>[] = [];
const mockRpc = jest.fn();

function mockBuilder() {
  const b: Record<string, unknown> = {
    insert: jest.fn((payload: Record<string, unknown>) => {
      mockPayloadInseriti.push(payload);
      return b;
    }),
    update: jest.fn(() => b),
    delete: jest.fn(() => b),
    eq: jest.fn(() => b),
    select: jest.fn(() => b),
    single: jest.fn(async () => mockRisultatoInsert),
    then: (ok: (r: Risultato) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve(mockRisultatoInsert).then(ok, ko),
  };
  return b;
}

jest.mock("@/config/supabase", () => ({
  supabase: {
    from: () => mockBuilder(),
    rpc: (...args: unknown[]) => {
      mockRpc(...args);
      return Promise.resolve(mockRisultatoRpc);
    },
  },
}));

const mockUploadFile = jest.fn();
const mockDeleteFile = jest.fn();
const mockDownloadFile = jest.fn();
jest.mock("@/model/drive/driveRepo", () => ({
  driveClient: {
    uploadFile: (...a: unknown[]) => mockUploadFile(...a),
    deleteFile: (...a: unknown[]) => mockDeleteFile(...a),
    downloadFile: (...a: unknown[]) => mockDownloadFile(...a),
  },
}));

const mockGetInfoAsync = jest.fn();
jest.mock("expo-file-system/legacy", () => ({
  getInfoAsync: (...a: unknown[]) => mockGetInfoAsync(...a),
  cacheDirectory: "file:///cache/",
}));

const mockManipulate = jest.fn();
jest.mock("expo-image-manipulator", () => ({
  manipulateAsync: (...a: unknown[]) => mockManipulate(...a),
  SaveFormat: { JPEG: "jpeg" },
}));

import { allegatiRepo } from "../allegatiRepo";

const INPUT = {
  ripassoId: "r1",
  localUri: "file:///tmp/foto.jpg",
  originalFileName: "foto.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 4_000_000,
  orderIndex: 0,
};

function allegato(): Allegato {
  return {
    id: "a1",
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    display_name: "foto.jpg",
    original_file_name: "foto.jpg",
    storage_path: "drive-file-1",
    order_index: 0,
    mime_type: "image/jpeg",
    size_bytes: 100,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPayloadInseriti.length = 0;
  mockRisultatoInsert = { data: { id: "a1" }, error: null };
  mockRisultatoRpc = { error: null };
  mockUploadFile.mockResolvedValue({ id: "drive-file-1", name: "n", mimeType: "image/jpeg" });
  mockDeleteFile.mockResolvedValue(undefined);
  mockManipulate.mockResolvedValue({ uri: "file:///tmp/compressa.jpg" });
  mockGetInfoAsync.mockResolvedValue({ exists: true, size: 380_000 });
});

describe("carica", () => {
  it("carica il file compresso, non l'originale", async () => {
    await allegatiRepo.carica(INPUT);

    expect(mockManipulate).toHaveBeenCalled();
    expect(mockUploadFile.mock.calls[0][0].localUri).toBe("file:///tmp/compressa.jpg");
  });

  it("registra la dimensione del file caricato, non quella dichiarata dal picker", async () => {
    // Il consumo dello storage è l'unico numero che il progetto deve tenere
    // d'occhio: salvare i 4 MB dell'originale invece dei 380 KB compressi lo
    // sovrastimava di un ordine di grandezza su ogni foto.
    await allegatiRepo.carica(INPUT);

    expect(mockPayloadInseriti[0].size_bytes).toBe(380_000);
  });

  it("ripiega sulla dimensione dichiarata se il file system non risponde", async () => {
    mockGetInfoAsync.mockRejectedValue(new Error("no such file"));

    await allegatiRepo.carica(INPUT);

    expect(mockPayloadInseriti[0].size_bytes).toBe(4_000_000);
  });

  it("non comprime i PDF", async () => {
    await allegatiRepo.carica({
      ...INPUT,
      localUri: "file:///tmp/dispensa.pdf",
      originalFileName: "dispensa.pdf",
      mimeType: "application/pdf",
    });

    expect(mockManipulate).not.toHaveBeenCalled();
    expect(mockUploadFile.mock.calls[0][0].localUri).toBe("file:///tmp/dispensa.pdf");
  });

  it("salva l'ID Drive in storage_path", async () => {
    await allegatiRepo.carica(INPUT);
    expect(mockPayloadInseriti[0].storage_path).toBe("drive-file-1");
  });

  it("se l'insert dei metadati fallisce, cancella il file su Drive e rilancia", async () => {
    // Senza questo, un fallimento su Postgres lascerebbe nel Drive dell'utente
    // un file che l'app non sa più di avere creato.
    mockRisultatoInsert = { data: null, error: { message: "row-level security" } };

    await expect(allegatiRepo.carica(INPUT)).rejects.toEqual({ message: "row-level security" });
    expect(mockDeleteFile).toHaveBeenCalledWith("drive-file-1");
  });

  it("un rollback fallito non maschera l'errore originale", async () => {
    mockRisultatoInsert = { data: null, error: { message: "row-level security" } };
    mockDeleteFile.mockRejectedValue(new Error("offline"));

    await expect(allegatiRepo.carica(INPUT)).rejects.toEqual({ message: "row-level security" });
  });
});

describe("riordina", () => {
  it("usa un'unica chiamata transazionale, non un update per riga", async () => {
    await allegatiRepo.riordina(["a", "b", "c"]);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("riordina_allegati", { ids: ["a", "b", "c"] });
  });

  it("rilancia l'errore del database", async () => {
    mockRisultatoRpc = { error: { message: "function does not exist" } };
    await expect(allegatiRepo.riordina(["a"])).rejects.toEqual({
      message: "function does not exist",
    });
  });
});

describe("elimina", () => {
  it("cancella prima la riga e poi il file su Drive", async () => {
    await allegatiRepo.elimina(allegato());
    expect(mockDeleteFile).toHaveBeenCalledWith("drive-file-1");
  });

  it("non cancella nulla su Drive se la riga non è stata eliminata", async () => {
    // L'ordine conta: eliminare prima il binario lascerebbe una riga che punta
    // a un file inesistente, cioè un allegato che non si apre più.
    mockRisultatoInsert = { data: null, error: { message: "permission denied" } };

    await expect(allegatiRepo.elimina(allegato())).rejects.toEqual({
      message: "permission denied",
    });
    expect(mockDeleteFile).not.toHaveBeenCalled();
  });
});

describe("materializzaTemporaneo", () => {
  it("scarica in una sottocartella dedicata, con l'estensione del nome originale", async () => {
    mockDownloadFile.mockResolvedValue("file:///cache/allegati-tmp/a1.jpg");

    const uri = await allegatiRepo.materializzaTemporaneo(allegato());

    expect(uri).toBe("file:///cache/allegati-tmp/a1.jpg");
    expect(mockDownloadFile).toHaveBeenCalledWith("drive-file-1", "file:///cache/allegati-tmp/a1.jpg");
  });
});
