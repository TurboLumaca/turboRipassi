-- ---------------------------------------------------------------------------
-- 0006 — riordina_allegati (e riallineamento di sposta_occorrenze).
--
-- Entrambe le funzioni erano definite solo in schema.sql, che sul progetto
-- remoto non è mai stato applicato per intero: la chiamata RPC falliva con
-- PGRST202 ("Could not find the function public.riordina_allegati(ids)").
-- sposta_occorrenze aveva già la 0003, ma nemmeno quella risulta applicata,
-- quindi la si ricrea qui: `create or replace` rende il doppio passaggio
-- innocuo se la 0003 venisse eseguita in seguito.
--
-- Deliberatamente NON security definer, come nel resto dello schema: è RLS a
-- decidere quali righe il chiamante può toccare.
-- ---------------------------------------------------------------------------

-- Riordino degli allegati in un'unica transazione. Con N update separati un
-- fallimento parziale lasciava order_index duplicato o con buchi, e spostare
-- un elemento di una posizione costava un round trip per allegato.
create or replace function public.riordina_allegati(ids uuid[])
returns void
language sql
as $$
  update public.allegati a
     set order_index = nuovo.posizione - 1
    from unnest(ids) with ordinality as nuovo(id, posizione)
   where a.id = nuovo.id;
$$;

-- Rischedulazione delle occorrenze in un'unica transazione: spostare una data
-- trascina quelle successive, e una connessione caduta a metà lascerebbe il
-- calendario spostato solo in parte.
create or replace function public.sposta_occorrenze(ids uuid[], istanti timestamptz[])
returns void
language sql
as $$
  update public.occorrenze o
     set scheduled_at = nuovo.istante
    from unnest(ids, istanti) as nuovo(id, istante)
   where o.id = nuovo.id;
$$;

-- PostgREST tiene in cache lo schema: senza questo, la funzione appena creata
-- resta invisibile all'API fino al riavvio.
notify pgrst, 'reload schema';
