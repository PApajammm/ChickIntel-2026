-- Setup egg_disposition_logs table for tracking egg transfers, sales, and disposals
create table if not exists public.egg_disposition_logs (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    egg_batch_id text,
    origin_batch_no text,
    color_name text,
    color_hex text,
    action_type text not null check (action_type in ('transfer', 'sell', 'dispose')),
    quantity integer not null default 0 check (quantity >= 0),
    target_chick_batch_id text,
    notes text,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_egg_disposition_logs_farm_id
    on public.egg_disposition_logs (farm_id);

create index if not exists idx_egg_disposition_logs_created_at
    on public.egg_disposition_logs (created_at desc);

alter table public.egg_disposition_logs enable row level security;

create policy "egg_disposition_logs_select_farm_members"
on public.egg_disposition_logs
for select
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = egg_disposition_logs.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "egg_disposition_logs_insert_farm_members"
on public.egg_disposition_logs
for insert
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = egg_disposition_logs.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "egg_disposition_logs_delete_farm_members"
on public.egg_disposition_logs
for delete
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = egg_disposition_logs.farm_id
          and fm.user_id = auth.uid()
    )
);
