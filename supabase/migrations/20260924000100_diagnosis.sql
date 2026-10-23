-- FIX50 migratie 0002: diagnose-database + full-text/trigram search
-- De Excel-data wordt via scripts/import-diagnosis.ts ingeladen (idempotent, hash-based).
-- Schakel trigm extensie in voor full-text search
create extension if not exists "pg_trgm" with schema extensions;

create table if not exists public.diagnosis_categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.diagnosis_entries (
  id uuid primary key default uuid_generate_v4(),
  category text not null,
  engine_type text not null default 'Universeel',
  problem text not null,
  symptoms text not null default '',
  causes text not null default '',
  visual_test text,
  measurement_test text,
  road_test text,
  solution text,
  keywords text[] not null default '{}',
  search_text text not null default '',
  severity text not null default 'info' check (severity in ('info', 'let op', 'risico')),
  active boolean not null default true,
  source text not null default 'Diagonose Fix50.xlsx',
  content_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.diagnosis_keywords (
  id uuid primary key default uuid_generate_v4(),
  keyword text not null unique,
  weight numeric(3, 2) not null default 1.0 check (weight between 0 and 5),
  created_at timestamptz not null default now()
);

create index if not exists idx_diag_entries_category on public.diagnosis_entries (category);
create index if not exists idx_diag_entries_engine on public.diagnosis_entries (engine_type);
create index if not exists idx_diag_entries_active on public.diagnosis_entries (active) where active;
create index if not exists idx_diag_entries_fts on public.diagnosis_entries
  using gin (to_tsvector('dutch', search_text));
create index if not exists idx_diag_entries_trgm_problem on public.diagnosis_entries
  using gin (problem gin_trgm_ops);
create index if not exists idx_diag_entries_trgm_search on public.diagnosis_entries
  using gin (search_text gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────
-- search-functie: relevantiescore, prioriteit bloktype > symptoom > keyword > categorie
-- ─────────────────────────────────────────────────────────────
create or replace function public.search_diagnosis(
  p_query text,
  p_engine_type text default null,
  p_limit integer default 8
)
returns table (
  id uuid,
  category text,
  engine_type text,
  problem text,
  symptoms text,
  causes text,
  visual_test text,
  measurement_test text,
  road_test text,
  solution text,
  severity text,
  score numeric
)
language sql
stable
as $$
  with q as (select websearch_to_tsquery('dutch', coalesce(p_query, '')) as tsq)
  select
    e.id,
    e.category,
    e.engine_type,
    e.problem,
    e.symptoms,
    e.causes,
    e.visual_test,
    e.measurement_test,
    e.road_test,
    e.solution,
    e.severity,
    (
      -- prioriteitsvolgorde: exact probleem > symptoommatch > keyword > bloktype > categorie
      case when e.problem ilike '%' || coalesce(p_query, '') || '%' then 4.0 else 0 end
      + case when ts_rank(to_tsvector('dutch', e.problem), q.tsq) > 0 then 2.0 else 0 end
      + case when ts_rank(to_tsvector('dutch', e.symptoms), q.tsq) > 0 then 1.6 else 0 end
      + case when exists (
          select 1 from unnest(e.keywords) k where k ilike '%' || coalesce(p_query, '') || '%'
        ) then 1.2 else 0 end
      + case when e.engine_type = p_engine_type then 1.0 else 0 end
      + case when e.category ilike '%' || coalesce(p_query, '') || '%' then 0.5 else 0 end
      + ts_rank(to_tsvector('dutch', e.search_text), q.tsq)
      + similarity(e.search_text, coalesce(p_query, '')) * 0.8
    ) as score
  from public.diagnosis_entries e, q
  where e.active
    and (
      coalesce(p_query, '') = ''
      or ts_rank(to_tsvector('dutch', e.search_text), q.tsq) > 0
      or similarity(e.search_text, coalesce(p_query, '')) > 0.12
      or e.problem ilike '%' || coalesce(p_query, '') || '%'
    )
    and (p_engine_type is null or e.engine_type = p_engine_type or e.engine_type = 'Universeel')
  order by score desc
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

-- RLS: diagnose-database is algemene applicatiekennis, leesbaar voor ingelogde gebruikers.
alter table public.diagnosis_categories enable row level security;
alter table public.diagnosis_entries enable row level security;
alter table public.diagnosis_keywords enable row level security;

create policy "diagnosis_entries: authenticated lezen (alleen active)"
  on public.diagnosis_entries for select
  using (auth.role() = 'authenticated' and active);
create policy "diagnosis_categories: authenticated lezen"
  on public.diagnosis_categories for select using (auth.role() = 'authenticated');
create policy "diagnosis_keywords: authenticated lezen"
  on public.diagnosis_keywords for select using (auth.role() = 'authenticated');
