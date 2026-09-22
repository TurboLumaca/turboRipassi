/**
 * La sessione di oggi, dal lato del Controller.
 *
 * Due cose si verificano qui.
 *
 * Che la chiusura compaia quando c'è stato qualcosa da fare e non c'è più —
 * e *non* a chi apre l'app in un giorno vuoto, perché celebrare il niente è
 * il primo passo verso il celebrare tutto.
 *
 * Che in Modalità Riposo l'anticipo di domani sparisca. In riposo
 * un'anticipazione smette di essere un'informazione e diventa una ragione per
 * tornare, ed è esattamente la feature che ogni prioritizzazione a breve
 * termine proverà a togliere per prima.
 */
let mockRipassi: RipassoCompleto[] = [];
let mockPausa: { attiva: boolean; dataInizio?: string } = { attiva: false };

jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({ ripassi: mockRipassi, pausa: mockPausa }),
}));

import { act, renderHook } from "@testing-library/react-native";
import { useSessioneGiornaliera } from "../useSessioneGiornaliera";
import type { Occorrenza, RipassoCompleto } from "@/model/types";

const ORA = Date.now();
const GIORNO = 86_400_000;
const sposta = (ms: number) => new Date(ORA + ms).toISOString();

function occ(id: string, scheduled_at: string, is_completed = false): Occorrenza {
  return {
    id,
    ripasso_id: "r",
    account_id: "a1",
    user_id: "u1",
    scheduled_at,
    is_manual_1h: false,
    is_completed,
    created_at: scheduled_at,
    updated_at: scheduled_at,
  };
}

function ripasso(
  id: string,
  occorrenze: Occorrenza[],
  over: Partial<RipassoCompleto> = {}
): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    user_id: "u1",
    titolo: id,
    domanda: null,
    note: null,
    ceremony_shown_at: null,
    created_at: sposta(-30 * GIORNO),
    updated_at: sposta(-30 * GIORNO),
    occorrenze,
    allegati: [],
    ...over,
  };
}

beforeEach(() => {
  mockRipassi = [];
  mockPausa = { attiva: false };
});

describe("useSessioneGiornaliera", () => {
  it("espone la coda chiusa di oggi e il suo totale", async () => {
    mockRipassi = [
      ripasso("a", [occ("o1", sposta(-2 * 3600_000))]),
      ripasso("b", [occ("o2", sposta(-3 * GIORNO))]),
      ripasso("c", [occ("o3", sposta(3 * GIORNO))]),
    ];
    const { result } = await renderHook(() => useSessioneGiornaliera());

    expect(result.current.voci).toHaveLength(2);
    expect(result.current.totale).toBe(2);
    expect(result.current.fatti).toBe(0);
  });

  it("il «2 di 5» conta i completamenti di oggi", async () => {
    mockRipassi = [
      ripasso("fatto", [occ("o1", sposta(-3600_000), true)]),
      ripasso("resta", [occ("o2", sposta(-2 * 3600_000))]),
    ];
    const { result } = await renderHook(() => useSessioneGiornaliera());

    expect(result.current.fatti).toBe(1);
    expect(result.current.totale).toBe(2);
  });

  // Celebrare un giorno in cui non c'era niente da fare sarebbe celebrare il
  // niente, che è il modo in cui l'inflazione del rinforzo comincia.
  it("non apre la chiusura in un giorno vuoto", async () => {
    const { result } = await renderHook(() => useSessioneGiornaliera());
    expect(result.current.chiusuraAperta).toBe(false);
  });

  it("apre la chiusura quando la coda si è svuotata, con il riepilogo giusto", async () => {
    mockRipassi = [
      ripasso("a", [occ("o1", sposta(-3600_000), true)]),
      ripasso("b", [occ("o2", sposta(-2 * 3600_000), true)]),
    ];
    const { result } = await renderHook(() => useSessioneGiornaliera());

    expect(result.current.chiusuraAperta).toBe(true);
    expect(result.current.riepilogo).toBe(
      "Oggi è tutto. 2 concetti hanno fatto un passo avanti."
    );
  });

  it("una volta congedata, la chiusura non torna", async () => {
    mockRipassi = [ripasso("a", [occ("o1", sposta(-3600_000), true)])];
    const { result } = await renderHook(() => useSessioneGiornaliera());
    expect(result.current.chiusuraAperta).toBe(true);

    await act(async () => {
      result.current.chiudiChiusura();
    });
    expect(result.current.chiusuraAperta).toBe(false);
  });

  it("anticipa domani con la domanda del concetto", async () => {
    mockRipassi = [
      ripasso("domani", [occ("o1", sposta(GIORNO + 3600_000))], {
        domanda: "Perché ~2,25?",
      }),
    ];
    const { result } = await renderHook(() => useSessioneGiornaliera());
    expect(result.current.domani?.domanda).toBe("Perché ~2,25?");
  });

  // La Modalità Riposo è la feature più umana dell'app, e la prima che ogni
  // metrica a breve termine proverà a depriorizzare. Qui è difesa da un test.
  it("in Modalità Riposo non anticipa niente", async () => {
    mockRipassi = [ripasso("domani", [occ("o1", sposta(GIORNO + 3600_000))])];
    mockPausa = { attiva: true, dataInizio: sposta(-2 * GIORNO) };

    const { result } = await renderHook(() => useSessioneGiornaliera());
    expect(result.current.domani).toBeNull();
  });
});
