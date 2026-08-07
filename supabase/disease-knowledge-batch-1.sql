insert into public.symptoms (code, label, description, severity)
values
    ('twisted_neck', 'Twisted neck', 'Abnormal neck twisting or torticollis.', 'high'),
    ('paralysis', 'Paralysis', 'Loss of movement or inability to stand/walk properly.', 'high'),
    ('green_diarrhea', 'Green diarrhea', 'Green loose droppings or diarrhea.', 'high'),
    ('sneezing', 'Sneezing', 'Repeated sneezing or upper respiratory irritation.', 'medium'),
    ('coughing', 'Coughing', 'Coughing or throat clearing sounds.', 'medium'),
    ('drooping_wings', 'Drooping wings', 'Wings hanging lower than normal.', 'medium'),
    ('scabs_on_combs', 'Scabs on combs', 'Dry scab-like lesions on the comb.', 'medium'),
    ('face_lesions', 'Face lesions', 'Visible lesions on the face.', 'medium'),
    ('yellow_lesions_mouth', 'Yellow lesions in mouth', 'Raised yellow lesions inside the mouth.', 'high'),
    ('swollen_eyes', 'Swollen eyes', 'Visible eye swelling or puffiness.', 'high'),
    ('comb_discoloration', 'Comb discoloration', 'Comb shows blue, purple, or unhealthy discoloration.', 'high'),
    ('sudden_death', 'Sudden death', 'Sudden unexpected death in a bird or flock.', 'critical'),
    ('fluid_comb_wattles', 'Fluid in comb and wattles', 'Abnormal swelling or fluid retention in comb/wattles.', 'high'),
    ('bleeding_under_skin_legs', 'Bleeding under the skin on legs', 'Subcutaneous bleeding visible on the legs.', 'critical'),
    ('reduced_egg_production', 'Reduced egg production', 'Noticeable drop in egg production.', 'medium'),
    ('irregular_iris_shape', 'Irregular iris shape', 'Misshapen or abnormal iris appearance.', 'high'),
    ('gray_cloudy_iris', 'Gray or cloudy iris', 'Cloudy, gray, or opaque iris appearance.', 'high'),
    ('reduced_pupil_light_reaction', 'Reduced pupil reaction to light', 'Pupils respond poorly to light.', 'high'),
    ('facial_swelling', 'Facial swelling', 'Swelling around the face, eyes, or sinuses.', 'high'),
    ('abnormal_sounds', 'Abnormal sounds', 'Unusual respiratory or throat sounds.', 'medium'),
    ('head_shaking', 'Head shaking', 'Repeated head shaking behavior.', 'medium'),
    ('bloody_yellowish_foamy_diarrhea', 'Bloody or foamy diarrhea', 'Bloody, yellowish, or foamy diarrhea.', 'high'),
    ('pale_combs_wattles', 'Pale combs and wattles', 'Comb and wattles look pale or bloodless.', 'medium'),
    ('rapid_weight_loss', 'Rapid weight loss', 'Fast or noticeable body weight loss.', 'high')
on conflict (code) do nothing;

insert into public.diseases (slug, name, short_label, summary, severity, reference_source)
values
    ('newcastle-disease', 'Newcastle Disease (Viral)', 'Newcastle disease', 'Viral poultry disease associated with respiratory signs, paralysis, diarrhea, and wing/neck abnormalities.', 'critical', 'Chicken Information PDF'),
    ('fowl-pox', 'Fowl Pox (Viral)', 'Fowl pox', 'Viral disease characterized by comb scabs, facial lesions, and yellow lesions inside the mouth.', 'high', 'Chicken Information PDF'),
    ('avian-influenza-bird-flu', 'Avian Influenza / Bird Flu', 'Bird flu', 'Severe viral disease associated with swelling, weakness, discoloration, sudden death, watery eyes, bleeding under the skin, and reduced egg production.', 'critical', 'Chicken Information PDF'),
    ('mareks-disease', 'Marek''s Disease (Viral)', 'Marek''s disease', 'Viral disease commonly associated with eye changes, abnormal pupil response, and paralysis.', 'high', 'Chicken Information PDF'),
    ('infectious-coryza', 'Infectious Coryza (Bacterial)', 'Infectious coryza', 'Bacterial respiratory disease with swollen eyes, facial swelling, discharge, coughing, and reduced appetite.', 'high', 'Chicken Information PDF'),
    ('coccidiosis', 'Coccidiosis (Parasitic)', 'Coccidiosis', 'Parasitic disease associated with bloody or foamy diarrhea, weakness, poor appetite, feather changes, flock withdrawal, and weight loss.', 'high', 'Chicken Information PDF')
on conflict (slug) do update
set
    name = excluded.name,
    short_label = excluded.short_label,
    summary = excluded.summary,
    severity = excluded.severity,
    reference_source = excluded.reference_source,
    is_active = true;

insert into public.disease_aliases (disease_id, alias, alias_type)
select d.id, alias_data.alias, alias_data.alias_type
from (
    values
        ('newcastle-disease', 'Newcastle Disease', 'common_name'),
        ('fowl-pox', 'Fowl Pox', 'common_name'),
        ('avian-influenza-bird-flu', 'Avian Influenza', 'common_name'),
        ('avian-influenza-bird-flu', 'Bird Flu', 'common_name'),
        ('mareks-disease', 'Marek''s Disease', 'common_name'),
        ('mareks-disease', 'Mareks Disease', 'common_name'),
        ('infectious-coryza', 'Coryza', 'common_name'),
        ('infectious-coryza', 'Infectious Coryza', 'common_name'),
        ('coccidiosis', 'Coccidiosis', 'common_name')
) as alias_data(slug, alias, alias_type)
join public.diseases d on d.slug = alias_data.slug
on conflict (disease_id, alias) do nothing;

insert into public.disease_symptoms (disease_id, symptom_id, weight, is_primary)
select
    d.id,
    s.id,
    links.weight,
    links.is_primary
from (
    values
        ('newcastle-disease', 'twisted_neck', 1.5, true),
        ('newcastle-disease', 'paralysis', 1.5, true),
        ('newcastle-disease', 'green_diarrhea', 1.2, true),
        ('newcastle-disease', 'sneezing', 1.0, false),
        ('newcastle-disease', 'discharge', 1.2, true),
        ('newcastle-disease', 'coughing', 1.0, false),
        ('newcastle-disease', 'drooping_wings', 1.0, false),
        ('fowl-pox', 'scabs_on_combs', 1.4, true),
        ('fowl-pox', 'face_lesions', 1.3, true),
        ('fowl-pox', 'yellow_lesions_mouth', 1.5, true),
        ('avian-influenza-bird-flu', 'swollen_eyes', 1.4, true),
        ('avian-influenza-bird-flu', 'ruffled_feathers', 1.0, false),
        ('avian-influenza-bird-flu', 'weak', 1.2, true),
        ('avian-influenza-bird-flu', 'comb_discoloration', 1.5, true),
        ('avian-influenza-bird-flu', 'sudden_death', 1.7, true),
        ('avian-influenza-bird-flu', 'fluid_comb_wattles', 1.3, true),
        ('avian-influenza-bird-flu', 'discharge', 1.0, false),
        ('avian-influenza-bird-flu', 'bleeding_under_skin_legs', 1.4, true),
        ('avian-influenza-bird-flu', 'reduced_egg_production', 0.8, false),
        ('mareks-disease', 'irregular_iris_shape', 1.5, true),
        ('mareks-disease', 'gray_cloudy_iris', 1.3, true),
        ('mareks-disease', 'reduced_pupil_light_reaction', 1.4, true),
        ('mareks-disease', 'paralysis', 1.5, true),
        ('infectious-coryza', 'swollen_eyes', 1.4, true),
        ('infectious-coryza', 'discharge', 1.2, true),
        ('infectious-coryza', 'facial_swelling', 1.4, true),
        ('infectious-coryza', 'coughing', 1.0, false),
        ('infectious-coryza', 'abnormal_sounds', 1.0, false),
        ('infectious-coryza', 'weak', 1.0, false),
        ('infectious-coryza', 'poor_appetite', 1.0, true),
        ('infectious-coryza', 'head_shaking', 0.9, false),
        ('coccidiosis', 'bloody_yellowish_foamy_diarrhea', 1.5, true),
        ('coccidiosis', 'weak', 1.2, true),
        ('coccidiosis', 'ruffled_feathers', 1.0, false),
        ('coccidiosis', 'poor_appetite', 1.1, true),
        ('coccidiosis', 'isolating', 1.0, false),
        ('coccidiosis', 'reduced_egg_production', 0.8, false),
        ('coccidiosis', 'pale_combs_wattles', 1.0, false),
        ('coccidiosis', 'rapid_weight_loss', 1.2, true)
) as links(slug, symptom_code, weight, is_primary)
join public.diseases d on d.slug = links.slug
join public.symptoms s on s.code = links.symptom_code
on conflict (disease_id, symptom_id) do update
set
    weight = excluded.weight,
    is_primary = excluded.is_primary;

insert into public.disease_treatments (
    disease_id,
    title,
    treatment_text,
    medication_id,
    vitamin_id,
    sort_order
)
select
    d.id,
    t.title,
    t.treatment_text,
    m.id,
    v.id,
    t.sort_order
from (
    values
        ('newcastle-disease', 'Antibiotic support', 'Provide antibiotics.', null, null, 1),
        ('newcastle-disease', 'Isolation', 'Isolate the bird.', null, null, 2),
        ('newcastle-disease', 'Prevention', 'Vaccination for prevention.', null, null, 3),
        ('fowl-pox', 'Isolation', 'Isolate the bird.', null, null, 1),
        ('fowl-pox', 'Antiseptic care', 'Apply antiseptic.', null, null, 2),
        ('fowl-pox', 'Vitamin support', 'Give Vitamin A.', null, null, 3),
        ('fowl-pox', 'Vector control', 'Control mosquitoes.', null, null, 4),
        ('avian-influenza-bird-flu', 'Culling', 'Culling.', null, null, 1),
        ('avian-influenza-bird-flu', 'Report case', 'Report to the authorities.', null, null, 2),
        ('mareks-disease', 'Culling', 'Culling.', null, null, 1),
        ('infectious-coryza', 'Isolation and warmth', 'Isolate and place in a warm place.', null, null, 1),
        ('infectious-coryza', 'Stress reduction', 'Limit stress.', null, null, 2),
        ('coccidiosis', 'Amprolium treatment', 'Add Amprolium to chicken water for 7 days.', 'Amprolium', null, 1),
        ('coccidiosis', 'Isolation', 'Isolate the bird.', null, null, 2),
        ('coccidiosis', 'Sanitation', 'Clean the coop.', null, null, 3)
) as t(slug, title, treatment_text, medication_name, vitamin_name, sort_order)
join public.diseases d on d.slug = t.slug
left join public.medications m on m.name = t.medication_name
left join public.vitamins v on v.name = t.vitamin_name
where not exists (
    select 1
    from public.disease_treatments existing
    where existing.disease_id = d.id
      and existing.title = t.title
      and existing.sort_order = t.sort_order
);

insert into public.disease_reference_images (
    disease_id,
    image_path,
    image_caption,
    body_region,
    example_type
)
select
    d.id,
    img.image_path,
    img.image_caption,
    img.body_region,
    img.example_type
from (
    values
        ('newcastle-disease', 'disease-reference-images/newcastle-disease/newcastle-disease-01.jpg', 'Bird showing weakness with drooping posture', 'whole_body', 'reference'),
        ('fowl-pox', 'disease-reference-images/fowl-pox/fowl-pox-01.jpg', 'Bird with visible facial lesions around the eye and beak', 'head', 'reference'),
        ('avian-influenza-bird-flu', 'disease-reference-images/avian-influenza-bird-flu/avian-influenza-01.jpg', 'Flock reference image labeled avian influenza', 'whole_body', 'reference'),
        ('mareks-disease', 'disease-reference-images/mareks-disease/mareks-disease-01.jpg', 'Bird showing eye changes and weakness', 'head', 'reference'),
        ('infectious-coryza', 'disease-reference-images/infectious-coryza/infectious-coryza-01.jpg', 'Bird with swollen eye and facial inflammation', 'head', 'reference'),
        ('coccidiosis', 'disease-reference-images/coccidiosis/coccidiosis-01.jpg', 'Bird sitting weakly on the ground outdoors', 'whole_body', 'reference')
) as img(slug, image_path, image_caption, body_region, example_type)
join public.diseases d on d.slug = img.slug
where not exists (
    select 1
    from public.disease_reference_images existing
    where existing.disease_id = d.id
      and existing.image_path = img.image_path
);

insert into public.disease_detection_rules (
    disease_id,
    rule_name,
    required_symptom_codes,
    optional_symptom_codes,
    blocked_symptom_codes,
    min_score
)
select
    d.id,
    rules.rule_name,
    rules.required_symptom_codes,
    rules.optional_symptom_codes,
    rules.blocked_symptom_codes,
    rules.min_score
from (
    values
        ('newcastle-disease', 'newcastle-disease-basic', array['twisted_neck']::text[], array['paralysis', 'green_diarrhea', 'discharge', 'sneezing', 'coughing', 'drooping_wings']::text[], array[]::text[], 2.5),
        ('fowl-pox', 'fowl-pox-basic', array['scabs_on_combs']::text[], array['face_lesions', 'yellow_lesions_mouth']::text[], array[]::text[], 2.0),
        ('avian-influenza-bird-flu', 'avian-influenza-basic', array['weak']::text[], array['ruffled_feathers', 'discharge', 'swollen_eyes', 'comb_discoloration', 'sudden_death', 'bleeding_under_skin_legs', 'reduced_egg_production']::text[], array[]::text[], 2.5),
        ('mareks-disease', 'mareks-disease-basic', array['paralysis']::text[], array['irregular_iris_shape', 'gray_cloudy_iris', 'reduced_pupil_light_reaction']::text[], array[]::text[], 2.2),
        ('infectious-coryza', 'infectious-coryza-basic', array['discharge']::text[], array['weak', 'poor_appetite', 'swollen_eyes', 'facial_swelling', 'coughing', 'abnormal_sounds', 'head_shaking']::text[], array[]::text[], 2.0),
        ('coccidiosis', 'coccidiosis-basic', array['weak']::text[], array['poor_appetite', 'ruffled_feathers', 'isolating', 'bloody_yellowish_foamy_diarrhea', 'rapid_weight_loss', 'pale_combs_wattles']::text[], array[]::text[], 2.2)
) as rules(slug, rule_name, required_symptom_codes, optional_symptom_codes, blocked_symptom_codes, min_score)
join public.diseases d on d.slug = rules.slug
where not exists (
    select 1
    from public.disease_detection_rules existing
    where existing.disease_id = d.id
      and existing.rule_name = rules.rule_name
);
