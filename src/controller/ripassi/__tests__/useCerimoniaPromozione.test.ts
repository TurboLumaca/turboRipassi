/**
 * La cerimonia, dal lato del Controller.
 *
 * L'invariante che conta: una volta sola per concetto, e mai due volte perché
 * il server è lento. La memoria vera è `ceremony_shown_at` sul server, ma fra
 * la chiusura e il reload che la riporta indietro passa un viaggio di rete: è
 * l'insieme locale a coprire quel viaggio, e senza di lui la cerimonia
 * riapparirebbe ogni volta che la connessione è lenta.
 */
const mockSegna = jest.fn();
let mockRipassi: RipassoCompleto[] = [];

jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({
    ripassi: mockRipassi,
    segnaCerimoniaMostrata: (...a: unknown[]) => mockSegna(...a),
  }),
}));

const mockReport = jest.fn();
jest.mock("@/config/crashReporting", () => ({
  reportError: (...a: unknown[]) => mockReport(...a),
}));

import { act, renderHook } from "@testing-library/react-native";
import { useCerimoniaPromozione } from "../useCerimoniaPromozione";
import { FRASI_PROMOZIONE } from "@/model/ripassi/richiamoLogic";
import type { Occorrenza, RipassoCompleto } from "@/model/types";

const GIORNO = 86_400_000;
const fa = (n: number) => new Date(Date.now() - n * GIORNO).toISOString();

function occ(scheduled_at: string, is_completed: boolean): Occorrenza {
  return {
    id: `o-${scheduled_at}`,
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

function ripasso(id: string, over: Partial<RipassoCompleto> = {}): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    user_id: "u1",
    titolo: id,
    domanda: null,
    note: null,
    ceremony_shown_at: null,
    created_at: fa(400),
    updated_at: fa(400),
    occorrenze: [occ(fa(300), true), occ(fa(280), true), occ(fa(250), true), occ(fa(2), true)],
    allegati: [],
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSegna.mockResolvedValue(undefined);
  mockRipassi = [];
});

describe("useCerimoniaPromozione", () => {
  it("senza permanenti non c'è niente da celebrare", async () => {
    mockRipassi = [ripasso("giovane", { occorrenze: [occ(fa(2), true)] })];
    const { result } = await renderHook(() => useCerimoniaPromozione());
    expect(result.current.cerimonia).toBeNull();
  });

  it("trova il permanente non ancora celebrato, con la sua storia", async () => {
    mockRipassi = [ripasso("maturo")];
    const { result } = await renderHook(() => useCerimoniaPromozione());

    expect(result.current.cerimonia?.ripasso.id).toBe("maturo");
    expect(result.current.cerimonia?.storia).toHaveLength(4);
    expect(FRASI_PROMOZIONE).toContain(result.current.cerimonia?.frase);
  });

  // Una celebrazione ripetibile non celebra niente.
  it("non ricelebra un concetto che porta già la data della cerimonia", async () => {
    mockRipassi = [ripasso("gia", { ceremony_shown_at: fa(1) })];
    const { result } = await renderHook(() => useCerimoniaPromozione());
    expect(result.current.cerimonia).toBeNull();
  });

  it("chiudere scrive sul server e non la riapre in attesa del reload", async () => {
    mockRipassi = [ripasso("maturo")];
    const { result } = await renderHook(() => useCerimoniaPromozione());

    await act(async () => {
      await result.current.chiudi();
    });

    expect(mockSegna).toHaveBeenCalledWith("maturo");
    // Il server non ha ancora risposto — `mockRipassi` è immutato — e la
    // cerimonia è comunque chiusa.
    expect(result.current.cerimonia).toBeNull();
  });

  // Una schermata intera da cui non si esce perché il server non risponde
  // sarebbe la cosa peggiore che questa cerimonia possa diventare.
  it("si chiude anche quando la scrittura fallisce", async () => {
    mockSegna.mockRejectedValue(new Error("offline"));
    mockRipassi = [ripasso("maturo")];
    const { result } = await renderHook(() => useCerimoniaPromozione());

    await act(async () => {
      await result.current.chiudi();
    });

    expect(result.current.cerimonia).toBeNull();
    expect(mockReport).toHaveBeenCalled();
  });

  it("chiudere quando non c'è niente aperto non scrive niente", async () => {
    const { result } = await renderHook(() => useCerimoniaPromozione());
    await act(async () => {
      await result.current.chiudi();
    });
    expect(mockSegna).not.toHaveBeenCalled();
  });

  it("con due promozioni ne mostra una per volta", async () => {
    mockRipassi = [ripasso("primo"), ripasso("secondo")];
    const { result } = await renderHook(() => useCerimoniaPromozione());
    expect(result.current.cerimonia?.ripasso.id).toBe("primo");

    await act(async () => {
      await result.current.chiudi();
    });
    expect(result.current.cerimonia?.ripasso.id).toBe("secondo");
  });
});
