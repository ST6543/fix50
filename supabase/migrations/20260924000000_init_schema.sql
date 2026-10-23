-- FIX50 migratie 0001: basisschema (profiles, settings, scooters, setups)
-- Alle tabellen krijgen RLS; gebruikers zien alleen hun eigen rijen.

-- Zorg dat de extensie bestaat en overal vindbaar is
create extension if not exists "uuid-ossp" with schema extensions;
alter database postgres set search_path to "$user", public, extensions;

-- ─────────────────────────────────────────────────────────────
-- profiles (1-op-1 met auth.users)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  avatar_url text,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- user_settings (1-op-1)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  push_enabled boolean not null default true,
  maintenance_notifications boolean not null default true,
  reminder_days_ahead integer not null default 3 check (reminder_days_ahead between 0 and 30),
  reminder_km_before integer not null default 100 check (reminder_km_before between 0 and 2000),
  weekly_overview boolean not null default true,
  language text not null default 'nl',
  units text not null default 'km',
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- scooters
-- ─────────────────────────────────────────────────────────────
create table if not exists public.scooters (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  brand text check (char_length(brand) <= 40),
  model text check (char_length(model) <= 40),
  year integer check (year between 1950 and 2100),
  engine_type text,
  engine_code text,
  fuel_system text check (fuel_system in ('2T', '4T', 'Injectie')),
  license_plate text,
  current_km integer not null default 0 check (current_km >= 0),
  notes text,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_scooters_user on public.scooters (user_id);

-- ─────────────────────────────────────────────────────────────
-- scooter_setups (1-op-1 per scooter; flexibele velden, NIET ieder veld is verplicht)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.scooter_setups (
  id uuid primary key default extensions.uuid_generate_v4(),
  scooter_id uuid not null unique references public.scooters (id) on delete cascade,
  bloktype text,
  cilinder text,
  cilinderinhoud_cc integer,
  krukas text,
  carburateur text,
  carburateurmaat_mm numeric(4, 1),
  hoofdsproeier integer,
  stationairsproeier integer,
  naaldpositie text,
  luchtfilter text,
  spruitstuk text,
  membraan text,
  uitlaat text,
  vertanding text,
  variateur text,
  rollen text,
  drukveer text,
  trekveren text,
  koppeling text,
  bougie text,
  ontsteking text,
  brandstof text,
  olie text,
  overig text,
  updated_at timestamptz not null default now()
);
create index if not exists idx_setups_scooter on public.scooter_setups (scooter_id);

-- ─────────────────────────────────────────────────────────────
-- app_settings (globale applicatievlaggen; beheer later via admin)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_scooters_updated on public.scooters;
create trigger trg_scooters_updated before update on public.scooters
  for each row execute function public.set_updated_at();

drop trigger if exists trg_setups_updated on public.scooter_setups;
create trigger trg_setups_updated before update on public.scooter_setups
  for each row execute function public.set_updated_at();

drop trigger if exists trg_user_settings_updated on public.user_settings;
create trigger trg_user_settings_updated before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.scooters enable row level security;
alter table public.scooter_setups enable row level security;
alter table public.app_settings enable row level security;

create policy "profiles: eigen rij lezen"
  on public.profiles for select using (auth.uid() = user_id);
create policy "profiles: eigen rij insert"
  on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles: eigen rij updaten"
  on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_settings: eigen rij alles"
  on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "scooters: eigen rij lezen"
  on public.scooters for select using (auth.uid() = user_id);
create policy "scooters: eigen rij insert"
  on public.scooters for insert with check (auth.uid() = user_id);
create policy "scooters: eigen rij updaten"
  on public.scooters for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scooters: eigen rij verwijderen"
  on public.scooters for delete using (auth.uid() = user_id);

create policy "setups: via eigen scooter"
  on public.scooter_setups for all
  using (exists (select 1 from public.scooters s where s.id = scooter_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.scooters s where s.id = scooter_id and s.user_id = auth.uid()));

-- app_settings: publiek leesbaar (app-vlaggen), alleen service role schrijft
create policy "app_settings: publiek lezen"
  on public.app_settings for select using (true);
