import {
  calcolaTempoRisparmiato,
  formattaTempoRisparmiato,
} from "../savingsLogic";
import type { VoceRipassoConOccorrenze } from "../capitaleMentaleLogic";

describe("savingsLogic", () => {
  describe("formattaTempoRisparmiato", () => {
    it("formatta i minuti per valori inferiori a 60 minuti", () => {
      expect(formattaTempoRisparmiato(0)).toBe("0 min");
      expect(formattaTempoRisparmiato(18)).toBe("18 min");
      expect(formattaTempoRisparmiato(45)).toBe("45 min");
      expect(formattaTempoRisparmiato(59)).toBe("59 min");
    });

    it("formatta le ore per valori maggiori o uguali a 60 minuti", () => {
      expect(formattaTempoRisparmiato(60)).toBe("1 ore");
      expect(formattaTempoRisparmiato(90)).toBe("1.5 ore");
      expect(formattaTempoRisparmiato(120)).toBe("2 ore");
      expect(formattaTempoRisparmiato(180)).toBe("3 ore");
      expect(formattaTempoRisparmiato(1110)).toBe("18.5 ore");
    });
  });

  describe("calcolaTempoRisparmiato", () => {
    function creaVoce(id: string, completate: number): VoceRipassoConOccorrenze {
      return {
        id,
        occorrenze: Array.from({ length: completate }, (_, i) => ({
          scheduled_at: `2026-01-0${i + 1}T10:00:00.000Z`,
          is_completed: true,
        })),
      };
    }

    it("calcola esattamente 18 minuti risparmiati per 1 voce con 4 ripassi", () => {
      const voce = creaVoce("v1", 4);
      const res = calcolaTempoRisparmiato([voce]);

      // 20 - (4 * 0.5) = 18
      expect(res.minutiTotaliRisparmiati).toBe(18);
      expect(res.oreFormattate).toBe("18 min");
      expect(res.dettaglioPerVoce["v1"]).toBe(18);
    });

    it("calcola 180 minuti (3 ore) per 10 voci con 4 ripassi ciascuna", () => {
      const voci = Array.from({ length: 10 }, (_, i) => creaVoce(`v-${i}`, 4));
      const res = calcolaTempoRisparmiato(voci);

      // 10 * 18 = 180 minuti = 3.0 ore
      expect(res.minutiTotaliRisparmiati).toBe(180);
      expect(res.oreFormattate).toBe("3 ore");
    });

    it("assegna 0 minuti risparmiati a voci senza ripassi completati", () => {
      const voceNonCompletata: VoceRipassoConOccorrenze = {
        id: "v-vuota",
        occorrenze: [
          { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: false },
        ],
      };

      const res = calcolaTempoRisparmiato([voceNonCompletata]);
      expect(res.minutiTotaliRisparmiati).toBe(0);
      expect(res.oreFormattate).toBe("0 min");
      expect(res.dettaglioPerVoce["v-vuota"]).toBe(0);
    });

    it("effettua clamping a zero se il tempo impiegato supera il tempo di studio", () => {
      // 50 ripassi * 0.5 = 25 minuti spesi vs 20 minuti di studio iniziale
      const voceMoltiRipassi = creaVoce("v-lunga", 50);
      const res = calcolaTempoRisparmiato([voceMoltiRipassi]);

      expect(res.minutiTotaliRisparmiati).toBe(0);
      expect(res.dettaglioPerVoce["v-lunga"]).toBe(0);
    });

    it("supporta parametri personalizzati di tempo", () => {
      const voce = creaVoce("v1", 2);
      // studio = 30 min, ripasso = 1 min -> 30 - (2 * 1) = 28 min
      const res = calcolaTempoRisparmiato([voce], 30, 1);

      expect(res.minutiTotaliRisparmiati).toBe(28);
      expect(res.oreFormattate).toBe("28 min");
    });
  });
});
