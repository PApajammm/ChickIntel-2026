-- Admin Master Data SQL Setup Script for Breeds and Inventory Categories
-- Run this in your Supabase SQL Editor to enable full CRUD access for breeds and inventory_categories

-- 1. Ensure public.breeds RLS allows select, insert, update, delete for authenticated users
alter table if exists public.breeds enable row level security;

drop policy if exists "breeds_read_authenticated" on public.breeds;
drop policy if exists "breeds_all_authenticated" on public.breeds;

create policy "breeds_all_authenticated"
on public.breeds
for all
to authenticated
using (true)
with check (true);

-- 2. Ensure public.inventory_categories RLS allows select, insert, update, delete for authenticated users
alter table if exists public.inventory_categories enable row level security;

drop policy if exists "inventory_categories_read_authenticated" on public.inventory_categories;
drop policy if exists "inventory_categories_all_authenticated" on public.inventory_categories;

create policy "inventory_categories_all_authenticated"
on public.inventory_categories
for all
to authenticated
using (true)
with check (true);

-- 3. Seed default breeds if not present
insert into public.breeds (name, purpose, is_active)
values
    ('Rhode Island Red', 'Hardy, active, dual-purpose breed known for excellent egg production.', true),
    ('White Leghorn', 'Active and flighty breed, highly efficient producer of large white eggs.', true),
    ('Australorp', 'Calm, gentle, and quiet egg layers. Excellent backyard chickens.', true),
    ('Silkie', 'Gentle, friendly, and highly ornamental breed with fluffy plumage.', true),
    ('Plymouth Rock', 'Docile, cold-hardy dual-purpose chickens. Great for beginners.', true)
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
