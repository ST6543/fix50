-- FIX50 migratie 0004: tuning, performance en chat

-- ─────────────────────────────────────────────────────────────
-- tuning_setups: meerdere setups per scooter ("Origineel", "Sport", "Dagelijks", ...)
-- parts is jsonb: flexibel onderdelenboek zonder dwingende schema-colommen.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.tuning_setups (
  id uuid primary key default uuid_generate_v4(),
  scooter_id uuid not null references public.scooters (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  parts jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scooter_id, name)
);
create index if not exists idx_tuning_setups_scooter on public.tuning_setups (scooter_id);

create table if not exists public.tuning_changes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scooter_id uuid not null references public.scooters (id) on delete cascade,
  setup_id uuid references public.tuning_setups (id) on delete set null,
  changed_at timestamptz not null default now(),
  km_at_change integer check (km_at_change >= 0),
  part text not null,
  old_value text,
  new_value text,
  result text,
  notes text,
  created_at timestamptz default now()
);
create index if not exists idx_tuning_changes_scooter on public.tuning_changes (scooter_id, changed_at desc);

-- ─────────────────────────────────────────────────────────────
-- performance_runs: GPS-punten als jsonb array (privacy: geen routes publiceren)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.performance_runs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scooter_id uuid references public.scooters (id) on delete set null,
  setup_id uuid references public.tuning_setups (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_s numeric(8, 2),
  distance_m numeric(10, 1),
  max_speed_kmh numeric(6, 2),
  avg_speed_kmh numeric(6, 2),
  t0_50_s numeric(6, 2),
  t0_80_s numeric(6, 2),
  t50_80_s numeric(6, 2),
  gps_quality text not null default 'matig' check (gps_quality in ('goed', 'matig', 'slecht')),
  points jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_perf_runs_user on public.performance_runs (user_id, created_at desc);
create index if not exists idx_perf_runs_scooter on public.performance_runs (scooter_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- chat
-- ─────────────────────────────────────────────────────────────
create table if not exists public.chat_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scooter_id uuid references public.scooters (id) on delete set null,
  title text not null default 'Nieuw gesprek',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_chat_sessions_user on public.chat_sessions (user_id, updated_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default uuid_generate_v4(),
  chat_session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  message text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_messages_session on public.chat_messages (chat_session_id, created_at);

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.tuning_setups enable row level security;
alter table public.tuning_changes enable row level security;
alter table public.performance_runs enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

create policy "tuning_setups: via eigen scooter"
  on public.tuning_setups for all
  using (exists (select 1 from public.scooters s where s.id = scooter_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.scooters s where s.id = scooter_id and s.user_id = auth.uid()));

create policy "tuning_changes: eigen rijen"
  on public.tuning_changes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "performance_runs: eigen rijen"
  on public.performance_runs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "chat_sessions: eigen rijen"
  on public.chat_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "chat_messages: via eigen sessie"
  on public.chat_messages for all
  using (exists (select 1 from public.chat_sessions cs where cs.id = chat_session_id and cs.user_id = auth.uid()))
  with check (exists (select 1 from public.chat_sessions cs where cs.id = chat_session_id and cs.user_id = auth.uid()));
