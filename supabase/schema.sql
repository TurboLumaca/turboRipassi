-- ============================================================================
-- Ripassa — Schema Supabase (Postgres)
-- Sezione 5 della spec (revisione 2026-07-06) + RLS (sezione 6) + Storage (sezione 3)
--
-- Da eseguire una sola volta nella dashboard Supabase:
--   Project → SQL Editor → incolla questo file → Run.
-- ============================================================================

-- Necessario per gen_random_uuid()
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Trigger generico: mantiene updated_at aggiornato ad ogni UPDATE (LWW, sez. 6)
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
-- Tabella: ripassi
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
-- Tabella: occorrenze
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
-- Tabella: allegati
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
-- Row Level Security (sezione 6): auth.uid() = user_id su ogni tabella
-- ----------------------------------------------------------------------------
alter table public.ripassi    enable row level security;
alter table public.occorrenze enable row level security;
alter table public.allegati   enable row level security;

drop policy if exists ripassi_owner on public.ripassi;
create policy ripassi_owner on public.ripassi
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists occorrenze_owner on public.occorrenze;
create policy occorrenze_owner on public.occorrenze
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists allegati_owner on public.allegati;
create policy allegati_owner on public.allegati
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Realtime (sezione 6): subscription su ripassi, occorrenze, allegati
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.ripassi;
alter publication supabase_realtime add table public.occorrenze;
alter publication supabase_realtime add table public.allegati;

-- ----------------------------------------------------------------------------
-- Storage bucket per gli allegati (sezione 3) + policy RLS sull'oggetto
-- Convenzione path: <user_id>/<ripasso_id>/<uuid-file>
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('allegati', 'allegati', false)
on conflict (id) do nothing;

drop policy if exists allegati_storage_owner on storage.objects;
create policy allegati_storage_owner on storage.objects
  for all
  using (bucket_id = 'allegati' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'allegati' and auth.uid()::text = (storage.foldername(name))[1]);
