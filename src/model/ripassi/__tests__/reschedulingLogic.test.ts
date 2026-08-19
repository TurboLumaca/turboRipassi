/**
 * Tests for the Graceful Rescheduling domain logic (reschedulingLogic.ts).
 * Pure and deterministic functions with no I/O dependencies.
 */
import {
  calcolaPrioritaRipasso,
  smoothOverdueReviews,
  applicaSmoothingARipassi,
} from "../reschedulingLogic";
import type { Occorrenza, RipassoCompleto } from "../../types";

const ORA = new Date("2026-07-15T10:00:00.000Z");

function occ(over: Partial<Occorrenza> & { scheduled_at: string }): Occorrenza {
  return {
    id: over.id ?? `occ-${over.scheduled_at}`,
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    is_manual_1h: false,
    is_completed: false,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    ...over,
  };
}

function ripasso(over: Partial<RipassoCompleto> & { id: string }): RipassoCompleto {
  return {
    account_id: "a1",
    user_id: "u1",
    titolo: "Titolo",
    note: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    occorrenze: [],
    allegati: [],
    ...over,
  };
}

describe("calcolaPrioritaRipasso", () => {
  it("assegna priorità maggiore alle occorrenze 1h rispetto a quelle a lungo termine", () => {
    const o1h = occ({
      id: "o1",
      scheduled_at: "2026-07-10T10:00:00.000Z",
      is_manual_1h: true,
      created_at: "2026-07-10T09:00:00.000Z",
    });
    const o6m = occ({
      id: "o2",
      scheduled_at: "2026-07-10T10:00:00.000Z",
      is_manual_1h: false,
      created_at: "2026-01-10T09:00:00.000Z",
    });

    const p1h = calcolaPrioritaRipasso(o1h, ORA);
    const p6m = calcolaPrioritaRipasso(o6m, ORA);

    expect(p1h).toBeGreaterThan(p6m);
  });

  it("garantisce determinismo anche in caso di parità di date", () => {
    const a = occ({ id: "alpha", scheduled_at: "2026-07-10T10:00:00.000Z" });
    const b = occ({ id: "beta", scheduled_at: "2026-07-10T10:00:00.000Z" });

    const pa1 = calcolaPrioritaRipasso(a, ORA);
    const pa2 = calcolaPrioritaRipasso(a, ORA);
    const pb = calcolaPrioritaRipasso(b, ORA);
    expect(pa1).toBe(pa2);
    expect(pa1).not.toBe(pb);
  });
});

describe("smoothOverdueReviews", () => {
  it("con 0 elementi arretrati lascia tutte le occorrenze invariate", () => {
    const oggi = occ({ id: "oggi", scheduled_at: "2026-07-15T11:00:00.000Z" });
    const domani = occ({ id: "domani", scheduled_at: "2026-07-16T09:00:00.000Z" });
    const completataIeri = occ({
      id: "ieri-fatta",
      scheduled_at: "2026-07-14T08:00:00.000Z",
      is_completed: true,
    });

    const input = [oggi, domani, completataIeri];
    const risultato = smoothOverdueReviews(input, 5, ORA);

    expect(risultato).toEqual(input);
  });

  it("non tocca né sposta i ripassi corretti programmati per oggi o per il futuro", () => {
    const oggi1 = occ({ id: "oggi1", scheduled_at: "2026-07-15T08:00:00.000Z" });
    const oggi2 = occ({ id: "oggi2", scheduled_at: "2026-07-15T15:00:00.000Z" });
    const futuro = occ({ id: "futuro", scheduled_at: "2026-07-20T10:00:00.000Z" });
    const arretrato = occ({ id: "arr1", scheduled_at: "2026-07-10T09:30:00.000Z" });

    const input = [oggi1, oggi2, futuro, arretrato];
    const risultato = smoothOverdueReviews(input, 5, ORA);

    // I ripassi corretti mantengono esattamente la loro data programmata
    expect(risultato.find((o) => o.id === "oggi1")?.scheduled_at).toBe(oggi1.scheduled_at);
    expect(risultato.find((o) => o.id === "oggi2")?.scheduled_at).toBe(oggi2.scheduled_at);
    expect(risultato.find((o) => o.id === "futuro")?.scheduled_at).toBe(futuro.scheduled_at);
  });

  it("quando gli arretrati sono entro la quota, rimangono assegnati al batch di oggi", () => {
    const arr1 = occ({ id: "arr1", scheduled_at: "2026-07-10T09:00:00.000Z" });
    const arr2 = occ({ id: "arr2", scheduled_at: "2026-07-11T14:00:00.000Z" });
    const oggi = occ({ id: "oggi", scheduled_at: "2026-07-15T10:00:00.000Z" });

    const risultato = smoothOverdueReviews([arr1, arr2, oggi], 5, ORA);

    // Entrambi gli arretrati rimangono nel batch odierno senza essere spinti al futuro
    expect(risultato.find((o) => o.id === "arr1")?.scheduled_at).toBe(arr1.scheduled_at);
    expect(risultato.find((o) => o.id === "arr2")?.scheduled_at).toBe(arr2.scheduled_at);
  });

  it("con 30 elementi arretrati e quota 10, distribuisce gli arretrati su 3 giorni progressivi senza duplicati o perdite", () => {
    const arretrati: Occorrenza[] = Array.from({ length: 30 }, (_, i) =>
      occ({
        id: `arr-${i}`,
        scheduled_at: `2026-07-${String((i % 5) + 1).padStart(2, "0")}T10:00:00.000Z`,
      })
    );

    const futuro = occ({ id: "futuro", scheduled_at: "2026-07-25T10:00:00.000Z" });
    const input = [...arretrati, futuro];

    const risultato = smoothOverdueReviews(input, 10, ORA);

    expect(risultato).toHaveLength(31);
    // Nessun ID perso o duplicato
    const ids = risultato.map((o) => o.id).sort();
    const inputIds = input.map((o) => o.id).sort();
    expect(ids).toEqual(inputIds);

    // Il ripasso futuro non è stato modificato
    expect(risultato.find((o) => o.id === "futuro")?.scheduled_at).toBe(futuro.scheduled_at);

    // Quota 10 per giorno:
    // Giorno 0 (batch iniziale): 10 arretrati (mantengono la data originaria)
    // Giorno 1 (16 luglio): 10 arretrati
    // Giorno 2 (17 luglio): 10 arretrati
    const spostati16 = risultato.filter((o) => new Date(o.scheduled_at).getUTCDate() === 16);
    const spostati17 = risultato.filter((o) => new Date(o.scheduled_at).getUTCDate() === 17);

    expect(spostati16).toHaveLength(10);
    expect(spostati17).toHaveLength(10);
  });

  it("preserva l'ora originaria delle occorrenze riprogrammate", () => {
    const arr = occ({ id: "arr1", scheduled_at: "2026-07-10T14:35:00.000Z" });
    const risultato = smoothOverdueReviews([arr], 5, ORA);

    const dataSpostata = new Date(risultato[0].scheduled_at);
    expect(dataSpostata.getUTCHours()).toBe(14);
    expect(dataSpostata.getUTCMinutes()).toBe(35);
  });

  it("gestisce date non valide senza lanciare errori", () => {
    const nonValida = occ({ id: "bad", scheduled_at: "data-non-valida" });
    const risultato = smoothOverdueReviews([nonValida], 5, ORA);
    expect(risultato).toHaveLength(1);
    expect(risultato[0].id).toBe("bad");
  });
});

describe("applicaSmoothingARipassi", () => {
  it("applica lo smoothing a livello dell'albero di ripassi completi senza mutare gli oggetti originari", () => {
    const arr1 = occ({ id: "arr1", scheduled_at: "2026-07-10T09:00:00.000Z" });
    const arr2 = occ({ id: "arr2", scheduled_at: "2026-07-11T09:00:00.000Z" });
    const r1 = ripasso({ id: "r1", occorrenze: [arr1] });
    const r2 = ripasso({ id: "r2", occorrenze: [arr2] });

    const out = applicaSmoothingARipassi([r1, r2], 1, ORA);

    expect(out).toHaveLength(2);
    expect(out[0].occorrenze).toHaveLength(1);
    expect(out[1].occorrenze).toHaveLength(1);

    // Uno dei due a giorno 0 (15 lug), l'altro a giorno 1 (16 lug)
    const d1 = new Date(out[0].occorrenze[0].scheduled_at).getUTCDate();
    const d2 = new Date(out[1].occorrenze[0].scheduled_at).getUTCDate();
    expect(new Set([d1, d2])).toEqual(new Set([11, 16]));
  });
});
