import { act, renderHook } from "@testing-library/react-native";
import { useFlashback } from "../useFlashback";
import type { RipassoCompleto } from "@/model/types";

let mockContextRipassi: RipassoCompleto[] = [];

jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({
    ripassi: mockContextRipassi,
  }),
}));

describe("useFlashback", () => {
  const OGGI = new Date("2026-07-15T12:00:00.000Z");

  function creaDataFa(giorniFa: number): string {
    const d = new Date(OGGI.getTime() - giorniFa * 86_400_000);
    return d.toISOString();
  }

  function creaRipasso(id: string, titolo: string, giorniFa: number): RipassoCompleto {
    return {
      id,
      account_id: "a1",
      user_id: "u1",
      titolo,
      note: `Note per ${titolo}`,
      created_at: creaDataFa(giorniFa),
      updated_at: creaDataFa(giorniFa),
      occorrenze: [],
      allegati: [],
    };
  }

  beforeEach(() => {
    mockContextRipassi = [];
  });

  it("identifica il flashback del giorno dal contesto", async () => {
    mockContextRipassi = [
      creaRipasso("r1", "Formula di Bayes", 30),
      creaRipasso("r2", "Costituzione Italiana", 10),
    ];

    const vista = await renderHook(() => useFlashback(undefined, OGGI));

    expect(vista.result.current.flashback).not.toBeNull();
    expect(vista.result.current.flashback?.voceId).toBe("r1");
    expect(vista.result.current.flashback?.titolo).toBe("Formula di Bayes");
    expect(vista.result.current.celebrato).toBe(false);
  });

  it("gestisce dismiss nascondendo il flashback", async () => {
    mockContextRipassi = [creaRipasso("r1", "Formula di Bayes", 30)];

    const vista = await renderHook(() => useFlashback(undefined, OGGI));
    expect(vista.result.current.flashback?.voceId).toBe("r1");

    await act(async () => {
      vista.result.current.dismiss();
    });

    expect(vista.result.current.flashback).toBeNull();
  });

  it("gestisce confermaRicordo impostando lo stato celebrativo", async () => {
    mockContextRipassi = [creaRipasso("r1", "Formula di Bayes", 30)];

    const vista = await renderHook(() => useFlashback(undefined, OGGI));

    await act(async () => {
      vista.result.current.confermaRicordo();
    });

    expect(vista.result.current.celebrato).toBe(true);
  });
});
