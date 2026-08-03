/**
 * Tests for the reviews Controller.
 *
 * The repository is injected, so the fake below is a plain RipassiRepo. What
 * is exercised is the policy this hook owns and the Model does not: which
 * operations may be retried, which must never be, when the list is reloaded,
 * and that a failed load turns into an Italian message instead of a silent
 * empty screen.
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { RipassoCompleto } from "@/model/types";
import type { RipassiRepo } from "@/model/ripassi/ripassiRepo";

const mockRemoveChannel = jest.fn();
const mockSubscribe = jest.fn();
jest.mock("@/config/supabase", () => {
  const canale: Record<string, unknown> = {};
  canale.on = () => canale;
  canale.subscribe = () => {
    mockSubscribe();
    return canale;
  };
  return {
    supabase: {
      channel: () => canale,
      removeChannel: (...a: unknown[]) => mockRemoveChannel(...a),
    },
  };
});

const mockReportError = jest.fn();
jest.mock("@/config/crashReporting", () => ({
  reportError: (...a: unknown[]) => mockReportError(...a),
}));

import { useRipassi } from "../useRipassi";

const leggiCompleti = jest.fn();
const crea = jest.fn();
const aggiorna = jest.fn();
const elimina = jest.fn();
const aggiornaOccorrenza = jest.fn();
const completaOccorrenza = jest.fn();

const repo: RipassiRepo = {
  leggiCompleti: () => leggiCompleti(),
  crea: (...a) => crea(...a),
  aggiorna: (...a) => aggiorna(...a),
  elimina: (...a) => elimina(...a),
  aggiornaOccorrenza: (...a) => aggiornaOccorrenza(...a),
  completaOccorrenza: (...a) => completaOccorrenza(...a),
};

function ripasso(id: string): RipassoCompleto {
  return {
    id,
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
  jest.clearAllMocks();
  leggiCompleti.mockResolvedValue([ripasso("r1")]);
  crea.mockResolvedValue({ id: "nuovo" });
  aggiorna.mockResolvedValue(undefined);
  elimina.mockResolvedValue(undefined);
  aggiornaOccorrenza.mockResolvedValue(undefined);
  completaOccorrenza.mockResolvedValue(undefined);
});

describe("caricamento iniziale", () => {
  it("carica la lista e smette di segnalare il caricamento", async () => {
    const { result } = await renderHook(() => useRipassi(repo));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.ripassi.map((r) => r.id)).toEqual(["r1"]);
    expect(result.current.error).toBeNull();
  });

  it("ritenta un errore transitorio prima di disturbare l'utente", async () => {
    leggiCompleti
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValue([ripasso("r1")]);

    const { result } = await renderHook(() => useRipassi(repo));

    await waitFor(() => expect(result.current.ripassi).toHaveLength(1));
    expect(leggiCompleti).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
  });

  it("un errore definitivo diventa un messaggio in italiano, non uno schermo vuoto", async () => {
    leggiCompleti.mockRejectedValue({ code: "42501", message: "row-level security" });

    const { result } = await renderHook(() => useRipassi(repo));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).not.toMatch(/row-level/i);
    expect(result.current.loading).toBe(false);
    expect(mockReportError).toHaveBeenCalled();
  });
});

describe("sottoscrizione Realtime", () => {
  it("si iscrive una volta sola e si disiscrive allo smontaggio", async () => {
    const { unmount } = await renderHook(() => useRipassi(repo));

    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    await unmount();

    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });
});

describe("crea", () => {
  it("NON viene ritentata: un insert ripetuto creerebbe un secondo ripasso", async () => {
    // Un errore di rete può voler dire "arrivata ma risposta persa": meglio
    // chiedere all'utente di ripremere che duplicare in silenzio.
    crea.mockRejectedValue(new TypeError("Network request failed"));
    const { result } = await renderHook(() => useRipassi(repo));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(
        result.current.crea({ titolo: "T", note: null, includi1h: false })
      ).rejects.toThrow();
    });

    expect(crea).toHaveBeenCalledTimes(1);
  });

  it("restituisce il ripasso creato e ricarica la lista", async () => {
    const { result } = await renderHook(() => useRipassi(repo));
    await waitFor(() => expect(result.current.loading).toBe(false));
    leggiCompleti.mockClear();

    let creato: { id: string } | undefined;
    await act(async () => {
      creato = await result.current.crea({ titolo: "T", note: null, includi1h: false });
    });

    // L'id serve subito: gli allegati scelti prima del salvataggio devono
    // sapere a quale ripasso appartengono.
    expect(creato?.id).toBe("nuovo");
    expect(leggiCompleti).toHaveBeenCalledTimes(1);
  });
});

describe("mutazioni idempotenti", () => {
  it("ritenta un errore transitorio e poi ricarica", async () => {
    aggiorna.mockRejectedValueOnce(new TypeError("Network request failed"));
    const { result } = await renderHook(() => useRipassi(repo));
    await waitFor(() => expect(result.current.loading).toBe(false));
    leggiCompleti.mockClear();

    await act(async () => {
      await result.current.modifica("r1", { titolo: "nuovo" });
    });

    expect(aggiorna).toHaveBeenCalledTimes(2);
    expect(leggiCompleti).toHaveBeenCalledTimes(1);
  });

  it("sposta un'occorrenza passando la data in ISO", async () => {
    const { result } = await renderHook(() => useRipassi(repo));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const data = new Date("2026-09-01T08:30:00.000Z");

    await act(async () => {
      await result.current.spostaOccorrenza("occ-1", data);
    });

    expect(aggiornaOccorrenza).toHaveBeenCalledWith("occ-1", {
      scheduled_at: "2026-09-01T08:30:00.000Z",
    });
  });

  it("propaga un errore non ritentabile al chiamante", async () => {
    elimina.mockRejectedValue({ code: "42501", message: "row-level security" });
    const { result } = await renderHook(() => useRipassi(repo));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.elimina("r1")).rejects.toBeDefined();
    });

    expect(elimina).toHaveBeenCalledTimes(1);
  });
});
