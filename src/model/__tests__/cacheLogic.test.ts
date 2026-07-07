/**
 * Test — logica pura della rotazione cache (sezione 7 della spec):
 * finestra [ieri, oggi, domani] in giorni LOCALI, selezione allegati,
 * eliminazione per appartenenza alla finestra.
 */
import {
  allegatiInFinestra,
  finestraGiorni,
  giornoLocale,
  righeDaEliminare,
} from "../cacheLogic";
import type { Allegato, CacheAllegato, RipassoCompleto } from "../types";

function ripasso(
  id: string,
  occorrenzeIso: string[],
  allegatiIds: string[]
): RipassoCompleto {
  return {
    id,
    user_id: "u1",
    titolo: `Ripasso ${id}`,
    note: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    occorrenze: occorrenzeIso.map((iso, i) => ({
      id: `${id}-occ-${i}`,
      ripasso_id: id,
      user_id: "u1",
      scheduled_at: iso,
      is_manual_1h: false,
      is_completed: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    })),
    allegati: allegatiIds.map((aid, i) => allegato(aid, id, i)),
  };
}

function allegato(id: string, ripassoId: string, index = 0): Allegato {
  return {
    id,
    ripasso_id: ripassoId,
    user_id: "u1",
    display_name: id,
    original_file_name: `${id}.jpg`,
    storage_path: `u1/${ripassoId}/${id}.jpg`,
    order_index: index,
    mime_type: "image/jpeg",
    size_bytes: 1000,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("giornoLocale", () => {
  it("usa i componenti locali, non UTC", () => {
    // 7 lug 2026 00:30 locale: in un fuso avanti rispetto a UTC l'ISO cade
    // sul 6 luglio UTC, ma il giorno locale deve restare il 7.
    const d = new Date(2026, 6, 7, 0, 30);
    expect(giornoLocale(d)).toBe("2026-07-07");
  });

  it("azzera con padding mese/giorno a una cifra", () => {
    expect(giornoLocale(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("finestraGiorni", () => {
  it("contiene esattamente ieri, oggi e domani", () => {
    const rif = new Date(2026, 6, 7, 12, 0);
    expect([...finestraGiorni(rif)].sort()).toEqual([
      "2026-07-06",
      "2026-07-07",
      "2026-07-08",
    ]);
  });

  it("gestisce il cambio di mese", () => {
    const rif = new Date(2026, 6, 31, 12, 0);
    expect(finestraGiorni(rif)).toEqual(
      new Set(["2026-07-30", "2026-07-31", "2026-08-01"])
    );
  });

  it("gestisce il cambio di anno", () => {
    const rif = new Date(2026, 0, 1, 12, 0);
    expect(finestraGiorni(rif)).toEqual(
      new Set(["2025-12-31", "2026-01-01", "2026-01-02"])
    );
  });
});

describe("allegatiInFinestra", () => {
  const rif = new Date(2026, 6, 7, 12, 0); // "oggi" = 7 lug locale

  function iso(y: number, m: number, g: number, h = 10): string {
    return new Date(y, m, g, h).toISOString();
  }

  it("include gli allegati dei ripassi con occorrenza ieri/oggi/domani", () => {
    const ripassi = [
      ripasso("ieri", [iso(2026, 6, 6)], ["a1"]),
      ripasso("oggi", [iso(2026, 6, 7)], ["a2", "a3"]),
      ripasso("domani", [iso(2026, 6, 8)], ["a4"]),
    ];
    const ids = allegatiInFinestra(ripassi, rif).map((a) => a.id);
    expect(ids.sort()).toEqual(["a1", "a2", "a3", "a4"]);
  });

  it("esclude i ripassi con occorrenze solo fuori finestra", () => {
    const ripassi = [
      ripasso("passato", [iso(2026, 6, 4)], ["a1"]),
      ripasso("futuro", [iso(2026, 6, 10)], ["a2"]),
    ];
    expect(allegatiInFinestra(ripassi, rif)).toEqual([]);
  });

  it("una sola occorrenza in finestra basta a includere tutti gli allegati", () => {
    const r = ripasso("misto", [iso(2026, 6, 1), iso(2026, 6, 8)], ["a1", "a2"]);
    expect(allegatiInFinestra([r], rif).map((a) => a.id)).toEqual(["a1", "a2"]);
  });

  it("confronta per giorno locale: occorrenza a mezzanotte e mezza conta per il suo giorno", () => {
    // 8 lug 2026 00:30 locale → in UTC+2 l'ISO è del 7 lug: deve comunque
    // rientrare nella finestra come "domani".
    const r = ripasso("notturno", [new Date(2026, 6, 8, 0, 30).toISOString()], ["a1"]);
    expect(allegatiInFinestra([r], rif).map((a) => a.id)).toEqual(["a1"]);
  });
});

describe("righeDaEliminare", () => {
  const riga = (id: string, cachedAt: string): CacheAllegato => ({
    allegato_id: id,
    local_uri: `file:///cache/${id}.jpg`,
    cached_at: cachedAt,
  });

  it("elimina solo le righe il cui allegato non è più in finestra", () => {
    const righe = [riga("dentro", "2026-07-01"), riga("fuori", "2026-07-07")];
    const out = righeDaEliminare(righe, new Set(["dentro"]));
    expect(out.map((r) => r.allegato_id)).toEqual(["fuori"]);
  });

  it("NON elimina un allegato in finestra anche se scaricato giorni fa (bug regressione)", () => {
    // Il vecchio criterio (cached_at fuori finestra) lo avrebbe cancellato.
    const righe = [riga("vecchio-ma-valido", "2026-06-20")];
    expect(righeDaEliminare(righe, new Set(["vecchio-ma-valido"]))).toEqual([]);
  });

  it("con finestra vuota elimina tutto", () => {
    const righe = [riga("a", "2026-07-07"), riga("b", "2026-07-07")];
    expect(righeDaEliminare(righe, new Set()).length).toBe(2);
  });
});
