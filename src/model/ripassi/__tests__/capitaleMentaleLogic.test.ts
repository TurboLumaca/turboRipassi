import {
  calcolaLivelloConsolidamento,
  calcolaLivelloVoce,
  calcolaStatisticheCapitale,
  type VoceRipassoConOccorrenze,
} from "../capitaleMentaleLogic";

describe("capitaleMentaleLogic", () => {
  describe("calcolaLivelloConsolidamento", () => {
    it("classifica come 'nuovo' se < 2 occorrenze e intervallo < 14 giorni", () => {
      expect(calcolaLivelloConsolidamento(0, 0)).toBe("nuovo");
      expect(calcolaLivelloConsolidamento(1, 0)).toBe("nuovo");
      expect(calcolaLivelloConsolidamento(1, 7)).toBe("nuovo");
      expect(calcolaLivelloConsolidamento(1, 13)).toBe("nuovo");
    });

    it("classifica come 'consolidamento' se >= 2 occorrenze completate oppure intervallo >= 14 giorni", () => {
      expect(calcolaLivelloConsolidamento(2, 7)).toBe("consolidamento");
      expect(calcolaLivelloConsolidamento(1, 14)).toBe("consolidamento");
      expect(calcolaLivelloConsolidamento(2, 30)).toBe("consolidamento");
      expect(calcolaLivelloConsolidamento(3, 90)).toBe("consolidamento");
      expect(calcolaLivelloConsolidamento(3, 179)).toBe("consolidamento");
    });

    it("classifica come 'permanente' se >= 4 occorrenze completate oppure intervallo >= 180 giorni", () => {
      expect(calcolaLivelloConsolidamento(4, 30)).toBe("permanente");
      expect(calcolaLivelloConsolidamento(5, 90)).toBe("permanente");
      expect(calcolaLivelloConsolidamento(1, 180)).toBe("permanente");
      expect(calcolaLivelloConsolidamento(2, 190)).toBe("permanente");
      expect(calcolaLivelloConsolidamento(4, 180)).toBe("permanente");
    });
  });

  describe("calcolaLivelloVoce", () => {
    it("restituisce 'nuovo' per voce senza occorrenze o senza occorrenze completate", () => {
      expect(calcolaLivelloVoce({ occorrenze: [] })).toBe("nuovo");
      expect(
        calcolaLivelloVoce({
          occorrenze: [
            { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: false },
            { scheduled_at: "2026-01-08T10:00:00.000Z", is_completed: false },
          ],
        })
      ).toBe("nuovo");
    });

    it("restituisce 'nuovo' se solo 1 occorrenza completata con intervallo breve", () => {
      const voce: VoceRipassoConOccorrenze = {
        occorrenze: [
          { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-01-02T10:00:00.000Z", is_completed: false },
          { scheduled_at: "2026-01-08T10:00:00.000Z", is_completed: false },
        ],
      };
      expect(calcolaLivelloVoce(voce)).toBe("nuovo");
    });

    it("restituisce 'consolidamento' per 2 o 3 occorrenze completate", () => {
      const voce2: VoceRipassoConOccorrenze = {
        occorrenze: [
          { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-01-08T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-02-01T10:00:00.000Z", is_completed: false },
        ],
      };
      expect(calcolaLivelloVoce(voce2)).toBe("consolidamento");

      const voce3: VoceRipassoConOccorrenze = {
        occorrenze: [
          { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-01-08T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-02-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-07-01T10:00:00.000Z", is_completed: false },
        ],
      };
      expect(calcolaLivelloVoce(voce3)).toBe("consolidamento");
    });

    it("restituisce 'permanente' se 4 occorrenze completate o intervallo >= 180 giorni", () => {
      const voce4: VoceRipassoConOccorrenze = {
        occorrenze: [
          { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-01-08T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-02-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-07-01T10:00:00.000Z", is_completed: true },
        ],
      };
      expect(calcolaLivelloVoce(voce4)).toBe("permanente");

      const voceLunga: VoceRipassoConOccorrenze = {
        occorrenze: [
          { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-07-15T10:00:00.000Z", is_completed: true },
        ],
      };
      expect(calcolaLivelloVoce(voceLunga)).toBe("permanente");
    });

    it("gestisce date non valide ricadendo su 'nuovo'", () => {
      const voceInvalida: VoceRipassoConOccorrenze = {
        occorrenze: [
          { scheduled_at: "data-non-valida", is_completed: true },
        ],
      };
      expect(calcolaLivelloVoce(voceInvalida)).toBe("nuovo");
    });
  });

  describe("calcolaStatisticheCapitale", () => {
    it("gestisce liste vuote", () => {
      const stats = calcolaStatisticheCapitale([]);
      expect(stats).toEqual({
        totaleVoci: 0,
        totalePermanenti: 0,
        totaleInConsolidamento: 0,
        totaleNuovi: 0,
        percentualePermanente: 0,
      });
    });

    it("calcola correttamente metriche e percentuali aggregate", () => {
      const voci: VoceRipassoConOccorrenze[] = [
        // Nuovo (0 completate)
        {
          occorrenze: [
            { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: false },
          ],
        },
        // Nuovo (1 completata, intervallo 0)
        {
          occorrenze: [
            { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
            { scheduled_at: "2026-01-02T10:00:00.000Z", is_completed: false },
          ],
        },
        // Consolidamento (2 completate)
        {
          occorrenze: [
            { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
            { scheduled_at: "2026-01-08T10:00:00.000Z", is_completed: true },
          ],
        },
        // Permanente (4 completate)
        {
          occorrenze: [
            { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
            { scheduled_at: "2026-01-08T10:00:00.000Z", is_completed: true },
            { scheduled_at: "2026-02-01T10:00:00.000Z", is_completed: true },
            { scheduled_at: "2026-07-01T10:00:00.000Z", is_completed: true },
          ],
        },
      ];

      const stats = calcolaStatisticheCapitale(voci);
      expect(stats.totaleVoci).toBe(4);
      expect(stats.totaleNuovi).toBe(2);
      expect(stats.totaleInConsolidamento).toBe(1);
      expect(stats.totalePermanenti).toBe(1);
      expect(stats.percentualePermanente).toBe(25);
    });

    it("calcola il 100% se tutti i concetti sono permanenti", () => {
      const voci: VoceRipassoConOccorrenze[] = [
        {
          occorrenze: [
            { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
            { scheduled_at: "2026-07-05T10:00:00.000Z", is_completed: true },
          ],
        },
      ];
      const stats = calcolaStatisticheCapitale(voci);
      expect(stats.totaleVoci).toBe(1);
      expect(stats.totalePermanenti).toBe(1);
      expect(stats.percentualePermanente).toBe(100);
    });
  });
});
