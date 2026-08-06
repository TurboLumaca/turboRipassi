-- ---------------------------------------------------------------------------
-- 0003 — sposta_occorrenze: rescheduling several dates in one transaction.
--
-- Moving one occurrence normally moves the ones after it: you write down today
-- something you studied two days ago, the first date goes back two days, and
-- the remaining four have to follow or the whole spacing is measured from the
-- wrong day. Done as N separate updates, a connection dropped halfway leaves
-- the schedule partly shifted — a state no screen can explain and the user
-- cannot undo. One statement either moves all of them or none.
--
-- Idempotent (create or replace) and re-runnable, like the rest of the schema.
-- Deliberately NOT security definer: RLS keeps deciding which rows the caller
-- may touch, exactly as it does for riordina_allegati.
-- ---------------------------------------------------------------------------
create or replace function public.sposta_occorrenze(ids uuid[], istanti timestamptz[])
returns void
language sql
as $$
  update public.occorrenze o
     set scheduled_at = nuovo.istante
    from unnest(ids, istanti) as nuovo(id, istante)
   where o.id = nuovo.id;
$$;
