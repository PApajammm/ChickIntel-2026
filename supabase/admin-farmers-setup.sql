-- 1. Add is_active and last_login_at columns to public.profiles if they don't exist
alter table public.profiles
add column if not exists is_active boolean default true,
add column if not exists last_login_at timestamptz;

-- 2. Drop any old lookup tables, functions or triggers to keep DB clean
drop table if exists public.admin_users cascade;
drop trigger if exists sync_profile_is_admin on public.profiles;
drop trigger if exists sync_profile_is_admin_to_admin_users_trig on public.profiles;
drop function if exists public.sync_profile_is_admin_to_auth();
drop function if exists public.sync_profile_is_admin_to_admin_users();
drop function if exists public.is_admin(uuid);

-- 3. Create RLS Policies for profiles (Admins) using direct JWT email verification
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
on public.profiles
for select
to authenticated
using (
    auth.jwt() ->> 'email' = 'dev@gmail.com'
);

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (
    auth.jwt() ->> 'email' = 'dev@gmail.com'
)
with check (
    auth.jwt() ->> 'email' = 'dev@gmail.com'
);

-- 4. Create RLS Policies for farms and farm_members (Admins)
drop policy if exists "farms_select_admin" on public.farms;
create policy "farms_select_admin"
on public.farms
for select
to authenticated
using (
    auth.jwt() ->> 'email' = 'dev@gmail.com'
);

drop policy if exists "farm_members_select_admin" on public.farm_members;
create policy "farm_members_select_admin"
on public.farm_members
for select
to authenticated
using (
    auth.jwt() ->> 'email' = 'dev@gmail.com'
);

drop policy if exists "farm_members_insert_admin" on public.farm_members;
create policy "farm_members_insert_admin"
on public.farm_members
for insert
to authenticated
with check (
    auth.jwt() ->> 'email' = 'dev@gmail.com'
);

-- 5. Trigger to automatically sync auth.users last_sign_in_at to public.profiles last_login_at
create or replace function public.sync_user_last_login()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    update public.profiles
    set last_login_at = new.last_sign_in_at
    where id = new.id;
    return new;
end;
$$;

drop trigger if exists sync_user_last_login_trig on auth.users;
create trigger sync_user_last_login_trig
after update of last_sign_in_at on auth.users
for each row
when (old.last_sign_in_at is distinct from new.last_sign_in_at)
execute procedure public.sync_user_last_login();

-- Sync existing users' last_sign_in_at to public.profiles.last_login_at
update public.profiles p
set last_login_at = u.last_sign_in_at
from auth.users u
where p.id = u.id;

-- 6. Auto-confirm user emails trigger (Auto-confirms farmer emails on creation so they can sign in immediately)
create or replace function public.auto_confirm_user_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
    if new.email_confirmed_at is null then
        new.email_confirmed_at := now();
    end if;
    return new;
end;
$$;

drop trigger if exists auto_confirm_user_email_trig on auth.users;
create trigger auto_confirm_user_email_trig
before insert on auth.users
for each row
execute procedure public.auto_confirm_user_email();

-- Confirm all existing unconfirmed user emails immediately
update auth.users
set email_confirmed_at = now()
where email_confirmed_at is null;

-- 7. Trigger to automatically attach new farmer profiles to the active farm upon creation
create or replace function public.auto_attach_farmer_to_farm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    target_farm_id uuid;
begin
    if new.is_admin = true then
        return new;
    end if;

    select id into target_farm_id
    from public.farms
    order by created_at asc
    limit 1;

    if target_farm_id is not null then
        insert into public.farm_members (farm_id, user_id, role)
        values (target_farm_id, new.id, 'farmer')
        on conflict (farm_id, user_id) do nothing;

        update public.profiles
        set default_farm_id = coalesce(default_farm_id, target_farm_id)
        where id = new.id;
    end if;

    return new;
end;
$$;

drop trigger if exists auto_attach_farmer_to_farm_trig on public.profiles;
create trigger auto_attach_farmer_to_farm_trig
after insert on public.profiles
for each row
execute procedure public.auto_attach_farmer_to_farm();

-- 8. Repair any existing users created without auth.identities records
insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
)
select
    id,
    id,
    jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
    'email',
    id::text,
    now(),
    created_at,
    updated_at
from auth.users
where id not in (select user_id from auth.identities)
on conflict do nothing;

-- 9. Repair any missing public.profiles rows for users in auth.users
insert into public.profiles (id, email, display_name, is_active, is_admin)
select
    u.id,
    u.email,
    coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1)),
    true,
    false
from auth.users u
where u.id not in (select id from public.profiles)
on conflict (id) do nothing;

-- 10. Auto-connect all existing farmers to the primary farm if not connected yet
do $$
declare
    target_farm_id uuid;
begin
    select id into target_farm_id
    from public.farms
    order by created_at asc
    limit 1;

    if target_farm_id is not null then
        -- Add missing farm memberships for all profiles
        insert into public.farm_members (farm_id, user_id, role)
        select target_farm_id, p.id, 'farmer'
        from public.profiles p
        where p.id not in (select user_id from public.farm_members)
        on conflict (farm_id, user_id) do nothing;

        -- Update default_farm_id on profiles
        update public.profiles
        set default_farm_id = target_farm_id
        where default_farm_id is null;
    end if;
end;
$$;
