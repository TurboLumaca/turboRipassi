-- ============================================================================
-- Ripassa — Supabase schema (Postgres)
-- Spec section 5 (revision 2026-07-06) + RLS (section 6) + Storage (section 3)
--
-- Run once in the Supabase dashboard:
--   Project → SQL Editor → paste this file → Run.
-- ============================================================================

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Generic trigger: keeps updated_at current on every UPDATE (LWW, section 6)
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Table: ripassi
-- ----------------------------------------------------------------------------
create table if not exists public.ripassi (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  titolo     text not null,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ripassi_user_idx on public.ripassi (user_id);

drop trigger if exists trg_ripassi_updated on public.ripassi;
create trigger trg_ripassi_updated
  before update on public.ripassi
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Table: occorrenze
-- ----------------------------------------------------------------------------
create table if not exists public.occorrenze (
  id           uuid primary key default gen_random_uuid(),
  ripasso_id   uuid not null references public.ripassi (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  scheduled_at timestamptz not null,
  is_manual_1h boolean not null default false,
  is_completed boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists occorrenze_ripasso_idx  on public.occorrenze (ripasso_id);
create index if not exists occorrenze_user_idx     on public.occorrenze (user_id);
create index if not exists occorrenze_schedule_idx on public.occorrenze (scheduled_at);

drop trigger if exists trg_occorrenze_updated on public.occorrenze;
create trigger trg_occorrenze_updated
  before update on public.occorrenze
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Table: allegati
-- ----------------------------------------------------------------------------
create table if not exists public.allegati (
  id                 uuid primary key default gen_random_uuid(),
  ripasso_id         uuid not null references public.ripassi (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade default auth.uid(),
  display_name       text not null,
  original_file_name text not null,
  storage_path       text not null,
  order_index        integer not null default 0,
  mime_type          text,
  size_bytes         bigint,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists allegati_ripasso_idx on public.allegati (ripasso_id);
create index if not exists allegati_user_idx    on public.allegati (user_id);

drop trigger if exists trg_allegati_updated on public.allegati;
create trigger trg_allegati_updated
  before update on public.allegati
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Reordering attachments, atomically.
--
-- The client used to send one UPDATE per attachment: a partial failure left
-- order_index duplicated or with holes, and moving one item by one position
-- cost one round trip per attachment. This does the whole reordering in a
-- single transaction. SECURITY INVOKER (the default) keeps it subject to the
-- allegati_owner policy below, so it can only touch rows the caller owns.
-- ----------------------------------------------------------------------------
create or replace function public.riordina_allegati(ids uuid[])
returns void
language sql
as $$
  update public.allegati a
     set order_index = nuovo.posizione - 1
    from (select id, ordinality as posizione
            from unnest(ids) with ordinality as t(id, ordinality)) as nuovo
   where a.id = nuovo.id;
$$;

-- ----------------------------------------------------------------------------
-- Row Level Security (section 6): auth.uid() = user_id on every table
-- ----------------------------------------------------------------------------
alter table public.ripassi    enable row level security;
alter table public.occorrenze enable row level security;
alter table public.allegati   enable row level security;

drop policy if exists ripassi_owner on public.ripassi;
create policy ripassi_owner on public.ripassi
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Besides `user_id = auth.uid()` on the row itself, verify that the
-- referenced parent ripasso really belongs to the user (defense in depth:
-- without this check, the FK alone wouldn't prevent attaching a row with
-- one's own user_id to another user's ripasso_id). Isolation required in
-- view of possible future multi-user usage (spec section 5).
drop policy if exists occorrenze_owner on public.occorrenze;
create policy occorrenze_owner on public.occorrenze
  for all using (
    auth.uid() = user_id
    and exists (select 1 from public.ripassi r where r.id = ripasso_id and r.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.ripassi r where r.id = ripasso_id and r.user_id = auth.uid())
  );

drop policy if exists allegati_owner on public.allegati;
create policy allegati_owner on public.allegati
  for all using (
    auth.uid() = user_id
    and exists (select 1 from public.ripassi r where r.id = ripasso_id and r.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.ripassi r where r.id = ripasso_id and r.user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- Realtime (section 6): subscription on ripassi, occorrenze, allegati.
-- The DO block makes the script re-runnable (ADD TABLE fails if already a member).
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['ripassi', 'occorrenze', 'allegati'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Attachment storage: the BINARIES now live on the user's own Google Drive
-- (folder "ripassiProgrammati", OAuth scope drive.file). The
-- allegati.storage_path field holds the Drive file ID, not a bucket path.
-- The Supabase Storage bucket is no longer used: no bucket/policy to create.
-- (If one existed from a previous version, it can be emptied/deleted
--  manually from the Supabase dashboard.)
-- ----------------------------------------------------------------------------
