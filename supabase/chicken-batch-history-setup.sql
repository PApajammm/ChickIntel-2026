create table if not exists public.chicken_batch_history (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    batch_no text not null,
    breed_name text not null,
    female_count integer not null default 0,
    male_count integer not null default 0,
    age_label text not null,
    isolated_count integer not null default 0,
    killed_count integer not null default 0,
    color_name text,
    color_hex text,
    created_at timestamptz,
    deleted_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_chicken_batch_history_farm_deleted
    on public.chicken_batch_history (farm_id, deleted_at desc);

alter table public.chicken_batch_history enable row level security;

drop policy if exists "chicken_batch_history_select_own_farm" on public.chicken_batch_history;
create policy "chicken_batch_history_select_own_farm"
on public.chicken_batch_history for select to authenticated
using (exists (select 1 from public.farm_members fm where fm.farm_id = chicken_batch_history.farm_id and fm.user_id = auth.uid()));

drop policy if exists "chicken_batch_history_insert_own_farm" on public.chicken_batch_history;
create policy "chicken_batch_history_insert_own_farm"
on public.chicken_batch_history for insert to authenticated
with check (exists (select 1 from public.farm_members fm where fm.farm_id = chicken_batch_history.farm_id and fm.user_id = auth.uid()));