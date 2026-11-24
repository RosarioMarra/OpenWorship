-- =====================================================================
-- OPEN WORSHIP - PREFERITI SALVATI ONLINE
-- Da eseguire una volta in Supabase > SQL Editor.
--
-- Ogni utente vede, aggiunge e toglie solo i propri preferiti,
-- e li ritrova su ogni dispositivo. Se un cantico viene eliminato
-- sparisce anche dai preferiti di tutti.
-- =====================================================================

create table if not exists public.preferiti (
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    cantico_id uuid not null references public.cantici (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, cantico_id)
);
alter table public.preferiti enable row level security;

drop policy if exists "preferiti_lettura_propri" on public.preferiti;
drop policy if exists "preferiti_inserimento_propri" on public.preferiti;
drop policy if exists "preferiti_eliminazione_propri" on public.preferiti;

create policy "preferiti_lettura_propri" on public.preferiti
    for select to authenticated using (user_id = auth.uid());
create policy "preferiti_inserimento_propri" on public.preferiti
    for insert to authenticated with check (user_id = auth.uid());
create policy "preferiti_eliminazione_propri" on public.preferiti
    for delete to authenticated using (user_id = auth.uid());

create index if not exists preferiti_cantico_idx on public.preferiti (cantico_id);
