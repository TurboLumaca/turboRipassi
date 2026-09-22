/**
 * Tests for the storage adapter supabase-js keeps the session in.
 *
 * What is worth asserting here is not "SecureStore was called" but the reason
 * the chunking exists at all: the session JSON (JWT + refresh token) is larger
 * than the ~2KB SecureStore accepts per entry, so it is split — and a split
 * value that comes back incomplete has to read as *absent*, not as a truncated
 * session. A half-restored session would make the app look signed in and then
 * fail every request.
 *
 * The module decides between the native and the web adapter while it is being
 * imported (`Platform.OS === "web"`), so each platform is loaded fresh, the
 * way notifications.test.ts and driveConfig.test.ts do.
 */

/** The in-memory stand-in for the Keychain/Keystore. */
interface FintoSecureStore {
  archivio: Map<string, string>;
  getItemAsync: jest.Mock;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: string;
}

interface Adattatore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Loads secureAuthStorage.ts fresh on a given platform, SecureStore mocked. */
function caricaModulo(platform: string): {
  storage: Adattatore;
  sdk: FintoSecureStore;
} {
  let storage!: Adattatore;
  let sdk!: FintoSecureStore;
  jest.isolateModules(() => {
    const archivio = new Map<string, string>();
    jest.doMock("react-native", () => ({ Platform: { OS: platform } }));
    jest.doMock("expo-secure-store", () => ({
      WHEN_UNLOCKED_THIS_DEVICE_ONLY: "whenUnlockedThisDeviceOnly",
      getItemAsync: jest.fn(async (k: string) => archivio.get(k) ?? null),
      setItemAsync: jest.fn(async (k: string, v: string) => {
        archivio.set(k, v);
      }),
      deleteItemAsync: jest.fn(async (k: string) => {
        archivio.delete(k);
      }),
    }));
    sdk = { ...require("expo-secure-store"), archivio } as FintoSecureStore;
    storage = require("../secureAuthStorage").secureAuthStorage;
  });
  return { storage, sdk };
}

/** Una sessione più lunga del tetto per entrata: deve essere spezzata. */
const SESSIONE_LUNGA = "s".repeat(4100);

describe("secureAuthStorage — su dispositivo", () => {
  it("scrive un valore corto direttamente, senza spezzarlo", async () => {
    const { storage, sdk } = caricaModulo("ios");

    await storage.setItem("sb-auth", "sessione-corta");

    expect(sdk.archivio.get("sb-auth")).toBe("sessione-corta");
    expect(sdk.archivio.has("sb-auth_chunks")).toBe(false);
    expect(await storage.getItem("sb-auth")).toBe("sessione-corta");
  });

  it("chiede la conservazione legata al dispositivo e solo da sbloccato", async () => {
    const { storage, sdk } = caricaModulo("ios");

    await storage.setItem("sb-auth", "sessione-corta");

    expect(sdk.setItemAsync).toHaveBeenCalledWith("sb-auth", "sessione-corta", {
      keychainAccessible: "whenUnlockedThisDeviceOnly",
    });
  });

  it("spezza una sessione lunga e la ricompone identica", async () => {
    const { storage, sdk } = caricaModulo("ios");

    await storage.setItem("sb-auth", SESSIONE_LUNGA);

    // 4100 caratteri a 1800 per pezzo: tre pezzi e il conteggio.
    expect(sdk.archivio.get("sb-auth_chunks")).toBe("3");
    expect(sdk.archivio.get("sb-auth_0")).toHaveLength(1800);
    expect(sdk.archivio.get("sb-auth_2")).toHaveLength(500);
    // Il valore intero non resta anche sotto la chiave nuda.
    expect(sdk.archivio.has("sb-auth")).toBe(false);

    expect(await storage.getItem("sb-auth")).toBe(SESSIONE_LUNGA);
  });

  it("legge come assente una sessione a cui manca un pezzo", async () => {
    const { storage, sdk } = caricaModulo("ios");
    await storage.setItem("sb-auth", SESSIONE_LUNGA);

    sdk.archivio.delete("sb-auth_1");

    // Non il prefisso: una sessione mezza restituita sembrerebbe valida e
    // farebbe fallire ogni richiesta dopo l'accesso.
    expect(await storage.getItem("sb-auth")).toBeNull();
  });

  it("non lascia indietro i pezzi della sessione precedente", async () => {
    const { storage, sdk } = caricaModulo("ios");
    await storage.setItem("sb-auth", SESSIONE_LUNGA);

    await storage.setItem("sb-auth", "sessione-corta");

    expect(sdk.archivio.has("sb-auth_chunks")).toBe(false);
    expect(sdk.archivio.has("sb-auth_0")).toBe(false);
    expect(await storage.getItem("sb-auth")).toBe("sessione-corta");
  });

  it("al logout cancella sia la chiave diretta sia i pezzi", async () => {
    const { storage, sdk } = caricaModulo("ios");
    await storage.setItem("sessione-lunga", SESSIONE_LUNGA);
    await storage.setItem("sessione-corta", "x");

    await storage.removeItem("sessione-lunga");
    await storage.removeItem("sessione-corta");

    expect([...sdk.archivio.keys()]).toHaveLength(0);
    expect(await storage.getItem("sessione-lunga")).toBeNull();
  });

  it("cancellare una chiave mai scritta non fa niente", async () => {
    const { storage, sdk } = caricaModulo("android");

    await storage.removeItem("mai-vista");

    expect(sdk.archivio.size).toBe(0);
  });
});

describe("secureAuthStorage — sul web", () => {
  const vero = globalThis.localStorage;

  afterEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: vero,
      configurable: true,
      writable: true,
    });
  });

  /** Installa un localStorage fittizio; `undefined` simula la sua assenza. */
  function montaLocalStorage(finto: unknown): void {
    Object.defineProperty(globalThis, "localStorage", {
      value: finto,
      configurable: true,
      writable: true,
    });
  }

  it("usa localStorage, dove il taglio in pezzi non serve", async () => {
    const magazzino = new Map<string, string>();
    montaLocalStorage({
      getItem: (k: string) => magazzino.get(k) ?? null,
      setItem: (k: string, v: string) => magazzino.set(k, v),
      removeItem: (k: string) => magazzino.delete(k),
    });
    const { storage } = caricaModulo("web");

    await storage.setItem("sb-auth", SESSIONE_LUNGA);

    expect(magazzino.get("sb-auth")).toBe(SESSIONE_LUNGA);
    expect(await storage.getItem("sb-auth")).toBe(SESSIONE_LUNGA);

    await storage.removeItem("sb-auth");
    expect(await storage.getItem("sb-auth")).toBeNull();
  });

  it("senza localStorage resta senza sessione invece di rompersi", async () => {
    montaLocalStorage(undefined);
    const { storage } = caricaModulo("web");

    await expect(storage.setItem("sb-auth", "x")).resolves.toBeUndefined();
    await expect(storage.removeItem("sb-auth")).resolves.toBeUndefined();
    expect(await storage.getItem("sb-auth")).toBeNull();
  });
});
