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
import type { Occorrenza, RipassoCompleto } from "@/model/types";
import type { RipassiRepo } from "@/model/ripassi/ripassiRepo";

const mockRemoveChannel = jest.fn();
const mockSubscribe = jest.fn();
/** Realtime handlers the hook registered, so a test can fire an event. */
const mockHandlerRealtime: (() => void)[] = [];
jest.mock("@/config/supabase", () => {
  const canale: Record<string, unknown> = {};
  canale.on = (_evento: unknown, _filtro: unknown, handler: () => void) => {
    mockHandlerRealtime.push(handler);
    return canale;
  };
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

const mockLeggiRipassiSalvati = jest.fn();
const mockSalvaRipassi = jest.fn();
jest.mock("@/model/ripassi/ripassiOffline", () => ({
  leggiRipassiSalvati: () => mockLeggiRipassiSalvati(),
  salvaRipassi: (...a: unknown[]) => mockSalvaRipassi(...a),
}));

const mockLeggiPausa = jest.fn();
const mockScriviPausa = jest.fn();
jest.mock("@/model/ripassi/pausaRepo", () => ({
  pausaRepo: {
    leggi: () => mockLeggiPausa(),
    scrivi: (...a: unknown[]) => mockScriviPausa(...a),
  },
  STATO_PAUSA_INIZIALE: { attiva: false },
}));

import { useRipassi } from "../useRipassi";

const leggiCompleti = jest.fn();
const leggiSingolo = jest.fn();
const crea = jest.fn();
const aggiorna = jest.fn();
const elimina = jest.fn();
const aggiornaOccorrenza = jest.fn();
const completaOccorrenza = jest.fn();
const spostaOccorrenze = jest.fn();
const creaDaCoda = jest.fn();

const repo: RipassiRepo = {
  leggiCompleti: () => leggiCompleti(),
  leggiSingolo: (id: string) => leggiSingolo(id),
  crea: (...a) => crea(...a),
  creaDaCoda: (...a) => creaDaCoda(...a),
  aggiorna: (...a) => aggiorna(...a),
  elimina: (...a) => elimina(...a),
  aggiornaOccorrenza: (...a) => aggiornaOccorrenza(...a),
  completaOccorrenza: (...a) => completaOccorrenza(...a),
  spostaOccorrenze: (...a) => spostaOccorrenze(...a),
};

function ripasso(id: string): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    user_id: "u1",
    titolo: id,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    occorrenze: [],
    allegati: [],
  };
}

function occ(id: string, scheduledAt: string): Occorrenza {
  return {
    id,
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    scheduled_at: scheduledAt,
    is_manual_1h: false,
    is_completed: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function conOccorrenze(id: string, occorrenze: Occorrenza[]): RipassoCompleto {
  return { ...ripasso(id), occorrenze };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLeggiRipassiSalvati.mockResolvedValue(null);
  mockSalvaRipassi.mockResolvedValue(undefined);
  leggiCompleti.mockResolvedValue([ripasso("r1")]);
  crea.mockResolvedValue({ id: "nuovo" });
  aggiorna.mockResolvedValue(undefined);
  elimina.mockResolvedValue(undefined);
  aggiornaOccorrenza.mockResolvedValue(undefined);
  completaOccorrenza.mockResolvedValue(undefined);
  spostaOccorrenze.mockResolvedValue(undefined);
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

    expect(spostaOccorrenze).toHaveBeenCalledWith([
      { id: "occ-1", scheduled_at: "2026-09-01T08:30:00.000Z" },
    ]);
  });

  /**
   * Quale sia il seguito di un'occorrenza è una domanda sui dati, e la risposta
   * sta nella lista che questo hook già tiene: la View dice solo se l'utente
   * vuole la cascata, non deve sapere che uno spostamento ha dei fratelli.
   */
  it("con la cascata trascina le date successive nella stessa scrittura", async () => {
    leggiCompleti.mockResolvedValue([
      conOccorrenze("r1", [
        occ("o1", "2026-07-08T15:30:00.000Z"),
        occ("o2", "2026-07-14T15:30:00.000Z"),
        occ("o3", "2026-08-07T15:30:00.000Z"),
      ]),
    ]);
    const { result } = await renderHook(() => useRipassi(repo));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      // Due giorni indietro: annotato oggi, studiato l'altro ieri.
      await result.current.spostaOccorrenza("o1", new Date("2026-07-06T15:30:00.000Z"), true);
    });

    expect(spostaOccorrenze).toHaveBeenCalledWith([
      { id: "o1", scheduled_at: "2026-07-06T15:30:00.000Z" },
      { id: "o2", scheduled_at: "2026-07-12T15:30:00.000Z" },
      { id: "o3", scheduled_at: "2026-08-05T15:30:00.000Z" },
    ]);
  });

  it("senza cascata scrive solo la data modificata", async () => {
    leggiCompleti.mockResolvedValue([
      conOccorrenze("r1", [
        occ("o1", "2026-07-08T15:30:00.000Z"),
        occ("o2", "2026-07-14T15:30:00.000Z"),
      ]),
    ]);
    const { result } = await renderHook(() => useRipassi(repo));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.spostaOccorrenza("o1", new Date("2026-07-06T15:30:00.000Z"), false);
    });

    expect(spostaOccorrenze).toHaveBeenCalledWith([
      { id: "o1", scheduled_at: "2026-07-06T15:30:00.000Z" },
    ]);
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

/**
 * Spuntare un ripasso in ritardo fa scivolare in avanti anche le date
 * successive, perché la spaziatura si misura dal giorno in cui il ripasso è
 * stato fatto davvero. Le due cose però non sono la stessa operazione: la
 * spunta è quello che l'utente ha chiesto, lo scivolamento è una cortesia.
 * Metterle in un'unica azione voleva dire che un fallimento della seconda
 * usciva con un errore *dopo* che la prima era già arrivata al server — ed è
 * ciò che faceva sembrare "Ho ripassato" un pulsante scollegato.
 */
describe("completamento in ritardo", () => {
  const dueGiorniFa = () => new Date(Date.now() - 2 * 86_400_000).toISOString();
  const fraUnMese = () => new Date(Date.now() + 30 * 86_400_000).toISOString();

  beforeEach(() => {
    leggiCompleti.mockResolvedValue([
      conOccorrenze("r1", [occ("o1", dueGiorniFa()), occ("o2", fraUnMese())]),
    ]);
  });

  it("fa scivolare le date successive", async () => {
    const { result } = await renderHook(() => useRipassi(repo));
    await waitFor(() => expect(result.current.ripassi).toHaveLength(1));

    await act(async () => {
      await result.current.completaOccorrenza("o1", true);
    });

    expect(completaOccorrenza).toHaveBeenCalledWith("o1", true);
    expect(spostaOccorrenze).toHaveBeenCalledTimes(1);
    expect(spostaOccorrenze.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: "o2" }),
    ]);
  });

  it("non annulla la spunta se lo scivolamento non riesce", async () => {
    spostaOccorrenze.mockRejectedValue(new Error("il server ha rifiutato"));
    const { result } = await renderHook(() => useRipassi(repo));
    await waitFor(() => expect(result.current.ripassi).toHaveLength(1));

    // Non solleva: la spunta è arrivata, ed è quella che il chiamante attende.
    await act(async () => {
      await expect(result.current.completaOccorrenza("o1", true)).resolves.toBeUndefined();
    });

    expect(completaOccorrenza).toHaveBeenCalledWith("o1", true);
  });

  it("non tocca le date quando il ripasso è spuntato in tempo", async () => {
    leggiCompleti.mockResolvedValue([
      conOccorrenze("r1", [occ("o1", new Date().toISOString()), occ("o2", fraUnMese())]),
    ]);
    const { result } = await renderHook(() => useRipassi(repo));
    await waitFor(() => expect(result.current.ripassi).toHaveLength(1));

    await act(async () => {
      await result.current.completaOccorrenza("o1", true);
    });

    expect(spostaOccorrenze).not.toHaveBeenCalled();
  });
});

describe("modalità pausa", () => {
  const leggiPausa = jest.fn();
  const scriviPausa = jest.fn();
  const mockPRepo = {
    leggi: () => leggiPausa(),
    scrivi: (...a: unknown[]) => scriviPausa(...a),
  };

  beforeEach(() => {
    leggiPausa.mockResolvedValue({ attiva: false });
    scriviPausa.mockResolvedValue(undefined);
  });

  it("carica lo stato di pausa salvato all'avvio", async () => {
    leggiPausa.mockResolvedValue({ attiva: true, dataInizio: "2026-07-10T10:00:00.000Z" });
    const { result } = await renderHook(() => useRipassi(repo, mockPRepo as any));

    await waitFor(() => expect(result.current.pausa.attiva).toBe(true));
    expect(result.current.pausa.dataInizio).toBe("2026-07-10T10:00:00.000Z");
  });

  it("attiva la pausa aggiornando lo stato e persistendo su file", async () => {
    const { result } = await renderHook(() => useRipassi(repo, mockPRepo as any));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const config = {
      attiva: true,
      dataInizio: "2026-07-15T10:00:00.000Z",
      motivo: "Vacanze",
    };

    await act(async () => {
      await result.current.attivaPausa(config);
    });

    expect(result.current.pausa).toEqual(config);
    expect(scriviPausa).toHaveBeenCalledWith(config);
  });

  it("riprendiPausa trasla le occorrenze aperte dei giorni effettivi e disattiva la pausa", async () => {
    const inizioPausa = new Date(Date.now() - 3 * 86_400_000).toISOString();
    leggiPausa.mockResolvedValue({
      attiva: true,
      dataInizio: inizioPausa,
    });
    leggiCompleti.mockResolvedValue([
      conOccorrenze("r1", [
        occ("o1", new Date(Date.now() + 86_400_000).toISOString()),
      ]),
    ]);

    const { result } = await renderHook(() => useRipassi(repo, mockPRepo as any));
    await waitFor(() => expect(result.current.pausa.attiva).toBe(true));

    await act(async () => {
      await result.current.riprendiPausa();
    });

    expect(spostaOccorrenze).toHaveBeenCalledTimes(1);
    expect(result.current.pausa.attiva).toBe(false);
    expect(scriviPausa).toHaveBeenCalledWith(expect.objectContaining({ attiva: false }));
  });

  /**
   * Il bug: lo spostamento veniva fatto *prima* di uscire dalla pausa, quindi
   * una scrittura fallita usciva dalla funzione lasciando `attiva: true`. Il
   * pulsante girava, tornava com'era, e il pannello continuava a dire
   * "Modalità riposo attiva" — una modalità in cui si entra e non si esce.
   */
  it("esce dalla pausa anche se lo spostamento delle date fallisce", async () => {
    const inizioPausa = new Date(Date.now() - 3 * 86_400_000).toISOString();
    leggiPausa.mockResolvedValue({ attiva: true, dataInizio: inizioPausa });
    leggiCompleti.mockResolvedValue([
      conOccorrenze("r1", [occ("o1", new Date(Date.now() + 86_400_000).toISOString())]),
    ]);
    spostaOccorrenze.mockRejectedValue(new Error("il server ha rifiutato"));

    const { result } = await renderHook(() => useRipassi(repo, mockPRepo as any));
    await waitFor(() => expect(result.current.pausa.attiva).toBe(true));

    let esito: Awaited<ReturnType<typeof result.current.riprendiPausa>> | undefined;
    await act(async () => {
      esito = await result.current.riprendiPausa();
    });

    expect(result.current.pausa.attiva).toBe(false);
    expect(scriviPausa).toHaveBeenCalledWith(expect.objectContaining({ attiva: false }));
    // E lo dice, invece di far finta che le date siano state spostate.
    expect(esito?.erroreSpostamento).toBeTruthy();
    expect(esito?.occorrenzeSpostate).toBe(0);
  });

  it("riferisce quante scadenze ha spostato quando riesce", async () => {
    const inizioPausa = new Date(Date.now() - 2 * 86_400_000).toISOString();
    leggiPausa.mockResolvedValue({ attiva: true, dataInizio: inizioPausa });
    leggiCompleti.mockResolvedValue([
      conOccorrenze("r1", [
        occ("o1", new Date(Date.now() + 86_400_000).toISOString()),
        occ("o2", new Date(Date.now() + 5 * 86_400_000).toISOString()),
      ]),
    ]);

    const { result } = await renderHook(() => useRipassi(repo, mockPRepo as any));
    await waitFor(() => expect(result.current.pausa.attiva).toBe(true));

    let esito: Awaited<ReturnType<typeof result.current.riprendiPausa>> | undefined;
    await act(async () => {
      esito = await result.current.riprendiPausa();
    });

    expect(esito?.erroreSpostamento).toBeNull();
    expect(esito?.occorrenzeSpostate).toBe(2);
    expect(esito?.giorniEffettivi).toBeGreaterThan(0);
  });

  it("riprendiPausa non fa nulla se la pausa non è attiva", async () => {
    leggiPausa.mockResolvedValue({ attiva: false });
    const { result } = await renderHook(() => useRipassi(repo, mockPRepo as any));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.riprendiPausa();
    });

    expect(spostaOccorrenze).not.toHaveBeenCalled();
  });
});

describe("eventi Realtime", () => {
  /** Oltre la finestra di coalescenza (200 ms) del Controller. */
  const OLTRE_FINESTRA = 300;
  /** Gli handler registrati dall'unico montaggio di questo blocco. */
  let handler: ((payload: any) => void)[] = [];

  let smonta: () => void;

  beforeAll(async () => {
    leggiCompleti.mockResolvedValue([ripasso("r1")]);
    const primo = mockHandlerRealtime.length;
    const { unmount } = await renderHook(() => useRipassi(repo));
    smonta = unmount;
    await waitFor(() => expect(mockHandlerRealtime.length).toBe(primo + 3));
    handler = mockHandlerRealtime.slice(primo);
  });

  afterAll(() => smonta());

  const attendi = (ms: number) =>
    act(async () => {
      await new Promise((r) => setTimeout(r, ms));
    });

  it("scarica il singolo ripasso se nel payload è specificato", async () => {
    leggiCompleti.mockClear();
    leggiSingolo.mockClear();
    
    // Simulate an event with a known ID
    const payload = { table: "ripassi", record: { id: "r2" } };

    await act(async () => {
      handler[0](payload);
    });
    await attendi(100);

    // Should fetch the single record, not the entire list
    expect(leggiSingolo).toHaveBeenCalledTimes(1);
    expect(leggiSingolo).toHaveBeenCalledWith("r2");
    expect(leggiCompleti).not.toHaveBeenCalled();
  });

  it("effettua il fallback a leggiCompleti se il payload non contiene ID", async () => {
    leggiCompleti.mockClear();
    leggiSingolo.mockClear();

    const payload = { table: "ripassi", record: null, old_record: null }; // Malformed

    await act(async () => {
      handler[0](payload);
    });
    await attendi(OLTRE_FINESTRA);

    expect(leggiCompleti).toHaveBeenCalledTimes(1);
    expect(leggiSingolo).not.toHaveBeenCalled();
  });
});
