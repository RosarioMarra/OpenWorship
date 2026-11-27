-- =====================================================================
-- OPEN WORSHIP - ACCESSO SU APPROVAZIONE
-- Da eseguire una volta in Supabase > SQL Editor
-- (dopo supabase-amministratori.sql, supabase-scalette.sql e supabase-preferiti.sql).
--
-- Chi entra con Google per la prima volta resta "in attesa" finché un
-- amministratore non lo approva: fino ad allora non legge né scrive niente.
-- Gli account già registrati quando si esegue questo file sono approvati.
-- Gli amministratori sono sempre approvati.
-- =====================================================================

create table if not exists public.membri (
    user_id uuid primary key references auth.users (id) on delete cascade,
    email text not null,
    nome text not null default '',
    avatar text not null default '',
    stato text not null default 'in_attesa' check (stato in ('in_attesa', 'approvato', 'rifiutato')),
    richiesto_il timestamptz not null default now(),
    deciso_il timestamptz,
    deciso_da text
);
alter table public.membri enable row level security;
-- Nessuna regola sulla tabella: dall'app si passa solo dalle funzioni qui sotto.

-- Chi c'era già è approvato
insert into public.membri (user_id, email, nome, avatar, stato, richiesto_il, deciso_il, deciso_da)
select u.id,
       lower(u.email),
       coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
       coalesce(u.raw_user_meta_data ->> 'avatar_url', ''),
       'approvato', u.created_at, now(), 'automatico'
from auth.users u
where u.email is not null
on conflict (user_id) do nothing;

-- È un membro approvato (o un amministratore) chi sta usando l'app?
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_admin() or exists (
        select 1 from public.membri m
        where m.user_id = auth.uid() and m.stato = 'approvato'
    );
$$;

-- Stato del proprio accesso; al primo ingresso registra la richiesta
create or replace function public.stato_accesso()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
    st text;
    j jsonb := auth.jwt();
begin
    if auth.uid() is null then return 'anonimo'; end if;
    if public.is_admin() then return 'approvato'; end if;
    select m.stato into st from public.membri m where m.user_id = auth.uid();
    if st is null then
        insert into public.membri (user_id, email, nome, avatar)
        values (
            auth.uid(),
            lower(coalesce(j ->> 'email', '')),
            coalesce(j -> 'user_metadata' ->> 'full_name', j -> 'user_metadata' ->> 'name', ''),
            coalesce(j -> 'user_metadata' ->> 'avatar_url', '')
        )
        on conflict (user_id) do nothing;
        st := 'in_attesa';
    end if;
    return st;
end;
$$;

-- Elenco per gli amministratori: prima le richieste in attesa
create or replace function public.list_membri()
returns table (user_id uuid, email text, nome text, avatar text, stato text,
               richiesto_il timestamptz, deciso_il timestamptz, amministratore boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'Solo gli amministratori possono vedere i membri';
    end if;
    return query
        select m.user_id, m.email, m.nome, m.avatar, m.stato, m.richiesto_il, m.deciso_il,
               exists (select 1 from public.amministratori a where lower(a.email) = lower(m.email))
        from public.membri m
        order by (m.stato = 'in_attesa') desc, m.richiesto_il desc;
end;
$$;

-- Approva o rifiuta (gli amministratori; non su sé stessi né su altri amministratori)
create or replace function public.decidi_membro(membro uuid, nuovo_stato text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'Solo gli amministratori possono approvare i membri';
    end if;
    if nuovo_stato not in ('approvato', 'rifiutato') then
        raise exception 'Stato non valido';
    end if;
    if membro = auth.uid() then
        raise exception 'Non puoi cambiare il tuo stesso accesso';
    end if;
    if exists (select 1 from public.membri m
               join public.amministratori a on lower(a.email) = lower(m.email)
               where m.user_id = membro) then
        raise exception 'È un amministratore: toglilo prima dagli amministratori';
    end if;
    update public.membri
    set stato = nuovo_stato, deciso_il = now(), deciso_da = lower(coalesce(auth.jwt() ->> 'email', ''))
    where user_id = membro;
    -- chi perde l'accesso non riceve più le notifiche degli avvisi
    if nuovo_stato = 'rifiutato' then
        delete from public.push_subscriptions where user_id = membro;
    end if;
end;
$$;

revoke all on function public.is_member() from public, anon;
revoke all on function public.stato_accesso() from public, anon;
revoke all on function public.list_membri() from public, anon;
revoke all on function public.decidi_membro(uuid, text) from public, anon;
grant execute on function public.is_member() to authenticated;
grant execute on function public.stato_accesso() to authenticated;
grant execute on function public.list_membri() to authenticated;
grant execute on function public.decidi_membro(uuid, text) to authenticated;

-- Le regole delle tabelle ora chiedono di essere membri approvati ------------
drop policy if exists "cantici_lettura_utenti" on public.cantici;
create policy "cantici_lettura_utenti" on public.cantici
    for select to authenticated using (public.is_member());

drop policy if exists "avvisi_lettura_utenti" on public.avvisi;
create policy "avvisi_lettura_utenti" on public.avvisi
    for select to authenticated using (public.is_member());

drop policy if exists "scalette_lettura_utenti" on public.scalette;
create policy "scalette_lettura_utenti" on public.scalette
    for select to authenticated using (public.is_member());

drop policy if exists "appunti_solo_proprietario" on public.appunti;
create policy "appunti_solo_proprietario" on public.appunti
    for all to authenticated
    using (user_id::text = auth.uid()::text and public.is_member())
    with check (user_id::text = auth.uid()::text and public.is_member());

drop policy if exists "preferiti_lettura_propri" on public.preferiti;
drop policy if exists "preferiti_inserimento_propri" on public.preferiti;
create policy "preferiti_lettura_propri" on public.preferiti
    for select to authenticated using (user_id = auth.uid() and public.is_member());
create policy "preferiti_inserimento_propri" on public.preferiti
    for insert to authenticated with check (user_id = auth.uid() and public.is_member());

drop policy if exists "push_inserimento_proprie" on public.push_subscriptions;
create policy "push_inserimento_proprie" on public.push_subscriptions
    for insert to authenticated with check (user_id = auth.uid() and public.is_member());
