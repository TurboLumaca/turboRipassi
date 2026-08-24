import { renderHook } from "@testing-library/react-native";
import { useStatisticheRipassi } from "../useStatisticheRipassi";
import type { Occorrenza, RipassoCompleto } from "@/model/types";

let mockContextRipassi: RipassoCompleto[] = [];

jest.mock("@/controller/RipassiContext", () => ({
  useRipassiCtx: () => ({
    ripassi: mockContextRipassi,
  }),
}));

/**
 * Le date seguono la scaletta reale dell'app (+1g, +1sett, +1mese, +6mesi):
 * il livello di consolidamento dipende dai giorni effettivamente trascorsi,
 * quindi quattro occorrenze tutte allo stesso istante non sarebbero un
 * concetto permanente ma un pomeriggio di spunte.
 */
const SCADENZE = [
  "2026-01-01T10:00:00.000Z",
  "2026-01-08T10:00:00.000Z",
  "2026-02-01T10:00:00.000Z",
  "2026-07-01T10:00:00.000Z",
];

function creaOccorrenza(id: string, is_completed: boolean, indice = 0): Occorrenza {
  return {
    id,
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    scheduled_at: SCADENZE[Math.min(indice, SCADENZE.length - 1)],
    is_manual_1h: false,
    is_completed,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function creaRipasso(id: string, numOccorrenzeCompletate: number): RipassoCompleto {
  return {
    id,
    account_id: "a1",
    user_id: "u1",
    titolo: `Ripasso ${id}`,
    note: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    occorrenze: Array.from({ length: numOccorrenzeCompletate }, (_, i) =>
      creaOccorrenza(`occ-${id}-${i}`, true, i)
    ),
    allegati: [],
  };
}

describe("useStatisticheRipassi", () => {
  beforeEach(() => {
    mockContextRipassi = [];
  });

  it("calcola statistiche capitale e tempo risparmiato", async () => {
    mockContextRipassi = [
      creaRipasso("r1", 4), // 20 - 2 = 18 min
      creaRipasso("r2", 4), // 20 - 2 = 18 min
    ];

    const vista = await renderHook(() => useStatisticheRipassi());

    expect(vista.result.current.totaleVoci).toBe(2);
    expect(vista.result.current.totalePermanenti).toBe(2);
    expect(vista.result.current.risparmioTempo.minutiTotaliRisparmiati).toBe(36);
    expect(vista.result.current.risparmioTempo.oreFormattate).toBe("36 min");
  });

  it("supporta lista personalizzata di ripassi", async () => {
    const custom = [
      creaRipasso("c1", 4),
      creaRipasso("c2", 4),
      creaRipasso("c3", 4),
      creaRipasso("c4", 4),
      creaRipasso("c5", 4),
      creaRipasso("c6", 4),
      creaRipasso("c7", 4),
      creaRipasso("c8", 4),
      creaRipasso("c9", 4),
      creaRipasso("c10", 4),
    ]; // 10 * 18 = 180 min = 3 ore

    const vista = await renderHook(() => useStatisticheRipassi(custom));

    expect(vista.result.current.risparmioTempo.minutiTotaliRisparmiati).toBe(180);
    expect(vista.result.current.risparmioTempo.oreFormattate).toBe("3 ore");
  });
});
