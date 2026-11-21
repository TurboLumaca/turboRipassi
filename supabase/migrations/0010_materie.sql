-- ============================================================================
-- Migration 0010 — le materie: un tag colorato per ogni ripasso.
--
-- Due oggetti:
--
--   public.materie           l'elenco dei tag di un account: nome e colore.
--                            Poche righe per persona, scritto di rado.
--   ripassi.materia_id       il tag scelto per un ripasso. Nullable: ogni
--                            ripasso esistente resta valido senza materia, e
--                            "nessuna materia" è una scelta legittima.
--
-- La FK è composta, (materia_id, account_id): la sola FK su materia_id
-- permetterebbe di agganciare a un proprio ripasso la materia di un altro
-- account, perché i controlli di integrità referenziale non passano dalla RLS.
-- `on delete set null (materia_id)` azzera solo la colonna della materia —
-- `account_id` è not null e non deve toccarlo — e cancellare una materia
-- lascia i ripassi senza tag invece di eliminarli.
--
-- I tag iniziali (le materie universitarie e le aree di vita) vengono
-- seminati per ogni account esistente e, con un trigger, per ogni nuovo
-- account. Il seme è per account e non una lista cablata nel client: ogni
-- persona poi li rinomina o ne aggiunge a modo suo.
--
-- La RPC di creazione prende `p_materia_id`. La vecchia firma viene eliminata
-- invece di essere affiancata, per lo stesso motivo della 0008: con un
-- parametro in più con default le due convivrebbero e una chiamata PostgREST
-- con gli stessi argomenti nominati sarebbe ambigua.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabella
-- ----------------------------------------------------------------------------
create table if not exists public.materie (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null default public.account_corrente()
             references public.account (id) on delete cascade,
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  nome       text not null check (char_length(btrim(nome)) between 1 and 40),
  -- Esadecimale a sei cifre: il client lo usa tale e quale come colore.
  colore     text not null check (colore ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Necessario come bersaglio della FK composta di ripassi.
  unique (id, account_id)
);

-- Un nome per account, senza distinguere maiuscole: "fisica" e "Fisica"
-- sono la stessa materia, e due chip con lo stesso nome non si
-- distinguerebbero nel filtro.
create unique index if not exists materie_nome_uniq
  on public.materie (account_id, lower(btrim(nome)));

drop trigger if exists trg_materie_updated on public.materie;
create trigger trg_materie_updated
  before update on public.materie
  for each row execute function public.set_updated_at();

drop trigger if exists trg_materie_user_id on public.materie;
create trigger trg_materie_user_id
  before update on public.materie
  for each row execute function public.mantieni_user_id();

-- ----------------------------------------------------------------------------
-- RLS: stesse regole di `ripassi`, per comando.
-- ----------------------------------------------------------------------------
alter table public.materie enable row level security;

drop policy if exists materie_select on public.materie;
create policy materie_select on public.materie
  for select using (account_id = public.account_corrente());

drop policy if exists materie_insert on public.materie;
create policy materie_insert on public.materie
  for insert with check (
    account_id = public.account_corrente()
    and (user_id is null or user_id = auth.uid())
  );

drop policy if exists materie_update on public.materie;
create policy materie_update on public.materie
  for update using (account_id = public.account_corrente())
  with check (account_id = public.account_corrente());

drop policy if exists materie_delete on public.materie;
create policy materie_delete on public.materie
  for delete using (account_id = public.account_corrente());

grant select, insert, update, delete on public.materie to authenticated;

-- ----------------------------------------------------------------------------
-- La colonna su ripassi, con la FK composta.
-- ----------------------------------------------------------------------------
alter table public.ripassi add column if not exists materia_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'ripassi_materia_fkey'
       and conrelid = 'public.ripassi'::regclass
  ) then
    alter table public.ripassi
      add constraint ripassi_materia_fkey
      foreign key (materia_id, account_id)
      references public.materie (id, account_id)
      on delete set null (materia_id);
  end if;
end $$;

create index if not exists ripassi_materia_idx on public.ripassi (account_id, materia_id);

comment on column public.ripassi.materia_id is
  'Materia (tag colorato) del ripasso. Null = nessuna materia. Cancellare la materia azzera la colonna.';

-- ----------------------------------------------------------------------------
-- I tag iniziali.
--
-- Le materie universitarie sono tutte azzurre; le aree di vita hanno il
-- colore che avevano nell'elenco da cui provengono. Idempotente: il
-- vincolo di unicità sul nome fa sì che un secondo passaggio non aggiunga
-- niente, e non riporta in vita un tag che l'utente ha rinominato.
-- ----------------------------------------------------------------------------
create or replace function public.semina_materie(p_account uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  insert into public.materie (account_id, user_id, nome, colore)
  select p_account, null, v.nome, v.colore
    from (values
      ('Tecnologie web',          '#5AA9E6'),
      ('Mdp',                     '#5AA9E6'),
      ('Filosofia della scienza', '#5AA9E6'),
      ('Telecomunicazioni',       '#5AA9E6'),
      ('Ricerca operativa',       '#5AA9E6'),
      ('Ingegneria del software', '#5AA9E6'),
      ('Fisica',                  '#5AA9E6'),
      ('OOP-AUREA',               '#5AA9E6'),
      ('Basi di dati',            '#5AA9E6'),
      ('Merton num',              '#5AA9E6'),
      ('Analisi',                 '#5AA9E6'),
      ('Ambassador Academy',      '#B38AF2'),
      ('Libri',                   '#5B9BEF'),
      ('Personal skill',          '#4E9C7C'),
      ('Learning skill',          '#3FA8E3'),
      ('Professional skills',     '#EE6A5F'),
      ('Learnis',                 '#5B9BEF'),
      ('Identità',                '#D8B07A'),
      ('Escapologia fiscale',     '#B38AF2'),
      ('Better CallQ',            '#EE6A5F')
    ) as v(nome, colore)
  on conflict do nothing;
$$;

-- Non raggiungibile dall'app: semina un account a scelta di chi la chiama.
revoke all on function public.semina_materie(uuid) from public;
revoke all on function public.semina_materie(uuid) from anon;
revoke all on function public.semina_materie(uuid) from authenticated;

create or replace function public.semina_materie_nuovo_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.semina_materie(new.id);
  return new;
end;
$$;

-- Funzione da trigger: non deve comparire come RPC chiamabile dall'app.
revoke all on function public.semina_materie_nuovo_account() from public;
revoke all on function public.semina_materie_nuovo_account() from anon;
revoke all on function public.semina_materie_nuovo_account() from authenticated;

drop trigger if exists trg_account_semina_materie on public.account;
create trigger trg_account_semina_materie
  after insert on public.account
  for each row execute function public.semina_materie_nuovo_account();

-- Gli account che esistono già.
do $$
declare
  a record;
begin
  for a in select id from public.account loop
    perform public.semina_materie(a.id);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- La RPC di creazione prende la materia.
-- ----------------------------------------------------------------------------
drop function if exists public.crea_ripasso_completo(uuid, text, text, jsonb, text);

create or replace function public.crea_ripasso_completo(
  p_id uuid,
  p_titolo text,
  p_note text,
  p_occorrenze jsonb,
  p_domanda text default null,
  p_materia_id uuid default null
) returns public.ripassi
language plpgsql security invoker
as $$
declare
  v_ripasso public.ripassi;
begin
  -- 1. Upsert Ripasso
  insert into public.ripassi (id, user_id, titolo, note, domanda, materia_id)
  values (p_id, auth.uid(), p_titolo, p_note, p_domanda, p_materia_id)
  on conflict (id) do update
  set titolo = excluded.titolo,
      note = excluded.note,
      domanda = excluded.domanda,
      materia_id = excluded.materia_id
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

revoke execute on function public.crea_ripasso_completo(uuid, text, text, jsonb, text, uuid) from public;
revoke execute on function public.crea_ripasso_completo(uuid, text, text, jsonb, text, uuid) from anon;
grant execute on function public.crea_ripasso_completo(uuid, text, text, jsonb, text, uuid) to authenticated;

insert into supabase_migrations.schema_migrations (version, name) values
  ('0010', 'materie')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
