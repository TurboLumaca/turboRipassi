/**
 * Il richiamo, dal lato del Controller.
 *
 * Due invarianti portano tutto il peso.
 *
 * La prima: nessuna scrittura prima della risposta. È ciò che rende il
 * completamento un atto di testing invece di una spunta — se bastasse aprire
 * la sheet per far salire il contatore, lo zombie-completion sarebbe tornato
 * dalla finestra.
 *
 * La seconda: un rientro che non riesce a essere scritto non annulla il
 * richiamo. Il completamento è ciò che l'utente ha fatto; l'anticipo di tre
 * giorni è una cortesia che l'app aggiunge sopra, e quando fallisce lo
 * scheduling normale riporta comunque il concetto.
 */
const mockCompleta = jest.fn();
const mockAggiungiRichiamo = jest.fn();

jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({
    completaOccorrenza: (...a: unknown[]) => mockCompleta(...a),
    aggiungiRichiamo: (...a: unknown[]) => mockAggiungiRichiamo(...a),
  }),
}));

import { act, renderHook } from "@testing-library/react-native";
import { useRichiamo } from "../useRichiamo";
import {
  FRASI_ERRORE_PRODUTTIVO,
  GIORNI_RIENTRO_ERRORE,
} from "@/model/ripassi/richiamoLogic";
import type { VoceRipasso } from "@/model/ripassi/ripassiLogic";
import type { Occorrenza, RipassoCompleto } from "@/model/types";

const occorrenza: Occorrenza = {
  id: "o1",
  ripasso_id: "r1",
  account_id: "a1",
  user_id: "u1",
  scheduled_at: "2026-09-21T09:00:00.000Z",
  is_manual_1h: false,
  is_completed: false,
  created_at: "2026-09-01T09:00:00.000Z",
  updated_at: "2026-09-01T09:00:00.000Z",
};

function voce(over: Partial<RipassoCompleto> = {}, occ = occorrenza): VoceRipasso {
  return {
    ripasso: {
      id: "r1",
      account_id: "a1",
      user_id: "u1",
      titolo: "Avversione alla perdita",
      domanda: "Perché ~2,25?",
      note: "Tversky & Kahneman.",
      ceremony_shown_at: null,
      created_at: "2026-09-01T09:00:00.000Z",
      updated_at: "2026-09-01T09:00:00.000Z",
      occorrenze: [occ],
      allegati: [],
      ...over,
    },
    occorrenza: occ,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCompleta.mockResolvedValue(undefined);
  mockAggiungiRichiamo.mockResolvedValue(undefined);
});

describe("useRichiamo", () => {
  it("parte chiuso", async () => {
    const { result } = await renderHook(() => useRichiamo());
    expect(result.current.voce).toBeNull();
    expect(result.current.domanda).toBe("");
  });

  // Il punto dell'intero question-first: aprire non scrive niente.
  it("aprire mostra la domanda e non tocca il repository", async () => {
    const { result } = await renderHook(() => useRichiamo());
    await act(async () => {
      result.current.apri(voce());
    });

    expect(result.current.passo).toBe("domanda");
    expect(result.current.domanda).toBe("Perché ~2,25?");
    expect(mockCompleta).not.toHaveBeenCalled();
  });

  it("su un concetto senza domanda propria chiede la cosa vera", async () => {
    const { result } = await renderHook(() => useRichiamo());
    await act(async () => {
      result.current.apri(voce({ domanda: null }));
    });
    expect(result.current.domanda).toBe("Che cosa ricordi di «Avversione alla perdita»?");
  });

  it("«Lo ricordavo» completa e chiude, senza rientri aggiuntivi", async () => {
    const { result } = await renderHook(() => useRichiamo());
    await act(async () => {
      result.current.apri(voce());
    });
    await act(async () => {
      result.current.mostraRisposta();
    });
    expect(result.current.passo).toBe("risposta");

    await act(async () => {
      await result.current.rispondi("ricordato");
    });

    expect(mockCompleta).toHaveBeenCalledWith("o1", true);
    expect(mockAggiungiRichiamo).not.toHaveBeenCalled();
    expect(result.current.voce).toBeNull();
  });

  // Il rientro *aggiunge* una data, non ne sposta una: un tentativo fallito
  // non deve rimandare tutto il resto del calendario.
  it("«Non del tutto» completa, aggiunge un rientro fra tre giorni e lo dice", async () => {
    const { result } = await renderHook(() => useRichiamo());
    await act(async () => {
      result.current.apri(voce());
    });
    await act(async () => {
      await result.current.rispondi("parziale");
    });

    expect(mockCompleta).toHaveBeenCalledWith("o1", true);
    expect(mockAggiungiRichiamo).toHaveBeenCalledTimes(1);

    const [ripassoId, quando] = mockAggiungiRichiamo.mock.calls[0] as [string, Date];
    expect(ripassoId).toBe("r1");
    const giorni = Math.round((quando.getTime() - Date.now()) / 86_400_000);
    expect(giorni).toBe(GIORNI_RIENTRO_ERRORE);

    expect(result.current.passo).toBe("erroreProduttivo");
    expect(result.current.feedback?.rientro).toBe("Rientra fra 3 giorni.");
    expect(FRASI_ERRORE_PRODUTTIVO).toContain(result.current.feedback?.frase);
  });

  it("se il rientro non si scrive, il richiamo resta registrato lo stesso", async () => {
    mockAggiungiRichiamo.mockRejectedValue(new Error("offline"));
    const { result } = await renderHook(() => useRichiamo());
    await act(async () => {
      result.current.apri(voce());
    });
    await act(async () => {
      await result.current.rispondi("parziale");
    });

    expect(mockCompleta).toHaveBeenCalledWith("o1", true);
    expect(result.current.passo).toBe("erroreProduttivo");
    expect(result.current.errore).not.toBeNull();
  });

  it("se il completamento fallisce non finge che sia andato", async () => {
    mockCompleta.mockRejectedValue(new Error("boom"));
    const { result } = await renderHook(() => useRichiamo());
    await act(async () => {
      result.current.apri(voce());
    });
    await act(async () => {
      await result.current.rispondi("ricordato");
    });

    expect(result.current.errore).not.toBeNull();
    expect(result.current.voce).not.toBeNull();
    expect(mockAggiungiRichiamo).not.toHaveBeenCalled();
  });

  it("rispondere a sheet chiusa non fa niente", async () => {
    const { result } = await renderHook(() => useRichiamo());
    await act(async () => {
      await result.current.rispondi("ricordato");
    });
    expect(mockCompleta).not.toHaveBeenCalled();
  });

  // L'escape hatch. Punire chi ha già richiamato fuori dall'app insegnerebbe
  // in un giorno solo che la cosa che conta è la spunta.
  it("il completamento diretto scrive senza passare dalla domanda", async () => {
    const { result } = await renderHook(() => useRichiamo());
    await act(async () => {
      await result.current.completaDiretto(voce());
    });
    expect(mockCompleta).toHaveBeenCalledWith("o1", true);
    expect(result.current.voce).toBeNull();
  });

  it("il completamento diretto inverte una spunta già messa", async () => {
    const fatta = { ...occorrenza, is_completed: true };
    const { result } = await renderHook(() => useRichiamo());
    await act(async () => {
      await result.current.completaDiretto(voce({}, fatta));
    });
    expect(mockCompleta).toHaveBeenCalledWith("o1", false);
  });

  it("il completamento diretto dice quando fallisce", async () => {
    mockCompleta.mockRejectedValue(new Error("boom"));
    const { result } = await renderHook(() => useRichiamo());
    await act(async () => {
      await result.current.completaDiretto(voce());
    });
    expect(result.current.errore).not.toBeNull();
  });

  it("chiudere riporta tutto al punto di partenza", async () => {
    const { result } = await renderHook(() => useRichiamo());
    await act(async () => {
      result.current.apri(voce());
    });
    await act(async () => {
      await result.current.rispondi("parziale");
    });
    await act(async () => {
      result.current.chiudi();
    });

    expect(result.current.voce).toBeNull();
    expect(result.current.passo).toBe("domanda");
    expect(result.current.feedback).toBeNull();
    expect(result.current.errore).toBeNull();
  });
});
