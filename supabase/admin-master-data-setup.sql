-- Admin Master Data SQL Setup Script for Breeds and Inventory Categories
-- Run this in your Supabase SQL Editor to enable full CRUD access for breeds and inventory_categories

-- 1. Ensure public.breeds is readable by users but writable only by admins
alter table if exists public.breeds enable row level security;

drop policy if exists "breeds_read_authenticated" on public.breeds;
drop policy if exists "breeds_all_authenticated" on public.breeds;
drop policy if exists "breeds_insert_admin" on public.breeds;
drop policy if exists "breeds_update_admin" on public.breeds;
drop policy if exists "breeds_delete_admin" on public.breeds;

create policy "breeds_read_authenticated"
on public.breeds
for select
to authenticated
using (true);

create policy "breeds_insert_admin"
on public.breeds for insert to authenticated
with check (public.is_admin());

create policy "breeds_update_admin"
on public.breeds for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "breeds_delete_admin"
on public.breeds for delete to authenticated
using (public.is_admin());

-- 2. Ensure public.inventory_categories is readable by users but writable only by admins
alter table if exists public.inventory_categories enable row level security;

drop policy if exists "inventory_categories_read_authenticated" on public.inventory_categories;
drop policy if exists "inventory_categories_all_authenticated" on public.inventory_categories;
drop policy if exists "inventory_categories_insert_admin" on public.inventory_categories;
drop policy if exists "inventory_categories_update_admin" on public.inventory_categories;
drop policy if exists "inventory_categories_delete_admin" on public.inventory_categories;

create policy "inventory_categories_read_authenticated"
on public.inventory_categories
for select
to authenticated
using (true);

create policy "inventory_categories_insert_admin"
on public.inventory_categories for insert to authenticated
with check (public.is_admin());

create policy "inventory_categories_update_admin"
on public.inventory_categories for update to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "inventory_categories_delete_admin"
on public.inventory_categories for delete to authenticated
using (public.is_admin());

-- 3. Seed default breeds if not present
insert into public.breeds (name, purpose, is_active)
values
    ('Barred Rock', 'Calm, hardy dual-purpose chickens with dependable brown egg production.', true),
    ('Rhode Island Red', 'Hardy, active, dual-purpose breed known for excellent egg production.', true),
    ('Silkie', 'Gentle, friendly, and highly ornamental breed with fluffy plumage.', true)
on conflict (name) do update set
    purpose = excluded.purpose,
    is_active = excluded.is_active;

-- 4. Seed default inventory categories if not present
insert into public.inventory_categories (name, description, is_active)
values
    ('Feeds', 'Standard poultry feed, mash, crumbles, and grain rations.', true),
    ('Vitamins', 'Water-soluble vitamins, stress packs, and immune booster supplements.', true),
    ('Medicine', 'Antibiotics, coccidiostats, and respiratory treatments.', true),
    ('Equipment', 'Farm tools and equipment, feeders, waterers, and nesting boxes.', true)
on conflict (name) do update set
    description = excluded.description,
    is_active = excluded.is_active;
