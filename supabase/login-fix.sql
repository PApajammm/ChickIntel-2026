-- =============================================================
-- login-fix.sql
-- Fixes the login error caused by missing INSERT policy on
-- public.profiles (needed for the self-healing upsert in
-- auth-provider.tsx when a profile row is missing).
--
-- Run this in the Supabase SQL Editor.
-- Safe to re-run: uses DROP IF EXISTS / CREATE.
-- =============================================================

-- Allow each authenticated user to insert their own profile row.
-- This is required by the self-healing upsert in auth-provider.tsx
-- which runs when a profile is missing after sign-in.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert to authenticated
with check (id = auth.uid());

-- Allow admin (dev@gmail.com) to insert any profile row
-- (used when createFarmer is called from supabase-admin.ts).
drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
on public.profiles for insert to authenticated
with check (auth.jwt() ->> 'email' = 'dev@gmail.com');
