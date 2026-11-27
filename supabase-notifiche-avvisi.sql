-- =====================================================================
-- OPEN WORSHIP - NOTIFICHE DEGLI AVVISI: UNA VOLTA SOLA E SOLO AI MEMBRI
-- Da eseguire una volta in Supabase > SQL Editor
-- (dopo supabase-membri.sql), insieme alla nuova versione della funzione
-- supabase/functions/notifica-avviso/index.ts (pubblicata come "hyper-responder").
--
-- La funzione rilegge l'avviso dal database e lo notifica una sola volta:
-- nessuno può mandare notifiche finte o ripetere quelle vere.
-- Ricevono gli avvisi solo i membri approvati e gli amministratori.
-- =====================================================================

alter table public.avvisi add column if not exists notificato_il timestamptz;
-- gli avvisi già esistenti risultano già notificati
update public.avvisi set notificato_il = coalesce(notificato_il, now());

create or replace function public.push_membri()
returns table (id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = public, auth
as $$
    select s.id, s.endpoint, s.p256dh, s.auth
    from public.push_subscriptions s
    join auth.users u on u.id = s.user_id
    where exists (select 1 from public.membri m where m.user_id = s.user_id and m.stato = 'approvato')
       or exists (select 1 from public.amministratori a where lower(a.email) = lower(u.email));
$$;
revoke all on function public.push_membri() from public, anon, authenticated;
grant execute on function public.push_membri() to service_role;
