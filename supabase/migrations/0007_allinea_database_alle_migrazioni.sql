-- ---------------------------------------------------------------------------
-- 0007 — allinea_database_alle_migrazioni: make the database say, and do, what
-- 0001..0006 promise.
--
-- WHERE THIS COMES FROM
-- An audit of the remote project against supabase/migrations. Every object the
-- earlier files create is there — they were each run by hand from the SQL
-- Editor, the way their own headers say to — but two things were not right.
--
-- 1. THE DATABASE HAD NO MEMORY OF THEM
-- `supabase_migrations.schema_migrations`, the ledger every Supabase tool
-- reads, did not exist on this project at all. "Has 0003 been applied?" could
-- only be answered by going and looking at pg_proc — which is how the missing
-- riordina_allegati that 0006 exists to fix went unnoticed until the app
-- failed with PGRST202. Worse, the first `supabase db push` ever pointed at
-- this project would find an empty ledger, conclude nothing had run, and
-- replay 0001 — whose backfill rewrites the ownership columns and merges
-- accounts. It is written to be idempotent and would very probably be a no-op,
-- but "probably a no-op" is not something to discover on production data.
--
-- 2. ONE PROMISE HAD QUIETLY STOPPED BEING TRUE
-- 0001 moved the foreign key on `user_id` from ON DELETE CASCADE to ON DELETE
-- SET NULL, precisely so that removing a login would not take the ripassi it
-- created with it. 0002 then added a BEFORE UPDATE trigger that pins `user_id`
-- to its old value, to stop a sibling identity being locked out of its own
-- account's rows.
--
-- The two collide. Postgres implements SET NULL as an UPDATE, that UPDATE goes
-- through the trigger like any other, and the trigger dutifully puts back the
-- id of the login being deleted. The row then fails its own foreign key and
-- the whole delete is refused:
--
--     ERROR 23503: insert or update on table "ripassi" violates foreign key
--                  constraint "ripassi_user_id_fkey"
--
-- Concretely: deleting a user from the Supabase dashboard, or through the
-- GoTrue admin API, fails for anyone who has ever created a ripasso — the one
-- case 0001 went out of its way to support. The 0001 test script catches it at
-- step 7; nobody re-ran it after 0002 landed.
--
-- The fix keeps both intentions. `user_id` is still written once and frozen,
-- with a single exception carved out for the case that motivated the FK: the
-- column may go to null when the login it names no longer exists. That is not
-- a hole a client can reach through — while the login is alive, clearing the
-- column is reverted exactly like forging it.
--
-- WHAT THIS FILE DOES NOT DO
-- Repeat any DDL from the earlier files. Everything they create is already in
-- place — mantieni_user_id is rewritten because it is wrong, not because it is
-- missing. The checks below prove all the rest before anything is written, so a
-- database where those files never ran gets an error here instead of a ledger
-- that lies about them.
--
-- Idempotent: re-running it re-checks, re-replaces the function with the same
-- body, and inserts nothing new.
--
-- HOW TO RUN
--   Supabase dashboard -> SQL Editor -> paste this file -> Run.
--   As `postgres`: it reads pg_catalog and writes a private schema.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. Proof. Every object below is something 0001..0006 (or the schema.sql
--    they build on) creates. A missing one aborts the file — nothing is
--    repaired and nothing is recorded — and says exactly what is absent.
-- ===========================================================================
do $$
declare
  -- The three tables that carry user data. Everything 0001 and 0002 do to one
  -- of them they do to all three, so the checks are written once and applied
  -- across the set rather than copied out nine times.
  tabelle  constant text[] := array['ripassi', 'occorrenze', 'allegati'];
  mancanti text[];
begin
  select array_agg(oggetto order by oggetto) into mancanti
  from (
    -- -- per-table: 0001 (ownership), 0002 (per-command RLS), schema.sql -----
    select format('%s.%s: %s', 'public', t, oggetto) as oggetto
      from unnest(tabelle) as t
      cross join lateral (values
        ('colonna account_id not null',
         (select a.attnotnull
            from pg_attribute a
           where a.attrelid = to_regclass('public.' || t)
             and a.attname = 'account_id' and not a.attisdropped)),

        ('default account_id = account_corrente()',
         (select pg_get_expr(d.adbin, d.adrelid) like '%account_corrente()'
            from pg_attrdef d
            join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
           where d.adrelid = to_regclass('public.' || t) and a.attname = 'account_id')),

        -- Deleting the person takes their rows with them...
        ('vincolo ' || t || '_account_id_fkey (on delete cascade)',
         (select c.confdeltype = 'c'
            from pg_constraint c
           where c.conrelid = to_regclass('public.' || t)
             and c.conname = t || '_account_id_fkey')),

        -- ...while deleting one of their logins must not: the audit column is
        -- cleared and the row stays. Section 2 below is what makes this
        -- constraint actually work again.
        ('vincolo ' || t || '_user_id_fkey (on delete set null)',
         (select c.confdeltype = 'n'
            from pg_constraint c
           where c.conrelid = to_regclass('public.' || t)
             and c.conname = t || '_user_id_fkey')),

        ('row level security attiva',
         (select c.relrowsecurity from pg_class c where c.oid = to_regclass('public.' || t))),

        ('policy ' || t || '_select',
         exists (select 1 from pg_policies p
                  where p.schemaname = 'public' and p.tablename = t
                    and p.policyname = t || '_select')),
        ('policy ' || t || '_insert',
         exists (select 1 from pg_policies p
                  where p.schemaname = 'public' and p.tablename = t
                    and p.policyname = t || '_insert')),
        ('policy ' || t || '_update',
         exists (select 1 from pg_policies p
                  where p.schemaname = 'public' and p.tablename = t
                    and p.policyname = t || '_update')),
        ('policy ' || t || '_delete',
         exists (select 1 from pg_policies p
                  where p.schemaname = 'public' and p.tablename = t
                    and p.policyname = t || '_delete')),

        -- The `for all` policy 0002 replaced. Still present means 0002 never
        -- ran, or something reinstated 0001's version on top of it.
        ('rimozione della vecchia policy ' || t || '_owner',
         not exists (select 1 from pg_policies p
                      where p.schemaname = 'public' and p.tablename = t
                        and p.policyname = t || '_owner')),

        ('trigger trg_' || t || '_updated',
         exists (select 1 from pg_trigger g
                  where g.tgrelid = to_regclass('public.' || t)
                    and g.tgname = 'trg_' || t || '_updated' and not g.tgisinternal)),
        ('trigger trg_' || t || '_user_id',
         exists (select 1 from pg_trigger g
                  where g.tgrelid = to_regclass('public.' || t)
                    and g.tgname = 'trg_' || t || '_user_id' and not g.tgisinternal))
      ) as v(oggetto, presente)
     where not coalesce(presente, false)

    union all

    -- -- everything there is only one of -------------------------------------
    select oggetto from (values
      -- 0001: the person, and the ways they sign in.
      ('tabella public.account',  to_regclass('public.account')  is not null),
      ('tabella public.identita', to_regclass('public.identita') is not null),
      ('row level security su public.account',
       (select relrowsecurity from pg_class where oid = to_regclass('public.account'))),
      ('row level security su public.identita',
       (select relrowsecurity from pg_class where oid = to_regclass('public.identita'))),
      ('policy account_proprio',
       exists (select 1 from pg_policies
                where schemaname = 'public' and tablename = 'account'
                  and policyname = 'account_proprio')),
      ('policy identita_proprie',
       exists (select 1 from pg_policies
                where schemaname = 'public' and tablename = 'identita'
                  and policyname = 'identita_proprie')),
      -- The invariant the linking rule rests on: at most one *verified*
      -- account per address.
      ('indice unico account_email_verificata_uniq',
       to_regclass('public.account_email_verificata_uniq') is not null),

      -- Functions by exact signature: a different argument type is a different
      -- function, and PostgREST would not find the one the app calls.
      ('funzione account_corrente()',
       to_regprocedure('public.account_corrente()') is not null),
      ('funzione assicura_account()',
       to_regprocedure('public.assicura_account()') is not null),
      ('funzione registra_identita()',
       to_regprocedure('public.registra_identita()') is not null),
      ('funzione registra_identita_per(uuid)',
       to_regprocedure('public.registra_identita_per(uuid)') is not null),
      ('funzione verifica_identita()',
       to_regprocedure('public.verifica_identita()') is not null),
      ('funzione unisci_account(uuid, uuid)',
       to_regprocedure('public.unisci_account(uuid, uuid)') is not null),
      ('funzione set_updated_at()',
       to_regprocedure('public.set_updated_at()') is not null),
      -- 0002
      ('funzione mantieni_user_id()',
       to_regprocedure('public.mantieni_user_id()') is not null),
      -- 0003 / 0006
      ('funzione sposta_occorrenze(uuid[], timestamptz[])',
       to_regprocedure('public.sposta_occorrenze(uuid[], timestamptz[])') is not null),
      ('funzione riordina_allegati(uuid[])',
       to_regprocedure('public.riordina_allegati(uuid[])') is not null),
      -- 0005
      ('funzione crea_ripasso_completo(uuid, text, text, jsonb)',
       to_regprocedure('public.crea_ripasso_completo(uuid, text, text, jsonb)') is not null),

      -- The three RPCs the app calls run as the caller on purpose: RLS, not
      -- the function, decides which rows they may touch. security definer here
      -- would hand every account's rows to anyone who can sign in.
      ('crea_ripasso_completo eseguita come chiamante (non security definer)',
       not (select prosecdef from pg_proc
             where oid = to_regprocedure('public.crea_ripasso_completo(uuid, text, text, jsonb)'))),
      ('riordina_allegati eseguita come chiamante (non security definer)',
       not (select prosecdef from pg_proc
             where oid = to_regprocedure('public.riordina_allegati(uuid[])'))),
      ('sposta_occorrenze eseguita come chiamante (non security definer)',
       not (select prosecdef from pg_proc
             where oid = to_regprocedure('public.sposta_occorrenze(uuid[], timestamptz[])'))),

      -- Grants. 0001 and 0005 both close their RPCs to anon; the two admin
      -- functions are not reachable from the API at all.
      ('assicura_account chiusa ad anon e aperta ad authenticated',
       not has_function_privilege('anon', to_regprocedure('public.assicura_account()'), 'execute')
       and has_function_privilege('authenticated', to_regprocedure('public.assicura_account()'), 'execute')),
      ('crea_ripasso_completo chiusa ad anon e aperta ad authenticated',
       not has_function_privilege('anon', to_regprocedure('public.crea_ripasso_completo(uuid, text, text, jsonb)'), 'execute')
       and has_function_privilege('authenticated', to_regprocedure('public.crea_ripasso_completo(uuid, text, text, jsonb)'), 'execute')),
      ('unisci_account non eseguibile dall''API',
       not has_function_privilege('anon', to_regprocedure('public.unisci_account(uuid, uuid)'), 'execute')
       and not has_function_privilege('authenticated', to_regprocedure('public.unisci_account(uuid, uuid)'), 'execute')),
      ('registra_identita_per non eseguibile dall''API',
       not has_function_privilege('anon', to_regprocedure('public.registra_identita_per(uuid)'), 'execute')
       and not has_function_privilege('authenticated', to_regprocedure('public.registra_identita_per(uuid)'), 'execute')),

      -- 0001's triggers on auth.users: without these a new sign-in gets no
      -- identity, account_corrente() returns null, and the person sees an
      -- empty app.
      ('trigger trg_auth_user_creato su auth.users',
       exists (select 1 from pg_trigger
                where tgrelid = to_regclass('auth.users')
                  and tgname = 'trg_auth_user_creato' and not tgisinternal)),
      ('trigger trg_auth_user_verificato su auth.users',
       exists (select 1 from pg_trigger
                where tgrelid = to_regclass('auth.users')
                  and tgname = 'trg_auth_user_verificato' and not tgisinternal))
    ) as v(oggetto, presente)
     where not coalesce(presente, false)
  ) as mancanze;

  if mancanti is not null then
    raise exception
      'Storico non allineato: % oggetti delle migrazioni 0001..0006 non esistono.%',
      array_length(mancanti, 1),
      e'\n  - ' || array_to_string(mancanti, e'\n  - ')
      using hint =
        'Esegui prima i file mancanti in supabase/migrations (in ordine), poi rilancia questo.';
  end if;

  raise notice 'Schema verificato: 0001..0006 risultano applicati.';
end $$;

-- ===========================================================================
-- 2. The repair: let a login be deleted again.
--
-- Same rule as 0002 — the audit column is written at INSERT and never again —
-- with the one exception the foreign key needs. Reading auth.users is why this
-- is now security definer: `authenticated` cannot see that table, and the
-- branch must be able to tell "the FK is clearing a vanished login" from "a
-- client is trying to erase its own tracks". The pinned search_path keeps the
-- elevated body from resolving names anywhere unexpected.
-- ===========================================================================
create or replace function public.mantieni_user_id()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if new.user_id is distinct from old.user_id then
    -- ON DELETE SET NULL on <tabella>_user_id_fkey: the login is already gone
    -- by the time this fires, so putting its id back would make the row fail
    -- its own foreign key and refuse the delete.
    if new.user_id is null
       and not exists (select 1 from auth.users u where u.id = old.user_id) then
      return new;
    end if;

    -- Everything else — forging another identity's id, or clearing the column
    -- while that login still exists — is silently put back. Assigning rather
    -- than raising keeps honest clients simple: a PostgREST update that sends
    -- the whole row does not have to remember to carry user_id through.
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;

comment on function public.mantieni_user_id() is
  'Freezes the audit column user_id on UPDATE: it records who created the row, '
  'and no later write may change it. The single exception is the FK''s ON DELETE '
  'SET NULL, which clears it when the login it names is deleted — without that '
  'branch the delete fails on ripassi_user_id_fkey (see 0007).';

-- Nothing calls this by name: a trigger function invoked as an RPC only
-- answers 'can only be called as a trigger'. But security definer plus the
-- default public EXECUTE is the shape the linter flags (0028/0029), and a
-- function that runs as postgres has no business being reachable from
-- /rest/v1/rpc at all. Triggers check EXECUTE when they are created, not when
-- they fire, so taking it away leaves trg_*_user_id working.
revoke execute on function public.mantieni_user_id() from public;
revoke execute on function public.mantieni_user_id() from anon;
revoke execute on function public.mantieni_user_id() from authenticated;

-- ===========================================================================
-- 3. The ledger. Same shape the Supabase CLI creates, so the CLI recognises it
--    instead of building a second one beside it. `supabase_migrations` is not
--    an exposed schema, so none of this is reachable through the API.
-- ===========================================================================
create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.schema_migrations (
  version    text primary key,
  statements text[],
  name       text
);

-- `version` is the file's numeric prefix, which is what the CLI compares
-- against the filenames in supabase/migrations — keep the two in step.
-- `statements` stays null on purpose: these rows record that a file ran, not
-- what was in it, and inventing a body for a migration nobody replayed through
-- the CLI would be a worse lie than saying nothing.
--
-- 0004 is deliberately absent: it lives in supabase/futuro/, was never applied,
-- and belongs to the "percorso" feature the standalone conversion removed.
insert into supabase_migrations.schema_migrations (version, name) values
  ('0001', 'account_identita'),
  ('0002', 'scrittura_fra_identita'),
  ('0003', 'sposta_occorrenze'),
  ('0005', 'crea_ripasso_rpc'),
  ('0006', 'riordina_allegati'),
  ('0007', 'allinea_database_alle_migrazioni')
on conflict (version) do nothing;
