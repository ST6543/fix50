-- FIX50 migratie: nachtelijke cron voor proactieve verslechtermings-signalen
-- (afronding fase C van docs/AI-SLIMMER-PLAN.md).
--
-- Roept de Edge Function `insights-cron` aan, die de kernsignalen (verbruik,
-- prestatie-daling, meet-trend) server-side herrekent voor actieve scooters
-- en meldingen macht via de bestaande dedupe-index (max 1x per week/signaal).
-- Idempotent: eerst unschedule zodat het schema altijd de actuele versie is.

do $$
begin
  -- Idempotent: unschedule gooit een fout als de job nog niet bestaat.
  if exists (select 1 from cron.job where jobname = 'fix50-insights-signals') then
    perform cron.unschedule('fix50-insights-signals');
  end if;
end $$;

-- Dagelijks om 05:30 UTC (06:30/07:30 NL — net vóór de bestaande
-- herinneringen-run om 06:00 UTC). Aparte naam en tijdslot voor isolatie.
select cron.schedule(
  'fix50-insights-signals',
  '30 5 * * *',
  $$
  select net.http_post(
    url := 'https://gdjargpxcdgciusycyya.supabase.co/functions/v1/insights-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || coalesce(
        (select decrypted_secret from vault.decrypted_secrets where name = 'CRON_SECRET'),
        'missing'
      ),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
