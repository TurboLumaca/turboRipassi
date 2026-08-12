/**
 * Test dell'autorizzazione a scrivere su Google Drive.
 *
 * La relazione dichiara i flussi OAuth come il rischio residuo più alto del
 * progetto, e questo hook è la parte del rischio che si può esercitare senza un
 * browser: le decisioni che prende sono tutte su quando chiedere il consenso e
 * quando invece limitarsi a rispondere di no. Sono anche i due difetti che
 * l'app ha già avuto davvero — un token il cui refresh Google aveva revocato
 * continuava a risultare autorizzato, e il pannello dell'account dichiarava
 * «non collegato» dopo un caricamento riuscito.
 *
 * L'asimmetria fra i due `set` è la regola meno ovvia e la più importante:
 * `accessoPronto` può alzare la bandiera ma non abbassarla, perché un refresh
 * torna vuoto anche quando è solo caduta la rete, e abbassarla lì
 * annuncerebbe Drive scollegato a ogni galleria.
 */
const mockIsAuthorized = jest.fn();
const mockAuthorize = jest.fn();
const mockGetValidAccessToken = jest.fn();
const mockCompleta = jest.fn();
const mockClear = jest.fn();
jest.mock("@/model/drive/driveAuth", () => ({
  driveTokenManager: {
    isAuthorized: () => mockIsAuthorized(),
    authorize: () => mockAuthorize(),
    getValidAccessToken: () => mockGetValidAccessToken(),
    completaAutorizzazione: (url: string) => mockCompleta(url),
    clear: () => mockClear(),
  },
}));

const mockReset = jest.fn();
jest.mock("@/model/drive/driveRepo", () => ({
  resetDriveFolderCache: () => mockReset(),
}));

import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useDriveAuth } from "../useDriveAuth";

const segnalaErrore = jest.fn();

/** L'hook non guarda dentro la sessione: gli basta che cambi identità. */
const SESSIONE = { user: { id: "u1" } } as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockIsAuthorized.mockResolvedValue(false);
  mockAuthorize.mockResolvedValue(true);
  mockGetValidAccessToken.mockResolvedValue("token-valido");
  mockCompleta.mockResolvedValue(true);
  mockClear.mockResolvedValue(undefined);
});

describe("stato iniziale", () => {
  it("all'avvio rilegge se l'autorizzazione c'è già", async () => {
    mockIsAuthorized.mockResolvedValue(true);

    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));

    await waitFor(() => expect(result.current.driveAutorizzato).toBe(true));
  });

  /** Uno storage illeggibile non è un motivo per bloccare l'app. */
  it("uno storage che esplode vale «non autorizzato», non un errore", async () => {
    mockIsAuthorized.mockRejectedValue(new Error("keychain bloccato"));

    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));

    await waitFor(() => expect(mockIsAuthorized).toHaveBeenCalled());
    expect(result.current.driveAutorizzato).toBe(false);
    expect(segnalaErrore).not.toHaveBeenCalled();
  });

  /** Account diverso, token diversi: la risposta di prima non vale più. */
  it("cambiare sessione fa ricontrollare l'autorizzazione", async () => {
    const { rerender } = await renderHook(
      ({ s }: { s: typeof SESSIONE | null }) => useDriveAuth(segnalaErrore, s),
      { initialProps: { s: null as typeof SESSIONE | null } }
    );
    await waitFor(() => expect(mockIsAuthorized).toHaveBeenCalledTimes(1));

    await rerender({ s: SESSIONE });

    await waitFor(() => expect(mockIsAuthorized).toHaveBeenCalledTimes(2));
  });
});

describe("autorizzaDrive", () => {
  it("un consenso concesso alza la bandiera e pulisce l'errore", async () => {
    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));

    let esito = false;
    await act(async () => {
      esito = await result.current.autorizzaDrive();
    });

    expect(esito).toBe(true);
    expect(result.current.driveAutorizzato).toBe(true);
    expect(segnalaErrore).toHaveBeenCalledWith(null);
  });

  it("un consenso negato lascia la bandiera bassa senza inventare un errore", async () => {
    mockAuthorize.mockResolvedValue(false);
    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));

    let esito = true;
    await act(async () => {
      esito = await result.current.autorizzaDrive();
    });

    expect(esito).toBe(false);
    expect(result.current.driveAutorizzato).toBe(false);
    expect(segnalaErrore).toHaveBeenCalledTimes(1);
    expect(segnalaErrore).toHaveBeenCalledWith(null);
  });

  it("un consenso che fallisce diventa un messaggio per l'utente", async () => {
    mockAuthorize.mockRejectedValue(new Error("browser chiuso"));
    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));

    let esito = true;
    await act(async () => {
      esito = await result.current.autorizzaDrive();
    });

    expect(esito).toBe(false);
    expect(segnalaErrore).toHaveBeenLastCalledWith(expect.any(String));
  });
});

describe("accessoPronto", () => {
  /**
   * Il difetto vero: `isAuthorized()` diceva di sì su un refresh token revocato
   * da Google, e ogni caricamento falliva dentro il client Drive. Qui si
   * guarda l'access token, non il fatto che un token esista.
   */
  it("guarda l'access token, non se un token è archiviato", async () => {
    mockIsAuthorized.mockResolvedValue(true);
    mockGetValidAccessToken.mockResolvedValue(null);
    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));

    let pronto = true;
    await act(async () => {
      pronto = await result.current.accessoPronto();
    });

    expect(pronto).toBe(false);
    expect(mockGetValidAccessToken).toHaveBeenCalled();
  });

  it("un token valido alza la bandiera anche se all'avvio era bassa", async () => {
    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));
    expect(result.current.driveAutorizzato).toBe(false);

    await act(async () => {
      await result.current.accessoPronto();
    });

    expect(result.current.driveAutorizzato).toBe(true);
  });

  /** La galleria: rete assente, non consenso revocato. */
  it("un refresh a vuoto non abbassa una bandiera già alzata", async () => {
    mockIsAuthorized.mockResolvedValue(true);
    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));
    await waitFor(() => expect(result.current.driveAutorizzato).toBe(true));

    mockGetValidAccessToken.mockResolvedValue(null);
    await act(async () => {
      await result.current.accessoPronto();
    });

    expect(result.current.driveAutorizzato).toBe(true);
  });

  /** Non deve mai aprire un browser: è la differenza con assicuraAccesso. */
  it("non chiede mai il consenso da solo", async () => {
    mockGetValidAccessToken.mockRejectedValue(new Error("offline"));
    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));

    let pronto = true;
    await act(async () => {
      pronto = await result.current.accessoPronto();
    });

    expect(pronto).toBe(false);
    expect(mockAuthorize).not.toHaveBeenCalled();
  });
});

describe("assicuraAccesso", () => {
  it("con un token valido non disturba l'utente", async () => {
    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));

    let ok = false;
    await act(async () => {
      ok = await result.current.assicuraAccesso();
    });

    expect(ok).toBe(true);
    expect(mockAuthorize).not.toHaveBeenCalled();
  });

  it("senza token valido chiede il consenso", async () => {
    mockGetValidAccessToken.mockResolvedValue(null);
    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));

    let ok = false;
    await act(async () => {
      ok = await result.current.assicuraAccesso();
    });

    expect(mockAuthorize).toHaveBeenCalledTimes(1);
    expect(ok).toBe(true);
  });
});

describe("completaRedirectDrive", () => {
  it("un redirect valido completa l'autorizzazione", async () => {
    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));

    let ok = false;
    await act(async () => {
      ok = await result.current.completaRedirectDrive("ripassa://drive?code=abc");
    });

    expect(ok).toBe(true);
    expect(result.current.driveAutorizzato).toBe(true);
  });

  /**
   * L'app riceve deep link che non c'entrano niente con Drive: rispondere
   * `false` senza rumore è ciò che permette al chiamante di continuare a
   * cercare chi se ne occupa.
   */
  it("un link che non riguarda Drive risponde di no e basta", async () => {
    mockCompleta.mockResolvedValue(false);
    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));

    let ok = true;
    await act(async () => {
      ok = await result.current.completaRedirectDrive("ripassa://altro");
    });

    expect(ok).toBe(false);
    expect(result.current.driveAutorizzato).toBe(false);
    expect(segnalaErrore).not.toHaveBeenCalled();
  });

  it("un redirect malformato diventa un messaggio, non un'eccezione", async () => {
    mockCompleta.mockRejectedValue(new Error("state non corrispondente"));
    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));

    let ok = true;
    await act(async () => {
      ok = await result.current.completaRedirectDrive("ripassa://drive?code=rotto");
    });

    expect(ok).toBe(false);
    expect(segnalaErrore).toHaveBeenCalledWith(expect.any(String));
  });
});

describe("dimenticaDrive", () => {
  it("cancella i token e svuota la cache della cartella", async () => {
    mockIsAuthorized.mockResolvedValue(true);
    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));
    await waitFor(() => expect(result.current.driveAutorizzato).toBe(true));

    await act(async () => {
      await result.current.dimenticaDrive();
    });

    expect(mockClear).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalled();
    expect(result.current.driveAutorizzato).toBe(false);
  });

  /** Il logout non può fallire perché i token non c'erano già più. */
  it("token già assenti non impediscono il logout", async () => {
    mockClear.mockRejectedValue(new Error("niente da cancellare"));
    const { result } = await renderHook(() => useDriveAuth(segnalaErrore, SESSIONE));

    await act(async () => {
      await result.current.dimenticaDrive();
    });

    expect(result.current.driveAutorizzato).toBe(false);
  });
});
