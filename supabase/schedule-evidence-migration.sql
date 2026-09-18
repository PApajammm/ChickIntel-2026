alter table public.schedule_task_completions
  add column if not exists evidence_uri text;

alter table public.schedule_task_completions
  add column if not exists evidence_captured_at timestamptz;