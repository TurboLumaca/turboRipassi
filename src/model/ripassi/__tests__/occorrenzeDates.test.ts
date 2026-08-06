/**
 * Test — generazione date di ripasso (sezione 5 della spec):
 * +1 giorno, +1 settimana, +1 mese, +6 mesi sempre; +1 ora solo se attivata.
 */
import {
  applicaOffset,
  calcolaOccorrenze,
  OFFSET_AUTOMATICI,
  ricalcolaSuccessive,
} from "../occorrenzeDates";
import type { Occorrenza } from "@/model/types";

describe("applicaOffset", () => {
  const base = new Date(2026, 6, 7, 15, 30, 0); // 7 lug 2026, 15:30 locale

  it("non muta la data di partenza", () => {
    const prima = base.getTime();
    applicaOffset(base, "1d");
    expect(base.getTime()).toBe(prima);
  });

  it("+1 ora", () => {
    expect(applicaOffset(base, "1h").getTime() - base.getTime()).toBe(3600_000);
  });

  it("+1 giorno mantiene l'orario", () => {
    const d = applicaOffset(base, "1d");
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([8, 15, 30]);
  });

  it("+1 settimana", () => {
    expect(applicaOffset(base, "1w").getDate()).toBe(14);
  });

  it("+1 mese e +6 mesi", () => {
    expect(applicaOffset(base, "1m").getMonth()).toBe(7); // agosto
    expect(applicaOffset(base, "6m").getMonth()).toBe(0); // gennaio anno dopo
    expect(applicaOffset(base, "6m").getFullYear()).toBe(2027);
  });

  it("fine mese: 31 gen +1m trabocca su marzo (comportamento JS documentato)", () => {
    const gen31 = new Date(2026, 0, 31, 10, 0);
    const d = applicaOffset(gen31, "1m");
    // 31 feb non esiste: JS normalizza a 2/3 marzo. L'importante è che sia
    // deterministico e non lanci.
    expect(d.getMonth()).toBe(2);
  });
});

describe("calcolaOccorrenze", () => {
  const base = new Date(2026, 6, 7, 15, 30, 0);

  it("senza +1h genera solo i 4 offset automatici", () => {
    const occ = calcolaOccorrenze(base, false);
    expect(occ.map((o) => o.offset)).toEqual(OFFSET_AUTOMATICI);
    expect(occ.every((o) => !o.is_manual_1h)).toBe(true);
  });

  it("con +1h la aggiunge in testa e la marca is_manual_1h", () => {
    const occ = calcolaOccorrenze(base, true);
    expect(occ).toHaveLength(5);
    expect(occ[0].offset).toBe("1h");
    expect(occ[0].is_manual_1h).toBe(true);
    expect(occ.slice(1).every((o) => !o.is_manual_1h)).toBe(true);
  });

  it("scheduled_at è ISO valido e ordinato crescente", () => {
    const occ = calcolaOccorrenze(base, true);
    const times = occ.map((o) => new Date(o.scheduled_at).getTime());
    expect(times.every((t) => Number.isFinite(t))).toBe(true);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

/**
 * Il caso per cui esiste: annoti oggi qualcosa che hai studiato due giorni fa.
 * Correggere la prima data senza trascinare le altre lascerebbe la scaletta
 * misurata dal giorno sbagliato.
 */
describe("ricalcolaSuccessive", () => {
  const GIORNO = 86_400_000;

  function occ(id: string, iso: string, completata = false): Occorrenza {
    return {
      id,
      ripasso_id: "r1",
      account_id: "a1",
      user_id: "u1",
      scheduled_at: iso,
      is_manual_1h: false,
      is_completed: completata,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
  }

  /** Scaletta tipica: +1g, +1s, +1m, +6m a partire dal 7 luglio 2026. */
  const scaletta = [
    occ("g", "2026-07-08T15:30:00.000Z"),
    occ("s", "2026-07-14T15:30:00.000Z"),
    occ("m", "2026-08-07T15:30:00.000Z"),
    occ("sm", "2027-01-07T15:30:00.000Z"),
  ];

  it("sposta le successive dello stesso scarto, lasciando ferma la modificata", () => {
    const nuova = new Date("2026-07-06T15:30:00.000Z"); // due giorni indietro
    const spostamenti = ricalcolaSuccessive(scaletta, "g", nuova);

    expect(spostamenti.map((s) => s.id)).toEqual(["s", "m", "sm"]);
    for (const s of spostamenti) {
      const prima = scaletta.find((o) => o.id === s.id)!;
      const scarto = new Date(s.scheduled_at).getTime() - new Date(prima.scheduled_at).getTime();
      expect(scarto).toBe(-2 * GIORNO);
    }
  });

  it("mantiene le distanze fra le date successive", () => {
    const spostamenti = ricalcolaSuccessive(
      scaletta,
      "g",
      new Date("2026-07-06T15:30:00.000Z")
    );
    const nuovi = spostamenti.map((s) => new Date(s.scheduled_at).getTime());
    const vecchi = ["s", "m", "sm"].map((id) =>
      new Date(scaletta.find((o) => o.id === id)!.scheduled_at).getTime()
    );

    expect(nuovi[1] - nuovi[0]).toBe(vecchi[1] - vecchi[0]);
    expect(nuovi[2] - nuovi[1]).toBe(vecchi[2] - vecchi[1]);
  });

  it("non tocca le date precedenti a quella modificata", () => {
    const spostamenti = ricalcolaSuccessive(
      scaletta,
      "m",
      new Date("2026-08-10T15:30:00.000Z")
    );
    expect(spostamenti.map((s) => s.id)).toEqual(["sm"]);
  });

  /**
   * Che tu abbia ripassato in un certo giorno è un fatto sul passato: spostarlo
   * falsificherebbe lo storico.
   */
  it("lascia ferme le occorrenze già completate", () => {
    const conCompletata = [
      scaletta[0],
      occ("s", "2026-07-14T15:30:00.000Z", true),
      scaletta[2],
    ];
    const spostamenti = ricalcolaSuccessive(
      conCompletata,
      "g",
      new Date("2026-07-10T15:30:00.000Z")
    );
    expect(spostamenti.map((s) => s.id)).toEqual(["m"]);
  });

  it("nessuno spostamento se la data non cambia", () => {
    expect(
      ricalcolaSuccessive(scaletta, "g", new Date("2026-07-08T15:30:00.000Z"))
    ).toEqual([]);
  });

  it("nessuno spostamento per un'occorrenza che non esiste", () => {
    expect(ricalcolaSuccessive(scaletta, "ignota", new Date())).toEqual([]);
  });

  it("nessuno spostamento se l'ultima della scaletta viene mossa", () => {
    expect(
      ricalcolaSuccessive(scaletta, "sm", new Date("2027-02-01T15:30:00.000Z"))
    ).toEqual([]);
  });

  /** Una data illeggibile viene saltata, non riscritta come Invalid Date. */
  it("salta le date malformate invece di propagarle", () => {
    const conRotta = [scaletta[0], occ("rotta", "non-una-data"), scaletta[2]];
    const spostamenti = ricalcolaSuccessive(
      conRotta,
      "g",
      new Date("2026-07-10T15:30:00.000Z")
    );
    expect(spostamenti.map((s) => s.id)).toEqual(["m"]);
    expect(spostamenti.every((s) => Number.isFinite(new Date(s.scheduled_at).getTime()))).toBe(
      true
    );
  });

  it("una data di arrivo non valida non produce spostamenti", () => {
    expect(ricalcolaSuccessive(scaletta, "g", new Date("boh"))).toEqual([]);
  });
});
