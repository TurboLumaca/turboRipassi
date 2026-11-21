import { test } from "node:test";
import assert from "node:assert/strict";
import { registraStrumenti } from "../lib/tools.mjs";

const ID = "11111111-1111-4111-8111-111111111111";
const OC = ["22222222-2222-4222-8222-222222222221", "22222222-2222-4222-8222-222222222222", "22222222-2222-4222-8222-222222222223"];

function setup(ripassi = []) {
  const chiamate = [];
  const repo = {
    elenca: async () => ripassi,
    leggi: async (id) => ripassi.find((r) => r.id === id) ?? null,
    crea: async (x) => { chiamate.push(["crea", x]); const r = { id: ID, titolo: x.titolo, domanda: x.domanda, non_proporre_piu: false, occorrenze: x.occorrenze.map((o, i) => ({ id: OC[i] ?? `x${i}`, is_completed: false, ...o })) }; ripassi.push(r); return r; },
    aggiorna: async (...a) => chiamate.push(["aggiorna", ...a]),
    elimina: async (...a) => chiamate.push(["elimina", ...a]),
    completaOccorrenza: async (...a) => chiamate.push(["completa", ...a]),
    aggiungiOccorrenza: async (...a) => chiamate.push(["aggiungi", ...a]),
    spostaOccorrenze: async (...a) => chiamate.push(["sposta", ...a]),
  };
  const strumenti = {};
  registraStrumenti({ registerTool: (n, _c, fn) => (strumenti[n] = fn) }, repo, () => new Date("2026-11-21T10:00:00Z"));
  return { strumenti, chiamate };
}
const json = (r) => JSON.parse(r.content[0].text);

test("crea_ripasso genera le 4 occorrenze automatiche, 5 con +1h", async () => {
  const { strumenti, chiamate } = setup();
  await strumenti.crea_ripasso({ titolo: "T", includi_1h: false });
  assert.equal(chiamate[0][1].occorrenze.length, 4);
  const b = setup();
  await b.strumenti.crea_ripasso({ titolo: "T", includi_1h: true });
  assert.equal(b.chiamate[0][1].occorrenze.length, 5);
  assert.equal(b.chiamate[0][1].occorrenze[0].is_manual_1h, true);
});

test("crea_ripasso conta dalla data_base", async () => {
  const { strumenti, chiamate } = setup();
  await strumenti.crea_ripasso({ titolo: "T", includi_1h: false, data_base: "2026-01-01T00:00:00Z" });
  assert.equal(chiamate[0][1].occorrenze[0].scheduled_at, "2026-01-02T00:00:00.000Z");
});

test("ripassi_di_oggi include gli arretrati e salta archiviati e completati", async () => {
  const mk = (id, arch, occ) => ({ id, titolo: id, domanda: null, non_proporre_piu: arch, occorrenze: occ });
  const { strumenti } = setup([
    mk("a", false, [{ id: "o1", scheduled_at: "2026-11-01T08:00:00Z", is_completed: false }]),
    mk("b", true, [{ id: "o2", scheduled_at: "2026-11-01T08:00:00Z", is_completed: false }]),
    mk("c", false, [{ id: "o3", scheduled_at: "2026-11-01T08:00:00Z", is_completed: true }, { id: "o4", scheduled_at: "2027-01-01T08:00:00Z", is_completed: false }]),
  ]);
  const r = json(await strumenti.ripassi_di_oggi({}));
  assert.deepEqual(r.richiami.map((x) => x.occorrenza_id), ["o1"]);
});

test("sposta_occorrenza trasla le successive non completate", async () => {
  const occ = [
    { id: OC[0], scheduled_at: "2026-11-22T10:00:00Z", is_completed: false },
    { id: OC[1], scheduled_at: "2026-11-28T10:00:00Z", is_completed: false },
    { id: OC[2], scheduled_at: "2026-12-21T10:00:00Z", is_completed: true },
  ];
  const { strumenti, chiamate } = setup([{ id: ID, titolo: "T", non_proporre_piu: false, occorrenze: occ }]);
  await strumenti.sposta_occorrenza({ ripasso_id: ID, occorrenza_id: OC[0], nuova_data: "2026-11-20T10:00:00Z", sposta_successive: true });
  assert.deepEqual(chiamate[0][1], [
    { id: OC[0], scheduled_at: "2026-11-20T10:00:00.000Z" },
    { id: OC[1], scheduled_at: "2026-11-26T10:00:00.000Z" },
  ]);
});

test("aggiorna_ripasso mappa archiviato su non_proporre_piu", async () => {
  const { strumenti, chiamate } = setup([{ id: ID, titolo: "T", occorrenze: [] }]);
  await strumenti.aggiorna_ripasso({ id: ID, archiviato: true });
  assert.deepEqual(chiamate[0], ["aggiorna", ID, { non_proporre_piu: true }]);
});

test("ripasso inesistente dà errore, non eccezione", async () => {
  const { strumenti } = setup();
  assert.equal((await strumenti.leggi_ripasso({ id: ID })).isError, true);
  assert.equal((await strumenti.elimina_ripasso({ id: ID, conferma: true })).isError, true);
});
