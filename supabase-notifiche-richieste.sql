-- =====================================================================
-- OPEN WORSHIP - NOTIFICA AGLI AMMINISTRATORI PER LE NUOVE RICHIESTE
-- Da eseguire una volta in Supabase > SQL Editor
-- (dopo supabase-membri.sql e supabase-notifiche-push.sql),
-- con la funzione "notifica-richiesta" già pubblicata
-- (supabase/functions/notifica-richiesta/index.ts).
--
-- Quando qualcuno entra per la prima volta e resta in attesa, il database
-- chiama la funzione, che manda una notifica push SOLO agli amministratori.
-- =====================================================================

-- Una richiesta si notifica una volta sola
alter table public.membri add column if not exists notificato_il timestamptz;
update public.membri set notificato_il = coalesce(notificato_il, now());

-- Dispositivi degli amministratori (la usa solo la funzione, con la chiave di servizio)
create or replace function public.push_amministratori()
returns table (id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = public, auth
as $$
    select s.id, s.endpoint, s.p256dh, s.auth
    from public.push_subscriptions s
    join auth.users u on u.id = s.user_id
    join public.amministratori a on lower(a.email) = lower(u.email);
$$;
revoke all on function public.push_amministratori() from public, anon, authenticated;
grant execute on function public.push_amministratori() to service_role;

-- Nuova richiesta in attesa -> chiamata alla funzione
-- (la chiave è quella pubblica "anon" dell'app, la stessa di script.js)
drop trigger if exists "notifica-richieste-accesso" on public.membri;
create trigger "notifica-richieste-accesso"
    after insert on public.membri
    for each row
    when (new.stato = 'in_attesa')
    execute function supabase_functions.http_request(
        'https://tgwiazgovhecxquvzzhn.supabase.co/functions/v1/notifica-richiesta',
        'POST',
        '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnd2lhemdvdmhlY3hxdXZ6emhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5OTA2NjcsImV4cCI6MjA5MDU2NjY2N30.srb3N0_csi4qBFBFyVeUMWueIWWidwV7vVcOLg0LJs8"}',
        '{}',
        '5000'
    );
