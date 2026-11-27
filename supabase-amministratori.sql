-- =====================================================================
-- OPEN WORSHIP - GESTIONE AMMINISTRATORI DALL'APP
-- Da eseguire una volta in Supabase > SQL Editor
-- Si può eseguire anche più volte: non cancella nessun dato.
--
-- Cosa fa:
--  - il proprietario (prima riga qui sotto) ha il controllo totale:
--    è l'unico che può aggiungere o togliere amministratori
--    e nessuno può togliere lui;
--  - gli altri amministratori vedono solo l'elenco.
-- La tabella resta chiusa: l'app passa solo da queste funzioni,
-- che controllano chi le sta usando.
-- =====================================================================

create table if not exists public.amministratori (
    email text primary key
);
alter table public.amministratori enable row level security;
alter table public.amministratori add column if not exists proprietario boolean not null default false;
alter table public.amministratori add column if not exists aggiunto_il timestamptz not null default now();

-- Proprietario: ha il controllo assoluto e non può essere rimosso.
-- PRIMA DI ESEGUIRE sostituisci TUA-EMAIL@esempio.invalid con l'email Google del proprietario.
insert into public.amministratori (email, proprietario)
values ('TUA-EMAIL@esempio.invalid', true)
on conflict (email) do update set proprietario = true;

-- È un amministratore chi sta usando l'app?
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

-- È il proprietario chi sta usando l'app?
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.amministratori a
        where a.proprietario
          and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

-- Elenco (lo vedono solo gli amministratori)
create or replace function public.list_admins()
returns table (email text, proprietario boolean, aggiunto_il timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'Solo gli amministratori possono vedere questo elenco';
    end if;
    return query
        select a.email, a.proprietario, a.aggiunto_il
        from public.amministratori a
        order by a.proprietario desc, a.aggiunto_il, a.email;
end;
$$;

-- Aggiunta (solo il proprietario)
create or replace function public.add_admin(new_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare clean text := lower(trim(coalesce(new_email, '')));
begin
    if not public.is_owner() then
        raise exception 'Solo il proprietario può aggiungere amministratori';
    end if;
    if clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'Indirizzo email non valido';
    end if;
    insert into public.amministratori (email) values (clean)
    on conflict (email) do nothing;
end;
$$;

-- Rimozione (solo il proprietario; il proprietario non si può rimuovere)
create or replace function public.remove_admin(old_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_owner() then
        raise exception 'Solo il proprietario può togliere amministratori';
    end if;
    if exists (select 1 from public.amministratori a
               where lower(a.email) = lower(trim(old_email)) and a.proprietario) then
        raise exception 'Il proprietario non può essere rimosso';
    end if;
    delete from public.amministratori a where lower(a.email) = lower(trim(old_email));
end;
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_owner() from public;
revoke all on function public.list_admins() from public;
revoke all on function public.add_admin(text) from public;
revoke all on function public.remove_admin(text) from public;
-- Supabase dà accesso di base anche a chi non ha fatto l'accesso (anon): lo si toglie
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_owner() from anon;
revoke execute on function public.list_admins() from anon;
revoke execute on function public.add_admin(text) from anon;
revoke execute on function public.remove_admin(text) from anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.list_admins() to authenticated;
grant execute on function public.add_admin(text) to authenticated;
grant execute on function public.remove_admin(text) to authenticated;
