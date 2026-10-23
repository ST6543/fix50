-- FIX50 migratie 0011: kosten + onderdelen bij onderhoudsrecords, tankbeurt-log.
-- 1) Onderhoudslogboek met kosten (MotorManage-feature: "bewijs bij verkoop").
-- 2) fuel_logs: tankbeurten voor verbruiksberekening (Drivvo/Fuelio-kern).

-- ── Onderhoudsrecords: kosten (in centen om float-problemen te vermijden) + onderdelen ──
alter table public.maintenance_records
  add column if not exists cost_cents integer check (cost_cents >= 0),
  add column if not exists parts text;

comment on column public.maintenance_records.cost_cents is 'Totale kosten in centen (bijv. 1250 = €12,50); null = niet ingevuld.';
comment on column public.maintenance_records.parts is 'Gebruikte onderdelen/vloeistoffen als vrije tekst (bijv. "NGK BR9ES, olie 10W40").';

-- ── Tankbeurten ──
create table if not exists public.fuel_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scooter_id uuid not null references public.scooters (id) on delete cascade,
  filled_at timestamptz not null default now(),
  odometer_km integer not null check (odometer_km >= 0),
  liters numeric(6, 2) not null check (liters > 0 and liters <= 100),
  price_per_liter_cents integer check (price_per_liter_cents >= 0),
  total_cents integer check (total_cents >= 0),
  station text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_fuel_scooter on public.fuel_logs (scooter_id, odometer_km asc);

comment on table public.fuel_logs is 'Tankbeurten per scooter; verbruik wordt client-side berekend tussen opeenvolgende standen.';
comment on column public.fuel_logs.price_per_liter_cents is 'Prijs per liter in centen (bijv. 219 = €2,19); optioneel.';
comment on column public.fuel_logs.total_cents is 'Totaalbetaalde bedrag in centen; optioneel als prijs per liter is ingevuld.';

alter table public.fuel_logs enable row level security;

create policy "fuel_logs: eigen rijen"
  on public.fuel_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
