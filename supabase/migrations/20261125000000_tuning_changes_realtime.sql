-- Realtime voor de sproeierwissels.
--
-- De GPS-meter laadt de wissels van de actieve scooter opnieuw bij focus en via
-- realtime. Zonder onderstaande twee regels komt er geen bruikbaar event door:
-- de tabel moet in de publicatie zitten, en DELETE-events bevatten standaard
-- alleen de primary key — dan matcht het filter op `scooter_id` nooit.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tuning_changes'
  ) then
    alter publication supabase_realtime add table public.tuning_changes;
  end if;
end $$;

-- Volledige oude rij meesturen, zodat een verwijdering op scooter_id te filteren is.
alter table public.tuning_changes replica identity full;
