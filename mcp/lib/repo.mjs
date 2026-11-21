/**
 * Accesso a Supabase per il server MCP.
 *
 * Entra come la persona (email + password, chiave pubblica): la sicurezza per
 * riga fa il resto, quindi il server vede e scrive solo i dati del suo account.
 * Le scritture usano le stesse RPC dell'app (`crea_ripasso_completo`,
 * `sposta_occorrenze`); `account_id` e `user_id` li riempie Postgres.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const SELECT_COMPLETO = "*, occorrenze(*), allegati(id, display_name, mime_type)";

function ordina(row) {
  const { occorrenze, allegati, ...ripasso } = row;
  return {
    ...ripasso,
    occorrenze: (occorrenze ?? []).slice().sort(
      (a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)
    ),
    allegati: allegati ?? [],
  };
}

function ok({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

export async function creaRepo({ url, anonKey, email, password }) {
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: true },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Accesso a Supabase fallito: ${error.message}`);

  return {
    async elenca() {
      const data = ok(
        await supabase.from("ripassi").select(SELECT_COMPLETO).order("created_at", { ascending: false })
      );
      return data.map(ordina);
    },

    async leggi(id) {
      const { data, error } = await supabase.from("ripassi").select(SELECT_COMPLETO).eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? ordina(data) : null;
    },

    async crea({ titolo, domanda, note, occorrenze }) {
      const id = randomUUID();
      const data = ok(
        await supabase.rpc("crea_ripasso_completo", {
          p_id: id,
          p_titolo: titolo,
          p_note: note,
          p_domanda: domanda,
          p_occorrenze: occorrenze.map((o) => ({ id: randomUUID(), ...o })),
        })
      );
      return Array.isArray(data) ? data[0] : data;
    },

    async aggiorna(id, patch) {
      ok(await supabase.from("ripassi").update(patch).eq("id", id));
    },

    async elimina(id) {
      ok(await supabase.from("ripassi").delete().eq("id", id));
    },

    async completaOccorrenza(id, completata) {
      ok(await supabase.from("occorrenze").update({ is_completed: completata }).eq("id", id));
    },

    async aggiungiOccorrenza(ripassoId, scheduled_at) {
      ok(
        await supabase
          .from("occorrenze")
          .insert({ id: randomUUID(), ripasso_id: ripassoId, scheduled_at, is_manual_1h: false })
      );
    },

    async spostaOccorrenze(spostamenti) {
      if (spostamenti.length === 0) return;
      ok(
        await supabase.rpc("sposta_occorrenze", {
          ids: spostamenti.map((s) => s.id),
          istanti: spostamenti.map((s) => s.scheduled_at),
        })
      );
    },
  };
}
