-- Adds disease knowledge entries for the Roboflow v4 labels:
-- crd, bumblefoot

insert into public.diseases (
    slug,
    name,
    short_label,
    summary,
    severity,
    reference_source,
    disease_name,
    description,
    status,
    recovery_duration,
    is_active
)
values
    (
        'chronic-respiratory-disease',
        'Chronic Respiratory Disease',
        'CRD',
        'A respiratory disease commonly associated with coughing, sneezing, nasal discharge, facial swelling, and reduced appetite.',
        'high',
        'Roboflow ChickIntel Disease Classifier v4',
        'Chronic Respiratory Disease',
        'Chronic Respiratory Disease can affect breathing and flock performance. Isolate affected birds, keep the environment warm and dry, and consult a veterinarian for antibiotic guidance when symptoms are severe or spreading.',
        'Needs monitoring',
        '7-14 days',
        true
    ),
    (
        'bumblefoot',
        'Bumblefoot',
        'Bumblefoot',
        'A bacterial foot infection often associated with swelling, limping, scabs, or sores on the foot pad.',
        'medium',
        'Roboflow ChickIntel Disease Classifier v4',
        'Bumblefoot',
        'Bumblefoot is usually linked to wounds or pressure injuries on the foot. Keep the bird on clean dry bedding, inspect the foot pad, clean mild wounds, and seek veterinary care for swelling, pus, or deep lesions.',
        'Needs monitoring',
        '10-21 days',
        true
    )
on conflict (slug) do update
set
    name = excluded.name,
    short_label = excluded.short_label,
    summary = excluded.summary,
    severity = excluded.severity,
    reference_source = excluded.reference_source,
    disease_name = excluded.disease_name,
    description = excluded.description,
    status = excluded.status,
    recovery_duration = excluded.recovery_duration,
    is_active = excluded.is_active,
    updated_at = timezone('utc', now());

insert into public.disease_aliases (disease_id, alias, alias_type)
select d.id, alias_data.alias, alias_data.alias_type
from (
    values
        ('chronic-respiratory-disease', 'crd', 'classifier_label'),
        ('chronic-respiratory-disease', 'CRD', 'common_name'),
        ('chronic-respiratory-disease', 'Chronic Respiratory Disease', 'common_name'),
        ('chronic-respiratory-disease', 'chronic respiratory disease', 'classifier_label'),
        ('bumblefoot', 'bumblefoot', 'classifier_label'),
        ('bumblefoot', 'Bumblefoot', 'common_name')
) as alias_data(slug, alias, alias_type)
join public.diseases d on d.slug = alias_data.slug
on conflict (disease_id, alias) do nothing;

insert into public.disease_treatments (
    disease_id,
    title,
    treatment_text,
    sort_order
)
select d.id, treatment_data.title, treatment_data.treatment_text, treatment_data.sort_order
from (
    values
        ('chronic-respiratory-disease', 'Isolation', 'Isolate the affected chicken from the flock to reduce spread and observe breathing closely.', 1),
        ('chronic-respiratory-disease', 'Supportive care', 'Keep the bird warm, dry, and well ventilated. Provide clean water and reduce stress.', 2),
        ('chronic-respiratory-disease', 'Veterinary treatment', 'Consult a veterinarian for proper antibiotic treatment if symptoms persist, worsen, or spread through the flock.', 3),
        ('bumblefoot', 'Clean housing', 'Move the chicken to clean, dry bedding and reduce sharp or rough surfaces that can worsen foot wounds.', 1),
        ('bumblefoot', 'Foot inspection', 'Inspect the foot pad for swelling, scabs, discharge, or deep wounds. Clean mild surface wounds carefully.', 2),
        ('bumblefoot', 'Veterinary care', 'Seek veterinary care for large swelling, pus, deep lesions, or if the chicken cannot walk normally.', 3)
) as treatment_data(slug, title, treatment_text, sort_order)
join public.diseases d on d.slug = treatment_data.slug
where not exists (
    select 1
    from public.disease_treatments existing
    where existing.disease_id = d.id
      and existing.title = treatment_data.title
);
