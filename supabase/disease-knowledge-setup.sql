create table if not exists public.diseases (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    name text not null unique,
    short_label text,
    summary text,
    severity text check (severity in ('low', 'medium', 'high', 'critical')),
    reference_source text,
    is_active boolean not null default true,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.disease_aliases (
    id uuid primary key default gen_random_uuid(),
    disease_id uuid not null references public.diseases (id) on delete cascade,
    alias text not null,
    alias_type text not null default 'common_name',
    created_at timestamptz not null default timezone('utc', now()),
    unique (disease_id, alias)
);

create table if not exists public.disease_symptoms (
    id uuid primary key default gen_random_uuid(),
    disease_id uuid not null references public.diseases (id) on delete cascade,
    symptom_id uuid not null references public.symptoms (id) on delete cascade,
    weight numeric(5, 2) not null default 1.0,
    is_primary boolean not null default false,
    created_at timestamptz not null default timezone('utc', now()),
    unique (disease_id, symptom_id)
);

create table if not exists public.disease_treatments (
    id uuid primary key default gen_random_uuid(),
    disease_id uuid not null references public.diseases (id) on delete cascade,
    title text not null,
    treatment_text text not null,
    medication_id uuid null references public.medications (id) on delete set null,
    vitamin_id uuid null references public.vitamins (id) on delete set null,
    sort_order integer not null default 0,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.disease_reference_images (
    id uuid primary key default gen_random_uuid(),
    disease_id uuid not null references public.diseases (id) on delete cascade,
    image_path text not null,
    image_caption text,
    body_region text,
    example_type text not null default 'reference',
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.disease_detection_rules (
    id uuid primary key default gen_random_uuid(),
    disease_id uuid not null references public.diseases (id) on delete cascade,
    rule_name text not null,
    required_symptom_codes text[] not null default '{}',
    optional_symptom_codes text[] not null default '{}',
    blocked_symptom_codes text[] not null default '{}',
    min_score numeric(5, 2) not null default 0,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_disease_aliases_disease_id
    on public.disease_aliases (disease_id);

create index if not exists idx_disease_symptoms_disease_id
    on public.disease_symptoms (disease_id);

create index if not exists idx_disease_treatments_disease_id
    on public.disease_treatments (disease_id);

create index if not exists idx_disease_reference_images_disease_id
    on public.disease_reference_images (disease_id);

create index if not exists idx_disease_detection_rules_disease_id
    on public.disease_detection_rules (disease_id);

drop trigger if exists diseases_set_updated_at on public.diseases;
create trigger diseases_set_updated_at
before update on public.diseases
for each row execute procedure public.set_updated_at();

alter table public.diseases enable row level security;
alter table public.disease_aliases enable row level security;
alter table public.disease_symptoms enable row level security;
alter table public.disease_treatments enable row level security;
alter table public.disease_reference_images enable row level security;
alter table public.disease_detection_rules enable row level security;

create policy "diseases_read_authenticated"
on public.diseases
for select
to authenticated
using (true);

create policy "disease_aliases_read_authenticated"
on public.disease_aliases
for select
to authenticated
using (true);

create policy "disease_symptoms_read_authenticated"
on public.disease_symptoms
for select
to authenticated
using (true);

create policy "disease_treatments_read_authenticated"
on public.disease_treatments
for select
to authenticated
using (true);

create policy "disease_reference_images_read_authenticated"
on public.disease_reference_images
for select
to authenticated
using (true);

create policy "disease_detection_rules_read_authenticated"
on public.disease_detection_rules
for select
to authenticated
using (true);

alter table public.health_logs
    add column if not exists disease_id uuid null references public.diseases (id) on delete set null;

alter table public.health_logs
    add column if not exists detection_source text null check (
        detection_source in ('image_model', 'image_plus_behavior', 'manual', 'reference_match')
    );

alter table public.health_logs
    add column if not exists confidence numeric(5, 2) null check (confidence >= 0 and confidence <= 100);

alter table public.scan_records
    add column if not exists disease_id uuid null references public.diseases (id) on delete set null;

alter table public.scan_records
    add column if not exists confidence numeric(5, 2) null check (confidence >= 0 and confidence <= 100);
