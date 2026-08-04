-- ============================================================================
-- Ripassa — migration: separate "account" from "login identity".
--
-- WHY
-- Ownership used to be `auth.users.id`. But an auth user is one *way of
-- signing in*, not a person: signing up with email/password and signing in
-- with Google produce two rows in auth.users even for the same mailbox, so
-- the same person ended up with two disjoint sets of ripassi.
--
-- The fix is to name the two concepts separately:
--   account   — the person. Owns ripassi, occorrenze, allegati.
--   identita  — one way that person signs in. N per account, 1 per auth user.
-- Any identity resolves to the same account, so the data follows the person
-- rather than the login button they happened to press.
--
-- LINKING RULE (this is the security-sensitive part)
-- A new identity joins an existing account only when the e-mail is verified
-- on both sides. Otherwise anyone could pre-register victim@example.com with
-- a password they choose, wait for the victim to sign in with Google, and be
-- handed their account. Concretely:
--   * OAuth identities (Google) arrive already verified -> may link on INSERT.
--   * `email` identities never link on INSERT, only when the confirmation
--     e-mail is actually clicked (the UPDATE trigger below). This holds even
--     if someone turns "Confirm email" off in the Supabase dashboard: the
--     worst case then is a duplicate account, never a stolen one.
--
-- HOW TO RUN
--   Supabase dashboard -> SQL Editor -> paste this file -> Run.
--   Idempotent: re-running it is a no-op. Run it once per environment, after
--   `schema.sql`. Take a backup first — it rewrites the ownership columns.
--   The two triggers at the bottom are created on `auth.users`; the SQL
--   Editor runs as `postgres`, which is allowed to do that. A permission
--   error there means the statement was run as a weaker role.
--
-- KEEP "Confirm email" ENABLED (Authentication -> Providers -> Email).
--   It is on by default. With it off, a password sign-up is born verified and
--   the confirmation event never happens, so email identities can no longer
--   join an existing account -- the original duplicate-account bug comes back
--   for that provider. Nothing becomes unsafe; it just stops being fixed.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- The person.
--
-- `email_canonica` is lower(trim(email)). No further normalization on
-- purpose: stripping dots or +tags is a Gmail-specific rule, and applying it
-- to every domain would merge accounts belonging to different people.
-- ----------------------------------------------------------------------------
create table if not exists public.account (
  id               uuid primary key default gen_random_uuid(),
  email_canonica   text,
  -- True once some identity of this account proved control of the mailbox.
  -- Only verified accounts can be joined by a new identity.
  email_verificata boolean not null default false,
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- One way of signing in. Exactly one row per auth.users row.
--
-- `on delete cascade` here removes the identity, not the account: unlinking a
-- login must never take the user's ripassi with it. That is the whole point
-- of the split.
-- ----------------------------------------------------------------------------
create table if not exists public.identita (
  auth_user_id     uuid primary key references auth.users (id) on delete cascade,
  account_id       uuid not null references public.account (id) on delete cascade,
  provider         text not null,
  email            text,
  email_verificata boolean not null default false,
  created_at       timestamptz not null default now()
);

create index if not exists identita_account_idx on public.identita (account_id);
create index if not exists account_email_idx    on public.account (email_canonica);

-- ----------------------------------------------------------------------------
-- Ownership columns. Added before the functions below, which write them.
--
-- `account_id` becomes the owner. `user_id` stays as an audit column — which
-- identity created the row — and later loses both its NOT NULL and its
-- cascading delete: unlinking a login must not delete the ripassi it happened
-- to create.
-- ----------------------------------------------------------------------------
alter table public.ripassi    add column if not exists account_id uuid;
alter table public.occorrenze add column if not exists account_id uuid;
alter table public.allegati   add column if not exists account_id uuid;

-- ----------------------------------------------------------------------------
-- The account behind the current session. Replaces auth.uid() everywhere
-- ownership is decided.
--
-- SECURITY DEFINER because RLS on `identita` would otherwise need this very
-- function to decide whether the row is readable. STABLE so Postgres
-- evaluates it once per statement instead of once per row.
-- ----------------------------------------------------------------------------
create or replace function public.account_corrente()
returns uuid
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select i.account_id from public.identita i where i.auth_user_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- Moves everything owned by `sorgente` onto `destinazione`, then drops the
-- now-empty source account.
--
-- Admin-only: it is the one operation that can hand one person's data to
-- another, so it is not reachable from the app (see the REVOKE below). It
-- exists for the recovery pass further down and for support work from the
-- SQL Editor.
--
-- Duplicate ripassi are left as duplicates. Two accounts of the same person
-- can legitimately hold two reviews with the same title on different
-- schedules, and silently dropping one would destroy data to tidy up a list.
-- ----------------------------------------------------------------------------
create or replace function public.unisci_account(sorgente uuid, destinazione uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if sorgente is null or destinazione is null or sorgente = destinazione then
    return;
  end if;
  if not exists (select 1 from public.account where id = destinazione) then
    raise exception 'Account di destinazione % inesistente', destinazione;
  end if;

  update public.ripassi    set account_id = destinazione where account_id = sorgente;
  update public.occorrenze set account_id = destinazione where account_id = sorgente;
  update public.allegati   set account_id = destinazione where account_id = sorgente;
  update public.identita   set account_id = destinazione where account_id = sorgente;

  delete from public.account where id = sorgente;
end;
$$;

revoke all on function public.unisci_account(uuid, uuid) from public;
revoke all on function public.unisci_account(uuid, uuid) from anon;
revoke all on function public.unisci_account(uuid, uuid) from authenticated;

-- ----------------------------------------------------------------------------
-- Gives an already-existing auth user its account, creating one or joining
-- the account that owns the same verified address.
--
-- Used by the backfill, and as the recovery branch of verifica_identita for
-- an auth user that predates the triggers. Unlike registra_identita below it
-- trusts a verified address from any provider: an identity that was already
-- in auth.users has been able to sign in for a while, so its verification
-- flag reflects a mailbox the person actually reached.
-- ----------------------------------------------------------------------------
create or replace function public.registra_identita_per(p_auth_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  u            auth.users%rowtype;
  v_email      text;
  v_provider   text;
  v_verificata boolean;
  v_account    uuid;
begin
  select * into u from auth.users where id = p_auth_user_id;
  if not found then
    return null;
  end if;

  select i.account_id into v_account from public.identita i where i.auth_user_id = u.id;
  if v_account is not null then
    return v_account;
  end if;

  v_email      := nullif(lower(trim(u.email)), '');
  v_provider   := coalesce(u.raw_app_meta_data ->> 'provider', 'email');
  v_verificata := u.email_confirmed_at is not null;

  if v_email is not null and v_verificata then
    select a.id into v_account
      from public.account a
     where a.email_canonica = v_email and a.email_verificata;
  end if;

  if v_account is null then
    insert into public.account (email_canonica, email_verificata, created_at)
    values (v_email, v_verificata, u.created_at)
    on conflict (email_canonica) where email_verificata do nothing
    returning id into v_account;

    -- Lost the race (or the index just rejected a duplicate): adopt the
    -- account that owns the address instead of failing.
    if v_account is null then
      select a.id into v_account
        from public.account a
       where a.email_canonica = v_email and a.email_verificata;
    end if;
  end if;

  insert into public.identita
    (auth_user_id, account_id, provider, email, email_verificata, created_at)
  values (u.id, v_account, v_provider, v_email, v_verificata, u.created_at)
  on conflict (auth_user_id) do nothing;

  return v_account;
end;
$$;

revoke all on function public.registra_identita_per(uuid) from public;
revoke all on function public.registra_identita_per(uuid) from anon;
revoke all on function public.registra_identita_per(uuid) from authenticated;

-- ----------------------------------------------------------------------------
-- The account of the caller, created on the spot if it is somehow missing.
--
-- Safe to expose, unlike the function it delegates to: it only ever acts on
-- auth.uid(), so a caller can only repair their own account.
--
-- It exists because an auth user with no identity row cannot read or write
-- anything (account_corrente() returns null, and every policy compares
-- against it). That should not happen — but it would for anyone signing up in
-- the seconds between the backfill and the triggers being installed, and a
-- self-healing call at login is cheaper than a support request.
-- ----------------------------------------------------------------------------
create or replace function public.assicura_account()
returns uuid
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_account uuid;
begin
  if auth.uid() is null then
    raise exception 'Nessuna sessione attiva';
  end if;

  select i.account_id into v_account
    from public.identita i where i.auth_user_id = auth.uid();

  if v_account is null then
    v_account := public.registra_identita_per(auth.uid());
  end if;

  return v_account;
end;
$$;

revoke all on function public.assicura_account() from public;
revoke all on function public.assicura_account() from anon;
grant execute on function public.assicura_account() to authenticated;

-- ----------------------------------------------------------------------------
-- A new auth user appears: give it an account, joining an existing one when
-- that is provably the same person.
--
-- The `provider = 'email'` exclusion is deliberate — see the header. A
-- password identity is born unverified under the recommended configuration,
-- so it takes the UPDATE path below instead.
-- ----------------------------------------------------------------------------
create or replace function public.registra_identita()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_email      text    := nullif(lower(trim(new.email)), '');
  v_provider   text    := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  -- A password sign-up counts as unverified whatever auth.users says: only
  -- clicking the confirmation link proves control of the mailbox, and that is
  -- what the UPDATE trigger reacts to.
  v_verificata boolean := new.email_confirmed_at is not null and v_provider <> 'email';
  v_account    uuid;
begin
  if v_email is not null and v_verificata then
    select a.id into v_account
      from public.account a
     where a.email_canonica = v_email and a.email_verificata;
  end if;

  if v_account is null then
    insert into public.account (email_canonica, email_verificata)
    values (v_email, v_verificata)
    on conflict (email_canonica) where email_verificata do nothing
    returning id into v_account;

    if v_account is null then
      select a.id into v_account
        from public.account a
       where a.email_canonica = v_email and a.email_verificata;
    end if;
  end if;

  insert into public.identita (auth_user_id, account_id, provider, email, email_verificata)
  values (new.id, v_account, v_provider, v_email, v_verificata)
  on conflict (auth_user_id) do nothing;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- The confirmation link was clicked: the mailbox is now proven.
--
-- Either this address is already an established account -- in which case this
-- identity joins it and brings its own account's rows along -- or this
-- account becomes the established one for that address.
--
-- Folding the source account in is safe precisely because it is triggered by
-- the confirmation: until this moment the identity could not sign in, so
-- whatever it owns was created by the person now proving the mailbox.
--
-- Only fires on the first confirmation (see the trigger's WHEN clause). A
-- later address change therefore leaves the account where it is, which is the
-- behaviour we want: the data belongs to the person, not to the address.
-- ----------------------------------------------------------------------------
create or replace function public.verifica_identita()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_email     text := nullif(lower(trim(new.email)), '');
  v_account   uuid;
  v_esistente uuid;
begin
  if v_email is null then
    return new;
  end if;

  select i.account_id into v_account
    from public.identita i where i.auth_user_id = new.id;

  -- No identity yet: an auth user that predates these triggers.
  if v_account is null then
    perform public.registra_identita_per(new.id);
    return new;
  end if;

  update public.identita
     set email = v_email, email_verificata = true
   where auth_user_id = new.id;

  select a.id into v_esistente
    from public.account a
   where a.email_canonica = v_email
     and a.email_verificata
     and a.id <> v_account;

  if v_esistente is not null then
    perform public.unisci_account(v_account, v_esistente);
  else
    update public.account
       set email_canonica = v_email, email_verificata = true
     where id = v_account;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- Backfill.
-- ============================================================================

-- Recovery pass, a no-op on a first run: an earlier interrupted attempt could
-- have left two verified accounts on one address, and the unique index below
-- would then refuse to be created. Oldest account wins, so the one the person
-- has been using the longest survives.
do $$
declare
  r      record;
  v_dest uuid;
  v_src  uuid;
  v_srcs uuid[];
begin
  for r in
    select email_canonica
      from public.account
     where email_canonica is not null and email_verificata
     group by email_canonica
    having count(*) > 1
  loop
    select id into v_dest
      from public.account
     where email_canonica = r.email_canonica and email_verificata
     order by created_at, id
     limit 1;

    select array_agg(id) into v_srcs
      from public.account
     where email_canonica = r.email_canonica and email_verificata and id <> v_dest;

    foreach v_src in array coalesce(v_srcs, '{}'::uuid[]) loop
      perform public.unisci_account(v_src, v_dest);
    end loop;

    raise notice 'Uniti % account duplicati per %',
      coalesce(array_length(v_srcs, 1), 0), r.email_canonica;
  end loop;
end $$;

-- The invariant the whole design rests on: at most one *verified* account per
-- address. Unverified ones may coexist — that is what makes a squatted,
-- never-confirmed sign-up harmless. Created before the backfill so that two
-- auth users sharing a verified address converge on one account instead of
-- creating a duplicate that then has to be merged.
create unique index if not exists account_email_verificata_uniq
  on public.account (email_canonica)
  where email_verificata;

-- One identity per existing auth user, oldest first so the older sign-in owns
-- the account and the newer one joins it.
do $$
declare
  u record;
begin
  for u in select id from auth.users order by created_at loop
    perform public.registra_identita_per(u.id);
  end loop;
end $$;

update public.ripassi r
   set account_id = i.account_id
  from public.identita i
 where i.auth_user_id = r.user_id and r.account_id is null;

update public.occorrenze o
   set account_id = i.account_id
  from public.identita i
 where i.auth_user_id = o.user_id and o.account_id is null;

update public.allegati a
   set account_id = i.account_id
  from public.identita i
 where i.auth_user_id = a.user_id and a.account_id is null;

-- Refuse to continue rather than guess. A row with no account has a user_id
-- pointing at no auth user, which the old cascading FK made impossible; if it
-- happened anyway the rows are worth looking at, not deleting silently.
do $$
declare
  n bigint;
begin
  select (select count(*) from public.ripassi    where account_id is null)
       + (select count(*) from public.occorrenze where account_id is null)
       + (select count(*) from public.allegati   where account_id is null)
    into n;

  if n > 0 then
    raise exception
      'Migrazione interrotta: % righe senza account (user_id orfano).%',
      n,
      e'\nIspezionale con:  select * from public.ripassi where account_id is null;'
      || e'\nPoi assegna un account a mano oppure eliminale, e rilancia il file.';
  end if;
end $$;

-- ============================================================================
-- Constraints, now that every row has an owner.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['ripassi', 'occorrenze', 'allegati'] loop
    execute format(
      'alter table public.%I alter column account_id set not null', t);
    execute format(
      'alter table public.%I alter column account_id set default public.account_corrente()', t);
    execute format(
      'create index if not exists %I on public.%I (account_id)', t || '_account_idx', t);

    if not exists (
      select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
       where ns.nspname = 'public' and rel.relname = t
         and con.conname = t || '_account_id_fkey'
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (account_id) '
        || 'references public.account (id) on delete cascade', t, t || '_account_id_fkey');
    end if;

    -- Swap the auth.users foreign key for a non-destructive one: deleting an
    -- identity must not take the rows it created with it.
    if exists (
      select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
       where ns.nspname = 'public' and rel.relname = t
         and con.conname = t || '_user_id_fkey'
         and con.confdeltype = 'c'   -- 'c' = cascade, the old behaviour
    ) then
      execute format('alter table public.%I drop constraint %I', t, t || '_user_id_fkey');
    end if;

    if not exists (
      select 1
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace ns on ns.oid = rel.relnamespace
       where ns.nspname = 'public' and rel.relname = t
         and con.conname = t || '_user_id_fkey'
    ) then
      execute format(
        'alter table public.%I add constraint %I foreign key (user_id) '
        || 'references auth.users (id) on delete set null', t, t || '_user_id_fkey');
    end if;

    execute format('alter table public.%I alter column user_id drop not null', t);
  end loop;
end $$;

comment on column public.ripassi.user_id is
  'Audit only: identity that created the row. Ownership lives in account_id.';
comment on column public.occorrenze.user_id is
  'Audit only: identity that created the row. Ownership lives in account_id.';
comment on column public.allegati.user_id is
  'Audit only: identity that created the row. Ownership lives in account_id.';

-- ============================================================================
-- RLS, restated in terms of the account.
-- ============================================================================

alter table public.account  enable row level security;
alter table public.identita enable row level security;

-- Read-only for the app: both tables are written by the SECURITY DEFINER
-- functions above, never by the client.
drop policy if exists account_proprio on public.account;
create policy account_proprio on public.account
  for select using (id = public.account_corrente());

drop policy if exists identita_proprie on public.identita;
create policy identita_proprie on public.identita
  for select using (account_id = public.account_corrente());

drop policy if exists ripassi_owner on public.ripassi;
create policy ripassi_owner on public.ripassi
  for all
  using (account_id = public.account_corrente())
  with check (
    account_id = public.account_corrente()
    -- The audit column must tell the truth: a row may record no identity,
    -- but not someone else's.
    and (user_id is null or user_id = auth.uid())
  );

-- Besides the row's own account, verify that the parent ripasso belongs to
-- the same account: without it the FK alone would let a caller attach a row
-- carrying their own account_id to another account's ripasso_id.
drop policy if exists occorrenze_owner on public.occorrenze;
create policy occorrenze_owner on public.occorrenze
  for all
  using (
    account_id = public.account_corrente()
    and exists (
      select 1 from public.ripassi r
       where r.id = ripasso_id and r.account_id = public.account_corrente())
  )
  with check (
    account_id = public.account_corrente()
    and (user_id is null or user_id = auth.uid())
    and exists (
      select 1 from public.ripassi r
       where r.id = ripasso_id and r.account_id = public.account_corrente())
  );

drop policy if exists allegati_owner on public.allegati;
create policy allegati_owner on public.allegati
  for all
  using (
    account_id = public.account_corrente()
    and exists (
      select 1 from public.ripassi r
       where r.id = ripasso_id and r.account_id = public.account_corrente())
  )
  with check (
    account_id = public.account_corrente()
    and (user_id is null or user_id = auth.uid())
    and exists (
      select 1 from public.ripassi r
       where r.id = ripasso_id and r.account_id = public.account_corrente())
  );

-- ============================================================================
-- Triggers on auth.users. Installed last, so the backfill above runs against
-- a table nothing else is rewriting.
-- ============================================================================

drop trigger if exists trg_auth_user_creato on auth.users;
create trigger trg_auth_user_creato
  after insert on auth.users
  for each row execute function public.registra_identita();

drop trigger if exists trg_auth_user_verificato on auth.users;
create trigger trg_auth_user_verificato
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.verifica_identita();
