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
/** Every upsert seen, per table: payload plus the options it carried. */
const upsertiti = new Map<string, { payload: unknown; opzioni: unknown }[]>();

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
    upsert: jest.fn((payload: unknown, opzioni: unknown) => {
      upsertiti.set(tabella, [...(upsertiti.get(tabella) ?? []), { payload, opzioni }]);
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
const mockRpc = jest.fn(async (_nome: string, _params?: Record<string, unknown>) => esitoRpc);

jest.mock("@/config/supabase", () => ({
  supabase: {
    from: (tabella: string) => mockFrom(tabella),
    rpc: (...a: unknown[]) => mockRpc(...(a as [string, Record<string, unknown>?])),
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
  upsertiti.clear();
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
  it("chiama l'RPC con i parametri corretti", async () => {
    esitoRpc = { data: { id: "nuovo", titolo: "T" }, error: null };

    await ripassiRepo.crea({ titolo: "T", note: null, includi1h: false });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpcName, params] = mockRpc.mock.calls[0];
    expect(rpcName).toBe("crea_ripasso_completo");
    expect(params?.p_titolo).toBe("T");
    expect(params?.p_occorrenze).toHaveLength(4);
  });

  it("aggiunge l'occorrenza +1 ora solo quando richiesta", async () => {
    esitoRpc = { data: { id: "nuovo" }, error: null };

    await ripassiRepo.crea({ titolo: "T", note: null, includi1h: true });

    const params = mockRpc.mock.calls[0][1] as { p_occorrenze: any[] };
    expect(params.p_occorrenze).toHaveLength(5);
    expect(params.p_occorrenze.filter((o: any) => o.is_manual_1h)).toHaveLength(1);
  });

  it("rilancia l'errore se l'RPC fallisce", async () => {
    esitoRpc = { data: null, error: { message: "duplicate key" } };

    await expect(ripassiRepo.crea({ titolo: "T", note: null, includi1h: false })).rejects.toEqual({
      message: "duplicate key",
    });
  });

  it("non invia le colonne di proprietà: le riempie Postgres dalla sessione (RPC param check)", async () => {
    esitoRpc = { data: { id: "nuovo" }, error: null };

    await ripassiRepo.crea({ titolo: "T", note: null, includi1h: false });

    const params = mockRpc.mock.calls[0][1] as { p_occorrenze: any[] };
    expect(params).not.toHaveProperty("account_id");
    expect(params).not.toHaveProperty("user_id");
    for (const o of params.p_occorrenze) {
      expect(o).not.toHaveProperty("account_id");
      expect(o).not.toHaveProperty("user_id");
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

/**
 * La proprietà su cui poggia tutta la coda offline: questa scrittura si può
 * ripetere. `crea` non si può ritentare — un insert con id generato dal server
 * la cui risposta si perde produce un secondo ripasso — mentre qui la riga si
 * dà il nome da sola e il secondo tentativo collide con il primo.
 */
describe("creaDaCoda", () => {
  const input = {
    id: "r-locale",
    titolo: "Teorema di Bayes",
    note: "probabilità condizionata",
    occorrenze: [
      { id: "o1", scheduled_at: "2026-08-12T09:00:00.000Z", is_manual_1h: false },
      { id: "o2", scheduled_at: "2026-08-18T09:00:00.000Z", is_manual_1h: true },
    ],
  };

  it("invia il payload tramite RPC", async () => {
    esitoRpc = { data: null, error: null };
    await ripassiRepo.creaDaCoda(input);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpcName, params] = mockRpc.mock.calls[0];
    expect(rpcName).toBe("crea_ripasso_completo");
    expect(params?.p_id).toBe("r-locale");
    expect(params?.p_titolo).toBe("Teorema di Bayes");
    expect(params?.p_note).toBe("probabilità condizionata");
    expect(params?.p_occorrenze).toEqual(input.occorrenze);
  });

  it("rilancia l'errore se l'RPC fallisce", async () => {
    esitoRpc = { data: null, error: { code: "42501" } };
    await expect(ripassiRepo.creaDaCoda(input)).rejects.toEqual({ code: "42501" });
  });

  it("non manda le colonne di proprietà: le decide Postgres dalla sessione", async () => {
    esitoRpc = { data: null, error: null };
    await ripassiRepo.creaDaCoda(input);
    const params = mockRpc.mock.calls[0][1] as Record<string, unknown>;
    expect(params).not.toHaveProperty("account_id");
    expect(params).not.toHaveProperty("user_id");
  });
});
