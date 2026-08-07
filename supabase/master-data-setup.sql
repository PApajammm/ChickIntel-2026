create table if not exists public.breeds (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    category text,
    temperament text,
    purpose text,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.feed_types (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.inventory_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    description text,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.symptoms (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    label text not null unique,
    description text,
    severity text,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.medications (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    medication_type text,
    notes text,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.vitamins (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    vitamin_type text,
    notes text,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.breeds enable row level security;
alter table public.feed_types enable row level security;
alter table public.inventory_categories enable row level security;
alter table public.symptoms enable row level security;
alter table public.medications enable row level security;
alter table public.vitamins enable row level security;

create policy "breeds_read_authenticated"
on public.breeds
for select
to authenticated
using (true);

create policy "feed_types_read_authenticated"
on public.feed_types
for select
to authenticated
using (true);

create policy "inventory_categories_read_authenticated"
on public.inventory_categories
for select
to authenticated
using (true);

create policy "symptoms_read_authenticated"
on public.symptoms
for select
to authenticated
using (true);

create policy "medications_read_authenticated"
on public.medications
for select
to authenticated
using (true);

create policy "vitamins_read_authenticated"
on public.vitamins
for select
to authenticated
using (true);

insert into public.breeds (name, category, temperament, purpose)
values
    ('Rhode Island Red', 'Chicken', 'Hardy', 'Dual-purpose'),
    ('White Leghorn', 'Chicken', 'Active', 'Egg production'),
    ('Plymouth Rock', 'Chicken', 'Docile', 'Dual-purpose'),
    ('Australorp', 'Chicken', 'Calm', 'Egg production'),
    ('Sussex', 'Chicken', 'Friendly', 'Dual-purpose'),
    ('Silkie', 'Chicken', 'Gentle', 'Ornamental'),
    ('Barred Rock', 'Chicken', 'Docile', 'Dual-purpose')
on conflict (name) do nothing;

insert into public.feed_types (name, description)
values
    ('Starter', 'Feed for newly hatched chicks'),
    ('Grower', 'Feed for growing birds before laying stage'),
    ('Layer', 'Feed formulated for laying hens'),
    ('Finisher', 'Feed used near maturity'),
    ('Maintenance', 'General upkeep feed')
on conflict (name) do nothing;

insert into public.inventory_categories (name, description)
values
    ('Feeds', 'Feed and ration inventory'),
    ('Vitamins', 'Vitamin and supplement stock'),
    ('Medicine', 'Medical stock and treatments'),
    ('Equipment', 'Farm tools and equipment')
on conflict (name) do nothing;

insert into public.symptoms (code, label, description, severity)
values
    ('restless', 'Restless', 'Unusual pacing or inability to settle', 'low'),
    ('stressed', 'Stressed', 'Visible signs of stress or agitation', 'medium'),
    ('weak', 'Weak', 'Reduced strength or poor stance', 'high'),
    ('lethargic', 'Lethargic', 'Low movement and reduced alertness', 'high'),
    ('poor_appetite', 'Poor appetite', 'Reduced feed or water intake', 'medium'),
    ('labored_breathing', 'Labored breathing', 'Heavy or difficult breathing', 'high'),
    ('discharge', 'Nasal or eye discharge', 'Visible mucus or eye drainage', 'high'),
    ('ruffled_feathers', 'Ruffled feathers', 'Poor feather posture or condition', 'medium'),
    ('isolating', 'Isolating from flock', 'Separating from the group', 'medium')
on conflict (code) do nothing;

insert into public.medications (name, medication_type, notes)
values
    ('Oxytetracycline', 'Antibiotic', 'Common broad-spectrum poultry antibiotic'),
    ('Amprolium', 'Coccidiostat', 'Used for coccidiosis management'),
    ('Tylosin', 'Antibiotic', 'Used for respiratory issues'),
    ('Dewormer', 'Antiparasitic', 'General parasite control')
on conflict (name) do nothing;

insert into public.vitamins (name, vitamin_type, notes)
values
    ('Vitamin C', 'Supplement', 'Supports stress recovery'),
    ('Vitamin B Complex', 'Supplement', 'Supports metabolism and recovery'),
    ('Electrolyte Plus', 'Electrolyte', 'Hydration support'),
    ('Multivitamins', 'Supplement', 'General health support')
on conflict (name) do nothing;
