-- FIX50: hulpfuncties bij username-registratie.
-- username_available(): anoniem checken of een naam vrij is (security definer,
-- omdat de profiles-select-policy alleen de eigen rij toont).
-- handle_new_user(): slaat de gekozen username uit user-metadata op (met
-- conflictslib als hij intussen al door iemand anders is genomen).

create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(trim(p_username))
  );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to authenticated, anon;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := nullif(new.raw_user_meta_data ->> 'username', '');
begin
  -- Als de gekozen naam intussen al bestaat: opslaan zonder username
  -- (de gebruiker kan dan gewoon met e-mail inloggen; niets gaat stuk).
  if v_username is not null
     and exists (select 1 from public.profiles where lower(username) = lower(v_username)) then
    v_username := null;
  end if;

  insert into public.profiles (user_id, display_name, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    v_username
  )
  on conflict (user_id) do nothing;

  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
