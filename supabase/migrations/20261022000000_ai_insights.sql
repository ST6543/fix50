-- FIX50 migratie: AI-inzichten (fase B van docs/AI-SLIMMER-PLAN.md)
-- De Edge Function `ai-insights` verwoordt de deterministische signalen (fase A)
-- in gewone taal en cachet het resultaat per signaal-hash, zodat het openen van
-- de app normaal gesproken geen extra AI-call kost.

create table if not exists public.ai_insights (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- scooter_id mag null zijn (signaal zonder actieve scooter); dedupe matcht daarom met coalesce.
  scooter_id uuid references public.scooters (id) on delete cascade,
  signal_key text not null check (char_length(signal_key) between 8 and 512),
  kind text not null check (kind in ('verbruik', 'onderhoud', 'performance', 'tuning')),
  severity text not null check (severity in ('info', 'let op', 'risico')),
  title text not null check (char_length(title) between 1 and 120),
  detail text not null check (char_length(detail) between 1 and 600),
  diagnosis_ids uuid[] not null default '{}',
  source text not null default 'ai' check (source in ('ai', 'fallback')),
  created_at timestamptz not null default now()
);

alter table public.ai_insights enable row level security;

drop policy if exists "ai_insights: eigenaar leest" on public.ai_insights;
create policy "ai_insights: eigenaar leest"
  on public.ai_insights for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "ai_insights: eigenaar beheert" on public.ai_insights;
create policy "ai_insights: eigenaar beheert"
  on public.ai_insights for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Eén rij per gebruiker + scooter + signalenset (dedupe; null-scooter telt mee).
create unique index if not exists ai_insights_signal_unique
  on public.ai_insights (user_id, coalesce(scooter_id, '00000000-0000-0000-0000-000000000000'::uuid), signal_key);

-- Snel dag-tellingen vinden voor de rate-limit.
create index if not exists ai_insights_user_created
  on public.ai_insights (user_id, created_at desc);

-- Kill switch: "AI meekijken" aan/uit (guardrail uit het plan).
alter table public.user_settings
  add column if not exists ai_watch_enabled boolean not null default true;
