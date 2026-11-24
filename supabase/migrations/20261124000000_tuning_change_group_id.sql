-- Groeps-id per sproeierwissel. De regels van één wissel (bijv. hoofdsproeier
-- én naaldclip) horen expliciet bij elkaar in plaats van via een tijdvenster
-- van vijf seconden. Oude rijen hebben geen group_id; de app groepeert die nog
-- op tijd als fallback.
alter table public.tuning_changes
  add column if not exists group_id uuid;

create index if not exists idx_tuning_changes_group on public.tuning_changes (group_id);

comment on column public.tuning_changes.group_id is
  'Sproeierwissel waar deze regel bij hoort; leeg = oude rij zonder groeps-id (fallback op tijd).';
