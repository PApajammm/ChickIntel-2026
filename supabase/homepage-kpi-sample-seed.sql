-- Homepage KPI sample seed
-- This version auto-selects the most recently created farm in public.farms.
-- If your project has more than one farm and you want a specific one, run:
-- select id, name, created_at from public.farms order by created_at desc;
-- Then replace the params CTE with:
-- select 'YOUR_FARM_UUID'::uuid as farm_id
--
-- This script inserts:
-- 1. A chicken batch inside the current "30 days" window
-- 2. A chicken batch inside the current "12 months" window
-- 3. A feed item inside the current "30 days" window
-- 4. A feed item inside the current "12 months" window
--
-- Important:
-- The app's "30 days" KPI window includes today, so its start date is
-- current_date - 29 days, not current_date - 30 days.
-- If today is 2026-04-13, that boundary is 2026-03-15.
-- The "12 months" KPI window starts at current_date - 12 months.

with params as (
    select id as farm_id
    from public.farms
    order by created_at desc
    limit 1
),
sample_dates as (
    select
        farm_id,
        (date_trunc('day', now()) - interval '29 days' + interval '09 hours') as within_30_days_at,
        (date_trunc('day', now()) - interval '12 months' + interval '09 hours') as within_12_months_at
    from params
)
insert into public.batches (
    farm_id,
    batch_no,
    breed_name,
    female_count,
    male_count,
    age_label,
    isolated_count,
    killed_count,
    color_name,
    color_hex,
    created_at,
    updated_at
)
select
    farm_id,
    'KPI-30D-CHK',
    'Rhode Island Red',
    24,
    6,
    '30 days old',
    0,
    0,
    'Red',
    '#D84A49',
    within_30_days_at,
    within_30_days_at
from sample_dates
union all
select
    farm_id,
    'KPI-12M-CHK',
    'White Leghorn',
    18,
    4,
    '12 months old',
    0,
    0,
    'Blue',
    '#4A86D8',
    within_12_months_at,
    within_12_months_at
from sample_dates
on conflict (farm_id, batch_no) do update
set
    breed_name = excluded.breed_name,
    female_count = excluded.female_count,
    male_count = excluded.male_count,
    age_label = excluded.age_label,
    isolated_count = excluded.isolated_count,
    killed_count = excluded.killed_count,
    color_name = excluded.color_name,
    color_hex = excluded.color_hex,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at;

with params as (
    select id as farm_id
    from public.farms
    order by created_at desc
    limit 1
),
sample_dates as (
    select
        farm_id,
        (date_trunc('day', now()) - interval '29 days' + interval '10 hours') as within_30_days_at,
        (date_trunc('day', now()) - interval '12 months' + interval '10 hours') as within_12_months_at
    from params
)
insert into public.inventory_items (
    farm_id,
    item_type,
    item_name,
    qty,
    unit,
    price,
    status_percent,
    purchased_date,
    delivered_date,
    created_at,
    updated_at
)
select
    farm_id,
    'Chicken Feed',
    'KPI Demo Feed 30 Days',
    8,
    'kg',
    560,
    100,
    within_30_days_at::date,
    within_30_days_at::date,
    within_30_days_at,
    within_30_days_at
from sample_dates
union all
select
    farm_id,
    'Chicken Feed',
    'KPI Demo Feed 12 Months',
    14,
    'kg',
    980,
    100,
    within_12_months_at::date,
    within_12_months_at::date,
    within_12_months_at,
    within_12_months_at
from sample_dates
on conflict do nothing;

-- Optional cleanup later:
-- delete from public.batches
-- where farm_id = (
--     select id
--     from public.farms
--     order by created_at desc
--     limit 1
-- )
--   and batch_no in ('KPI-30D-CHK', 'KPI-12M-CHK');
--
-- delete from public.inventory_items
-- where farm_id = (
--     select id
--     from public.farms
--     order by created_at desc
--     limit 1
-- )
--   and item_name in ('KPI Demo Feed 30 Days', 'KPI Demo Feed 12 Months');
