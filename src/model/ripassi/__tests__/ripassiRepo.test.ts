/**
 * Tests for the reviews repository. Supabase is mocked with a minimal query
 * builder, so what is exercised is the repository's own contract: the ordering
 * it guarantees to the UI, the occurrences generated on creation, and the fact
 * that a failed query is rethrown instead of returning empty data.
 *
 * The ordering matters more than it looks: Postgres returns embedded rows in
 * no defined order, so every screen that shows "the next review" or the
 * attachments in the order the user arranged them depends on this file.
 */
import type { Allegato, Occorrenza } from "@/model/types";

interface Risultato {
  data?: unknown;
  error?: unknown;
}

/** Result queued per table, in call order. */
const risultati = new Map<string, Risultato[]>();
/** Every insert payload seen, per table, for assertions. */
const insertiti = new Map<string, unknown[]>();

function accoda(tabella: string, risultato: Risultato): void {
  risultati.set(tabella, [...(risultati.get(tabella) ?? []), risultato]);
}

function prossimo(tabella: string): Risultato {
  const coda = risultati.get(tabella) ?? [];
  return coda.shift() ?? { data: null, error: null };
}

/**
 * Chainable stand-in for the supabase query builder: every method returns the
 * same object, and awaiting it (or calling .single()) yields the queued result.
 */
function builder(tabella: string) {
  const risultato = prossimo(tabella);
  const b: Record<string, unknown> = {
    select: jest.fn(() => b),
    order: jest.fn(() => b),
    eq: jest.fn(() => b),
    update: jest.fn(() => b),
    delete: jest.fn(() => b),
    insert: jest.fn((payload: unknown) => {
      insertiti.set(tabella, [...(insertiti.get(tabella) ?? []), payload]);
      return b;
    }),
    single: jest.fn(async () => risultato),
    then: (ok: (r: Risultato) => unknown, ko?: (e: unknown) => unknown) =>
      Promise.resolve(risultato).then(ok, ko),
  };
  return b;
}

const mockFrom = jest.fn((tabella: string) => builder(tabella));
/** Result queued for the next rpc() call, and the arguments it was given. */
let esitoRpc: Risultato = { data: null, error: null };
const mockRpc = jest.fn(async () => esitoRpc);

jest.mock("@/config/supabase", () => ({
  supabase: {
    from: (tabella: string) => mockFrom(tabella),
    rpc: (...a: unknown[]) => mockRpc(...(a as [])),
  },
}));

import { ripassiRepo } from "../ripassiRepo";

function occ(id: string, scheduledAt: string): Occorrenza {
  return {
    id,
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    scheduled_at: scheduledAt,
    is_manual_1h: false,
    is_completed: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function all(id: string, orderIndex: number): Allegato {
  return {
    id,
    ripasso_id: "r1",
    account_id: "a1",
    user_id: "u1",
    display_name: id,
    original_file_name: `${id}.jpg`,
    storage_path: `drive-${id}`,
    order_index: orderIndex,
    mime_type: "image/jpeg",
    size_bytes: 10,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

beforeEach(() => {
  risultati.clear();
  insertiti.clear();
  mockFrom.mockClear();
  mockRpc.mockClear();
  esitoRpc = { data: null, error: null };
});

describe("leggiCompleti", () => {
  it("ordina le occorrenze cronologicamente e gli allegati per order_index", async () => {
    accoda("ripassi", {
      data: [
        {
          id: "r1",
          account_id: "a1",
          user_id: "u1",
          titolo: "Bayes",
          note: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          // Postgres non garantisce l'ordine delle righe innestate.
          occorrenze: [occ("tardi", "2026-03-01T00:00:00.000Z"), occ("presto", "2026-02-01T00:00:00.000Z")],
          allegati: [all("secondo", 1), all("primo", 0)],
        },
      ],
      error: null,
    });

    const [ripasso] = await ripassiRepo.leggiCompleti();

    expect(ripasso.occorrenze.map((o) => o.id)).toEqual(["presto", "tardi"]);
    expect(ripasso.allegati.map((a) => a.id)).toEqual(["primo", "secondo"]);
  });

  it("tratta figli assenti come liste vuote, non come undefined", async () => {
    accoda("ripassi", {
      data: [
        {
          id: "r1",
          account_id: "a1",
          user_id: "u1",
          titolo: "Senza figli",
          note: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });

    const [ripasso] = await ripassiRepo.leggiCompleti();

    expect(ripasso.occorrenze).toEqual([]);
    expect(ripasso.allegati).toEqual([]);
  });

  it("rilancia l'errore invece di restituire una lista vuota", async () => {
    accoda("ripassi", { data: null, error: { message: "boom" } });
    await expect(ripassiRepo.leggiCompleti()).rejects.toEqual({ message: "boom" });
  });
});

describe("crea", () => {
  it("inserisce le 4 occorrenze automatiche legate al nuovo ripasso", async () => {
    accoda("ripassi", { data: { id: "nuovo", titolo: "T" }, error: null });
    accoda("occorrenze", { data: null, error: null });

    await ripassiRepo.crea({ titolo: "T", note: null, includi1h: false });

    const occorrenze = (insertiti.get("occorrenze") ?? [])[0] as {
      ripasso_id: string;
      is_manual_1h: boolean;
    }[];
    expect(occorrenze).toHaveLength(4);
    expect(occorrenze.every((o) => o.ripasso_id === "nuovo")).toBe(true);
    expect(occorrenze.some((o) => o.is_manual_1h)).toBe(false);
  });

  it("aggiunge l'occorrenza +1 ora solo quando richiesta", async () => {
    accoda("ripassi", { data: { id: "nuovo" }, error: null });
    accoda("occorrenze", { data: null, error: null });

    await ripassiRepo.crea({ titolo: "T", note: null, includi1h: true });

    const occorrenze = (insertiti.get("occorrenze") ?? [])[0] as { is_manual_1h: boolean }[];
    expect(occorrenze).toHaveLength(5);
    expect(occorrenze.filter((o) => o.is_manual_1h)).toHaveLength(1);
  });

  it("non tenta di generare occorrenze se l'insert del ripasso fallisce", async () => {
    accoda("ripassi", { data: null, error: { message: "duplicate key" } });

    await expect(ripassiRepo.crea({ titolo: "T", note: null, includi1h: false })).rejects.toEqual({
      message: "duplicate key",
    });
    expect(insertiti.get("occorrenze")).toBeUndefined();
  });

  /**
   * Ownership is decided by Postgres, from the session. A client that sends
   * `account_id` or `user_id` is either guessing (and RLS rejects the row) or
   * right by luck; either way it is claiming an authority it does not have,
   * and the columns are defaulted server-side precisely so it never needs to.
   */
  it("non invia le colonne di proprietà: le riempie Postgres dalla sessione", async () => {
    accoda("ripassi", { data: { id: "nuovo" }, error: null });
    accoda("occorrenze", { data: null, error: null });

    await ripassiRepo.crea({ titolo: "T", note: null, includi1h: false });

    const [ripasso] = (insertiti.get("ripassi") ?? []) as Record<string, unknown>[];
    const [occorrenze] = (insertiti.get("occorrenze") ?? []) as Record<string, unknown>[][];

    for (const riga of [ripasso, ...occorrenze]) {
      expect(riga).not.toHaveProperty("account_id");
      expect(riga).not.toHaveProperty("user_id");
    }
  });
});

describe("completaOccorrenza", () => {
  it("passa dall'aggiornamento dell'occorrenza", async () => {
    accoda("occorrenze", { data: null, error: null });
    await ripassiRepo.completaOccorrenza("occ-1", true);
    expect(mockFrom).toHaveBeenCalledWith("occorrenze");
  });

  it("rilancia l'errore di aggiornamento", async () => {
    accoda("occorrenze", { data: null, error: { code: "42501" } });
    await expect(ripassiRepo.completaOccorrenza("occ-1", true)).rejects.toEqual({ code: "42501" });
  });
});

/**
 * Una sola chiamata transazionale, come per il riordino degli allegati: N
 * update separati lascerebbero la scaletta spostata a metà se la connessione
 * cade nel mezzo, e su mobile cade.
 */
describe("spostaOccorrenze", () => {
  it("invia id e istanti in un'unica RPC, allineati per posizione", async () => {
    await ripassiRepo.spostaOccorrenze([
      { id: "a", scheduled_at: "2026-07-08T15:30:00.000Z" },
      { id: "b", scheduled_at: "2026-07-14T15:30:00.000Z" },
    ]);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("sposta_occorrenze", {
      ids: ["a", "b"],
      istanti: ["2026-07-08T15:30:00.000Z", "2026-07-14T15:30:00.000Z"],
    });
  });

  it("non fa alcuna chiamata se non c'è niente da spostare", async () => {
    await ripassiRepo.spostaOccorrenze([]);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("rilancia l'errore invece di dare per riuscito lo spostamento", async () => {
    esitoRpc = { data: null, error: { code: "42501" } };
    await expect(
      ripassiRepo.spostaOccorrenze([{ id: "a", scheduled_at: "2026-07-08T15:30:00.000Z" }])
    ).rejects.toEqual({ code: "42501" });
  });
});
