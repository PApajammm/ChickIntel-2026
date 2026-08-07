create table if not exists public.batches (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    batch_no text not null,
    breed_name text not null,
    female_count integer not null default 0 check (female_count >= 0),
    male_count integer not null default 0 check (male_count >= 0),
    age_label text not null,
    isolated_count integer not null default 0 check (isolated_count >= 0),
    killed_count integer not null default 0 check (killed_count >= 0),
    color_name text,
    color_hex text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    unique (farm_id, batch_no)
);

create table if not exists public.egg_batches (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    batch_no text not null,
    egg_qty integer not null default 0 check (egg_qty >= 0),
    line_no integer not null default 0 check (line_no >= 0),
    age_unit text not null check (age_unit in ('Days old', 'Weeks old')),
    hatched_qty integer not null default 0 check (hatched_qty >= 0),
    damaged_qty integer not null default 0 check (damaged_qty >= 0),
    unhatched_qty integer not null default 0 check (unhatched_qty >= 0),
    color_name text,
    color_hex text,
    origin text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory_items (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    item_type text not null,
    item_name text not null,
    qty numeric(12, 2) not null default 0 check (qty >= 0),
    unit text not null,
    price numeric(12, 2),
    status_percent integer not null default 0 check (status_percent between 0 and 100),
    purchased_date date,
    delivered_date date,
    expiration_date date,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_batches_farm_id
    on public.batches (farm_id);

create index if not exists idx_egg_batches_farm_id
    on public.egg_batches (farm_id);

create index if not exists idx_inventory_items_farm_id
    on public.inventory_items (farm_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = timezone('utc', now());
    return new;
end;
$$;

drop trigger if exists batches_set_updated_at on public.batches;
create trigger batches_set_updated_at
before update on public.batches
for each row execute procedure public.set_updated_at();

drop trigger if exists egg_batches_set_updated_at on public.egg_batches;
create trigger egg_batches_set_updated_at
before update on public.egg_batches
for each row execute procedure public.set_updated_at();

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute procedure public.set_updated_at();

alter table public.batches enable row level security;
alter table public.egg_batches enable row level security;
alter table public.inventory_items enable row level security;

create policy "batches_select_farm_members"
on public.batches
for select
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = batches.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "batches_insert_farm_members"
on public.batches
for insert
to authenticated
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = batches.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "batches_update_farm_members"
on public.batches
for update
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = batches.farm_id
          and fm.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = batches.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "batches_delete_farm_members"
on public.batches
for delete
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = batches.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "egg_batches_select_farm_members"
on public.egg_batches
for select
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = egg_batches.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "egg_batches_insert_farm_members"
on public.egg_batches
for insert
to authenticated
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = egg_batches.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "egg_batches_update_farm_members"
on public.egg_batches
for update
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = egg_batches.farm_id
          and fm.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = egg_batches.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "egg_batches_delete_farm_members"
on public.egg_batches
for delete
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = egg_batches.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "inventory_items_select_farm_members"
on public.inventory_items
for select
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = inventory_items.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "inventory_items_insert_farm_members"
on public.inventory_items
for insert
to authenticated
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = inventory_items.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "inventory_items_update_farm_members"
on public.inventory_items
for update
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = inventory_items.farm_id
          and fm.user_id = auth.uid()
    )
)
with check (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = inventory_items.farm_id
          and fm.user_id = auth.uid()
    )
);

create policy "inventory_items_delete_farm_members"
on public.inventory_items
for delete
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = inventory_items.farm_id
          and fm.user_id = auth.uid()
    )
);
