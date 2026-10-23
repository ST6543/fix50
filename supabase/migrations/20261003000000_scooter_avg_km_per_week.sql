-- FIX50 migratie 0007: gemiddeld km-verbruik per week per scooter
-- Voedt de automatische kilometerstand-schatting en de week-voorspelling
-- van onderhoud ("over hoeveel weken moet X vervangen worden").
-- De client blijft current_km zelf bijwerken; avg_km_per_week is een schatting-anker.

alter table public.scooters
  add column if not exists avg_km_per_week numeric;

comment on column public.scooters.avg_km_per_week is
  'Door de gebruiker opgegeven gemiddeld aantal km per week; null = niet ingesteld (geen automatische km-schatting).';

alter table public.scooters
  add constraint scooters_avg_km_per_week_check
  check (avg_km_per_week is null or (avg_km_per_week >= 0 and avg_km_per_week <= 5000));
