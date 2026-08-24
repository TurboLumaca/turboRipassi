import {
  calcolaLivelloConsolidamento,
  calcolaLivelloVoce,
  calcolaStatisticheCapitale,
  type VoceRipassoConOccorrenze,
} from "../capitaleMentaleLogic";

/**
 * The rule under test is an AND on purpose: a concept is "permanente" only if
 * it has been brought back four times *and* has survived six months of not
 * being looked at. The OR it replaced let an app one month old report seven
 * notions already stable for the long term, which is the one thing this card
 * must never claim.
 */
describe("capitaleMentaleLogic", () => {
  describe("calcolaLivelloConsolidamento", () => {
    it("classifica come 'nuovo' sotto le 2 ripetizioni o sotto le 2 settimane", () => {
      expect(calcolaLivelloConsolidamento(0, 0)).toBe("nuovo");
      expect(calcolaLivelloConsolidamento(1, 0)).toBe("nuovo");
      expect(calcolaLivelloConsolidamento(1, 400)).toBe("nuovo");
      expect(calcolaLivelloConsolidamento(5, 13)).toBe("nuovo");
    });

    it("richiede sia le ripetizioni sia il tempo per il consolidamento", () => {
      expect(calcolaLivelloConsolidamento(2, 14)).toBe("consolidamento");
      expect(calcolaLivelloConsolidamento(3, 90)).toBe("consolidamento");
      expect(calcolaLivelloConsolidamento(4, 179)).toBe("consolidamento");
      // Tempo senza ripetizioni: non è consolidamento.
      expect(calcolaLivelloConsolidamento(1, 200)).toBe("nuovo");
      // Ripetizioni senza tempo: nemmeno.
      expect(calcolaLivelloConsolidamento(4, 1)).toBe("nuovo");
    });

    it("dichiara 'permanente' solo con 4 ripassi e 6 mesi trascorsi", () => {
      expect(calcolaLivelloConsolidamento(4, 180)).toBe("permanente");
      expect(calcolaLivelloConsolidamento(6, 400)).toBe("permanente");
      // Quattro ripassi schiacciati in un pomeriggio restano "nuovo".
      expect(calcolaLivelloConsolidamento(4, 0)).toBe("nuovo");
      // Sei mesi con due soli ripassi non bastano.
      expect(calcolaLivelloConsolidamento(2, 365)).toBe("consolidamento");
      expect(calcolaLivelloConsolidamento(3, 179)).toBe("consolidamento");
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

    it("non promuove un ripasso completato tutto lo stesso giorno", () => {
      const voce: VoceRipassoConOccorrenze = {
        occorrenze: [
          { scheduled_at: "2026-01-01T09:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-01-01T11:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-01-01T12:00:00.000Z", is_completed: true },
        ],
      };
      expect(calcolaLivelloVoce(voce)).toBe("nuovo");
    });

    it("restituisce 'consolidamento' fra le 2 settimane e i 6 mesi", () => {
      const voce2: VoceRipassoConOccorrenze = {
        occorrenze: [
          { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-02-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-07-01T10:00:00.000Z", is_completed: false },
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

    it("non conta le occorrenze soltanto programmate", () => {
      // Il ripasso a 6 mesi è in calendario ma non è stato fatto: l'ultima
      // occorrenza completata è a un mese, quindi il concetto non è permanente.
      const voce: VoceRipassoConOccorrenze = {
        occorrenze: [
          { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-01-02T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-01-08T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-02-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-07-01T10:00:00.000Z", is_completed: false },
        ],
      };
      expect(calcolaLivelloVoce(voce)).toBe("consolidamento");
    });

    it("restituisce 'permanente' con 4 ripassi completati oltre i 6 mesi", () => {
      const voce4: VoceRipassoConOccorrenze = {
        occorrenze: [
          { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-01-08T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-02-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-07-01T10:00:00.000Z", is_completed: true },
        ],
      };
      expect(calcolaLivelloVoce(voce4)).toBe("permanente");
    });

    it("gestisce date non valide ricadendo su 'nuovo'", () => {
      const voceInvalida: VoceRipassoConOccorrenze = {
        occorrenze: [{ scheduled_at: "data-non-valida", is_completed: true }],
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
          occorrenze: [{ scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: false }],
        },
        // Nuovo (1 completata, intervallo 0)
        {
          occorrenze: [
            { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
            { scheduled_at: "2026-01-02T10:00:00.000Z", is_completed: false },
          ],
        },
        // Consolidamento (2 completate su un mese)
        {
          occorrenze: [
            { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
            { scheduled_at: "2026-02-01T10:00:00.000Z", is_completed: true },
          ],
        },
        // Permanente (4 completate su sei mesi)
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

    it("non riporta nessun permanente su un archivio giovane", () => {
      // Un'app in uso da un mese: ogni concetto ha al massimo un mese di vita,
      // per quanti ripassi ne siano stati spuntati.
      const voci: VoceRipassoConOccorrenze[] = Array.from({ length: 7 }, () => ({
        occorrenze: [
          { scheduled_at: "2026-07-01T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-07-02T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-07-08T10:00:00.000Z", is_completed: true },
          { scheduled_at: "2026-07-29T10:00:00.000Z", is_completed: true },
        ],
      }));

      const stats = calcolaStatisticheCapitale(voci);
      expect(stats.totaleVoci).toBe(7);
      expect(stats.totalePermanenti).toBe(0);
      expect(stats.totaleInConsolidamento).toBe(7);
      expect(stats.percentualePermanente).toBe(0);
    });

    it("calcola il 100% se tutti i concetti sono permanenti", () => {
      const voci: VoceRipassoConOccorrenze[] = [
        {
          occorrenze: [
            { scheduled_at: "2026-01-01T10:00:00.000Z", is_completed: true },
            { scheduled_at: "2026-01-08T10:00:00.000Z", is_completed: true },
            { scheduled_at: "2026-02-01T10:00:00.000Z", is_completed: true },
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
