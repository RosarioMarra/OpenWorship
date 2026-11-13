-- =====================================================================
-- OPEN WORSHIP - REGOLE DI SICUREZZA PER SUPABASE
-- Da eseguire una volta in Supabase > SQL Editor.
--
-- Cosa fa:
--  1. crea la tabella "amministratori" (chi può modificare cantici e avvisi)
--  2. crea la funzione is_admin() usata dall'app
--  3. attiva la Row Level Security su cantici, avvisi e appunti:
--     - cantici e avvisi: leggono tutti gli utenti autenticati,
--       scrivono/modificano/eliminano solo gli amministratori
--     - appunti: ogni utente vede e modifica solo i propri
--
-- ATTENZIONE: le regole RLS di Supabase si sommano. Se esistono già regole
-- più permissive (es. "tutti possono scrivere") continuano a valere.
-- Per questo il blocco 3 rimuove prima le regole esistenti su queste tre
-- tabelle. I dati NON vengono toccati.
-- =====================================================================

-- 1. Amministratori ----------------------------------------------------
create table if not exists public.amministratori (
    email text primary key
);
alter table public.amministratori enable row level security;
-- Nessuna regola sulla tabella: dall'app non si può leggere né modificare.

insert into public.amministratori (email)
values ('marraros11@gmail.com')
on conflict do nothing;
-- Per aggiungere un altro amministratore:
-- insert into public.amministratori (email) values ('altra.email@gmail.com');

-- 2. Funzione is_admin() ----------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.amministratori a
        where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- 3. Rimozione delle regole esistenti sulle tre tabelle ----------------
do $$
declare r record;
begin
    for r in
        select policyname, tablename from pg_policies
        where schemaname = 'public' and tablename in ('cantici', 'avvisi', 'appunti')
    loop
        execute format('drop policy %I on public.%I', r.policyname, r.tablename);
    end loop;
end $$;

-- 4. Cantici -----------------------------------------------------------
alter table public.cantici enable row level security;
create policy "cantici_lettura_utenti" on public.cantici
    for select to authenticated using (true);
create policy "cantici_inserimento_admin" on public.cantici
    for insert to authenticated with check (public.is_admin());
create policy "cantici_modifica_admin" on public.cantici
    for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "cantici_eliminazione_admin" on public.cantici
    for delete to authenticated using (public.is_admin());

-- 5. Avvisi ------------------------------------------------------------
alter table public.avvisi enable row level security;
create policy "avvisi_lettura_utenti" on public.avvisi
    for select to authenticated using (true);
create policy "avvisi_inserimento_admin" on public.avvisi
    for insert to authenticated with check (public.is_admin());
create policy "avvisi_modifica_admin" on public.avvisi
    for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "avvisi_eliminazione_admin" on public.avvisi
    for delete to authenticated using (public.is_admin());

-- 6. Appunti (privati per utente) --------------------------------------
alter table public.appunti enable row level security;
create policy "appunti_solo_proprietario" on public.appunti
    for all to authenticated
    using (user_id::text = auth.uid()::text)
    with check (user_id::text = auth.uid()::text);

-- 7. Verifica: deve elencare 9 regole ----------------------------------
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('cantici', 'avvisi', 'appunti')
order by tablename, policyname;
