-- =============================================================
-- profiles-rls-fix.sql
-- Fixes RLS on public.profiles so admins can read all farmer
-- profiles through the admin dashboard (including the audit log
-- actor join), instead of only allowing dev@gmail.com.
--
-- Run this in the Supabase SQL Editor.
-- Safe to re-run: uses DROP IF EXISTS / CREATE.
-- =============================================================

-- 1. Helper function to check admin status without circular RLS
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
    select exists (
        select 1
        from public.profiles p
        where p.id = auth.uid()
          and p.is_admin = true
    );
$$;

-- 2. Allow admins to read all profiles
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
on public.profiles
for select
to authenticated
using (
    public.is_admin()
);

-- 3. Allow admins to update all profiles
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (
    public.is_admin()
)
with check (
    public.is_admin()
);
