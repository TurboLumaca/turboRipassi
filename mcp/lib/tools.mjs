/**
 * Gli strumenti MCP. Dipendono da un `repo` passato dall'esterno, così si
 * provano con uno finto senza rete. Le date si calcolano con le stesse
 * funzioni pure dell'app: un ripasso creato da Claude ha esattamente il
 * calendario di uno creato a mano.
 */
import { z } from "zod";
import {
  calcolaOccorrenze,
  ricalcolaSuccessive,
} from "../../src/model/ripassi/occorrenzeDates.ts";

const testo = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });
const errore = (msg) => ({ isError: true, content: [{ type: "text", text: msg }] });

const dataIso = z.string().datetime({ offset: true }).describe("Data e ora ISO 8601, es. 2026-11-25T09:00:00+01:00");

/** Vista compatta di un ripasso: la risposta resta fuori dalle liste. */
export function riassunto(r, adesso = new Date()) {
  const aperte = r.occorrenze.filter((o) => !o.is_completed);
  const prossima = aperte[0] ?? null;
  return {
    id: r.id,
    titolo: r.titolo,
    domanda: r.domanda,
    archiviato: r.non_proporre_piu,
    prossima_occorrenza: prossima && {
      id: prossima.id,
      quando: prossima.scheduled_at,
      scaduta: new Date(prossima.scheduled_at) <= adesso,
    },
    occorrenze_completate: r.occorrenze.length - aperte.length,
    occorrenze_totali: r.occorrenze.length,
  };
}

export function registraStrumenti(server, repo, orologio = () => new Date()) {
  const def = (nome, config, fn) =>
    server.registerTool(nome, config, async (args) => {
      try {
        return await fn(args);
      } catch (e) {
        return errore(e instanceof Error ? e.message : String(e));
      }
    });

  def(
    "crea_ripasso",
    {
      title: "Crea un ripasso programmato",
      description:
        "Crea un ripasso con ripetizione dilazionata: occorrenze automatiche a +1 giorno, +1 settimana, +1 mese, +6 mesi (più +1 ora se richiesto), contate da data_base (default: adesso). Usa 'domanda' per il prompt di richiamo e 'note' per la risposta.",
      inputSchema: {
        titolo: z.string().min(1).describe("Il concetto da ripassare"),
        domanda: z.string().optional().describe("La domanda che apre il richiamo (mai la risposta)"),
        note: z.string().optional().describe("Note o risposta, mostrate dopo il richiamo"),
        includi_1h: z.boolean().default(false).describe("Aggiunge un primo richiamo dopo un'ora"),
        data_base: dataIso.optional().describe("Quando è stato studiato, se non adesso"),
      },
      annotations: { destructiveHint: false, idempotentHint: false },
    },
    async ({ titolo, domanda, note, includi_1h, data_base }) => {
      const base = data_base ? new Date(data_base) : orologio();
      const occorrenze = calcolaOccorrenze(base, includi_1h).map(({ scheduled_at, is_manual_1h }) => ({
        scheduled_at,
        is_manual_1h,
      }));
      const creato = await repo.crea({ titolo, domanda: domanda ?? null, note: note ?? null, occorrenze });
      const completo = await repo.leggi(creato.id);
      return testo(riassunto(completo ?? { ...creato, occorrenze: [], allegati: [] }, orologio()));
    }
  );

  def(
    "elenca_ripassi",
    {
      title: "Elenca i ripassi",
      description: "Elenca i ripassi con la prossima occorrenza. Di default esclude gli archiviati («Non proporre più»).",
      inputSchema: {
        cerca: z.string().optional().describe("Filtra per testo in titolo, domanda o note"),
        includi_archiviati: z.boolean().default(false),
        limite: z.number().int().min(1).max(200).default(50),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ cerca, includi_archiviati, limite }) => {
      const q = cerca?.toLowerCase();
      const righe = (await repo.elenca())
        .filter((r) => includi_archiviati || !r.non_proporre_piu)
        .filter((r) => !q || [r.titolo, r.domanda, r.note].some((t) => t?.toLowerCase().includes(q)));
      return testo({ totale: righe.length, ripassi: righe.slice(0, limite).map((r) => riassunto(r, orologio())) });
    }
  );

  def(
    "ripassi_di_oggi",
    {
      title: "Ripassi da fare oggi",
      description: "I richiami in scadenza entro la fine di oggi, arretrati compresi, dal più vecchio.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const fine = orologio();
      fine.setHours(23, 59, 59, 999);
      const dovuti = [];
      for (const r of await repo.elenca()) {
        if (r.non_proporre_piu) continue;
        for (const o of r.occorrenze) {
          if (!o.is_completed && new Date(o.scheduled_at) <= fine) {
            dovuti.push({ occorrenza_id: o.id, quando: o.scheduled_at, ripasso_id: r.id, titolo: r.titolo, domanda: r.domanda });
          }
        }
      }
      dovuti.sort((a, b) => new Date(a.quando) - new Date(b.quando));
      return testo({ totale: dovuti.length, richiami: dovuti });
    }
  );

  def(
    "leggi_ripasso",
    {
      title: "Leggi un ripasso",
      description: "Il ripasso completo: domanda, note, tutte le occorrenze e i nomi degli allegati.",
      inputSchema: { id: z.string().uuid() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => {
      const r = await repo.leggi(id);
      return r ? testo(r) : errore("Ripasso non trovato.");
    }
  );

  def(
    "aggiorna_ripasso",
    {
      title: "Modifica un ripasso",
      description: "Cambia titolo, domanda o note, oppure archivia/ripristina («Non proporre più»). Passa solo i campi da cambiare.",
      inputSchema: {
        id: z.string().uuid(),
        titolo: z.string().min(1).optional(),
        domanda: z.string().nullable().optional(),
        note: z.string().nullable().optional(),
        archiviato: z.boolean().optional().describe("true = non proporre più; false = ripristina"),
      },
      annotations: { idempotentHint: true },
    },
    async ({ id, archiviato, ...campi }) => {
      const patch = { ...campi };
      if (archiviato !== undefined) patch.non_proporre_piu = archiviato;
      const chiavi = Object.keys(patch).filter((k) => patch[k] !== undefined);
      if (chiavi.length === 0) return errore("Niente da modificare.");
      if (!(await repo.leggi(id))) return errore("Ripasso non trovato.");
      await repo.aggiorna(id, Object.fromEntries(chiavi.map((k) => [k, patch[k]])));
      return testo({ id, modificati: chiavi });
    }
  );

  def(
    "completa_occorrenza",
    {
      title: "Segna un richiamo come fatto",
      description: "Segna un'occorrenza completata (o la riapre con completata=false). L'id si ottiene da ripassi_di_oggi o leggi_ripasso.",
      inputSchema: { occorrenza_id: z.string().uuid(), completata: z.boolean().default(true) },
      annotations: { idempotentHint: true },
    },
    async ({ occorrenza_id, completata }) => {
      await repo.completaOccorrenza(occorrenza_id, completata);
      return testo({ occorrenza_id, completata });
    }
  );

  def(
    "aggiungi_occorrenza",
    {
      title: "Aggiungi un richiamo a un ripasso",
      description: "Aggiunge una data di richiamo a un ripasso esistente, oltre a quelle che ha già (es. dopo un richiamo andato male).",
      inputSchema: { ripasso_id: z.string().uuid(), quando: dataIso },
    },
    async ({ ripasso_id, quando }) => {
      if (!(await repo.leggi(ripasso_id))) return errore("Ripasso non trovato.");
      await repo.aggiungiOccorrenza(ripasso_id, new Date(quando).toISOString());
      return testo({ ripasso_id, quando });
    }
  );

  def(
    "sposta_occorrenza",
    {
      title: "Riprogramma un richiamo",
      description:
        "Sposta un'occorrenza a una nuova data. Con sposta_successive=true (default) trasla della stessa distanza anche le occorrenze non completate che la seguono, come fa l'app; gli arretrati e i completati non si toccano.",
      inputSchema: {
        ripasso_id: z.string().uuid(),
        occorrenza_id: z.string().uuid(),
        nuova_data: dataIso,
        sposta_successive: z.boolean().default(true),
      },
      annotations: { idempotentHint: true },
    },
    async ({ ripasso_id, occorrenza_id, nuova_data, sposta_successive }) => {
      const r = await repo.leggi(ripasso_id);
      if (!r) return errore("Ripasso non trovato.");
      if (!r.occorrenze.some((o) => o.id === occorrenza_id)) return errore("Occorrenza non trovata in questo ripasso.");
      const nuova = new Date(nuova_data);
      const spostamenti = [
        { id: occorrenza_id, scheduled_at: nuova.toISOString() },
        ...(sposta_successive ? ricalcolaSuccessive(r.occorrenze, occorrenza_id, nuova) : []),
      ];
      await repo.spostaOccorrenze(spostamenti);
      return testo({ spostate: spostamenti.length, spostamenti });
    }
  );

  def(
    "elimina_ripasso",
    {
      title: "Elimina un ripasso",
      description:
        "Elimina definitivamente un ripasso con occorrenze e allegati. Irreversibile: se basta toglierlo dalle proposte usa aggiorna_ripasso con archiviato=true. Richiede conferma=true.",
      inputSchema: { id: z.string().uuid(), conferma: z.literal(true).describe("Deve essere true") },
      annotations: { destructiveHint: true },
    },
    async ({ id }) => {
      if (!(await repo.leggi(id))) return errore("Ripasso non trovato.");
      await repo.elimina(id);
      return testo({ eliminato: id });
    }
  );
}
