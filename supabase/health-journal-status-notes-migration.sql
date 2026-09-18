-- Adds note timestamps and preserves a status when a record is archived.
alter table public.health_logs
  add column if not exists note_saved_at timestamptz;

alter table public.health_logs
  add column if not exists note_history jsonb not null default '[]'::jsonb;

alter table public.health_logs
  add column if not exists archived_at timestamptz;

create index if not exists idx_health_logs_archived_at
  on public.health_logs (archived_at);