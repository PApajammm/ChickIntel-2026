create table if not exists public.health_logs (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    photo_uri text,
    detected_illness text not null,
    behavior_ids text[] not null default '{}',
    result_summary text not null,
    recommendation_text text not null,
    action_status text not null default '',
    duration_value text not null default '',
    saved_at timestamptz not null default timezone('utc', now()),
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Ensure all optional & newer schema columns exist on health_logs
alter table public.health_logs add column if not exists disease_id uuid references public.diseases(id) on delete set null;
alter table public.health_logs add column if not exists confidence double precision;
alter table public.health_logs add column if not exists detection_source text;
alter table public.health_logs add column if not exists additional_observation text;
alter table public.health_logs add column if not exists action_status text default '';
alter table public.health_logs add column if not exists duration_value text default '';
alter table public.health_logs add column if not exists health_monitoring_id uuid;

create table if not exists public.scan_records (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    scan_type text not null check (scan_type in ('health', 'breed')),
    image_uri text,
    breed_name text,
    detected_illness text,
    raw_result jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_health_logs_farm_id
    on public.health_logs (farm_id);

create index if not exists idx_health_logs_saved_at
    on public.health_logs (saved_at desc);

create index if not exists idx_scan_records_farm_id
    on public.scan_records (farm_id);

create index if not exists idx_scan_records_scan_type
    on public.scan_records (scan_type);

drop trigger if exists health_logs_set_updated_at on public.health_logs;
create trigger health_logs_set_updated_at
before update on public.health_logs
for each row execute procedure public.set_updated_at();

drop trigger if exists scan_records_set_updated_at on public.scan_records;
create trigger scan_records_set_updated_at
before update on public.scan_records
for each row execute procedure public.set_updated_at();

alter table public.health_logs enable row level security;
alter table public.scan_records enable row level security;

create policy "health_logs_select_farm_members"
on public.health_logs
for select
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = health_logs.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "health_logs_insert_farm_members"
on public.health_logs
for insert
to authenticated
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = health_logs.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "health_logs_update_farm_members"
on public.health_logs
for update
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = health_logs.farm_id
          and fm.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = health_logs.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "health_logs_delete_farm_members"
on public.health_logs
for delete
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = health_logs.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "scan_records_select_farm_members"
on public.scan_records
for select
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = scan_records.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "scan_records_insert_farm_members"
on public.scan_records
for insert
to authenticated
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = scan_records.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "scan_records_update_farm_members"
on public.scan_records
for update
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = scan_records.farm_id
          and fm.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = scan_records.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "scan_records_delete_farm_members"
on public.scan_records
for delete
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = scan_records.farm_id
          and fm.user_id = auth.uid()
    )
);
