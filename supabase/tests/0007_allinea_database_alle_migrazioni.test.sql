-- ============================================================================
-- Ripassa — verification script for migrations/0007_allinea_database_alle_migrazioni.sql
--
-- WHAT THIS IS FOR
-- 0007 does two things a catalog query cannot vouch for.
--
--   1. It repairs the collision between 0001's `on delete set null` and 0002's
--      trg_*_user_id trigger. The trigger put the deleted login's id back on
--      the row, so the row failed its own foreign key and deleting a user was
--      refused outright — while every object involved still looked perfectly
--      correct in pg_catalog. Only actually deleting a login shows it.
--
--   2. It writes supabase_migrations.schema_migrations, so that "which
--      migrations has this database seen" stops being a question you answer by
--      reading pg_proc.
--
-- It also covers riordina_allegati and sposta_occorrenze, which had no test of
-- their own: 0006 exists because riordina_allegati turned out to be missing
-- from the remote project and nothing but a PGRST202 in the app said so.
--
-- HOW TO RUN
--   Supabase dashboard -> SQL Editor -> paste this file -> Run.
--   Or: SUPABASE_DB_URL='postgresql://...' npm run test:db
--   Run it AFTER the migration, on a staging project or a Supabase branch.
--
-- It ends in ROLLBACK: every row it creates disappears, fake auth users
-- included. Output is one NOTICE per passing check; the first failure raises
-- and stops, so "no exception" is the pass condition.
-- ============================================================================

begin;

create or replace function pg_temp.verifica(condizione boolean, descrizione text)
returns void
language plpgsql
as $$
begin
  if condizione then
    raise notice 'OK       %', descrizione;
  else
    raise exception 'FALLITO: %', descrizione;
  end if;
end;
$$;

create or replace function pg_temp.crea_utente(p_email text, p_provider text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) values (
    v_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', p_email, '',
    now(),
    jsonb_build_object('provider', p_provider,
                       'providers', jsonb_build_array(p_provider)),
    '{}'::jsonb, now(), now()
  );
  return v_id;
end;
$$;

-- Become that identity, the way PostgREST does: the role plus the claim
-- auth.uid() reads. Refuses to continue if the switch did not take, because
-- postgres bypasses RLS and every check below would then pass for the wrong
-- reason.
create or replace function pg_temp.accedi(p_auth_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_auth_user_id,
                                       'role', 'authenticated')::text,
                     true);
  set local role authenticated;

  if current_user <> 'authenticated' then
    raise exception 'FALLITO: il cambio di ruolo non ha avuto effetto (current_user = %)', current_user;
  end if;
  if public.account_corrente() is null then
    raise exception 'FALLITO: la sessione simulata non risolve un account';
  end if;
end;
$$;

do $$
declare
  v_prima    uuid;   -- the identity that creates everything
  v_seconda  uuid;   -- a sibling identity: same person, same account
  v_estranea uuid;   -- somebody else entirely

  v_account  uuid;
  v_altro    uuid;

  v_ripasso  uuid;
  v_all      uuid[];
  v_occ      uuid[];
  v_istanti  timestamptz[];
  v_prima_data timestamptz;
begin
  -- ==========================================================================
  raise notice '--- 0. Preparazione: un account con due accessi, e un estraneo ---';
  -- ==========================================================================
  v_prima   := pg_temp.crea_utente('tizio@example.com', 'google');
  v_seconda := pg_temp.crea_utente('Tizio@Example.com', 'google');
  v_estranea := pg_temp.crea_utente('caio@example.com', 'google');

  select account_id into v_account from public.identita where auth_user_id = v_prima;
  select account_id into v_altro   from public.identita where auth_user_id = v_estranea;

  insert into public.ripassi (titolo, account_id, user_id)
  values ('Teorema di Bayes', v_account, v_prima)
  returning id into v_ripasso;

  -- Three attachments, in the order they were added.
  insert into public.allegati (ripasso_id, account_id, user_id,
                               display_name, original_file_name, storage_path, order_index)
  select v_ripasso, v_account, v_prima,
         'Foglio ' || i, 'foglio' || i || '.pdf', 'drive-id-' || i, i - 1
    from generate_series(1, 3) as i;

  select array_agg(id order by order_index) into v_all
    from public.allegati where ripasso_id = v_ripasso;

  insert into public.occorrenze (ripasso_id, account_id, user_id, scheduled_at)
  select v_ripasso, v_account, v_prima, date_trunc('day', now()) + (i || ' days')::interval
    from generate_series(1, 3) as i;

  select array_agg(id order by scheduled_at) into v_occ
    from public.occorrenze where ripasso_id = v_ripasso;

  -- ==========================================================================
  raise notice '--- 1. riordina_allegati riordina in un colpo solo (0006) ---';
  -- ==========================================================================
  perform pg_temp.accedi(v_prima);

  -- Drag the third one to the top: the whole new order goes in one call, so a
  -- dropped connection cannot leave order_index with holes or duplicates.
  perform public.riordina_allegati(array[v_all[3], v_all[1], v_all[2]]);

  perform pg_temp.verifica(
    (select array_agg(id order by order_index) from public.allegati where ripasso_id = v_ripasso)
      = array[v_all[3], v_all[1], v_all[2]],
    'gli allegati seguono l''ordine passato alla RPC');
  perform pg_temp.verifica(
    (select array_agg(distinct order_index) from public.allegati where ripasso_id = v_ripasso)
      = array[0, 1, 2],
    'e order_index resta 0..N-1, senza buchi ne'' doppioni');

  -- ==========================================================================
  raise notice '--- 2. sposta_occorrenze rischedula in un colpo solo (0003) ---';
  -- ==========================================================================
  select array_agg(scheduled_at - interval '2 days' order by scheduled_at)
    into v_istanti
    from public.occorrenze where ripasso_id = v_ripasso;

  perform public.sposta_occorrenze(v_occ, v_istanti);

  perform pg_temp.verifica(
    (select array_agg(scheduled_at order by scheduled_at) from public.occorrenze
      where ripasso_id = v_ripasso) = v_istanti,
    'spostare la prima data trascina tutte le altre insieme');

  -- ==========================================================================
  raise notice '--- 3. Le due RPC non sono security definer: la RLS decide ---';
  -- ==========================================================================
  select min(scheduled_at) into v_prima_data from public.occorrenze where ripasso_id = v_ripasso;

  perform pg_temp.accedi(v_estranea);

  -- Rows the USING clause hides are not refused, they simply do not match.
  perform public.riordina_allegati(array[v_all[1], v_all[2], v_all[3]]);
  perform public.sposta_occorrenze(v_occ, array[now(), now(), now()]::timestamptz[]);

  reset role;
  perform pg_temp.verifica(
    (select array_agg(id order by order_index) from public.allegati where ripasso_id = v_ripasso)
      = array[v_all[3], v_all[1], v_all[2]],
    'un estraneo non riordina gli allegati di un altro account');
  perform pg_temp.verifica(
    (select min(scheduled_at) from public.occorrenze where ripasso_id = v_ripasso) = v_prima_data,
    'ne'' sposta le sue occorrenze');

  -- ==========================================================================
  raise notice '--- 4. La colonna di audit resta congelata (0002, invariato) ---';
  -- ==========================================================================
  perform pg_temp.accedi(v_seconda);

  update public.ripassi set user_id = v_seconda where id = v_ripasso;
  perform pg_temp.verifica(
    (select user_id from public.ripassi where id = v_ripasso) = v_prima,
    'un''identita'' sorella non puo'' intestarsi la riga');

  -- The new branch in 0007 must not become a way for a client to erase its
  -- own tracks: while the login exists, clearing is put back like forging.
  update public.ripassi set user_id = null where id = v_ripasso;
  perform pg_temp.verifica(
    (select user_id from public.ripassi where id = v_ripasso) = v_prima,
    'e non puo'' nemmeno azzerarla finche'' quell''accesso esiste');

  reset role;

  -- ==========================================================================
  raise notice '--- 5. La regressione di 0007: cancellare un accesso ---';
  -- ==========================================================================
  -- Before the fix this raised 23503 on <tabella>_user_id_fkey, because the
  -- trigger put the vanished id back on the row the FK was clearing.
  delete from auth.users where id = v_prima;

  perform pg_temp.verifica(
    exists (select 1 from public.ripassi where id = v_ripasso),
    'il ripasso sopravvive alla cancellazione dell''accesso che lo ha creato');
  perform pg_temp.verifica(
    (select count(*) from public.occorrenze where ripasso_id = v_ripasso) = 3
    and (select count(*) from public.allegati where ripasso_id = v_ripasso) = 3,
    'occorrenze e allegati sopravvivono insieme a lui');
  perform pg_temp.verifica(
    (select user_id from public.ripassi where id = v_ripasso) is null
    and not exists (select 1 from public.occorrenze
                     where ripasso_id = v_ripasso and user_id = v_prima)
    and not exists (select 1 from public.allegati
                     where ripasso_id = v_ripasso and user_id = v_prima),
    'la colonna di audit si azzera su tutte e tre le tabelle');
  perform pg_temp.verifica(
    exists (select 1 from public.account where id = v_account),
    'e l''account resta, raggiungibile dall''altro accesso');

  -- The whole point of the sibling identity: the data is still reachable.
  perform pg_temp.accedi(v_seconda);
  perform pg_temp.verifica(
    exists (select 1 from public.ripassi where id = v_ripasso),
    'l''identita'' rimasta continua a vedere i ripassi dell''account');
  reset role;

  -- Il trigger gira come postgres: non deve essere raggiungibile come RPC.
  perform pg_temp.verifica(
    not has_function_privilege('anon', 'public.mantieni_user_id()', 'execute')
    and not has_function_privilege('authenticated', 'public.mantieni_user_id()', 'execute'),
    'il trigger security definer non e'' esposto su /rest/v1/rpc');

  raise notice '=== Tutti i controlli superati ===';
end $$;

-- ==========================================================================
-- 6. Lo storico: una riga per ogni file applicato, e nessuna in piu'.
--    `version` deve coincidere col prefisso numerico del file, perche' e'
--    quello che la CLI confronta con supabase/migrations.
-- ==========================================================================
do $$
declare
  attese constant text[] := array['0001', '0002', '0003', '0005', '0006', '0007'];
  trovate text[];
begin
  select array_agg(version order by version)
    into trovate
    from supabase_migrations.schema_migrations;

  perform pg_temp.verifica(trovate @> attese,
    'lo storico registra tutte le migrazioni applicate');
  perform pg_temp.verifica(not (trovate @> array['0004']),
    'e non registra la 0004, che vive in supabase/futuro e non e'' mai stata applicata');
  perform pg_temp.verifica(
    not exists (select 1 from supabase_migrations.schema_migrations
                 where version !~ '^[0-9]+$'),
    'nessuna versione fuori dallo schema di numerazione dei file');

  raise notice '=== Storico verificato ===';
end $$;

rollback;
