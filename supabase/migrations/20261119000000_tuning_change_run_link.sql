-- Koppeling tussen een gelogde sproeierwissel en de GPS-test die hem test.
-- run_id leeg = de wissel wacht nog op de eerstvolgende meting.
alter table public.tuning_changes
  add column if not exists run_id uuid references public.performance_runs (id) on delete set null;

create index if not exists idx_tuning_changes_run on public.tuning_changes (run_id);

comment on column public.tuning_changes.run_id is
  'GPS-test die als testresultaat bij deze wijziging hoort (top en 0-50); leeg = wacht nog op een meting.';
