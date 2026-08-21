-- ============================================================================
-- Ripassa — verification script for migrations/0005_crea_ripasso_rpc.sql
--
-- WHAT THIS IS FOR
-- This script validates the atomic creation of reviews (ripassi) and their 
-- occurrences via the `crea_ripasso_completo` RPC. It also specifically 
-- verifies that Row Level Security (RLS) is correctly enforced by the RPC 
-- (since it's declared with SECURITY INVOKER) and that idempotent queue 
-- retries do not overwrite an occurrence's `is_completed` flag.
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

-- Create test users
create or replace function pg_temp.crea_utente(
  p_email      text,
  p_provider   text,
  p_confermato boolean,
  p_creato     timestamptz
) returns uuid
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
    case when p_confermato then p_creato end,
    jsonb_build_object('provider', p_provider, 'providers', jsonb_build_array(p_provider)),
    '{}'::jsonb,
    p_creato, p_creato
  );
  return v_id;
end;
$$;

do $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_acc_a uuid;
  v_acc_b uuid;

  v_ripasso_id uuid := '11111111-1111-1111-1111-111111111111';
  v_occ_id uuid := '22222222-2222-2222-2222-222222222222';
  
  v_occorrenze jsonb := jsonb_build_array(
    jsonb_build_object(
      'id', v_occ_id,
      'scheduled_at', '2026-08-21T00:00:00Z',
      'is_manual_1h', true
    )
  );
  v_occorrenze_senza_manual jsonb := jsonb_build_array(
    jsonb_build_object(
      'id', '33333333-3333-3333-3333-333333333333'::uuid,
      'scheduled_at', '2026-08-21T00:00:00Z'
    )
  );
  
  v_res public.ripassi;
begin
  -- Setup test users
  v_user_a := pg_temp.crea_utente('alice@example.com', 'email', true, now());
  select account_id into v_acc_a from public.identita where auth_user_id = v_user_a;
  
  v_user_b := pg_temp.crea_utente('bob@example.com', 'email', true, now());
  select account_id into v_acc_b from public.identita where auth_user_id = v_user_b;

  -- ==========================================================================
  raise notice '--- 1. Creazione di un ripasso con occorrenze ---';
  -- ==========================================================================
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_user_a::text, true);

  v_res := public.crea_ripasso_completo(v_ripasso_id, 'Ripasso Alice', 'Note Alice', v_occorrenze);

  perform pg_temp.verifica(
    v_res.id = v_ripasso_id and v_res.titolo = 'Ripasso Alice',
    'La RPC restituisce il ripasso inserito'
  );

  perform pg_temp.verifica(
    exists(select 1 from public.ripassi where id = v_ripasso_id and account_id = v_acc_a),
    'Il ripasso è stato inserito e assegnato al corretto account tramite default server-side'
  );

  perform pg_temp.verifica(
    exists(select 1 from public.occorrenze where id = v_occ_id and ripasso_id = v_ripasso_id and is_manual_1h = true),
    'L''occorrenza è stata inserita correttamente con i parametri richiesti'
  );

  -- ==========================================================================
  raise notice '--- 2. Il parametro is_manual_1h mancante ricade a false (coalesce) ---';
  -- ==========================================================================
  v_res := public.crea_ripasso_completo('44444444-4444-4444-4444-444444444444'::uuid, 'Senza parametro', null, v_occorrenze_senza_manual);

  perform pg_temp.verifica(
    (select is_manual_1h from public.occorrenze where id = '33333333-3333-3333-3333-333333333333'::uuid) = false,
    'Senza is_manual_1h nel JSON, il default coalesce(..., false) previene errori di colonna NOT NULL'
  );

  -- ==========================================================================
  raise notice '--- 3. L''idempotenza mantiene intatte le spunte (is_completed) ---';
  -- ==========================================================================
  -- Alice marca l'occorrenza come completata.
  update public.occorrenze set is_completed = true where id = v_occ_id;

  -- La coda offline "rigioca" l'insert originale.
  v_res := public.crea_ripasso_completo(v_ripasso_id, 'Ripasso Alice Aggiornato', 'Nuove note', v_occorrenze);

  perform pg_temp.verifica(
    (select titolo from public.ripassi where id = v_ripasso_id) = 'Ripasso Alice Aggiornato',
    'L''UPSERT del ripasso aggiorna il titolo e le note'
  );

  perform pg_temp.verifica(
    (select is_completed from public.occorrenze where id = v_occ_id) = true,
    'Il ritento NON disfa la spunta messa nel frattempo (on conflict do nothing)'
  );

  -- ==========================================================================
  raise notice '--- 4. Sicurezza RLS e Security Invoker ---';
  -- ==========================================================================
  -- Bob effettua il login.
  perform set_config('request.jwt.claim.sub', v_user_b::text, true);

  -- Bob tenta di sovrascrivere il ripasso di Alice passando lo stesso ID.
  begin
    perform public.crea_ripasso_completo(v_ripasso_id, 'Hack by Bob', 'Hack', v_occorrenze);
    raise exception 'FALLITO: Bob ha potuto sovrascrivere il ripasso di Alice';
  exception
    when others then
      if sqlstate <> '42501' then
        raise exception 'FALLITO: Bob fermato da % (%), non dall''RLS', sqlerrm, sqlstate;
      end if;
      raise notice 'OK       Bob non può sovrascrivere il ripasso di Alice (RLS, SQLSTATE %)', sqlstate;
  end;

  -- Verifica che Bob non abbia alterato i dati di Alice
  reset role; -- Rimuoviamo RLS per controllare il DB reale (torna all'utente della connessione)
  perform pg_temp.verifica(
    (select titolo from public.ripassi where id = v_ripasso_id) = 'Ripasso Alice Aggiornato',
    'Il ripasso di Alice è rimasto intatto'
  );

  -- ==========================================================================
  raise notice '--- 5. Isolamento Account e Permessi GRANT ---';
  -- ==========================================================================
  perform set_config('role', 'authenticated', true);
  v_res := public.crea_ripasso_completo('99999999-9999-9999-9999-999999999999'::uuid, 'Ripasso Bob', 'Note Bob', '[]'::jsonb);
  perform pg_temp.verifica(
    exists(select 1 from public.ripassi where id = '99999999-9999-9999-9999-999999999999'::uuid and account_id = v_acc_b),
    'Bob può creare correttamente i propri ripassi, che finiscono sotto il suo account'
  );

  reset role;

  perform pg_temp.verifica(
    not has_function_privilege('anon', 'public.crea_ripasso_completo(uuid,text,text,jsonb)', 'execute') and
    has_function_privilege('authenticated', 'public.crea_ripasso_completo(uuid,text,text,jsonb)', 'execute'),
    'anon non può eseguire la RPC, authenticated sì'
  );

  raise notice '=== Tutti i controlli superati ===';
end $$;

rollback;
