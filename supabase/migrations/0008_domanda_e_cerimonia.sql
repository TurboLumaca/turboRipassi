-- ============================================================================
-- Migration 0008 — la domanda del richiamo e la cerimonia di promozione.
--
-- Due colonne su `ripassi`, entrambe nullable, entrambe senza default.
--
--   domanda            il prompt che apre il richiamo, separato dalle note.
--                      Separato e non ricavato dal titolo perché la struttura
--                      prompt/risposta deve essere esplicita mentre si scrive
--                      il concetto: la lista mostra la domanda e mai la
--                      risposta, ed è ciò che impedisce di spuntare una voce
--                      senza aver richiamato niente.
--
--   ceremony_shown_at  quando la Cerimonia di Promozione è stata mostrata.
--                      Sul server e non sul dispositivo: una volta sola per
--                      concetto, non una volta sola per telefono. Una
--                      celebrazione ripetibile non celebra niente.
--
-- Nullable per necessità e non per comodità: ogni ripasso creato prima di
-- oggi non ha una domanda, e inventargliene una al posto dell'utente sarebbe
-- peggio che non averla.
-- ============================================================================

alter table public.ripassi add column if not exists domanda text;
alter table public.ripassi add column if not exists ceremony_shown_at timestamptz;

comment on column public.ripassi.domanda is
  'Prompt del richiamo, mostrato prima della risposta. Null sui ripassi anteriori alla 0008.';
comment on column public.ripassi.ceremony_shown_at is
  'Istante in cui la Cerimonia di Promozione a Permanente e'' stata mostrata. Null finche'' non lo e'' stata.';

-- ---------------------------------------------------------------------------
-- La RPC di creazione prende la domanda.
--
-- La vecchia firma a quattro argomenti viene eliminata invece di essere
-- affiancata: con `p_domanda default null` le due convivrebbero, e una
-- chiamata PostgREST con quattro argomenti nominati corrisponderebbe a
-- entrambe — ambiguita' a runtime, cioe' la creazione di un ripasso che
-- smette di funzionare senza che nessuno abbia toccato il client.
-- Il default sul nuovo parametro copre comunque i client che non lo inviano.
-- ---------------------------------------------------------------------------
drop function if exists public.crea_ripasso_completo(uuid, text, text, jsonb);

create or replace function public.crea_ripasso_completo(
  p_id uuid,
  p_titolo text,
  p_note text,
  p_occorrenze jsonb,
  p_domanda text default null
) returns public.ripassi
language plpgsql security invoker
as $$
declare
  v_ripasso public.ripassi;
begin
  -- 1. Upsert Ripasso
  insert into public.ripassi (id, user_id, titolo, note, domanda)
  values (p_id, auth.uid(), p_titolo, p_note, p_domanda)
  on conflict (id) do update
  set titolo = excluded.titolo,
      note = excluded.note,
      domanda = excluded.domanda
  returning * into v_ripasso;

  -- 2. Upsert Occorrenze
  insert into public.occorrenze (id, ripasso_id, user_id, scheduled_at, is_manual_1h)
  select
    (elem->>'id')::uuid,
    p_id,
    auth.uid(),
    (elem->>'scheduled_at')::timestamptz,
    coalesce((elem->>'is_manual_1h')::boolean, false)
  from jsonb_array_elements(p_occorrenze) as elem
  on conflict (id) do nothing;

  return v_ripasso;
end;
$$;

revoke execute on function public.crea_ripasso_completo(uuid, text, text, jsonb, text) from public;
revoke execute on function public.crea_ripasso_completo(uuid, text, text, jsonb, text) from anon;
grant execute on function public.crea_ripasso_completo(uuid, text, text, jsonb, text) to authenticated;

insert into supabase_migrations.schema_migrations (version, name) values
  ('0008', 'domanda_e_cerimonia')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
