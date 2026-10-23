-- FIX50: inloggen met gebruikersnaam + registreren zonder e-mailadres.
--
-- Achtergrond: Supabase Auth gebruikt altijd een e-mailadres als identity.
-- FIX50 laat jonge gebruikers nu starten met alleen gebruikersnaam + wachtwoord;
-- de app maakt dan een synthetisch adres (<slug>@users.fix50.app) dat uniek is.
-- Later kan de gebruiker in de app een echt e-mailadres toevoegen.
--
-- lookup_login_identity(): lost een gebruikersnaam op naar dat synthetische adres,
-- zodat de client kan inloggen met wat de gebruiker typte.

-- 1) Username-kolom op profiles (genormaliseerd: lowercase, [a-z0-9_], 3-20)
alter table public.profiles
  add column if not exists username text;

create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;

-- 2) Zoekfunctie: gebruikersnaam -> e-mailadres van het account (search_path vast).
create or replace function public.lookup_login_identity(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(u.email)
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where lower(p.username) = lower(trim(p_username))
  limit 1;
$$;

revoke all on function public.lookup_login_identity(text) from public;
grant execute on function public.lookup_login_identity(text) to authenticated, anon;

-- 3) Bestaande profielen een username geven op basis van hun weergavenaam
--    (alleen waar die nog leeg is en de basis vrij is).
update public.profiles p
set username = base.candidate
from (
  select p2.id,
    regexp_replace(lower(trim(p2.display_name)), '[^a-z0-9_]+', '_', 'g') as candidate
  from public.profiles p2
  where p2.username is null
) base
where p.id = base.id
  and length(base.candidate) >= 3
  and not exists (
    select 1 from public.profiles q
    where lower(q.username) = base.candidate and q.id <> p.id
  );

-- 4) backfillwaarschuwing: profielen zonder username vallen terug op e-mail-login
--    (app-veld is 'gebruikersnaam OF e-mail', dus zij kunnen gewoon blijven inloggen).
