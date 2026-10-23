-- FIX50 migratie 0003: onderhoud (items, schedules, records, reminders)
-- Onderhoudsitems komen uit Excel-sheet "Onderhoud" (intervallen als ranges, niet als feiten).

create table if not exists public.maintenance_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  category text not null default 'Algemeen',
  interval_km_min integer,
  interval_km_max integer,
  interval_months_min integer,
  interval_months_max integer,
  applies_2t boolean not null default true,
  applies_4t boolean not null default true,
  applies_injectie boolean not null default true,
  description text,
  active boolean not null default true,
  source text not null default 'Diagonose Fix50.xlsx',
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_schedules (
  id uuid primary key default uuid_generate_v4(),
  scooter_id uuid not null references public.scooters (id) on delete cascade,
  item_id uuid not null references public.maintenance_items (id) on delete cascade,
  -- Intervallen zijn configureerbaar per scooter; null = tijdelijk uitgeschakeld.
  interval_km integer,
  interval_months integer,
  enabled boolean not null default true,
  last_done_km integer,
  last_done_at timestamptz,
  next_due_km integer,
  next_due_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scooter_id, item_id)
);
create index if not exists idx_sched_scooter on public.maintenance_schedules (scooter_id);
create index if not exists idx_sched_due on public.maintenance_schedules (next_due_km, next_due_at);

create table if not exists public.maintenance_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scooter_id uuid not null references public.scooters (id) on delete cascade,
  item_id uuid references public.maintenance_items (id) on delete set null,
  custom_name text,
  done_at timestamptz not null default now(),
  km_at_service integer check (km_at_service >= 0),
  notes text,
  created_at timestamptz not null default now(),
  constraint record_has_name check (item_id is not null or custom_name is not null)
);
create index if not exists idx_records_scooter on public.maintenance_records (scooter_id, done_at desc);
create index if not exists idx_records_user on public.maintenance_records (user_id);

create table if not exists public.maintenance_reminders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scooter_id uuid not null references public.scooters (id) on delete cascade,
  schedule_id uuid references public.maintenance_schedules (id) on delete cascade,
  severity text not null default 'reminder' check (severity in ('info', 'reminder', 'warning')),
  title text not null,
  body text not null default '',
  due_km integer,
  due_at date,
  status text not null default 'open' check (status in ('open', 'afgerond', 'genegeerd')),
  -- idempotentie: max één open reminder per schedule
  unique (schedule_id, status)
  -- let op: partial unique via index hieronder (open only)
);
create unique index if not exists uq_reminder_open_per_schedule
  on public.maintenance_reminders (schedule_id) where status = 'open';
create index if not exists idx_reminders_user on public.maintenance_reminders (user_id, status);

-- ─────────────────────────────────────────────────────────────
-- Kilometerstand-update → schedules herberekenen → reminders aanmaken
-- (server-side logica; client hoeft alleen current_km te updaten)
-- ─────────────────────────────────────────────────────────────
create or replace function public.recalc_schedules_on_km()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_km > old.current_km then
    update public.maintenance_schedules s
    set next_due_km = case
          when s.interval_km is not null
            then coalesce(s.last_done_km, 0) + s.interval_km
          else s.next_due_km
        end
    where s.scooter_id = new.id and s.enabled and s.interval_km is not null;

    insert into public.maintenance_reminders (
      user_id, scooter_id, schedule_id, severity, title, body, due_km
    )
    select
      new.user_id,
      new.id,
      s.id,
      case
        when coalesce(s.last_done_km, 0) + s.interval_km <= new.current_km then 'warning'
        else 'reminder'
      end,
      i.name,
      case
        when coalesce(s.last_done_km, 0) + s.interval_km <= new.current_km
        then 'Deze taak is ' || (new.current_km - (coalesce(s.last_done_km, 0) + s.interval_km)) ||
             ' km geleden toe aan beurt.'
        else 'In ongeveer ' || ((coalesce(s.last_done_km, 0) + s.interval_km) - new.current_km) ||
             ' km toe aan beurt.'
      end,
      coalesce(s.last_done_km, 0) + s.interval_km
    from public.maintenance_schedules s
    join public.maintenance_items i on i.id = s.item_id
    where s.scooter_id = new.id
      and s.enabled
      and s.interval_km is not null
      and (coalesce(s.last_done_km, 0) + s.interval_km) <= new.current_km + coalesce(
        (select reminder_km_before from public.user_settings us where us.user_id = new.user_id), 100)
    on conflict (schedule_id) where status = 'open' do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recalc_on_km on public.scooters;
create trigger trg_recalc_on_km after update of current_km on public.scooters
  for each row execute function public.recalc_schedules_on_km();

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.maintenance_items enable row level security;
alter table public.maintenance_schedules enable row level security;
alter table public.maintenance_records enable row level security;
alter table public.maintenance_reminders enable row level security;

-- items: algemene kennis, leesbaar voor ingelogde gebruikers
create policy "maintenance_items: authenticated lezen"
  on public.maintenance_items for select
  using (auth.role() = 'authenticated' and active);

-- schedules/records/reminders: strikt per eigenaar
create policy "schedules: via eigen scooter"
  on public.maintenance_schedules for all
  using (exists (select 1 from public.scooters s where s.id = scooter_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.scooters s where s.id = scooter_id and s.user_id = auth.uid()));

create policy "records: eigen rijen"
  on public.maintenance_records for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "reminders: eigen rijen"
  on public.maintenance_reminders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
