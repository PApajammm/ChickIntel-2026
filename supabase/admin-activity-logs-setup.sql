-- =============================================================
-- admin-activity-logs-setup.sql
-- Run this in the Supabase SQL Editor (admin / owner role).
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE.
-- =============================================================

-- 1. Create admin_audit_logs table
create table if not exists public.admin_audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references public.profiles(id) on delete set null,
    action char(1) not null check (action in ('I','U','D')),
    table_name text not null,
    record_id uuid,
    new_data jsonb,
    old_data jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

-- 2. Indexes for fast admin queries
create index if not exists idx_admin_audit_logs_actor
    on public.admin_audit_logs (actor_id);

create index if not exists idx_admin_audit_logs_table
    on public.admin_audit_logs (table_name);

create index if not exists idx_admin_audit_logs_created
    on public.admin_audit_logs (created_at desc);

-- 3. Generic row-level trigger function
create or replace function public.handle_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if tg_op = 'INSERT' then
        insert into public.admin_audit_logs (
            actor_id, action, table_name, record_id, new_data, old_data
        ) values (
            auth.uid(),
            'I',
            tg_table_name,
            (NEW.id)::uuid,
            to_jsonb(NEW),
            null
        );
        return NEW;
    elsif tg_op = 'UPDATE' then
        insert into public.admin_audit_logs (
            actor_id, action, table_name, record_id, new_data, old_data
        ) values (
            auth.uid(),
            'U',
            tg_table_name,
            (NEW.id)::uuid,
            to_jsonb(NEW),
            to_jsonb(OLD)
        );
        return NEW;
    elsif tg_op = 'DELETE' then
        insert into public.admin_audit_logs (
            actor_id, action, table_name, record_id, new_data, old_data
        ) values (
            auth.uid(),
            'D',
            tg_table_name,
            (OLD.id)::uuid,
            null,
            to_jsonb(OLD)
        );
        return OLD;
    end if;
    return NULL;
end;
$$;

-- 4. Attach triggers to all farmer-facing tables
drop trigger if exists audit_inventory_items on public.inventory_items;
create trigger audit_inventory_items
    after insert or update or delete on public.inventory_items
    for each row execute function public.handle_audit_log();

drop trigger if exists audit_batches on public.batches;
create trigger audit_batches
    after insert or update or delete on public.batches
    for each row execute function public.handle_audit_log();

drop trigger if exists audit_egg_batches on public.egg_batches;
create trigger audit_egg_batches
    after insert or update or delete on public.egg_batches
    for each row execute function public.handle_audit_log();

drop trigger if exists audit_health_logs on public.health_logs;
create trigger audit_health_logs
    after insert or update or delete on public.health_logs
    for each row execute function public.handle_audit_log();

drop trigger if exists audit_health_monitoring on public.health_monitoring;
create trigger audit_health_monitoring
    after insert or update or delete on public.health_monitoring
    for each row execute function public.handle_audit_log();

drop trigger if exists audit_schedule_task_completions on public.schedule_task_completions;
create trigger audit_schedule_task_completions
    after insert or update or delete on public.schedule_task_completions
    for each row execute function public.handle_audit_log();

-- profiles: only track meaningful admin changes (NOT last_login_at which fires on every login)
-- Limiting to specific columns prevents spurious "Unknown updated farmer account" entries on login.
drop trigger if exists audit_profiles on public.profiles;
create trigger audit_profiles
    after update of display_name, is_active, is_admin, default_farm_id on public.profiles
    for each row execute function public.handle_audit_log();

drop trigger if exists audit_breeds on public.breeds;
create trigger audit_breeds
    after insert or update or delete on public.breeds
    for each row execute function public.handle_audit_log();

drop trigger if exists audit_inventory_categories on public.inventory_categories;
create trigger audit_inventory_categories
    after insert or update or delete on public.inventory_categories
    for each row execute function public.handle_audit_log();

-- 5. Enable RLS on admin_audit_logs
alter table public.admin_audit_logs enable row level security;

-- 6. RLS policy: admins can read all audit logs
drop policy if exists "audit_logs_select_admin" on public.admin_audit_logs;
create policy "audit_logs_select_admin"
on public.admin_audit_logs for select to authenticated
using (
    exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_admin = true
    )
);

-- 7. RLS policy: authenticated users can insert audit logs (e.g. login events)
drop policy if exists "audit_logs_insert_authenticated" on public.admin_audit_logs;
create policy "audit_logs_insert_authenticated"
on public.admin_audit_logs for insert to authenticated
with check (true);