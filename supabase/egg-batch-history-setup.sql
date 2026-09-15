create table if not exists public.egg_batch_history (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    batch_no text not null,
    egg_qty integer not null default 0,
    line_no integer not null default 0,
    age_unit text not null check (age_unit in ('Days old', 'Weeks old')),
    hatched_qty integer not null default 0,
    damaged_qty integer not null default 0,
    unhatched_qty integer not null default 0,
    color_name text,
    color_hex text,
    origin text,
    created_at timestamptz,
    deleted_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_egg_batch_history_farm_deleted
    on public.egg_batch_history (farm_id, deleted_at desc);

alter table public.egg_batch_history enable row level security;

drop policy if exists "egg_batch_history_select_own_farm" on public.egg_batch_history;
create policy "egg_batch_history_select_own_farm"
on public.egg_batch_history for select to authenticated
using (exists (select 1 from public.farm_members fm where fm.farm_id = egg_batch_history.farm_id and fm.user_id = auth.uid()));

drop policy if exists "egg_batch_history_insert_own_farm" on public.egg_batch_history;
create policy "egg_batch_history_insert_own_farm"
on public.egg_batch_history for insert to authenticated
with check (exists (select 1 from public.farm_members fm where fm.farm_id = egg_batch_history.farm_id and fm.user_id = auth.uid()));
