-- =====================================================================
-- OPEN WORSHIP - NOTIFICHE PUSH
-- Da eseguire una volta in Supabase > SQL Editor.
--
-- Crea la tabella dei dispositivi registrati per le notifiche push.
-- Ogni utente può registrare, vedere ed eliminare solo i propri dispositivi.
-- La funzione "notifica-avviso" legge la tabella con la chiave di servizio
-- (che ignora queste regole) per inviare la notifica a tutti.
-- =====================================================================

create table if not exists public.push_subscriptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    endpoint text not null unique,
    p256dh text not null,
    auth text not null,
    user_agent text,
    created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_lettura_proprie" on public.push_subscriptions;
drop policy if exists "push_inserimento_proprie" on public.push_subscriptions;
drop policy if exists "push_modifica_proprie" on public.push_subscriptions;
drop policy if exists "push_eliminazione_proprie" on public.push_subscriptions;

create policy "push_lettura_proprie" on public.push_subscriptions
    for select to authenticated using (user_id = auth.uid());
create policy "push_inserimento_proprie" on public.push_subscriptions
    for insert to authenticated with check (user_id = auth.uid());
create policy "push_modifica_proprie" on public.push_subscriptions
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_eliminazione_proprie" on public.push_subscriptions
    for delete to authenticated using (user_id = auth.uid());

-- Verifica: deve elencare 4 regole
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'push_subscriptions'
order by policyname;
