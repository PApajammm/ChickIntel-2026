alter table public.egg_batches
    add column if not exists transferred_hatched_qty integer not null default 0,
    add column if not exists disposed_damaged_qty integer not null default 0,
    add column if not exists sold_qty integer not null default 0;