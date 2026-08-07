create table if not exists public.schedule_task_completions (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    task_id uuid not null references public.schedule_tasks (id) on delete cascade,
    completion_date date not null,
    completed_at timestamptz not null default timezone('utc', now()),
    completion_status text not null check (completion_status in ('Completed On Time', 'Completed Late')),
    created_at timestamptz not null default timezone('utc', now()),
    unique (task_id, completion_date)
);

create index if not exists idx_schedule_task_completions_farm_date
    on public.schedule_task_completions (farm_id, completion_date);

alter table public.schedule_task_completions enable row level security;

create policy "schedule_completions_select_farm"
on public.schedule_task_completions for select to authenticated
using (
    exists (
        select 1 from public.farm_members fm
        where fm.farm_id = schedule_task_completions.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "schedule_completions_insert_farm"
on public.schedule_task_completions for insert to authenticated
with check (
    exists (
        select 1 from public.farm_members fm
        where fm.farm_id = schedule_task_completions.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "schedule_completions_update_farm"
on public.schedule_task_completions for update to authenticated
using (
    exists (
        select 1 from public.farm_members fm
        where fm.farm_id = schedule_task_completions.farm_id
          and fm.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1 from public.farm_members fm
        where fm.farm_id = schedule_task_completions.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "schedule_completions_delete_farm"
on public.schedule_task_completions for delete to authenticated
using (
    exists (
        select 1 from public.farm_members fm
        where fm.farm_id = schedule_task_completions.farm_id
          and fm.user_id = auth.uid()
    )
);
