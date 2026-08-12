/**
 * Tests for the worker that drains the outgoing queue.
 *
 * What matters here is what happens when a pass does not finish: the network
 * dies halfway through a ripasso with three photos, or a single entry fails for
 * a reason no amount of waiting will fix. Both used to be the same thing —
 * "the save didn't work" — and they need opposite responses: resume the first,
 * stop retrying the second.
 *
 * The queue module and the two repos are mocked. The point is the worker's own
 * decisions, not the file system.
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { VoceCoda } from "@/model/outbox/codaLogic";

let mockCoda: VoceCoda[] = [];
const mockSegnaCompletati = jest.fn();
const mockAggiornaVoce = jest.fn();
const mockAccodaSalvataggio = jest.fn();
const mockRimuoviVoce = jest.fn();

jest.mock("@/model/outbox/coda", () => ({
  leggiCoda: async () => mockCoda,
  accodaSalvataggio: (...a: unknown[]) => mockAccodaSalvataggio(...a),
  aggiornaVoce: (...a: unknown[]) => mockAggiornaVoce(...a),
  segnaCompletati: (...a: unknown[]) => mockSegnaCompletati(...a),
  rimuoviVoce: (...a: unknown[]) => mockRimuoviVoce(...a),
}));

const mockRegistraFileLocale = jest.fn();
jest.mock("@/model/cache/localCache", () => ({
  registraFileLocale: (...a: unknown[]) => mockRegistraFileLocale(...a),
}));

const mockReportError = jest.fn();
jest.mock("@/config/crashReporting", () => ({
  reportError: (...a: unknown[]) => mockReportError(...a),
}));

let mockOnline = true;
jest.mock("../useConnettivita", () => ({
  useConnettivita: () => ({ online: mockOnline }),
}));

const mockAssicuraAccessoDrive = jest.fn();
const mockAccessoDrivePronto = jest.fn();
jest.mock("../AuthContext", () => ({
  useAuthCtx: () => ({
    assicuraAccessoDrive: mockAssicuraAccessoDrive,
    accessoDrivePronto: mockAccessoDrivePronto,
  }),
}));

import { useCoda } from "../useCoda";
import type { RipassiRepo } from "@/model/ripassi/ripassiRepo";
import type { AllegatiRepo } from "@/model/allegati/allegatiRepo";

const mockCreaDaCoda = jest.fn();
const mockAggiorna = jest.fn();
const mockCaricaDaCoda = jest.fn();

const repoRipassi = {
  creaDaCoda: (...a: unknown[]) => mockCreaDaCoda(...a),
  aggiorna: (...a: unknown[]) => mockAggiorna(...a),
} as unknown as RipassiRepo;

const repoAllegati = {
  caricaDaCoda: (...a: unknown[]) => mockCaricaDaCoda(...a),
} as unknown as AllegatiRepo;

const mockSincronizzato = jest.fn();

function voce(over: Partial<VoceCoda> & { id: string }): VoceCoda {
  return {
    titolo: "Teorema di Bayes",
    note: null,
    occorrenze: [{ id: "o1", scheduled_at: "2026-08-12T09:00:00.000Z", is_manual_1h: false }],
    campiModificati: true,
    allegati: [],
    accodatoIl: "2026-08-11T09:00:00.000Z",
    tentativi: 0,
    ultimoErrore: null,
    ...over,
  };
}

function allegato(id: string, driveFileId: string | null = null) {
  return {
    id,
    uri: `file:///doc/coda-file/${id}.jpg`,
    nome: `${id}.jpg`,
    mimeType: "image/jpeg",
    sizeBytes: 10,
    orderIndex: 0,
    driveFileId,
  };
}

/** Renders the hook and waits for the automatic pass to have finished. */
async function avvia() {
  const utils = await renderHook(() => useCoda(mockSincronizzato, repoRipassi, repoAllegati));
  await waitFor(() => expect(utils.result.current.sincronizzando).toBe(false));
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCoda = [];
  mockOnline = true;
  // mockReset and not just clearAllMocks: the latter forgets the calls but
  // keeps the implementation, so a mockRejectedValue set by one test goes on
  // rejecting in every test after it.
  mockAccessoDrivePronto.mockReset().mockResolvedValue(true);
  mockAssicuraAccessoDrive.mockReset().mockResolvedValue(true);
  mockCreaDaCoda.mockReset().mockResolvedValue(undefined);
  mockAggiorna.mockReset().mockResolvedValue(undefined);
  mockCaricaDaCoda.mockReset().mockResolvedValue({ id: "a1" });
  mockRegistraFileLocale.mockReset().mockResolvedValue(undefined);
  mockAccodaSalvataggio.mockReset().mockResolvedValue(voce({ id: "r1" }));
});

describe("quando parte", () => {
  it("offline non tenta niente", async () => {
    mockOnline = false;
    mockCoda = [voce({ id: "r1" })];

    await avvia();

    expect(mockCreaDaCoda).not.toHaveBeenCalled();
  });

  it("con la coda vuota non chiama nessuno", async () => {
    await avvia();

    expect(mockCreaDaCoda).not.toHaveBeenCalled();
    expect(mockSincronizzato).not.toHaveBeenCalled();
  });

  it("appena c'è rete manda quello che aspetta", async () => {
    mockCoda = [voce({ id: "r1" })];

    await avvia();

    expect(mockCreaDaCoda).toHaveBeenCalledWith(
      expect.objectContaining({ id: "r1", titolo: "Teorema di Bayes" })
    );
    expect(mockSegnaCompletati).toHaveBeenCalledWith("r1", [], true);
  });
});

describe("cosa manda, e cosa no", () => {
  it("su un ripasso già esistente manda una UPDATE, non una creazione", async () => {
    mockCoda = [voce({ id: "r1", occorrenze: null, campiModificati: true })];

    await avvia();

    expect(mockCreaDaCoda).not.toHaveBeenCalled();
    expect(mockAggiorna).toHaveBeenCalledWith("r1", { titolo: "Teorema di Bayes", note: null });
  });

  it("NON riscrive i campi quando l'utente non li ha toccati", async () => {
    // Aggiungere una foto offline a un ripasso di mesi fa porta con sé il suo
    // titolo: rimandarlo indietro sovrascriverebbe una correzione fatta da un
    // altro dispositivo, per giunta con un valore più vecchio.
    mockCoda = [
      voce({
        id: "r1",
        occorrenze: null,
        campiModificati: false,
        allegati: [allegato("a1")],
      }),
    ];

    await avvia();

    expect(mockAggiorna).not.toHaveBeenCalled();
    expect(mockCaricaDaCoda).toHaveBeenCalledTimes(1);
  });

  it("carica gli allegati dopo il ripasso: la policy RLS verifica che il padre esista", async () => {
    const ordine: string[] = [];
    mockCreaDaCoda.mockImplementation(async () => {
      ordine.push("ripasso");
    });
    mockCaricaDaCoda.mockImplementation(async () => {
      ordine.push("allegato");
      return { id: "a1" };
    });
    mockCoda = [voce({ id: "r1", allegati: [allegato("a1")] })];

    await avvia();

    expect(ordine).toEqual(["ripasso", "allegato"]);
  });

  it("riporta in coda il Drive id appena il binario è su", async () => {
    mockCaricaDaCoda.mockImplementation(async (input: { onBinarioCaricato: (id: string) => Promise<void> }) => {
      await input.onBinarioCaricato("drive-9");
      return { id: "a1" };
    });
    mockCoda = [voce({ id: "r1", allegati: [allegato("a1")] })];

    await avvia();

    expect(mockAggiornaVoce).toHaveBeenCalledWith("r1", expect.any(Function));
    // La funzione passata deve marcare proprio quell'allegato.
    const patch = mockAggiornaVoce.mock.calls[0][1];
    const dopo = patch(voce({ id: "r1", allegati: [allegato("a1")] }));
    expect(dopo.allegati[0].driveFileId).toBe("drive-9");
  });
});

describe("quando qualcosa va storto", () => {
  it("un errore di rete ferma il giro invece di bruciarlo voce per voce", async () => {
    mockCreaDaCoda.mockRejectedValue(new Error("Network request failed"));
    mockCoda = [voce({ id: "r1" }), voce({ id: "r2" })];

    await avvia();

    expect(mockCreaDaCoda).toHaveBeenCalledTimes(1);
    // Nessun tentativo consumato: non ha avuto occasione di riuscire.
    expect(mockAggiornaVoce).not.toHaveBeenCalled();
  });

  it("registra quello che è comunque atterrato, così il giro dopo riprende", async () => {
    // Su un ripasso con quattro foto, riprendere invece di ricominciare è la
    // differenza fra finire su una connessione ballerina e non finire mai.
    mockCaricaDaCoda
      .mockResolvedValueOnce({ id: "a1" })
      .mockRejectedValueOnce(new Error("Network request failed"));
    mockCoda = [voce({ id: "r1", allegati: [allegato("a1"), allegato("a2")] })];

    await avvia();

    expect(mockSegnaCompletati).toHaveBeenCalledWith("r1", ["a1"], true);
  });

  it("un errore NON di rete conta un tentativo e passa alla voce dopo", async () => {
    mockCreaDaCoda
      .mockRejectedValueOnce(new Error("duplicate key"))
      .mockResolvedValueOnce(undefined);
    mockCoda = [voce({ id: "r1" }), voce({ id: "r2" })];

    await avvia();

    expect(mockCreaDaCoda).toHaveBeenCalledTimes(2);
    const patch = mockAggiornaVoce.mock.calls[0][1];
    const dopo = patch(voce({ id: "r1" }));
    expect(dopo.tentativi).toBe(1);
    expect(dopo.ultimoErrore).toEqual(expect.any(String));
    expect(mockReportError).toHaveBeenCalled();
  });

  it("non ritenta le voci che hanno esaurito i tentativi", async () => {
    mockCoda = [voce({ id: "r1", tentativi: 5 })];

    await avvia();

    expect(mockCreaDaCoda).not.toHaveBeenCalled();
  });
});

describe("autorizzazione a Google Drive", () => {
  it("il giro automatico NON apre il consenso: nessuno lo sta guardando", async () => {
    mockCoda = [voce({ id: "r1", allegati: [allegato("a1")] })];

    await avvia();

    expect(mockAccessoDrivePronto).toHaveBeenCalled();
    expect(mockAssicuraAccessoDrive).not.toHaveBeenCalled();
  });

  it("senza accesso manda comunque il ripasso e tiene i file", async () => {
    mockAccessoDrivePronto.mockResolvedValue(false);
    mockCoda = [voce({ id: "r1", allegati: [allegato("a1")] })];

    const { result } = await avvia();

    expect(mockCreaDaCoda).toHaveBeenCalled();
    expect(mockCaricaDaCoda).not.toHaveBeenCalled();
    expect(mockSegnaCompletati).toHaveBeenCalledWith("r1", [], true);
    expect(result.current.bloccoDrive).toBe(true);
  });

  it("«Carica ora» invece può chiedere il consenso: c'è qualcuno che aspetta", async () => {
    mockCoda = [voce({ id: "r1", allegati: [allegato("a1")] })];
    const { result } = await avvia();
    jest.clearAllMocks();
    mockAssicuraAccessoDrive.mockResolvedValue(true);

    await act(async () => {
      await result.current.sincronizzaOra();
    });

    expect(mockAssicuraAccessoDrive).toHaveBeenCalled();
  });

  it("una coda senza allegati non chiede Drive per niente", async () => {
    mockCoda = [voce({ id: "r1" })];

    await avvia();

    expect(mockAccessoDrivePronto).not.toHaveBeenCalled();
  });
});

describe("accodare dal form", () => {
  it("registra i file in cache: la foto appena scattata si deve poter aprire", async () => {
    mockAccodaSalvataggio.mockResolvedValue(
      voce({ id: "r1", allegati: [allegato("a1")] })
    );
    const { result } = await avvia();

    await act(async () => {
      await result.current.accoda({
        id: "r1",
        titolo: "T",
        note: null,
        occorrenze: null,
        campiModificati: true,
        file: [],
      });
    });

    expect(mockRegistraFileLocale).toHaveBeenCalledWith("a1", "file:///doc/coda-file/a1.jpg");
  });

  it("se la registrazione in cache fallisce il salvataggio regge lo stesso", async () => {
    // Non poter aprire il file finché non è caricato è un guaio minore di
    // perderlo.
    mockAccodaSalvataggio.mockResolvedValue(voce({ id: "r1", allegati: [allegato("a1")] }));
    mockRegistraFileLocale.mockRejectedValue(new Error("db chiuso"));
    const { result } = await avvia();

    await act(async () => {
      await expect(
        result.current.accoda({
          id: "r1",
          titolo: "T",
          note: null,
          occorrenze: null,
          campiModificati: true,
          file: [],
        })
      ).resolves.toBeUndefined();
    });

    expect(mockReportError).toHaveBeenCalled();
  });
});
