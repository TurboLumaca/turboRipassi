import { renderHook } from "@testing-library/react-native";
import { useCapitaleMentale } from "../useCapitaleMentale";
import type { Occorrenza, RipassoCompleto } from "@/model/types";

let mockContextRipassi: RipassoCompleto[] = [];

jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({
    ripassi: mockContextRipassi,
  }),
}));

function creaOccorrenza(id: string, scheduled_at: string, is_completed: boolean): Occorrenza {
  return {
    id,
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    scheduled_at,
    is_manual_1h: false,
    is_completed,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function creaRipasso(id: string, occorrenze: Occorrenza[]): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    user_id: "u1",
    titolo: `Ripasso ${id}`,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    occorrenze,
    allegati: [],
  };
}

describe("useCapitaleMentale", () => {
  beforeEach(() => {
    mockContextRipassi = [];
  });

  it("calcola le metriche dal contesto RipassiContext", async () => {
    mockContextRipassi = [
      creaRipasso("r1", [
        creaOccorrenza("o1", "2026-01-01T10:00:00.000Z", true),
        creaOccorrenza("o2", "2026-01-08T10:00:00.000Z", true),
        creaOccorrenza("o3", "2026-02-01T10:00:00.000Z", true),
        creaOccorrenza("o4", "2026-07-01T10:00:00.000Z", true),
      ]),
      creaRipasso("r2", [
        creaOccorrenza("o5", "2026-01-01T10:00:00.000Z", true),
        creaOccorrenza("o6", "2026-01-15T10:00:00.000Z", true),
      ]),
      creaRipasso("r3", [
        creaOccorrenza("o7", "2026-01-01T10:00:00.000Z", false),
      ]),
    ];

    const vista = await renderHook(() => useCapitaleMentale());

    expect(vista.result.current.totaleVoci).toBe(3);
    expect(vista.result.current.totalePermanenti).toBe(1);
    expect(vista.result.current.totaleInConsolidamento).toBe(1);
    expect(vista.result.current.totaleNuovi).toBe(1);
    expect(vista.result.current.percentualePermanente).toBe(33);
    expect(vista.result.current.statistiche).toEqual({
      totaleVoci: 3,
      totalePermanenti: 1,
      totaleInConsolidamento: 1,
      totaleNuovi: 1,
      percentualePermanente: 33,
    });
  });

  it("supporta una lista passata come prop", async () => {
    const customList = [
      creaRipasso("c1", [
        creaOccorrenza("co1", "2026-01-01T10:00:00.000Z", true),
        creaOccorrenza("co2", "2026-07-01T10:00:00.000Z", true),
      ]),
    ];

    const vista = await renderHook(() => useCapitaleMentale(customList));

    expect(vista.result.current.totaleVoci).toBe(1);
    expect(vista.result.current.totalePermanenti).toBe(1);
    expect(vista.result.current.percentualePermanente).toBe(100);
  });
});
