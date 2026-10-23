-- FIX50 migratie 0006: Supabase Cron → Edge Function `maintenance-reminders`
-- Vereist: pg_cron en pg_net extensies (ondersteund door Supabase).
-- De CRON_SECRET staat in de vault: select vault.create_secret('<sterk-secret>', 'CRON_SECRET');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Dagelijks om 06:00 UTC (07:00/08:00 NL) herinneringen controleren en versturen.
select cron.schedule(
  'fix50-maintenance-reminders',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://gdjargpxcdgciusycyya.supabase.co/functions/v1/maintenance-reminders',
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
