/**
 * Unit tests for useMicroSessione.ts hook.
 */
const mockCompleta = jest.fn();
const mockSposta = jest.fn();
const mockModifica = jest.fn();
let mockRipassiList: RipassoCompleto[] = [];

jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({
    ripassi: mockRipassiList,
    completaOccorrenza: (...a: unknown[]) => mockCompleta(...a),
    spostaOccorrenza: (...a: unknown[]) => mockSposta(...a),
    modifica: (...a: unknown[]) => mockModifica(...a),
  }),
}));

import { act, renderHook } from "@testing-library/react-native";
import { useMicroSessione } from "../useMicroSessione";
import type { Occorrenza, RipassoCompleto } from "@/model/types";

function occ(id: string, sched: string, isManual1h = false): Occorrenza {
  return {
    id,
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    scheduled_at: sched,
    is_manual_1h: isManual1h,
    is_completed: false,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
}

function ripasso(id: string, titolo: string, occs: Occorrenza[], note: string | null = null): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    user_id: "u1",
    titolo,
    note,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    occorrenze: occs,
    allegati: [],
  };
}

describe("useMicroSessione", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCompleta.mockResolvedValue(undefined);
    mockSposta.mockResolvedValue(undefined);
    mockModifica.mockResolvedValue(undefined);

    // o1 has is_manual_1h = true so it has strict priority over o2
    const r1 = ripasso("r1", "Concetto 1", [occ("o1", new Date().toISOString(), true)], "Nota iniziale");
    const r2 = ripasso("r2", "Concetto 2", [occ("o2", new Date().toISOString(), false)]);

    mockRipassiList = [r1, r2];
  });

  it("inizializza con sessione chiusa", async () => {
    const vista = await renderHook(() => useMicroSessione());
    expect(vista.result.current.aperta).toBe(false);
    expect(vista.result.current.elementi).toHaveLength(0);
    expect(vista.result.current.elementoCorrente).toBeNull();
  });

  it("avvia la sessione popolando gli elementi prioritari", async () => {
    const vista = await renderHook(() => useMicroSessione());

    await act(async () => {
      vista.result.current.avvia(2);
    });

    expect(vista.result.current.aperta).toBe(true);
    expect(vista.result.current.elementi).toHaveLength(2);
    expect(vista.result.current.indiceCorrente).toBe(0);
    expect(vista.result.current.elementoCorrente?.ripasso.id).toBe("r1");
    expect(vista.result.current.completata).toBe(false);
  });

  it("conferma l'elemento corrente e avanza all'elemento successivo", async () => {
    const vista = await renderHook(() => useMicroSessione());

    await act(async () => {
      vista.result.current.avvia(2);
    });

    await act(async () => {
      await vista.result.current.confermaCorrente();
    });

    expect(mockCompleta).toHaveBeenCalledWith("o1", true);
    expect(vista.result.current.indiceCorrente).toBe(1);
    expect(vista.result.current.elementoCorrente?.ripasso.id).toBe("r2");
    expect(vista.result.current.conteggioCompletati).toBe(1);
    expect(vista.result.current.completata).toBe(false);
  });

  it("salva la micro-nota opzionale se fornita durante la conferma", async () => {
    const vista = await renderHook(() => useMicroSessione());

    await act(async () => {
      vista.result.current.avvia(2);
    });

    await act(async () => {
      await vista.result.current.confermaCorrente("Nuova micro riflessione");
    });

    expect(mockModifica).toHaveBeenCalledWith("r1", {
      note: "Nota iniziale\n\n• Nuova micro riflessione",
    });
  });

  it("posticipa l'elemento a domani e avanza", async () => {
    const vista = await renderHook(() => useMicroSessione());

    await act(async () => {
      vista.result.current.avvia(2);
    });

    await act(async () => {
      await vista.result.current.posticipaCorrente();
    });

    expect(mockSposta).toHaveBeenCalledWith("o1", expect.any(Date), false);
    expect(vista.result.current.indiceCorrente).toBe(1);
    expect(vista.result.current.elementoCorrente?.ripasso.id).toBe("r2");
  });

  it("segna la sessione come completata dopo l'ultimo elemento", async () => {
    const vista = await renderHook(() => useMicroSessione());

    await act(async () => {
      vista.result.current.avvia(2);
    });

    await act(async () => {
      await vista.result.current.confermaCorrente();
    });
    await act(async () => {
      await vista.result.current.confermaCorrente();
    });

    expect(vista.result.current.completata).toBe(true);
    expect(vista.result.current.elementoCorrente).toBeNull();
    expect(vista.result.current.conteggioCompletati).toBe(2);
  });

  it("chiude e resetta lo stato della sessione", async () => {
    const vista = await renderHook(() => useMicroSessione());

    await act(async () => {
      vista.result.current.avvia(2);
    });
    expect(vista.result.current.aperta).toBe(true);

    await act(async () => {
      vista.result.current.chiudi();
    });

    expect(vista.result.current.aperta).toBe(false);
    expect(vista.result.current.completata).toBe(false);
    expect(vista.result.current.elementi).toHaveLength(0);
  });
});
