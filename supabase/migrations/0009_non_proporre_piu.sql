-- ============================================================================
-- Migration 0009 — «Non proporre più».
--
-- Una colonna su `ripassi`:
--
--   non_proporre_piu   il concetto resta nell'archivio — storico, ricerca,
--                      allegati — ma le sue occorrenze non tornano più in
--                      lista, nella coda del giorno, nella micro-sessione né
--                      nelle notifiche. È l'alternativa all'eliminazione per
--                      chi ha finito di lavorare su un argomento senza voler
--                      cancellare la propria storia.
--
-- Not null con default false: ogni ripasso esistente è "proposto", e il
-- comportamento dell'app non cambia finché l'utente non lo chiede. Sul server
-- e non sul dispositivo, come ogni fatto del concetto: il flag segue il
-- ripasso su ogni account e ogni telefono.
-- ============================================================================

alter table public.ripassi add column if not exists non_proporre_piu boolean not null default false;

comment on column public.ripassi.non_proporre_piu is
  'Vero quando l''utente ha chiesto di non proporre più il concetto: resta in archivio, esce da lista, coda, micro-sessione e notifiche.';

insert into supabase_migrations.schema_migrations (version, name) values
  ('0009', 'non_proporre_piu')
on conflict (version) do nothing;

notify pgrst, 'reload schema';
