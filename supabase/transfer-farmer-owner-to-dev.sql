-- Run this in the Supabase SQL Editor with an admin/owner account.
-- It transfers all farms connected to farmer@gmail.com and owner@gmail.com
-- to dev@gmail.com. Farm-scoped records stay attached through farm_id.

begin;

do $$
declare
    target_email constant text := 'dev@gmail.com';
    source_emails constant text[] := array['farmer@gmail.com', 'owner@gmail.com'];
    target_user_id uuid;
    source_user_ids uuid[];
    matched_source_count integer;
    transferred_farm_count integer;
    target_default_farm_id uuid;
begin
    select id
    into target_user_id
    from auth.users
    where lower(email) = target_email;

    if target_user_id is null then
        raise exception 'Target user % does not exist in auth.users. Create it in Authentication > Users first.', target_email;
    end if;

    select array_agg(id), count(*)
    into source_user_ids, matched_source_count
    from auth.users
    where lower(email) = any(source_emails);

    if matched_source_count <> array_length(source_emails, 1) then
        raise exception 'Expected source users %, but found %. Existing matched user ids: %',
            source_emails,
            matched_source_count,
            source_user_ids;
    end if;

    insert into public.profiles (id, email, display_name)
    values (target_user_id, target_email, 'Developer')
    on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name);

    create temporary table transfer_farms on commit drop as
    select distinct f.id, f.created_at
    from public.farms f
    where f.owner_user_id = any(source_user_ids)
       or exists (
           select 1
           from public.farm_members fm
           where fm.farm_id = f.id
             and fm.user_id = any(source_user_ids)
       );

    select count(*)
    into transferred_farm_count
    from transfer_farms;

    if transferred_farm_count = 0 then
        raise exception 'No farms found for source users %.', source_emails;
    end if;

    update public.farms
    set owner_user_id = target_user_id
    where id in (select id from transfer_farms);

    insert into public.farm_members (farm_id, user_id, role)
    select id, target_user_id, 'farmer'
    from transfer_farms
    on conflict (farm_id, user_id) do update
    set role = 'farmer';

    delete from public.farm_members
    where user_id = any(source_user_ids)
      and farm_id in (select id from transfer_farms);

    update public.profiles
    set default_farm_id = null
    where id = any(source_user_ids)
      and default_farm_id in (select id from transfer_farms);

    select id
    into target_default_farm_id
    from transfer_farms
    order by created_at
    limit 1;

    update public.profiles
    set default_farm_id = target_default_farm_id
    where id = target_user_id;

    raise notice 'Transferred % farm(s) from % to %.',
        transferred_farm_count,
        source_emails,
        target_email;
end $$;

commit;

-- Optional verification after commit:
-- select p.email, p.default_farm_id, fm.farm_id, fm.role, f.name
-- from public.profiles p
-- left join public.farm_members fm on fm.user_id = p.id
-- left join public.farms f on f.id = fm.farm_id
-- where lower(p.email) in ('dev@gmail.com', 'farmer@gmail.com', 'owner@gmail.com')
-- order by p.email, f.created_at;
