create table if not exists public.schedule_task_history (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    title text not null,
    task_time time not null,
    category text not null,
    repeat_type text not null,
    custom_repeat_days text[] not null default '{}',
    start_date date not null,
    end_date date,
    feed_inventory_item_name text,
    feed_daily_amount numeric(12, 2),
    feed_daily_unit text,
    deleted_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory_item_history (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    item_type text not null,
    item_name text not null,
    qty numeric(12, 2) not null default 0,
    total_qty numeric(12, 2) not null default 0,
    restock_credit_qty numeric(12, 2) not null default 0,
    unit text not null,
    purchased_date date,
    delivered_date date,
    expiration_date date,
    deleted_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.schedule_task_occurrence_exclusions (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    task_id uuid not null references public.schedule_tasks (id) on delete cascade,
    occurrence_date date not null,
    created_at timestamptz not null default timezone('utc', now()),
    unique (farm_id, task_id, occurrence_date)
);

create index if not exists idx_schedule_task_history_farm_deleted on public.schedule_task_history (farm_id, deleted_at desc);
create index if not exists idx_inventory_item_history_farm_deleted on public.inventory_item_history (farm_id, deleted_at desc);
create index if not exists idx_schedule_occurrence_exclusions_farm on public.schedule_task_occurrence_exclusions (farm_id, occurrence_date);

alter table public.schedule_task_history enable row level security;
alter table public.inventory_item_history enable row level security;
alter table public.schedule_task_occurrence_exclusions enable row level security;

drop policy if exists "schedule_task_history_select_own_farm" on public.schedule_task_history;
create policy "schedule_task_history_select_own_farm" on public.schedule_task_history for select to authenticated
using (exists (select 1 from public.farm_members fm where fm.farm_id = schedule_task_history.farm_id and fm.user_id = auth.uid()));
drop policy if exists "schedule_task_history_insert_own_farm" on public.schedule_task_history;
create policy "schedule_task_history_insert_own_farm" on public.schedule_task_history for insert to authenticated
with check (exists (select 1 from public.farm_members fm where fm.farm_id = schedule_task_history.farm_id and fm.user_id = auth.uid()));

drop policy if exists "inventory_item_history_select_own_farm" on public.inventory_item_history;
create policy "inventory_item_history_select_own_farm" on public.inventory_item_history for select to authenticated
using (exists (select 1 from public.farm_members fm where fm.farm_id = inventory_item_history.farm_id and fm.user_id = auth.uid()));
drop policy if exists "inventory_item_history_insert_own_farm" on public.inventory_item_history;
create policy "inventory_item_history_insert_own_farm" on public.inventory_item_history for insert to authenticated
with check (exists (select 1 from public.farm_members fm where fm.farm_id = inventory_item_history.farm_id and fm.user_id = auth.uid()));

drop policy if exists "schedule_occurrence_exclusions_select_own_farm" on public.schedule_task_occurrence_exclusions;
create policy "schedule_occurrence_exclusions_select_own_farm" on public.schedule_task_occurrence_exclusions for select to authenticated
using (exists (select 1 from public.farm_members fm where fm.farm_id = schedule_task_occurrence_exclusions.farm_id and fm.user_id = auth.uid()));
drop policy if exists "schedule_occurrence_exclusions_insert_own_farm" on public.schedule_task_occurrence_exclusions;
create policy "schedule_occurrence_exclusions_insert_own_farm" on public.schedule_task_occurrence_exclusions for insert to authenticated
with check (exists (select 1 from public.farm_members fm where fm.farm_id = schedule_task_occurrence_exclusions.farm_id and fm.user_id = auth.uid()));
