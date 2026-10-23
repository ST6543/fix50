-- FIX50 migratie 0005: notificaties, push-tokens, cron

create table if not exists public.notifications (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scooter_id uuid references public.scooters (id) on delete cascade,
  type text not null default 'general' check (type in ('maintenance','diagnosis','warning','performance','general')),
  title text not null,
  body text not null default '',
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  dedupe_key text,
  created_at timestamptz not null default now()
);

-- idempotentie: dezelfde dedupe_key levert nooit dubbele meldingen op
create unique index if not exists uq_notifications_dedupe
  on public.notifications (coalesce(dedupe_key, id::text));
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);

create table if not exists public.push_tokens (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

-- Veilig oude policies droppen om fouten te voorkomen
drop policy if exists "notifications: eigen rijen" on public.notifications;
create policy "notifications: eigen rijen"
  on public.notifications for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "push_tokens: eigen rijen" on public.push_tokens;
create policy "push_tokens: eigen rijen"
  on public.push_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- Nieuwe auth-user → profile + user_settings automatisch aanmaken
-- ─────────────────────────────────────────────────────────────
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Cron-helpers
-- ─────────────────────────────────────────────────────────────
create or replace function public.due_time_schedules(days_ahead integer default 3)
returns table (
  user_id uuid,
  scooter_id uuid,
  schedule_id uuid,
  item_name text,
  next_due_at date
)
language sql
stable
as $$
  select
    sc.user_id,
    sc.id,
    s.id,
    i.name,
    s.next_due_at
  from public.maintenance_schedules s
  join public.scooters sc on sc.id = s.scooter_id
  join public.maintenance_items i on i.id = s.item_id
  where s.enabled
    and s.next_due_at is not null
    and s.next_due_at <= (current_date + greatest(coalesce(days_ahead, 3), 0))
    and not exists (
      select 1 from public.maintenance_reminders r
      where r.schedule_id = s.id and r.status = 'open'
    );
$$;

-- Oude genegeerde reminders opruimen (zonder datum-veld te forceren)
create or replace function public.cleanup_old_reminders()
returns void
language sql
as $$
  delete from public.maintenance_reminders
  where status = 'genegeerd';
$$;