-- ============================================================================
-- TurboRipassi — verification script for migrations/0002_scrittura_fra_identita.sql
--
-- WHAT THIS IS FOR
-- 0002 claims two things at once, and they pull in opposite directions:
--   * a sibling identity of the same account may now write rows it did not
--     create (the bug 0002 fixes), and
--   * nobody may write a row belonging to another account, or forge the
--     audit column while doing it (what must not be lost along the way).
-- Neither is visible in a table definition, so this script signs in as real
-- roles and tries.
--
-- WHY IT SWITCHES ROLE, UNLIKE THE 0001 SCRIPT
-- RLS does not apply to the table owner, and the SQL Editor runs as
-- `postgres`. A check written as postgres would pass no matter what the
-- policies say. So the fixtures are created as postgres, and every assertion
-- that is about a policy runs after `set local role authenticated` with a
-- forged `request.jwt.claims` — which is exactly what PostgREST does for a
-- signed-in user.
--
-- HOW TO RUN
--   Supabase dashboard -> SQL Editor -> paste this file -> Run.
--   Run it AFTER the migration, on a staging project or a Supabase branch.
--
-- It ends in ROLLBACK: every row it creates disappears, including the fake
-- auth users. Run it somewhere disposable anyway — a failed assertion aborts
-- the transaction where it stands.
--
-- Output: one NOTICE per passing check. The first failure raises and stops.
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

-- A sign-up, as GoTrue would write it. Confirmed on creation = OAuth, which
-- is the case that links to an existing account (see 0001).
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
-- auth.uid() reads.
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

  -- Without this the whole script is worthless: postgres bypasses RLS, so if
  -- the role switch ever stopped taking effect every policy check below would
  -- pass for the wrong reason. Fail loudly instead.
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
  v_seconda  uuid;   -- the sibling identity, same person, same account
  v_estranea uuid;   -- somebody else entirely

  v_account  uuid;
  v_altro    uuid;

  v_ripasso  uuid;
  v_occ      uuid;
  v_esito    boolean;
  v_righe    bigint;
begin
  -- ==========================================================================
  raise notice '--- 0. Due identita'' che convergono su un solo account ---';
  -- ==========================================================================
  -- Same mailbox, written in two cases: auth.users keeps them apart (its
  -- unique index does not fold case), email_canonica does not. This is the
  -- situation 0001 created on purpose and 0002 has to make writable.
  v_prima   := pg_temp.crea_utente('tizio@example.com', 'google');
  v_seconda := pg_temp.crea_utente('Tizio@Example.com', 'google');

  select account_id into v_account  from public.identita where auth_user_id = v_prima;
  select account_id into v_altro    from public.identita where auth_user_id = v_seconda;

  perform pg_temp.verifica(v_account is not null and v_account = v_altro,
    'le due identita'' condividono un solo account');

  v_estranea := pg_temp.crea_utente('caio@example.com', 'google');
  select account_id into v_altro from public.identita where auth_user_id = v_estranea;
  perform pg_temp.verifica(v_altro is distinct from v_account,
    'la terza identita'' ha un account proprio');

  -- Created by the FIRST identity: this is the audit value that used to make
  -- the row unwritable for the second one.
  insert into public.ripassi (titolo, account_id, user_id)
  values ('Teorema di Bayes', v_account, v_prima)
  returning id into v_ripasso;

  insert into public.occorrenze (ripasso_id, scheduled_at, account_id, user_id)
  values (v_ripasso, now() - interval '2 days', v_account, v_prima)
  returning id into v_occ;

  -- ==========================================================================
  raise notice '--- 1. La seconda identita'' vede e scrive cio'' che ha creato la prima ---';
  -- ==========================================================================
  perform pg_temp.accedi(v_seconda);

  perform pg_temp.verifica(
    exists (select 1 from public.occorrenze where id = v_occ),
    'legge l''occorrenza creata dall''altra identita''');

  -- The regression: before 0002 this raised
  -- 42501 "new row violates row-level security policy".
  update public.occorrenze set is_completed = true where id = v_occ;

  perform pg_temp.verifica(
    (select is_completed from public.occorrenze where id = v_occ),
    'il tondino si riempie: l''UPDATE passa');

  update public.ripassi set titolo = 'Teorema di Bayes (rivisto)' where id = v_ripasso;
  perform pg_temp.verifica(
    (select titolo from public.ripassi where id = v_ripasso) = 'Teorema di Bayes (rivisto)',
    'e anche la modifica del ripasso viene salvata');

  -- ==========================================================================
  raise notice '--- 2. La colonna di audit resta quella di chi ha creato la riga ---';
  -- ==========================================================================
  perform pg_temp.verifica(
    (select user_id from public.occorrenze where id = v_occ) = v_prima,
    'una scrittura normale non riscrive user_id');

  -- Trying on purpose: the trigger pins it back rather than refusing, so the
  -- write succeeds and the column does not move.
  update public.occorrenze set user_id = v_seconda where id = v_occ;
  perform pg_temp.verifica(
    (select user_id from public.occorrenze where id = v_occ) = v_prima,
    'e nemmeno un tentativo esplicito di cambiarlo lo sposta');

  -- ==========================================================================
  raise notice '--- 3. Un INSERT non puo'' spacciarsi per un''altra identita'' ---';
  -- ==========================================================================
  begin
    insert into public.occorrenze (ripasso_id, scheduled_at, account_id, user_id)
    values (v_ripasso, now(), v_account, v_estranea);
    v_esito := true;
  exception when insufficient_privilege then
    v_esito := false;
  end;
  perform pg_temp.verifica(not v_esito,
    'inserire una riga intestata a un''identita'' altrui viene rifiutato');

  -- What the app actually does: send neither column and let the defaults
  -- decide. This must keep working.
  insert into public.occorrenze (ripasso_id, scheduled_at)
  values (v_ripasso, now() + interval '1 day');
  perform pg_temp.verifica(
    (select count(*) from public.occorrenze
      where ripasso_id = v_ripasso and user_id = v_seconda) = 1,
    'senza colonne di proprieta'' i default assegnano account e identita'' correnti');

  -- ==========================================================================
  raise notice '--- 4. L''isolamento fra account diversi e'' intatto ---';
  -- ==========================================================================
  perform pg_temp.accedi(v_estranea);

  perform pg_temp.verifica(
    not exists (select 1 from public.occorrenze where id = v_occ),
    'un altro account non vede l''occorrenza');

  -- A row the USING clause hides is not refused, it is simply not there:
  -- the UPDATE succeeds having matched nothing.
  update public.occorrenze set is_completed = false where id = v_occ;
  get diagnostics v_righe = row_count;
  perform pg_temp.verifica(v_righe = 0,
    'e il suo UPDATE non tocca alcuna riga');

  reset role;
  perform pg_temp.verifica(
    (select is_completed from public.occorrenze where id = v_occ),
    'la riga e'' rimasta come l''aveva lasciata il proprietario');

  -- Hanging a row off another account's ripasso, with one's own account_id:
  -- refused by the parent check, not by the foreign key.
  perform pg_temp.accedi(v_estranea);
  select account_id into v_altro from public.identita where auth_user_id = v_estranea;
  begin
    insert into public.occorrenze (ripasso_id, scheduled_at, account_id)
    values (v_ripasso, now(), v_altro);
    v_esito := true;
  exception when insufficient_privilege then
    v_esito := false;
  end;
  perform pg_temp.verifica(not v_esito,
    'e non puo'' agganciare un''occorrenza al ripasso di un altro account');

  reset role;
  raise notice '=== Tutti i controlli superati ===';
end $$;

rollback;
