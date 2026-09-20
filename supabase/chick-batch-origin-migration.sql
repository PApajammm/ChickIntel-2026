-- Run this once in the Supabase SQL Editor for existing projects.
alter table public.batches
    add column if not exists origin_batch_no text,
    add column if not exists source_egg_batch_id uuid;

create index if not exists idx_batches_origin_batch_no
    on public.batches (farm_id, origin_batch_no);

create index if not exists idx_batches_source_egg_batch_id
    on public.batches (farm_id, source_egg_batch_id);