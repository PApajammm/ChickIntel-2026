create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text unique,
    display_name text,
    default_farm_id uuid null,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.farms (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    owner_user_id uuid not null references public.profiles (id) on delete cascade,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.farm_members (
    id uuid primary key default gen_random_uuid(),
    farm_id uuid not null references public.farms (id) on delete cascade,
    user_id uuid not null references public.profiles (id) on delete cascade,
    role text not null check (role in ('owner', 'manager', 'worker')),
    created_at timestamptz not null default timezone('utc', now()),
    unique (farm_id, user_id)
);

alter table public.profiles
    add constraint profiles_default_farm_id_fkey
        foreign key (default_farm_id)
            references public.farms (id)
            on delete set null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.profiles (id, email, display_name)
    values (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;

    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

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
    values (new_farm_id, auth.uid(), 'owner')
    on conflict (farm_id, user_id) do nothing;

    update public.profiles
    set default_farm_id = coalesce(default_farm_id, new_farm_id)
    where id = auth.uid();

    return new_farm_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.farm_members enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "farms_select_member"
on public.farms
for select
to authenticated
using (
    exists (
        select 1
        from public.farm_members fm
        where fm.farm_id = farms.id
          and fm.user_id = auth.uid()
    )
);

create policy "farms_insert_owner"
on public.farms
for insert
to authenticated
with check (owner_user_id = auth.uid());

create policy "farm_members_select_own"
on public.farm_members
for select
to authenticated
using (user_id = auth.uid());

create policy "farm_members_insert_owner_only"
on public.farm_members
for insert
to authenticated
with check (user_id = auth.uid() and role = 'owner');
