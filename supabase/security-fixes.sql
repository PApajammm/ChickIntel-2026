-- Replace hard-coded admin email check with the is_admin() helper.
drop policy if exists "profiles_insert_admin" on public.profiles;
create policy "profiles_insert_admin"
on public.profiles for insert to authenticated
with check (public.is_admin());

-- Only allow users to write audit rows as themselves.
drop policy if exists "audit_logs_insert_authenticated" on public.admin_audit_logs;
create policy "audit_logs_insert_authenticated"
on public.admin_audit_logs for insert to authenticated
with check (actor_id = auth.uid());
