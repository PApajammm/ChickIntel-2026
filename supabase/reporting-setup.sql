create or replace view public.report_batch_daily_summary as
select
    farm_id,
    timezone('utc', created_at)::date as report_date,
    sum(female_count + male_count) as birds_recorded,
    sum(isolated_count) as isolated_birds,
    sum(killed_count) as lost_birds
from public.batches
group by farm_id, timezone('utc', created_at)::date;

create or replace view public.report_egg_daily_summary as
select
    farm_id,
    timezone('utc', created_at)::date as report_date,
    sum(egg_qty) as eggs_recorded,
    sum(hatched_qty) as eggs_hatched,
    sum(unhatched_qty) as eggs_unhatched,
    sum(damaged_qty) as eggs_damaged
from public.egg_batches
group by farm_id, timezone('utc', created_at)::date;

create or replace view public.report_inventory_daily_summary as
select
    farm_id,
    timezone('utc', created_at)::date as report_date,
    lower(trim(item_type)) as normalized_item_type,
    sum(qty) as total_qty
from public.inventory_items
group by farm_id, timezone('utc', created_at)::date, lower(trim(item_type));

create or replace function public.get_report_totals(
    p_farm_id uuid,
    p_start_date date,
    p_end_date date
)
returns table (
    birds_recorded bigint,
    isolated_birds bigint,
    lost_birds bigint,
    eggs_recorded bigint,
    eggs_hatched bigint,
    eggs_unhatched bigint,
    eggs_damaged bigint,
    feed_qty numeric,
    vitamin_med_qty numeric
)
language sql
security invoker
set search_path = public
as $$
    with batch_totals as (
        select
            coalesce(sum(r.birds_recorded), 0) as birds_recorded,
            coalesce(sum(r.isolated_birds), 0) as isolated_birds,
            coalesce(sum(r.lost_birds), 0) as lost_birds
        from public.report_batch_daily_summary r
        where r.farm_id = p_farm_id
          and r.report_date between p_start_date and p_end_date
    ),
    egg_totals as (
        select
            coalesce(sum(r.eggs_recorded), 0) as eggs_recorded,
            coalesce(sum(r.eggs_hatched), 0) as eggs_hatched,
            coalesce(sum(r.eggs_unhatched), 0) as eggs_unhatched,
            coalesce(sum(r.eggs_damaged), 0) as eggs_damaged
        from public.report_egg_daily_summary r
        where r.farm_id = p_farm_id
          and r.report_date between p_start_date and p_end_date
    ),
    inventory_totals as (
        select
            coalesce(sum(case when normalized_item_type like '%feed%' then total_qty else 0 end), 0) as feed_qty,
            coalesce(sum(case
                when normalized_item_type like '%vitamin%'
                  or normalized_item_type like '%med%'
                  or normalized_item_type like '%medicine%'
                then total_qty
                else 0
            end), 0) as vitamin_med_qty
        from public.report_inventory_daily_summary r
        where r.farm_id = p_farm_id
          and r.report_date between p_start_date and p_end_date
    )
    select
        batch_totals.birds_recorded,
        batch_totals.isolated_birds,
        batch_totals.lost_birds,
        egg_totals.eggs_recorded,
        egg_totals.eggs_hatched,
        egg_totals.eggs_unhatched,
        egg_totals.eggs_damaged,
        inventory_totals.feed_qty,
        inventory_totals.vitamin_med_qty
    from batch_totals, egg_totals, inventory_totals;
$$;

grant select on public.report_batch_daily_summary to authenticated;
grant select on public.report_egg_daily_summary to authenticated;
grant select on public.report_inventory_daily_summary to authenticated;
grant execute on function public.get_report_totals(uuid, date, date) to authenticated;
