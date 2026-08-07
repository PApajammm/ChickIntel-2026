begin;

alter table public.farm_members
    drop constraint if exists farm_members_role_check;

update public.farm_members
set role = 'farmer'
where role = 'owner';

alter table public.farm_members
    add constraint farm_members_role_check
        check (role in ('farmer', 'manager', 'worker'));

create or replace function public.create_farm_for_owner(farm_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    new_farm_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Not authenticated';
    end if;

    insert into public.farms (name, owner_user_id)
    values (farm_name, auth.uid())
    returning id into new_farm_id;

    insert into public.farm_members (farm_id, user_id, role)
    values (new_farm_id, auth.uid(), 'farmer')
    on conflict (farm_id, user_id) do nothing;

    update public.profiles
    set default_farm_id = coalesce(default_farm_id, new_farm_id)
    where id = auth.uid();

    return new_farm_id;
end;
$$;

drop policy if exists "farm_members_insert_owner_only" on public.farm_members;

create policy "farm_members_insert_farmer_only"
on public.farm_members
for insert
to authenticated
with check (user_id = auth.uid() and role = 'farmer');

commit;
