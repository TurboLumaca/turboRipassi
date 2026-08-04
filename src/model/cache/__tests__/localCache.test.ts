/**
 * Tests for the cache I/O layer. SQLite, the file system, the Drive client and
 * crash reporting are all mocked; the SQLite fake keeps rows in a Map, so the
 * assertions are about behaviour ("has this file been downloaded again?")
 * rather than about the SQL text.
 *
 * The selection rule itself lives in cacheLogic and is tested there. What is
 * exercised here is the part that touches the world: not re-downloading what
 * is already on disk, noticing when the file has disappeared underneath us,
 * removing what left the window, and — the point of the whole module — not
 * losing the fact that a download failed.
 */
import type { Allegato } from "@/model/types";

interface Riga {
  allegato_id: string;
  local_uri: string;
  cached_at: string;
}

const mockRighe = new Map<string, Riga>();
/** Local uris the file system is pretending to hold. */
const mockFileEsistenti = new Set<string>();
const mockFileCancellati: string[] = [];
const mockScarica = jest.fn();
const mockReportError = jest.fn();

jest.mock("expo-sqlite", () => ({
  openDatabaseAsync: async () => ({
    execAsync: async () => undefined,
    getAllAsync: async () => [...mockRighe.values()],
    getFirstAsync: async (_sql: string, id: string) => mockRighe.get(id) ?? null,
    runAsync: async (sql: string, ...args: unknown[]) => {
      if (sql.startsWith("UPDATE")) {
        const [cachedAt, id] = args as [string, string];
        const riga = mockRighe.get(id);
        if (riga) riga.cached_at = cachedAt;
      } else if (sql.startsWith("INSERT")) {
        const [id, uri, cachedAt] = args as [string, string, string];
        mockRighe.set(id, { allegato_id: id, local_uri: uri, cached_at: cachedAt });
      } else if (sql.startsWith("DELETE")) {
        mockRighe.delete(args[0] as string);
      }
    },
  }),
}));

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///doc/",
  getInfoAsync: async (uri: string) => ({ exists: mockFileEsistenti.has(uri) }),
  makeDirectoryAsync: async () => undefined,
  deleteAsync: async (uri: string) => {
    mockFileCancellati.push(uri);
    mockFileEsistenti.delete(uri);
  },
}));

jest.mock("@/model/drive/driveRepo", () => ({
  driveClient: { downloadFile: jest.fn() },
}));

jest.mock("@/config/crashReporting", () => ({
  reportError: (...a: unknown[]) => mockReportError(...a),
}));

import { cacheAllegato, getLocalUri, ruotaCache, svuotaCache } from "../localCache";

function allegato(id: string): Allegato {
  return {
    id,
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    display_name: id,
    original_file_name: `${id}.jpg`,
    storage_path: `drive-${id}`,
    order_index: 0,
    mime_type: "image/jpeg",
    size_bytes: 10,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  mockRighe.clear();
  mockFileEsistenti.clear();
  mockFileCancellati.length = 0;
  mockReportError.mockClear();
  // Il downloader iniettato: scrive dove gli si chiede e segnala il file come
  // presente, come farebbe un download riuscito.
  mockScarica.mockReset();
  mockScarica.mockImplementation(async (_path: string, dest: string) => {
    mockFileEsistenti.add(dest);
    return dest;
  });
});

describe("cacheAllegato", () => {
  it("scarica il file mancante e ne registra la riga", async () => {
    const uri = await cacheAllegato(allegato("a1"), mockScarica);

    expect(mockScarica).toHaveBeenCalledWith("drive-a1", uri);
    expect(await getLocalUri("a1")).toBe(uri);
    // L'estensione viene dal nome originale: storage_path è un ID Drive e non
    // ne porta nessuna.
    expect(uri.endsWith(".jpg")).toBe(true);
  });

  it("non riscarica un file già in cache, ma ne aggiorna cached_at", async () => {
    const uri = await cacheAllegato(allegato("a1"), mockScarica);
    mockRighe.get("a1")!.cached_at = "2020-01-01";
    mockScarica.mockClear();

    const secondo = await cacheAllegato(allegato("a1"), mockScarica);

    expect(mockScarica).not.toHaveBeenCalled();
    expect(secondo).toBe(uri);
    expect(mockRighe.get("a1")!.cached_at).not.toBe("2020-01-01");
  });

  it("riscarica se la riga c'è ma il file è sparito dal dispositivo", async () => {
    await cacheAllegato(allegato("a1"), mockScarica);
    mockFileEsistenti.clear(); // pulizia di sistema, sync di iCloud, ecc.
    mockScarica.mockClear();

    await cacheAllegato(allegato("a1"), mockScarica);

    expect(mockScarica).toHaveBeenCalledTimes(1);
  });
});

describe("ruotaCache", () => {
  it("elimina file e righe degli allegati usciti dalla finestra", async () => {
    await cacheAllegato(allegato("dentro"), mockScarica);
    await cacheAllegato(allegato("fuori"), mockScarica);
    const uriFuori = (await getLocalUri("fuori"))!;

    await ruotaCache([allegato("dentro")], mockScarica);

    expect(await getLocalUri("fuori")).toBeNull();
    expect(mockFileCancellati).toContain(uriFuori);
    expect(await getLocalUri("dentro")).not.toBeNull();
  });

  it("un download fallito non ferma gli altri", async () => {
    mockScarica.mockImplementation(async (path: string, dest: string) => {
      if (path === "drive-rotto") throw new Error("403 forbidden");
      mockFileEsistenti.add(dest);
      return dest;
    });

    const esito = await ruotaCache(
      [allegato("rotto"), allegato("buono")],
      mockScarica
    );

    expect(await getLocalUri("buono")).not.toBeNull();
    expect(esito).toEqual({ disponibili: 1, falliti: 1 });
  });

  it("segnala i fallimenti anomali: una cache che non si riempie era invisibile", async () => {
    mockScarica.mockRejectedValue(new Error("403 forbidden"));

    await ruotaCache([allegato("a1")], mockScarica);

    expect(mockReportError).toHaveBeenCalledTimes(1);
    expect(mockReportError.mock.calls[0][1]).toMatchObject({
      operazione: "ruotaCache",
      falliti: 1,
    });
  });

  it("non segnala l'assenza di rete: è un esito previsto, non un'anomalia", async () => {
    mockScarica.mockRejectedValue(new TypeError("Network request failed"));

    const esito = await ruotaCache([allegato("a1")], mockScarica);

    expect(mockReportError).not.toHaveBeenCalled();
    expect(esito.falliti).toBe(1);
  });

  it("con finestra vuota svuota la cache senza scaricare nulla", async () => {
    await cacheAllegato(allegato("a1"), mockScarica);
    mockScarica.mockClear();

    const esito = await ruotaCache([], mockScarica);

    expect(mockScarica).not.toHaveBeenCalled();
    expect([...mockRighe.keys()]).toEqual([]);
    expect(esito).toEqual({ disponibili: 0, falliti: 0 });
  });
});

describe("svuotaCache", () => {
  it("rimuove ogni file e ogni riga (i file appartengono all'utente che esce)", async () => {
    await cacheAllegato(allegato("a1"), mockScarica);
    await cacheAllegato(allegato("a2"), mockScarica);

    await svuotaCache();

    expect([...mockRighe.keys()]).toEqual([]);
    expect(mockFileCancellati).toHaveLength(2);
  });
});
