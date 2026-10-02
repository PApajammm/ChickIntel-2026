-- ChickIntel Multiple Disease Records Migration
-- Enables individual chickens (CHT tag) to maintain multiple separate disease records,
-- each with its own independent treatment protocol, daily tasks, notes, and resolution status.

-- 1. Add health_log_id to health_monitoring_tasks to link tasks directly to specific disease records
alter table public.health_monitoring_tasks
    add column if not exists health_log_id uuid references public.health_logs(id) on delete cascade;

create index if not exists idx_health_monitoring_tasks_health_log_id
    on public.health_monitoring_tasks (health_log_id);

-- 2. Backfill existing tasks with their parent monitoring record's initial health_log_id
update public.health_monitoring_tasks t
set health_log_id = hm.health_log_id
from public.health_monitoring hm
where t.health_monitoring_id = hm.id
  and t.health_log_id is null;
