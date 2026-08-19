import {
  calcolaTraguardo,
  etichettaTraguardo,
  trovaFlashbackDelGiorno,
  type ElementoConData,
} from "../flashbackLogic";

describe("flashbackLogic", () => {
  describe("calcolaTraguardo", () => {
    it("riconosce la finestra di 1 mese (28-32 giorni)", () => {
      expect(calcolaTraguardo(27)).toBeNull();
      expect(calcolaTraguardo(28)).toBe("1_mese");
      expect(calcolaTraguardo(30)).toBe("1_mese");
      expect(calcolaTraguardo(32)).toBe("1_mese");
      expect(calcolaTraguardo(33)).toBeNull();
    });

    it("riconosce la finestra di 6 mesi (178-182 giorni)", () => {
      expect(calcolaTraguardo(177)).toBeNull();
      expect(calcolaTraguardo(178)).toBe("6_mesi");
      expect(calcolaTraguardo(180)).toBe("6_mesi");
      expect(calcolaTraguardo(182)).toBe("6_mesi");
      expect(calcolaTraguardo(183)).toBeNull();
    });

    it("riconosce la finestra di 1 anno (363-367 giorni)", () => {
      expect(calcolaTraguardo(362)).toBeNull();
      expect(calcolaTraguardo(363)).toBe("1_anno");
      expect(calcolaTraguardo(365)).toBe("1_anno");
      expect(calcolaTraguardo(367)).toBe("1_anno");
      expect(calcolaTraguardo(368)).toBeNull();
    });

    it("riconosce la finestra di più anni (x_anni)", () => {
      expect(calcolaTraguardo(730)).toBe("x_anni");
      expect(calcolaTraguardo(728)).toBe("x_anni");
      expect(calcolaTraguardo(732)).toBe("x_anni");
      expect(calcolaTraguardo(1095)).toBe("x_anni");
    });
  });

  describe("etichettaTraguardo", () => {
    it("genera etichette leggibili per ciascun traguardo", () => {
      expect(etichettaTraguardo("1_mese")).toBe("Esattamente 1 mese fa");
      expect(etichettaTraguardo("6_mesi")).toBe("Esattamente 6 mesi fa");
      expect(etichettaTraguardo("1_anno")).toBe("Esattamente 1 anno fa");
      expect(etichettaTraguardo("x_anni", 730)).toBe("Esattamente 2 anni fa");
      expect(etichettaTraguardo("x_anni", 1095)).toBe("Esattamente 3 anni fa");
    });
  });

  describe("trovaFlashbackDelGiorno", () => {
    const OGGI = new Date("2026-07-15T12:00:00.000Z");

    function creaDataFa(giorniFa: number): string {
      const d = new Date(OGGI.getTime() - giorniFa * 86_400_000);
      return d.toISOString();
    }

    it("restituisce null se non ci sono elementi", () => {
      expect(trovaFlashbackDelGiorno([], OGGI)).toBeNull();
    });

    it("restituisce null se nessun elemento ricade nelle finestre", () => {
      const voci: ElementoConData[] = [
        { id: "1", titolo: "Recente", created_at: creaDataFa(10) },
        { id: "2", titolo: "Casuale", created_at: creaDataFa(90) },
      ];
      expect(trovaFlashbackDelGiorno(voci, OGGI)).toBeNull();
    });

    it("trova un flashback di 1 mese", () => {
      const voci: ElementoConData[] = [
        {
          id: "r1",
          titolo: "Regola dei 2 minuti",
          note: "Se un compito richiede meno di 2 minuti, fallo subito.",
          created_at: creaDataFa(30),
        },
      ];

      const res = trovaFlashbackDelGiorno(voci, OGGI);
      expect(res).not.toBeNull();
      expect(res?.voceId).toBe("r1");
      expect(res?.titolo).toBe("Regola dei 2 minuti");
      expect(res?.traguardo).toBe("1_mese");
      expect(res?.anteprima).toContain("Se un compito richiede");
    });

    it("dà priorità ai ricordi più vecchi (1 anno > 6 mesi > 1 mese)", () => {
      const voci: ElementoConData[] = [
        {
          id: "r1",
          titolo: "Ripasso 1 mese",
          created_at: creaDataFa(30),
        },
        {
          id: "r2",
          titolo: "Ripasso 1 anno",
          created_at: creaDataFa(365),
        },
        {
          id: "r3",
          titolo: "Ripasso 6 mesi",
          created_at: creaDataFa(180),
        },
      ];

      const res = trovaFlashbackDelGiorno(voci, OGGI);
      expect(res?.voceId).toBe("r2");
      expect(res?.traguardo).toBe("1_anno");
    });

    it("esclude elementi già mostrati oggi", () => {
      const voci: ElementoConData[] = [
        {
          id: "r1",
          titolo: "Ripasso 1 anno",
          created_at: creaDataFa(365),
        },
        {
          id: "r2",
          titolo: "Ripasso 6 mesi",
          created_at: creaDataFa(180),
        },
      ];

      // Se r1 è già stato mostrato, seleziona r2
      const res = trovaFlashbackDelGiorno(voci, OGGI, ["r1"]);
      expect(res?.voceId).toBe("r2");
      expect(res?.traguardo).toBe("6_mesi");

      // Se entrambi sono mostrati, ritorna null
      const resTutti = trovaFlashbackDelGiorno(voci, OGGI, ["r1", "r2"]);
      expect(resTutti).toBeNull();
    });

    it("gestisce oggetti nidificati del tipo VoceRipasso", () => {
      const voceRipasso = {
        ripasso: {
          id: "r-wrap",
          titolo: "Algoritmo di Dijkstra",
          note: "Cammini minimi su grafi orientati con pesi non negativi.",
          created_at: creaDataFa(180),
          updated_at: creaDataFa(180),
          account_id: "a1",
          user_id: "u1",
          occorrenze: [],
          allegati: [],
        },
        occorrenza: {
          id: "o1",
          ripasso_id: "r-wrap",
          account_id: "a1",
          user_id: "u1",
          scheduled_at: OGGI.toISOString(),
          is_manual_1h: false,
          is_completed: true,
          created_at: creaDataFa(180),
          updated_at: creaDataFa(180),
        },
      };

      const res = trovaFlashbackDelGiorno([voceRipasso], OGGI);
      expect(res?.voceId).toBe("r-wrap");
      expect(res?.titolo).toBe("Algoritmo di Dijkstra");
      expect(res?.traguardo).toBe("6_mesi");
    });
  });
});
