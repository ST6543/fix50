-- FIX50: terug naar e-mail-only login.
-- Gebruikersnaam-ondersteuning (migraties 20260925*) wordt volledig teruggedraaid.

-- Trigger terug naar de basisversie (zonder username-logica).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;

  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Functies, index en kolom verwijderen.
drop function if exists public.lookup_login_identity(text);
drop function if exists public.username_available(text);
drop index if exists public.profiles_username_key;
alter table public.profiles drop column if exists username;
