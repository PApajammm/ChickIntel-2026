create table if not exists public.symptom_categories (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.health_symptoms (
    id uuid primary key default gen_random_uuid(),
    category_id uuid not null references public.symptom_categories (id) on delete restrict,
    name text not null unique,
    description text,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.diseases
    add column if not exists disease_name text;

alter table public.diseases
    add column if not exists description text;

alter table public.diseases
    add column if not exists status text;

alter table public.diseases
    add column if not exists recovery_duration text;

update public.diseases
set
    disease_name = coalesce(disease_name, name),
    description = coalesce(description, summary),
    status = coalesce(
        status,
        case
            when severity in ('critical', 'high') then 'Isolation'
            else 'Monitor'
        end
    ),
    recovery_duration = coalesce(
        recovery_duration,
        case
            when severity = 'critical' then '7 days'
            when severity = 'high' then '5 days'
            when severity = 'medium' then '3 days'
            else 'Routine monitoring'
        end
    );

alter table public.disease_treatments
    add column if not exists description text;

alter table public.disease_treatments
    add column if not exists display_order integer;

update public.disease_treatments
set
    description = coalesce(description, treatment_text),
    display_order = coalesce(display_order, sort_order, 0);

alter table public.health_logs
    add column if not exists additional_observation text;

alter table public.scan_records
    add column if not exists additional_observation text;

alter table public.symptom_categories enable row level security;
alter table public.health_symptoms enable row level security;

drop policy if exists "symptom_categories_read_authenticated" on public.symptom_categories;
create policy "symptom_categories_read_authenticated"
on public.symptom_categories
for select
to authenticated
using (true);

drop policy if exists "health_symptoms_read_authenticated" on public.health_symptoms;
create policy "health_symptoms_read_authenticated"
on public.health_symptoms
for select
to authenticated
using (true);

insert into public.symptom_categories (name)
values
    ('Respiratory'),
    ('Skin'),
    ('Behavior'),
    ('General')
on conflict (name) do nothing;

insert into public.health_symptoms (category_id, name, description)
select c.id, s.name, s.description
from (
    values
        ('Respiratory', 'Sneezing', 'Repeated sneezing or upper respiratory irritation.'),
        ('Respiratory', 'Nasal Discharge', 'Visible discharge from the nose.'),
        ('Respiratory', 'Swollen Face', 'Swelling around the face or sinuses.'),
        ('Respiratory', 'Swollen Eyes', 'Visible swelling around one or both eyes.'),
        ('Respiratory', 'Difficulty Breathing', 'Labored, noisy, or open-mouth breathing.'),
        ('General', 'Loss of Appetite', 'The bird is eating less than usual.'),
        ('Behavior', 'Lethargy', 'Low activity, weakness, or unusual inactivity.'),
        ('Skin', 'Skin Lesions', 'Visible sores or lesions on the skin.'),
        ('Skin', 'Black Scabs', 'Dark scabs on exposed skin, comb, or wattles.'),
        ('Skin', 'Warts on Comb', 'Wart-like growths or bumps on the comb.'),
        ('Skin', 'Warts on Wattles', 'Wart-like growths or bumps on the wattles.')
) as s(category_name, name, description)
join public.symptom_categories c on c.name = s.category_name
on conflict (name) do update
set
    category_id = excluded.category_id,
    description = excluded.description;

insert into public.diseases (
    slug,
    name,
    short_label,
    summary,
    severity,
    disease_name,
    description,
    status,
    recovery_duration,
    reference_source,
    is_active
)
values
    (
        'healthy',
        'Healthy',
        'Healthy',
        'No disease indicators were detected by the image classifier.',
        'low',
        'Healthy',
        'No disease indicators were detected by the image classifier. Continue normal flock care and observe the bird for any new symptoms.',
        'Monitor',
        'Routine monitoring',
        'Roboflow Health Camera model',
        true
    ),
    (
        'infectious-coryza',
        'Infectious Coryza',
        'Infectious Coryza',
        'A bacterial respiratory disease commonly associated with facial swelling, swollen eyes, nasal discharge, and reduced appetite.',
        'high',
        'Infectious Coryza',
        'A bacterial respiratory disease commonly associated with facial swelling, swollen eyes, nasal discharge, and reduced appetite.',
        'Isolation',
        '5-7 days',
        'Supabase disease knowledge base',
        true
    ),
    (
        'fowl-pox',
        'Fowlpox',
        'Fowlpox',
        'A viral poultry disease that commonly causes wart-like lesions, black scabs, and skin growths around the comb, wattles, and face.',
        'high',
        'Fowlpox',
        'A viral poultry disease that commonly causes wart-like lesions, black scabs, and skin growths around the comb, wattles, and face.',
        'Isolation',
        '2-4 weeks',
        'Supabase disease knowledge base',
        true
    )
on conflict (slug) do update
set
    name = excluded.name,
    short_label = excluded.short_label,
    summary = excluded.summary,
    severity = excluded.severity,
    disease_name = excluded.disease_name,
    description = excluded.description,
    status = excluded.status,
    recovery_duration = excluded.recovery_duration,
    reference_source = excluded.reference_source,
    is_active = true;

insert into public.disease_aliases (disease_id, alias, alias_type)
select d.id, a.alias, 'roboflow_label'
from (
    values
        ('healthy', 'healthy'),
        ('healthy', 'Healthy'),
        ('infectious-coryza', 'infectious coryza'),
        ('infectious-coryza', 'Infectious Coryza'),
        ('infectious-coryza', 'infectious-coryza'),
        ('fowl-pox', 'fowlpox'),
        ('fowl-pox', 'Fowlpox'),
        ('fowl-pox', 'fowl-pox'),
        ('fowl-pox', 'Fowl Pox')
) as a(slug, alias)
join public.diseases d on d.slug = a.slug
on conflict (disease_id, alias) do nothing;

insert into public.disease_treatments (
    disease_id,
    title,
    treatment_text,
    description,
    sort_order,
    display_order
)
select d.id, t.title, t.description, t.description, t.display_order, t.display_order
from (
    values
        ('healthy', 'Continue observation', 'Keep normal feeding, clean water, and routine flock monitoring.', 1),
        ('healthy', 'Repeat scan if symptoms appear', 'Run another health scan if the bird develops visible symptoms or abnormal behavior.', 2),
        ('infectious-coryza', 'Isolate the bird', 'Separate the affected bird from the flock to reduce spread and stress.', 1),
        ('infectious-coryza', 'Provide supportive care', 'Keep the bird warm, hydrated, and supplied with clean feed and water.', 2),
        ('infectious-coryza', 'Consult a veterinarian', 'Ask a poultry veterinarian about appropriate antibiotic treatment and flock-level control.', 3),
        ('fowl-pox', 'Isolate and monitor', 'Separate the affected bird and monitor lesions for secondary infection.', 1),
        ('fowl-pox', 'Clean lesion areas', 'Keep affected skin clean and dry; use antiseptic care only as advised by a poultry professional.', 2),
        ('fowl-pox', 'Control mosquitoes', 'Reduce mosquito exposure around the coop because mosquitoes can spread fowlpox.', 3)
) as t(slug, title, description, display_order)
join public.diseases d on d.slug = t.slug
where not exists (
    select 1
    from public.disease_treatments existing
    where existing.disease_id = d.id
      and existing.title = t.title
);

create index if not exists idx_health_symptoms_category_id
    on public.health_symptoms (category_id);

create index if not exists idx_health_symptoms_name
    on public.health_symptoms (name);
