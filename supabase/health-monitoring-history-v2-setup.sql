-- Health Monitoring History v2 Migration Script
-- Run this in your Supabase SQL Editor

-- 1. Add health_monitoring_id column to health_logs if it doesn't exist
alter table public.health_logs 
add column if not exists health_monitoring_id uuid references public.health_monitoring(id) on delete set null;

-- 2. Create index for fast history retrieval
create index if not exists idx_health_logs_monitoring_id 
on public.health_logs (health_monitoring_id, saved_at desc);

-- 3. Backfill initial monitoring links from existing health_monitoring records
update public.health_logs hl
set health_monitoring_id = hm.id
from public.health_monitoring hm
where hl.id = hm.health_log_id
  and hl.health_monitoring_id is null;
