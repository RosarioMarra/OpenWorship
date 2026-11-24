-- =====================================================================
-- OPEN WORSHIP - SCALETTE DEL SERVIZIO
-- Da eseguire una volta in Supabase > SQL Editor
-- (dopo supabase-amministratori.sql, che crea la funzione is_admin).
--
-- Ogni scaletta ha una data, un titolo facoltativo e l'elenco dei cantici
-- ("voci": [{ "cantico_id": "...", "etichetta": "inizio" }, ...]).
-- Il numero di ogni cantico è la sua posizione nell'elenco.
-- Tutti gli utenti autenticati le leggono, solo gli amministratori le modificano.
-- =====================================================================

create table if not exists public.scalette (
    id uuid primary key default gen_random_uuid(),
    data date not null,
    titolo text not null default '',
    voci jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint scalette_voci_array check (jsonb_typeof(voci) = 'array')
);
alter table public.scalette enable row level security;

drop policy if exists "scalette_lettura_utenti" on public.scalette;
drop policy if exists "scalette_inserimento_admin" on public.scalette;
drop policy if exists "scalette_modifica_admin" on public.scalette;
drop policy if exists "scalette_eliminazione_admin" on public.scalette;

create policy "scalette_lettura_utenti" on public.scalette
    for select to authenticated using (true);
create policy "scalette_inserimento_admin" on public.scalette
    for insert to authenticated with check (public.is_admin());
create policy "scalette_modifica_admin" on public.scalette
    for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "scalette_eliminazione_admin" on public.scalette
    for delete to authenticated using (public.is_admin());

create index if not exists scalette_data_idx on public.scalette (data desc);
