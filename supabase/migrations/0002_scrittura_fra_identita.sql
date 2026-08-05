-- ============================================================================
-- TurboRipassi — migration: let any identity of an account write the account's
-- rows.
--
-- THE BUG
-- 0001 made the *account* the owner, so that signing in with Google and with
-- e-mail reach the same ripassi. Reading works: every USING clause compares
-- `account_id` against `account_corrente()`.
--
-- Writing does not. The three WITH CHECK clauses also carry
--
--     (user_id is null or user_id = auth.uid())
--
-- and `user_id` is the identity that *created* the row. An UPDATE does not
-- change it, so Postgres re-checks the creator's id against the id of whoever
-- is signed in now. As soon as an account has two identities — which is the
-- whole point of 0001 — every row created by the other one becomes readable
-- but unwritable:
--
--     ERROR 42501: new row violates row-level security policy for table "occorrenze"
--
-- In the app that is: the completion circle refuses to fill, edits to an older
-- ripasso will not save, attachments cannot be reordered — while anything
-- created since the last sign-in works fine, which is what makes it look
-- random.
--
-- THE FIX
-- The clause was there to stop a caller *claiming* to be someone else on the
-- way in, and for INSERT that is still worth checking: `user_id` is being set
-- then, and a row is free to record no identity but not a foreign one.
--
-- On UPDATE the column is not the caller's to set at all, so the check is
-- replaced by something stronger: a BEFORE UPDATE trigger pins `user_id` to
-- the value it already had. Forging it stops being refused and starts being
-- impossible — and an honest write by a sibling identity goes through.
--
-- Ownership is unchanged: `account_id = account_corrente()` still decides
-- every read and every write, and the parent-ripasso check still prevents
-- hanging a row off another account's ripasso. Nothing here widens what an
-- account can reach; it only stops one account fighting itself.
--
-- HOW TO RUN
--   Supabase dashboard -> SQL Editor -> paste this file -> Run.
--   Idempotent: re-running it is a no-op. Run it once per environment, after
--   0001_account_identita.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- The audit column is written once, at INSERT, and never again.
--
-- Assigning OLD unconditionally rather than raising on a mismatch keeps the
-- client honest without making it careful: `update ... set is_completed`
-- through PostgREST sends only the columns it means to change, but a full-row
-- write would otherwise have to remember to carry `user_id` through untouched.
-- ----------------------------------------------------------------------------
create or replace function public.mantieni_user_id()
returns trigger
language plpgsql
as $$
begin
  new.user_id := old.user_id;
  return new;
end;
$$;

do $$
declare
  t             text;
  -- The row belongs to the caller's account. For the two child tables the
  -- parent ripasso must belong to it as well: without that, the foreign key
  -- alone would let a caller attach a row carrying their own account_id to
  -- another account's ripasso_id.
  proprieta     text;
  figlio        text :=
    ' and exists (select 1 from public.ripassi r'
    || ' where r.id = ripasso_id and r.account_id = public.account_corrente())';
begin
  foreach t in array array['ripassi', 'occorrenze', 'allegati'] loop
    proprieta := 'account_id = public.account_corrente()'
              || case when t = 'ripassi' then '' else figlio end;

    -- 0001 wrote one `for all` policy per table. It is replaced by four
    -- per-command ones, because INSERT and UPDATE no longer want the same
    -- WITH CHECK.
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select using (%s)', t || '_select', t, proprieta);

    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format(
      'create policy %I on public.%I for insert with check (%s and (user_id is null or user_id = auth.uid()))',
      t || '_insert', t, proprieta);

    -- The one that was broken: no user_id clause, because the trigger below
    -- now guarantees what the clause was trying to check.
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format(
      'create policy %I on public.%I for update using (%s) with check (%s)',
      t || '_update', t, proprieta, proprieta);

    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format(
      'create policy %I on public.%I for delete using (%s)', t || '_delete', t, proprieta);

    execute format('drop trigger if exists %I on public.%I', 'trg_' || t || '_user_id', t);
    execute format(
      'create trigger %I before update on public.%I'
      || ' for each row execute function public.mantieni_user_id()',
      'trg_' || t || '_user_id', t);
  end loop;
end $$;

comment on function public.mantieni_user_id() is
  'Freezes the audit column user_id on UPDATE: it records who created the row, '
  'and no later write may change it. Replaces the WITH CHECK clause that used '
  'to block a sibling identity of the same account from writing.';
