-- ============================================================================
-- Migration: Atomic Ripasso creation (crea_ripasso_completo)
-- Fixes partial write vulnerabilities where a ripasso is inserted but its 
-- occurrences fail due to network drops, leaving an orphaned review.
-- ============================================================================

create or replace function public.crea_ripasso_completo(
  p_id uuid,
  p_titolo text,
  p_note text,
  p_occorrenze jsonb
) returns public.ripassi
language plpgsql security invoker
as $$
declare
  v_ripasso public.ripassi;
begin
  -- 1. Upsert Ripasso
  insert into public.ripassi (id, user_id, titolo, note)
  values (p_id, auth.uid(), p_titolo, p_note)
  on conflict (id) do update 
  set titolo = excluded.titolo, note = excluded.note
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

revoke execute on function public.crea_ripasso_completo(uuid, text, text, jsonb) from public;
grant execute on function public.crea_ripasso_completo(uuid, text, text, jsonb) to authenticated;

notify pgrst, 'reload schema';

