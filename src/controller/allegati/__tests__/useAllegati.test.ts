/**
 * Tests for the attachments Controller.
 *
 * The repository arrives as a parameter, so the fake below is a plain object
 * implementing AllegatiRepo — no module mocking needed for the part that
 * matters. What is exercised: that a batch upload keeps going after one file
 * fails and hands back exactly the failures, that an upload is never retried
 * (it is not idempotent) while the idempotent operations are, and that nothing
 * fails silently.
 */
import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { Allegato } from "@/model/types";
import type { AllegatiRepo } from "@/model/allegati/allegatiRepo";

const mockAssicuraAccessoDrive = jest.fn();
jest.mock("@/controller/AuthContext", () => ({
  useAuthCtx: () => ({ assicuraAccessoDrive: mockAssicuraAccessoDrive }),
}));

const mockGetLocalUri = jest.fn();
const mockRimuoviDaCache = jest.fn();
jest.mock("@/model/cache/localCache", () => ({
  getLocalUri: (...a: unknown[]) => mockGetLocalUri(...a),
  rimuoviDaCache: (...a: unknown[]) => mockRimuoviDaCache(...a),
}));

const mockGetInfoAsync = jest.fn();
jest.mock("expo-file-system/legacy", () => ({
  getInfoAsync: (...a: unknown[]) => mockGetInfoAsync(...a),
}));

const mockMostraErrore = jest.fn();
jest.mock("@/controller/avvisoErrore", () => ({
  mostraErrore: (...a: unknown[]) => mockMostraErrore(...a),
}));

const mockApriUriLocale = jest.fn();
jest.mock("@/controller/allegati/fileDispositivo", () => ({
  apriUriLocale: (...a: unknown[]) => mockApriUriLocale(...a),
}));

import { useAllegati } from "../useAllegati";

const carica = jest.fn();
const rinomina = jest.fn();
const riordina = jest.fn();
const elimina = jest.fn();
const materializzaTemporaneo = jest.fn();

const repo: AllegatiRepo = {
  carica: (...a) => carica(...a),
  rinomina: (...a) => rinomina(...a),
  riordina: (...a) => riordina(...a),
  elimina: (...a) => elimina(...a),
  materializzaTemporaneo: (...a) => materializzaTemporaneo(...a),
};

function file(nome: string) {
  return { uri: `file:///${nome}`, name: nome, mimeType: "image/jpeg", size: 1 };
}

function allegato(): Allegato {
  return {
    id: "a1",
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    display_name: "foto.jpg",
    original_file_name: "foto.jpg",
    storage_path: "drive-1",
    order_index: 0,
    mime_type: "image/jpeg",
    size_bytes: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAssicuraAccessoDrive.mockResolvedValue(true);
  carica.mockResolvedValue(allegato());
  rinomina.mockResolvedValue(undefined);
  riordina.mockResolvedValue(undefined);
  elimina.mockResolvedValue(undefined);
  mockGetLocalUri.mockResolvedValue(null);
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("autorizzazione Drive", () => {
  it("chiede l'accesso una volta prima di caricare", async () => {
    const { result } = await renderHook(() => useAllegati("r1", undefined, repo));

    await act(async () => {
      await result.current.caricaSuRipasso("r1", [file("a.jpg")]);
    });

    expect(mockAssicuraAccessoDrive).toHaveBeenCalledTimes(1);
    expect(carica).toHaveBeenCalledTimes(1);
  });

  it("senza accesso non carica nulla e restituisce i file da riprovare", async () => {
    mockAssicuraAccessoDrive.mockResolvedValue(false);
    const { result } = await renderHook(() => useAllegati("r1", undefined, repo));

    let falliti: unknown[] = [];
    await act(async () => {
      falliti = await result.current.caricaSuRipasso("r1", [file("a.jpg")]);
    });

    expect(carica).not.toHaveBeenCalled();
    expect(falliti).toHaveLength(1);
    // I file scelti non si perdono, e l'utente riceve un messaggio.
    expect(mockMostraErrore).toHaveBeenCalled();
  });
});

describe("caricaSuRipasso", () => {
  it("prosegue dopo un fallimento e restituisce solo i file falliti", async () => {
    carica.mockImplementation(async (input: { originalFileName: string }) => {
      if (input.originalFileName === "rotto.jpg") throw new Error("Drive upload 403");
      return allegato();
    });
    const onChange = jest.fn();
    const { result } = await renderHook(() => useAllegati("r1", onChange, repo));

    let falliti: { name: string }[] = [];
    await act(async () => {
      falliti = await result.current.caricaSuRipasso("r1", [
        file("ok.jpg"),
        file("rotto.jpg"),
        file("ok2.jpg"),
      ]);
    });

    expect(carica).toHaveBeenCalledTimes(3);
    expect(falliti.map((f) => f.name)).toEqual(["rotto.jpg"]);
    expect(onChange).toHaveBeenCalled();
  });

  it("NON ritenta un upload: non è idempotente e duplicherebbe file e riga", async () => {
    // Un errore di rete può significare "la richiesta è arrivata ma la
    // risposta si è persa": un secondo tentativo creerebbe un secondo file su
    // Drive con una seconda riga in allegati.
    carica.mockRejectedValue(new TypeError("Network request failed"));
    const { result } = await renderHook(() => useAllegati("r1", undefined, repo));

    await act(async () => {
      await result.current.caricaSuRipasso("r1", [file("a.jpg")]);
    });

    expect(carica).toHaveBeenCalledTimes(1);
  });

  it("preserva l'ordine a partire dall'indice richiesto", async () => {
    const { result } = await renderHook(() => useAllegati("r1", undefined, repo));

    await act(async () => {
      await result.current.caricaSuRipasso("r1", [file("a.jpg"), file("b.jpg")], 3);
    });

    expect(carica.mock.calls.map((c) => c[0].orderIndex)).toEqual([3, 4]);
  });

  it("una lista vuota non chiede nemmeno l'accesso a Drive", async () => {
    const { result } = await renderHook(() => useAllegati("r1", undefined, repo));

    await act(async () => {
      await result.current.caricaSuRipasso("r1", []);
    });

    expect(mockAssicuraAccessoDrive).not.toHaveBeenCalled();
  });
});

describe("aggiungi", () => {
  it("avvisa invece di caricare quando il ripasso non esiste ancora", async () => {
    const { result } = await renderHook(() => useAllegati(null, undefined, repo));

    await act(async () => {
      await result.current.aggiungi(async () => file("a.jpg"), 0);
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(carica).not.toHaveBeenCalled();
  });

  it("un picker annullato non carica nulla", async () => {
    const { result } = await renderHook(() => useAllegati("r1", undefined, repo));

    await act(async () => {
      await result.current.aggiungi(async () => null, 0);
    });

    expect(carica).not.toHaveBeenCalled();
  });
});

describe("operazioni idempotenti", () => {
  it("ritenta un errore transitorio e poi ricarica", async () => {
    const onChange = jest.fn();
    rinomina.mockRejectedValueOnce(new TypeError("Network request failed"));
    const { result } = await renderHook(() => useAllegati("r1", onChange, repo));

    await act(async () => {
      await result.current.rinomina("a1", "nuovo nome");
    });

    expect(rinomina).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(mockMostraErrore).not.toHaveBeenCalled();
  });

  it("non ritenta un errore di permessi: ripeterebbe lo stesso fallimento", async () => {
    riordina.mockRejectedValue({ code: "42501", message: "row-level security" });
    const { result } = await renderHook(() => useAllegati("r1", undefined, repo));

    await act(async () => {
      await result.current.riordina(["a", "b"]);
    });

    expect(riordina).toHaveBeenCalledTimes(1);
    expect(mockMostraErrore).toHaveBeenCalled();
  });

  it("eliminando un allegato ne rimuove anche la copia in cache", async () => {
    const { result } = await renderHook(() => useAllegati("r1", undefined, repo));

    await act(async () => {
      await result.current.elimina(allegato());
    });

    expect(elimina).toHaveBeenCalled();
    expect(mockRimuoviDaCache).toHaveBeenCalledWith("a1");
  });

  it("un fallimento non resta una promise non gestita: diventa un messaggio", async () => {
    elimina.mockRejectedValue(new Error("boom"));
    const { result } = await renderHook(() => useAllegati("r1", undefined, repo));

    await act(async () => {
      await result.current.elimina(allegato());
    });

    expect(mockMostraErrore).toHaveBeenCalledTimes(1);
    expect(mockMostraErrore.mock.calls[0][1]).toBe("eliminaAllegato");
  });
});

describe("risolviUri", () => {
  it("preferisce la copia in cache quando il file c'è davvero", async () => {
    mockGetLocalUri.mockResolvedValue("file:///cache/a1.jpg");
    mockGetInfoAsync.mockResolvedValue({ exists: true });
    const { result } = await renderHook(() => useAllegati("r1", undefined, repo));

    let uri = "";
    await act(async () => {
      uri = await result.current.risolviUri(allegato());
    });

    expect(uri).toBe("file:///cache/a1.jpg");
    expect(materializzaTemporaneo).not.toHaveBeenCalled();
  });

  it("scarica se la riga di cache c'è ma il file è sparito", async () => {
    mockGetLocalUri.mockResolvedValue("file:///cache/a1.jpg");
    mockGetInfoAsync.mockResolvedValue({ exists: false });
    materializzaTemporaneo.mockResolvedValue("file:///tmp/a1.jpg");
    const { result } = await renderHook(() => useAllegati("r1", undefined, repo));

    let uri = "";
    await act(async () => {
      uri = await result.current.risolviUri(allegato());
    });

    expect(uri).toBe("file:///tmp/a1.jpg");
  });

  it("il download è idempotente, quindi viene ritentato", async () => {
    materializzaTemporaneo
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValue("file:///tmp/a1.jpg");
    const { result } = await renderHook(() => useAllegati("r1", undefined, repo));

    await act(async () => {
      await result.current.risolviUri(allegato());
    });

    expect(materializzaTemporaneo).toHaveBeenCalledTimes(2);
  });
});

describe("apri", () => {
  it("risolve l'uri locale e lascia decidere al livello di piattaforma", async () => {
    materializzaTemporaneo.mockResolvedValue("file:///tmp/a1.jpg");
    mockApriUriLocale.mockResolvedValue({ tipo: "immagine", uri: "file:///tmp/a1.jpg" });
    const { result } = await renderHook(() => useAllegati("r1", undefined, repo));

    let esito: unknown;
    await act(async () => {
      esito = await result.current.apri(allegato());
    });

    expect(mockApriUriLocale).toHaveBeenCalledWith("file:///tmp/a1.jpg", "image/jpeg");
    expect(esito).toEqual({ tipo: "immagine", uri: "file:///tmp/a1.jpg" });
  });
});
