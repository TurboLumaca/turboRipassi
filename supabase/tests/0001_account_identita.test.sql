-- ============================================================================
-- Ripassa — verification script for migrations/0001_account_identita.sql
--
-- WHAT THIS IS FOR
-- The migration's security rests on behaviour, not on shape: "a squatted
-- address cannot capture the victim's account" is not something you can see by
-- reading a table definition. This script provokes each situation on real
-- rows and asserts what came out.
--
-- WHY THE EMAILS DIFFER IN CASE, NOT JUST BY VALUE
-- `auth.users` has its own native unique index on `email` for non-SSO users
-- (`users_email_partial_key`), so two rows can never carry the byte-identical
-- address — Supabase itself refuses that INSERT. But the index is on the raw
-- column, not `lower(email)`, so "Tizio@Example.com" and "tizio@example.com"
-- coexist there just fine even though they are the same mailbox. That gap is
-- exactly what `public.account.email_canonica` (= lower(trim(email))) exists
-- to close, and it is a real gap: this is not a contrived edge case, it is
-- what actually happened to this project's own account (one identity used
-- "nikita.piraino3@gmail.com", the other "nikitapiraino3@gmail.com" — a dot,
-- not a case difference, but the same kind of gap; case is the variant this
-- script can reach without superuser rights on `auth`, see below).
--
-- WHAT THIS SCRIPT DOES NOT COVER
-- Gmail's dot-insensitivity is deliberately NOT normalised away (see
-- docs/account-identita.md, "Normalizzazione dell'indirizzo") — two dotted
-- variants of a Gmail address stay two accounts until merged by hand with
-- `public.unisci_account`. Case differences are, so they are what this script
-- exercises; the linking logic is identical either way, since both collapse
-- to the same `email_canonica` once one form is chosen to be canonical.
--
-- HOW TO RUN
--   Supabase dashboard -> SQL Editor -> paste this file -> Run.
--   Run it AFTER the migration, on a staging project or a Supabase branch.
--
-- It ends in ROLLBACK: every row it creates disappears, including the fake
-- auth users. Nothing is left behind — but run it somewhere disposable
-- anyway, because a failed assertion aborts the transaction at that point and
-- you want to be free to re-run it without thinking about production.
--
-- Output: one NOTICE per passing check. The first failure raises and stops —
-- so "no exception" is the pass condition, and the notices tell you how far it
-- got.
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

-- A sign-up, as GoTrue would write it. `p_confermato` is the state at
-- creation: true for OAuth (Google vouches for the address), false for a
-- password sign-up waiting on its confirmation e-mail.
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
    jsonb_build_object('provider', p_provider,
                       'providers', jsonb_build_array(p_provider)),
    '{}'::jsonb,
    p_creato, p_creato
  );
  return v_id;
end;
$$;

do $$
declare
  v_google      uuid;
  v_password    uuid;
  v_squatter    uuid;
  v_vittima     uuid;
  v_disattivato uuid;

  v_acc_google   uuid;
  v_acc_password uuid;
  v_acc_squatter uuid;
  v_acc_vittima  uuid;
begin
  -- ==========================================================================
  raise notice '--- 1. Un accesso Google crea un account verificato ---';
  -- ==========================================================================
  v_google := pg_temp.crea_utente('tizio@example.com', 'google', true, now() - interval '10 days');

  select account_id into v_acc_google from public.identita where auth_user_id = v_google;

  perform pg_temp.verifica(v_acc_google is not null,
    'l''accesso Google riceve un account');
  perform pg_temp.verifica(
    (select email_verificata from public.account where id = v_acc_google),
    'l''account e'' verificato: Google garantisce l''indirizzo');

  insert into public.ripassi (titolo, account_id, user_id)
  values ('Ripasso creato da Google', v_acc_google, v_google);

  -- ==========================================================================
  raise notice '--- 2. Registrazione con password, stessa casella scritta diversa, non confermata ---';
  -- ==========================================================================
  -- "Tizio@Example.com" is a different string from "tizio@example.com" as far
  -- as auth.users is concerned (its unique index is not case-folding), so
  -- this INSERT succeeds even though it is the same mailbox. That gap is
  -- exactly what email_canonica closes.
  v_password := pg_temp.crea_utente('Tizio@Example.com', 'email', false, now() - interval '5 days');

  select account_id into v_acc_password from public.identita where auth_user_id = v_password;

  -- Questa e' la difesa, non un difetto: alla creazione nessuno ha ancora
  -- dimostrato di possedere la casella, quindi non si entra in un account
  -- altrui. Il collegamento arriva alla conferma (punto 3).
  perform pg_temp.verifica(v_acc_password is distinct from v_acc_google,
    'la registrazione non confermata NON entra nell''account Google');
  perform pg_temp.verifica(
    not (select email_verificata from public.account where id = v_acc_password),
    'e il suo account nasce non verificato');

  insert into public.ripassi (titolo, account_id, user_id)
  values ('Ripasso creato con la password', v_acc_password, v_password);

  -- ==========================================================================
  raise notice '--- 3. Cliccato il link di conferma: i due mondi si uniscono ---';
  -- ==========================================================================
  update auth.users set email_confirmed_at = now() where id = v_password;

  perform pg_temp.verifica(
    (select account_id from public.identita where auth_user_id = v_password) = v_acc_google,
    'la conferma aggancia l''identita'' all''account gia'' esistente');
  perform pg_temp.verifica(
    not exists (select 1 from public.account where id = v_acc_password),
    'l''account temporaneo sparisce invece di restare orfano');
  perform pg_temp.verifica(
    (select count(*) from public.ripassi where account_id = v_acc_google) = 2,
    'i ripassi delle due parti finiscono nello stesso account');

  -- ==========================================================================
  raise notice '--- 4. Indirizzo squattato: la vittima non viene consegnata ---';
  -- ==========================================================================
  -- Chi registra in anticipo la mail di un altro con una password scelta da
  -- se'. Non possiede la casella, quindi non confermera' mai.
  v_squatter := pg_temp.crea_utente('Vittima@Example.com', 'email', false, now() - interval '30 days');
  select account_id into v_acc_squatter from public.identita where auth_user_id = v_squatter;

  insert into public.ripassi (titolo, account_id, user_id)
  values ('Esca dello squatter', v_acc_squatter, v_squatter);

  -- La vittima arriva mesi dopo con Google, che restituisce l'indirizzo in
  -- forma canonica minuscola.
  v_vittima := pg_temp.crea_utente('vittima@example.com', 'google', true, now());
  select account_id into v_acc_vittima from public.identita where auth_user_id = v_vittima;

  perform pg_temp.verifica(v_acc_vittima is distinct from v_acc_squatter,
    'la vittima NON finisce nell''account di chi ha squattato l''indirizzo');
  perform pg_temp.verifica(
    (select count(*) from public.ripassi where account_id = v_acc_vittima) = 0,
    'e non si porta dietro i dati piazzati dallo squatter');
  perform pg_temp.verifica(
    (select count(*) from public.ripassi where account_id = v_acc_squatter) = 1,
    'i due account restano separati in entrambe le direzioni');

  -- ==========================================================================
  raise notice '--- 5. Con "Confirm email" disattivato si degrada, non si rompe ---';
  -- ==========================================================================
  -- Una registrazione con password nata gia' confermata: nessuno ha provato
  -- niente, quindi non le si concede di collegarsi. Il prezzo e' un doppione.
  v_disattivato := pg_temp.crea_utente('TIZIO@EXAMPLE.COM', 'email', true, now());

  perform pg_temp.verifica(
    (select account_id from public.identita where auth_user_id = v_disattivato)
      is distinct from v_acc_google,
    'una password nata confermata resta fuori: al massimo un doppione, mai un furto');

  -- ==========================================================================
  raise notice '--- 6. Invarianti del database ---';
  -- ==========================================================================
  begin
    insert into public.account (email_canonica, email_verificata)
    values ('tizio@example.com', true);
    raise exception 'FALLITO: accettati due account verificati sullo stesso indirizzo';
  exception
    when unique_violation then
      raise notice 'OK       un solo account verificato per indirizzo, imposto dall''indice';
  end;

  perform pg_temp.verifica(public.account_corrente() is null,
    'senza sessione non esiste un account corrente: la RLS nega tutto');

  -- ==========================================================================
  raise notice '--- 7. Scollegare un accesso non cancella i ripassi ---';
  -- ==========================================================================
  -- Il motivo per cui la FK su user_id e'' passata da cascade a set null.
  delete from auth.users where id = v_google;

  perform pg_temp.verifica(
    (select count(*) from public.ripassi where account_id = v_acc_google) = 2,
    'i ripassi sopravvivono alla cancellazione dell''accesso che li ha creati');
  perform pg_temp.verifica(
    (select user_id from public.ripassi where titolo = 'Ripasso creato da Google') is null,
    'la colonna di audit si azzera invece di trascinarsi via la riga');
  perform pg_temp.verifica(
    exists (select 1 from public.account where id = v_acc_google),
    'e l''account resta, raggiungibile dall''altra identita''');

  raise notice '=== Tutti i controlli superati ===';
end $$;

rollback;
