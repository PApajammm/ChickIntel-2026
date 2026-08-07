create table if not exists public.schedule_tasks (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    title text not null,
    task_time time not null,
    category text not null,
    repeat_type text not null check (
        repeat_type in ('Never', 'Daily', 'Weekly', 'Monthly', 'Annually', 'Custom')
    ),
    custom_repeat_days text[] not null default '{}',
    start_date date not null,
    feed_inventory_item_id uuid references public.inventory_items (id) on delete set null,
    feed_inventory_item_name text,
    feed_daily_amount numeric(12, 2),
    feed_daily_unit text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.schedule_tasks
    add column if not exists feed_inventory_item_id uuid references public.inventory_items (id) on delete set null;

alter table public.schedule_tasks
    add column if not exists feed_inventory_item_name text;

alter table public.schedule_tasks
    add column if not exists feed_daily_amount numeric(12, 2);

alter table public.schedule_tasks
    add column if not exists feed_daily_unit text;

create index if not exists idx_schedule_tasks_farm_id
    on public.schedule_tasks (farm_id);

create index if not exists idx_schedule_tasks_start_date
    on public.schedule_tasks (start_date);

drop trigger if exists schedule_tasks_set_updated_at on public.schedule_tasks;
create trigger schedule_tasks_set_updated_at
before update on public.schedule_tasks
for each row execute procedure public.set_updated_at();

alter table public.schedule_tasks enable row level security;

create policy "schedule_tasks_select_farm_members"
on public.schedule_tasks
for select
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = schedule_tasks.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "schedule_tasks_insert_farm_members"
on public.schedule_tasks
for insert
to authenticated
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = schedule_tasks.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "schedule_tasks_update_farm_members"
on public.schedule_tasks
for update
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = schedule_tasks.farm_id
          and fm.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = schedule_tasks.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "schedule_tasks_delete_farm_members"
on public.schedule_tasks
for delete
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = schedule_tasks.farm_id
          and fm.user_id = auth.uid()
    )
);
