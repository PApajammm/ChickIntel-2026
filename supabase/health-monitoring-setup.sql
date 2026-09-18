-- Health Monitoring table
-- Links to health_logs as the single source of truth
create table if not exists public.health_monitoring (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    health_log_id uuid not null references public.health_logs (id) on delete cascade,
    cht_tag text not null,
    monitoring_status text not null default 'Active',
    monitoring_completed_at timestamptz,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.health_monitoring
    add column if not exists monitoring_status text not null default 'Active';

alter table public.health_monitoring
    add column if not exists monitoring_completed_at timestamptz;

alter table public.health_monitoring
    add column if not exists batch_no text;

create table if not exists public.health_monitoring_tasks (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    health_monitoring_id uuid not null references public.health_monitoring (id) on delete cascade,
    title text not null,
    description text,
    task_type text not null default 'Treatment',
    due_at timestamptz,
    status text not null default 'Pending',
    completed boolean not null default false,
    completed_at timestamptz,
    completed_by uuid references auth.users (id) on delete set null,
    treatment_note text,
    schedule_task_id uuid references public.schedule_tasks (id) on delete set null,
    frequency text not null default 'Never',
    start_date date,
    end_date date,
    scheduled_times text[] not null default '{}',
    sort_order integer not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.health_monitoring_tasks
    add column if not exists description text;
alter table public.health_monitoring_tasks
    add column if not exists task_type text not null default 'Treatment';
alter table public.health_monitoring_tasks
    add column if not exists due_at timestamptz;
alter table public.health_monitoring_tasks
    add column if not exists status text not null default 'Pending';
alter table public.health_monitoring_tasks
    add column if not exists completed_by uuid references auth.users (id) on delete set null;
alter table public.health_monitoring_tasks
    add column if not exists treatment_note text;
alter table public.health_monitoring_tasks
    add column if not exists schedule_task_id uuid references public.schedule_tasks (id) on delete set null;
alter table public.health_monitoring_tasks
    add column if not exists frequency text not null default 'Never';
alter table public.health_monitoring_tasks
    add column if not exists start_date date;
alter table public.health_monitoring_tasks
    add column if not exists end_date date;
alter table public.health_monitoring_tasks
    add column if not exists scheduled_times text[] not null default '{}';

update public.health_monitoring_tasks
set status = case when completed then 'Completed' else 'Pending' end
where status is null;

drop trigger if exists health_monitoring_tasks_set_updated_at on public.health_monitoring_tasks;
create trigger health_monitoring_tasks_set_updated_at
before update on public.health_monitoring_tasks
for each row execute procedure public.set_updated_at();

create index if not exists idx_health_monitoring_tasks_monitoring_id
    on public.health_monitoring_tasks (health_monitoring_id, sort_order);

create table if not exists public.health_monitoring_task_occurrences (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    health_monitoring_task_id uuid not null references public.health_monitoring_tasks (id) on delete cascade,
    due_at timestamptz not null,
    completed boolean not null default false,
    completed_at timestamptz,
    completed_by uuid references auth.users (id) on delete set null,
    treatment_note text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_health_monitoring_task_occurrences_task_due
    on public.health_monitoring_task_occurrences (health_monitoring_task_id, due_at);

-- Preserve treatment tasks created before occurrence support was added.
insert into public.health_monitoring_task_occurrences (
    farm_id,
    health_monitoring_task_id,
    due_at,
    completed,
    completed_at,
    completed_by,
    treatment_note
)
select
    task.farm_id,
    task.id,
    coalesce(task.due_at, task.created_at),
    task.completed,
    task.completed_at,
    task.completed_by,
    task.treatment_note
from public.health_monitoring_tasks task
where not exists (
    select 1
    from public.health_monitoring_task_occurrences occurrence
    where occurrence.health_monitoring_task_id = task.id
);

drop trigger if exists health_monitoring_task_occurrences_set_updated_at
on public.health_monitoring_task_occurrences;
create trigger health_monitoring_task_occurrences_set_updated_at
before update on public.health_monitoring_task_occurrences
for each row execute procedure public.set_updated_at();

alter table public.health_monitoring_task_occurrences enable row level security;

drop policy if exists "health_monitoring_task_occurrences_select_farm_members"
on public.health_monitoring_task_occurrences;
create policy "health_monitoring_task_occurrences_select_farm_members"
on public.health_monitoring_task_occurrences for select to authenticated
using (exists (
    select 1 from public.farm_members fm
    where fm.farm_id = health_monitoring_task_occurrences.farm_id
      and fm.user_id = auth.uid()
));

drop policy if exists "health_monitoring_task_occurrences_insert_farm_members"
on public.health_monitoring_task_occurrences;
create policy "health_monitoring_task_occurrences_insert_farm_members"
on public.health_monitoring_task_occurrences for insert to authenticated
with check (exists (
    select 1 from public.farm_members fm
    where fm.farm_id = health_monitoring_task_occurrences.farm_id
      and fm.user_id = auth.uid()
));

drop policy if exists "health_monitoring_task_occurrences_update_farm_members"
on public.health_monitoring_task_occurrences;
create policy "health_monitoring_task_occurrences_update_farm_members"
on public.health_monitoring_task_occurrences for update to authenticated
using (exists (
    select 1 from public.farm_members fm
    where fm.farm_id = health_monitoring_task_occurrences.farm_id
      and fm.user_id = auth.uid()
))
with check (exists (
    select 1 from public.farm_members fm
    where fm.farm_id = health_monitoring_task_occurrences.farm_id
      and fm.user_id = auth.uid()
));

alter table public.health_monitoring_tasks enable row level security;

drop policy if exists "health_monitoring_tasks_select_farm_members"
on public.health_monitoring_tasks;
create policy "health_monitoring_tasks_select_farm_members"
on public.health_monitoring_tasks for select to authenticated
using (exists (
    select 1 from public.farm_members fm
    where fm.farm_id = health_monitoring_tasks.farm_id
      and fm.user_id = auth.uid()
));

drop policy if exists "health_monitoring_tasks_insert_farm_members"
on public.health_monitoring_tasks;
create policy "health_monitoring_tasks_insert_farm_members"
on public.health_monitoring_tasks for insert to authenticated
with check (exists (
    select 1 from public.farm_members fm
    where fm.farm_id = health_monitoring_tasks.farm_id
      and fm.user_id = auth.uid()
));

drop policy if exists "health_monitoring_tasks_update_farm_members"
on public.health_monitoring_tasks;
create policy "health_monitoring_tasks_update_farm_members"
on public.health_monitoring_tasks for update to authenticated
using (exists (
    select 1 from public.farm_members fm
    where fm.farm_id = health_monitoring_tasks.farm_id
      and fm.user_id = auth.uid()
))
with check (exists (
    select 1 from public.farm_members fm
    where fm.farm_id = health_monitoring_tasks.farm_id
      and fm.user_id = auth.uid()
));

update public.health_monitoring
set monitoring_status = 'Active'
where monitoring_status is null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'health_monitoring_status_check'
          and conrelid = 'public.health_monitoring'::regclass
    ) then
        alter table public.health_monitoring
            add constraint health_monitoring_status_check
            check (monitoring_status in ('Active', 'Recovered', 'Deceased'));
    end if;
end $$;

-- Unique constraint on cht_tag per farm
create unique index if not exists idx_health_monitoring_cht_tag_farm
    on public.health_monitoring (farm_id, cht_tag);

-- Index for lookups
create index if not exists idx_health_monitoring_farm_id
    on public.health_monitoring (farm_id);

create index if not exists idx_health_monitoring_farm_status
    on public.health_monitoring (farm_id, monitoring_status);

create index if not exists idx_health_monitoring_health_log_id
    on public.health_monitoring (health_log_id);

-- Updated_at trigger
drop trigger if exists health_monitoring_set_updated_at on public.health_monitoring;
create trigger health_monitoring_set_updated_at
before update on public.health_monitoring
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.health_monitoring enable row level security;

drop policy if exists "health_monitoring_select_farm_members"
on public.health_monitoring;

create policy "health_monitoring_select_farm_members"
on public.health_monitoring
for select
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = health_monitoring.farm_id
          and fm.user_id = auth.uid()
    )
);

drop policy if exists "health_monitoring_insert_farm_members"
on public.health_monitoring;

create policy "health_monitoring_insert_farm_members"
on public.health_monitoring
for insert
to authenticated
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = health_monitoring.farm_id
          and fm.user_id = auth.uid()
    )
);

drop policy if exists "health_monitoring_update_farm_members"
on public.health_monitoring;

create policy "health_monitoring_update_farm_members"
on public.health_monitoring
for update
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = health_monitoring.farm_id
          and fm.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = health_monitoring.farm_id
          and fm.user_id = auth.uid()
    )
);

drop policy if exists "health_monitoring_delete_farm_members"
on public.health_monitoring;

create policy "health_monitoring_delete_farm_members"
on public.health_monitoring
for delete
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = health_monitoring.farm_id
          and fm.user_id = auth.uid()
    )
);

-- Scan history: multiple health_logs per monitored chicken (same CHT tag / card)
create table if not exists public.health_monitoring_scans (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    health_monitoring_id uuid not null references public.health_monitoring (id) on delete cascade,
    health_log_id uuid not null references public.health_logs (id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now()),
    unique (health_monitoring_id, health_log_id)
);

create index if not exists idx_health_monitoring_scans_monitoring_id
    on public.health_monitoring_scans (health_monitoring_id, created_at desc);

alter table public.health_monitoring_scans enable row level security;

drop policy if exists "health_monitoring_scans_select_farm_members"
on public.health_monitoring_scans;

create policy "health_monitoring_scans_select_farm_members"
on public.health_monitoring_scans
for select
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = health_monitoring_scans.farm_id
          and fm.user_id = auth.uid()
    )
);

drop policy if exists "health_monitoring_scans_insert_farm_members"
on public.health_monitoring_scans;

create policy "health_monitoring_scans_insert_farm_members"
on public.health_monitoring_scans
for insert
to authenticated
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = health_monitoring_scans.farm_id
          and fm.user_id = auth.uid()
    )
);

drop policy if exists "health_monitoring_scans_update_farm_members"
on public.health_monitoring_scans;

create policy "health_monitoring_scans_update_farm_members"
on public.health_monitoring_scans
for update
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = health_monitoring_scans.farm_id
          and fm.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = health_monitoring_scans.farm_id
          and fm.user_id = auth.uid()
    )
);


insert into public.health_monitoring_scans (farm_id, health_monitoring_id, health_log_id)
select hm.farm_id, hm.id, hm.health_log_id
from public.health_monitoring hm
where not exists (
    select 1
    from public.health_monitoring_scans hms
    where hms.health_monitoring_id = hm.id
      and hms.health_log_id = hm.health_log_id
);
