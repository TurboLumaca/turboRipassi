/**
 * Tests for the ripasso form Controller.
 *
 * This is where the orchestration lives — "create or update, then upload what
 * was picked before the row existed, then decide whether the screen may close"
 * — and it is the part of the app that can destroy user data if it gets the
 * order wrong. The first block is a regression test for exactly that.
 *
 * The two contexts it reads are mocked: the point is the hook's own decisions,
 * not Supabase.
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { RipassoCompleto } from "@/model/types";

const mockCrea = jest.fn();
const mockModifica = jest.fn();
const mockEliminaRipasso = jest.fn();
const mockReload = jest.fn();
const mockAccoda = jest.fn();
const mockScarta = jest.fn();
let mockRipassi: RipassoCompleto[] = [];
let mockIdsInCoda = new Set<string>();

jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({
    ripassi: mockRipassi,
    reload: mockReload,
    crea: mockCrea,
    modifica: mockModifica,
    elimina: mockEliminaRipasso,
    idsInCoda: mockIdsInCoda,
    coda: { accoda: mockAccoda, scarta: mockScarta },
  }),
}));

// Online unless a test says otherwise: the deferred-save path is the exception,
// and every pre-existing test here is about what happens with a connection.
let mockOnline = true;
jest.mock("@/controller/useConnettivita", () => ({
  useConnettivita: () => ({ online: mockOnline }),
}));

const mockCaricaSuRipasso = jest.fn();
jest.mock("@/controller/allegati/useAllegati", () => ({
  useAllegati: () => ({
    busy: false,
    caricaSuRipasso: mockCaricaSuRipasso,
    risolviUri: jest.fn(),
  }),
}));

const mockMostraErrore = jest.fn();
jest.mock("@/controller/avvisoErrore", () => ({
  mostraErrore: (...a: unknown[]) => mockMostraErrore(...a),
}));

import { useFormRipasso } from "../useFormRipasso";

function ripasso(over: Partial<RipassoCompleto> = {}): RipassoCompleto {
  return {
    id: "r1",
    account_id: "a1",
    user_id: "u1",
    titolo: "Teorema di Bayes",
    note: "probabilità condizionata",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    occorrenze: [],
    allegati: [],
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRipassi = [];
  mockIdsInCoda = new Set();
  mockOnline = true;
  mockCaricaSuRipasso.mockResolvedValue([]);
  mockAccoda.mockResolvedValue(undefined);
  mockCrea.mockResolvedValue({ id: "nuovo" });
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("apertura a freddo: la lista arriva dopo il mount", () => {
  it("riempie i campi quando il ripasso diventa disponibile", async () => {
    // Montato prima che la lista sia caricata: `corrente` è null.
    const { result, rerender } = await renderHook(() => useFormRipasso("r1"));
    expect(result.current.titolo).toBe("");

    mockRipassi = [ripasso()];
    await rerender({});

    await waitFor(() => expect(result.current.titolo).toBe("Teorema di Bayes"));
    expect(result.current.note).toBe("probabilità condizionata");
  });

  it("NON sovrascrive titolo e note con dei vuoti (regressione: perdita dati)", async () => {
    // Il difetto: i campi si inizializzavano una volta sola al mount. Aperta la
    // scheda prima del caricamento, mostravano vuoto, e un tocco su Salva
    // scriveva quel vuoto sul server, cancellando titolo e note su tutti i
    // dispositivi.
    const { result } = await renderHook(() => useFormRipasso("r1"));

    let chiudibile: boolean | undefined;
    await act(async () => {
      chiudibile = await result.current.salva();
    });

    expect(chiudibile).toBe(false);
    expect(mockModifica).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalled();
  });

  it("non sovrascrive quello che l'utente sta scrivendo quando arriva un evento Realtime", async () => {
    mockRipassi = [ripasso()];
    const { result, rerender } = await renderHook(() => useFormRipasso("r1"));
    await waitFor(() => expect(result.current.titolo).toBe("Teorema di Bayes"));

    await act(async () => {

      result.current.setTitolo("Bayes, riscritto");

    });
    // Realtime ricarica la lista: nuovi oggetti, stesso id.
    mockRipassi = [ripasso()];
    await rerender({});

    expect(result.current.titolo).toBe("Bayes, riscritto");
  });
});

describe("salva", () => {
  it("rifiuta un titolo vuoto senza toccare il repository", async () => {
    const { result } = await renderHook(() => useFormRipasso());

    let chiudibile: boolean | undefined;
    await act(async () => {
      chiudibile = await result.current.salva();
    });

    expect(chiudibile).toBe(false);
    expect(mockCrea).not.toHaveBeenCalled();
  });

  it("crea il ripasso e chiude quando non ci sono allegati in attesa", async () => {
    const { result } = await renderHook(() => useFormRipasso());
    await act(async () => {
      result.current.setTitolo("  Nuovo  ");
    });

    let chiudibile: boolean | undefined;
    await act(async () => {
      chiudibile = await result.current.salva();
    });

    expect(mockCrea).toHaveBeenCalledWith({ titolo: "Nuovo", note: null, includi1h: false });
    expect(chiudibile).toBe(true);
  });

  it("dopo la prima creazione si comporta da modifica, non crea un secondo ripasso", async () => {
    const { result } = await renderHook(() => useFormRipasso());
    await act(async () => {
      result.current.setTitolo("Nuovo");
    });
    await act(async () => {
      await result.current.salva();
    });

    await act(async () => {
      await result.current.salva();
    });

    expect(mockCrea).toHaveBeenCalledTimes(1);
    expect(mockModifica).toHaveBeenCalledTimes(1);
    expect(mockModifica).toHaveBeenCalledWith("nuovo", { titolo: "Nuovo", note: null });
  });

  it("resta aperto e conserva SOLO gli allegati falliti", async () => {
    const { result } = await renderHook(() => useFormRipasso());
    await act(async () => {
      result.current.setTitolo("Con allegati");
    });

    const ok = { uri: "file:///ok.jpg", name: "ok.jpg", mimeType: "image/jpeg", size: 1 };
    const ko = { uri: "file:///ko.jpg", name: "ko.jpg", mimeType: "image/jpeg", size: 1 };
    await act(async () => {
      await result.current.aggiungiAllegato(async () => ok);
      await result.current.aggiungiAllegato(async () => ko);
    });
    expect(result.current.inAttesa).toHaveLength(2);

    mockCaricaSuRipasso.mockResolvedValue([ko]);
    let chiudibile: boolean | undefined;
    await act(async () => {
      chiudibile = await result.current.salva();
    });

    expect(chiudibile).toBe(false);
    expect(result.current.inAttesa.map((v) => v.file.name)).toEqual(["ko.jpg"]);
  });

  it("segnala l'errore e resta aperto se il salvataggio fallisce", async () => {
    // Un errore che NON è di rete: quelli di rete ora finiscono in coda invece
    // di fallire (vedi il blocco «salvataggio differito»).
    mockCrea.mockRejectedValue(new Error("duplicate key"));
    const { result } = await renderHook(() => useFormRipasso());
    await act(async () => {
      result.current.setTitolo("T");
    });

    let chiudibile: boolean | undefined;
    await act(async () => {
      chiudibile = await result.current.salva();
    });

    expect(chiudibile).toBe(false);
    expect(mockMostraErrore).toHaveBeenCalled();
  });
});

/**
 * La promessa che questo blocco protegge: premere Salva non fallisce mai per
 * colpa della rete. Il ripasso resta sul dispositivo e sale da solo dopo.
 */
describe("salvataggio differito quando manca la rete", () => {
  it("offline accoda invece di chiamare il repository", async () => {
    mockOnline = false;
    const { result } = await renderHook(() => useFormRipasso());
    await act(async () => {
      result.current.setTitolo("Teorema di Bayes");
    });

    let chiudibile: boolean | undefined;
    await act(async () => {
      chiudibile = await result.current.salva();
    });

    expect(mockCrea).not.toHaveBeenCalled();
    expect(chiudibile).toBe(true);
    expect(mockAccoda).toHaveBeenCalledTimes(1);
    const voce = mockAccoda.mock.calls[0][0];
    expect(voce.titolo).toBe("Teorema di Bayes");
    // Un ripasso nuovo porta con sé le sue date: sono quelle che il form
    // stava già mostrando, e i promemoria sono agganciati a questi id.
    expect(voce.occorrenze).toHaveLength(4);
    expect(voce.id).toEqual(expect.any(String));
  });

  it("accoda anche quando il dispositivo si credeva online e il server non risponde", async () => {
    // Una galleria, un wifi captive, un server giù: per questo salvataggio
    // sono indistinguibili dall'essere offline, e la risposta è la stessa.
    mockCrea.mockRejectedValue(new Error("Network request failed"));
    const { result } = await renderHook(() => useFormRipasso());
    await act(async () => {
      result.current.setTitolo("T");
    });

    let chiudibile: boolean | undefined;
    await act(async () => {
      chiudibile = await result.current.salva();
    });

    expect(chiudibile).toBe(true);
    expect(mockAccoda).toHaveBeenCalledTimes(1);
    expect(mockMostraErrore).not.toHaveBeenCalled();
  });

  it("porta in coda gli allegati scelti prima che il ripasso esistesse", async () => {
    mockOnline = false;
    const { result } = await renderHook(() => useFormRipasso());
    await act(async () => {
      result.current.setTitolo("T");
      await result.current.aggiungiAllegato(async () => ({
        uri: "file:///foto.jpg",
        name: "foto.jpg",
        mimeType: "image/jpeg",
        size: 1,
      }));
    });

    await act(async () => {
      await result.current.salva();
    });

    expect(mockAccoda.mock.calls[0][0].file).toEqual([
      expect.objectContaining({ nome: "foto.jpg", orderIndex: 0 }),
    ]);
    // Non restano anche sullo schermo: da qui appartengono alla coda.
    expect(result.current.inAttesa).toEqual([]);
  });

  it("se nemmeno la coda riesce a scrivere, lo dice: l'utente sta per andarsene", async () => {
    mockOnline = false;
    mockAccoda.mockRejectedValue(new Error("ENOSPC"));
    const { result } = await renderHook(() => useFormRipasso());
    await act(async () => {
      result.current.setTitolo("T");
    });

    let chiudibile: boolean | undefined;
    await act(async () => {
      chiudibile = await result.current.salva();
    });

    expect(chiudibile).toBe(false);
    expect(mockMostraErrore).toHaveBeenCalled();
  });

  it("eliminare un ripasso ancora in coda scarta la voce invece di mandare una DELETE", async () => {
    mockIdsInCoda = new Set(["r1"]);
    mockRipassi = [ripasso()];
    const { result } = await renderHook(() => useFormRipasso("r1"));

    await act(async () => {
      await result.current.elimina();
    });

    expect(mockScarta).toHaveBeenCalledWith("r1");
    expect(mockEliminaRipasso).not.toHaveBeenCalled();
  });
});

describe("allegati scelti prima che il ripasso esista", () => {
  it("li tiene in attesa finché non c'è un id a cui appartenere", async () => {
    const { result } = await renderHook(() => useFormRipasso());

    await act(async () => {
      await result.current.aggiungiAllegato(async () => ({
        uri: "file:///a.jpg",
        name: "a.jpg",
        mimeType: "image/jpeg",
        size: 1,
      }));
    });

    expect(mockCaricaSuRipasso).not.toHaveBeenCalled();
    expect(result.current.inAttesa).toHaveLength(1);
  });

  it("in modifica li carica subito", async () => {
    mockRipassi = [ripasso()];
    const { result } = await renderHook(() => useFormRipasso("r1"));

    await act(async () => {
      await result.current.aggiungiAllegato(async () => ({
        uri: "file:///a.jpg",
        name: "a.jpg",
        mimeType: "image/jpeg",
        size: 1,
      }));
    });

    expect(mockCaricaSuRipasso).toHaveBeenCalledTimes(1);
    expect(result.current.inAttesa).toHaveLength(0);
  });

  it("rimuove per chiave, non per posizione (due foto possono avere lo stesso nome)", async () => {
    const { result } = await renderHook(() => useFormRipasso());
    const file = { uri: "file:///IMG_0001.jpg", name: "IMG_0001.jpg", mimeType: null, size: 1 };

    await act(async () => {
      await result.current.aggiungiAllegato(async () => file);
      await result.current.aggiungiAllegato(async () => file);
    });
    const primaChiave = result.current.inAttesa[0].chiave;

    await act(async () => {

      result.current.rimuoviInAttesa(primaChiave);

    });

    expect(result.current.inAttesa).toHaveLength(1);
    expect(result.current.inAttesa[0].chiave).not.toBe(primaChiave);
  });

  it("un picker annullato non aggiunge nulla", async () => {
    const { result } = await renderHook(() => useFormRipasso());

    await act(async () => {
      await result.current.aggiungiAllegato(async () => null);
    });

    expect(result.current.inAttesa).toHaveLength(0);
  });
});

describe("elimina", () => {
  it("segnala l'errore e tiene aperta la schermata se l'eliminazione fallisce", async () => {
    mockRipassi = [ripasso()];
    mockEliminaRipasso.mockRejectedValue(new Error("permission denied"));
    const { result } = await renderHook(() => useFormRipasso("r1"));

    let eliminato: boolean | undefined;
    await act(async () => {
      eliminato = await result.current.elimina();
    });

    expect(eliminato).toBe(false);
    expect(mockMostraErrore).toHaveBeenCalled();
  });

  it("non fa nulla in creazione: non c'è ancora niente da eliminare", async () => {
    const { result } = await renderHook(() => useFormRipasso());

    let eliminato: boolean | undefined;
    await act(async () => {
      eliminato = await result.current.elimina();
    });

    expect(eliminato).toBe(false);
    expect(mockEliminaRipasso).not.toHaveBeenCalled();
  });
});
