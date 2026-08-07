-- Drop old tables if they exist
drop table if exists public.health_symptoms cascade;
drop table if exists public.symptom_categories cascade;

-- Create behavior_categories table
create table if not exists public.behavior_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    created_at timestamptz not null default timezone('utc', now())
);

-- Create health_behaviors table
create table if not exists public.health_behaviors (
    id uuid primary key default gen_random_uuid(),
    category_id uuid not null references public.behavior_categories (id) on delete cascade,
    name text not null unique,
    description text,
    created_at timestamptz not null default timezone('utc', now())
);

-- Enable Row Level Security (RLS)
alter table public.behavior_categories enable row level security;
alter table public.health_behaviors enable row level security;

-- Policies for select
drop policy if exists "behavior_categories_read_authenticated" on public.behavior_categories;
create policy "behavior_categories_read_authenticated"
on public.behavior_categories
for select
to authenticated
using (true);

drop policy if exists "health_behaviors_read_authenticated" on public.health_behaviors;
create policy "health_behaviors_read_authenticated"
on public.health_behaviors
for select
to authenticated
using (true);

-- Insert behavior categories
insert into public.behavior_categories (name)
values
    ('Activity & Posture'),
    ('Locomotion & Movement'),
    ('Feeding & Maintenance'),
    ('Social & Vocalization')
on conflict (name) do nothing;

-- Insert health behaviors
insert into public.health_behaviors (category_id, name, description)
select c.id, b.name, b.description
from (
    values
        ('Activity & Posture', 'Lethargy', 'Unusually low activity, weakness, or generalized inactivity.'),
        ('Activity & Posture', 'Huddling', 'Standing or sitting closely together, often with fluffed feathers.'),
        ('Activity & Posture', 'Wing Drooping', 'Wings hung unusually low or dragging, indicating weakness or heat stress.'),
        ('Activity & Posture', 'Isolating from Flock', 'Staying alone or hiding in corners away from the rest of the flock.'),
        ('Activity & Posture', 'Sitting / Lying Constantly', 'Reluctance or inability to stand up or walk.'),
        ('Locomotion & Movement', 'Limping', 'Difficulty walking or favoring one leg/joint.'),
        ('Locomotion & Movement', 'Stumbling / Incoordination', 'Unsteady movements, loss of balance, or tilting.'),
        ('Locomotion & Movement', 'Head Shaking / Twisting', 'Frequent shaking of the head or holding it at odd angles (wry neck).'),
        ('Feeding & Maintenance', 'Reduced Feed Intake', 'Eating significantly less than usual or ignoring feed entirely.'),
        ('Feeding & Maintenance', 'Reduced Water Intake', 'Drinking significantly less water than usual.'),
        ('Feeding & Maintenance', 'Excessive Scratching / Preening', 'Constant scratching or picking at feathers, indicating discomfort or parasites.'),
        ('Social & Vocalization', 'Aggressive Pecking', 'Attacking, chasing, or pecking aggressively at other chickens.'),
        ('Social & Vocalization', 'Feather Pulling', 'Pecking and pulling out feathers from flock mates.'),
        ('Social & Vocalization', 'Abnormal Vocalization', 'Loud distress-like calling, screeching, or complete silence when active.'),
        ('Social & Vocalization', 'Panting', 'Rapid open-mouth breathing indicating heat stress or respiratory struggle.')
) as b(category_name, name, description)
join public.behavior_categories c on c.name = b.category_name
on conflict (name) do update
set
    category_id = excluded.category_id,
    description = excluded.description;
