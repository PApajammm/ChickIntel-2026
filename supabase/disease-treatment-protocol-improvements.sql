-- Replace vague disease treatment seed text with actionable, validated protocol tasks.
-- Review these protocols with a poultry veterinarian before production use.

alter table public.disease_treatments
    add column if not exists description text;
alter table public.disease_treatments
    add column if not exists display_order integer;

delete from public.disease_treatments
where disease_id in (
    select id
    from public.diseases
    where slug in (
        'infectious-coryza',
        'fowl-pox',
        'coccidiosis',
        'newcastle-disease',
        'avian-influenza-bird-flu',
        'mareks-disease'
    )
);

insert into public.disease_treatments (
    disease_id,
    title,
    treatment_text,
    description,
    sort_order,
    display_order
)
select
    d.id,
    protocol.title,
    protocol.description,
    protocol.description,
    protocol.task_order,
    protocol.task_order
from (
    values
        ('infectious-coryza', 'Isolate affected chicken', 'Separate the affected chicken from the flock and use dedicated equipment to reduce spread.', 1),
        ('infectious-coryza', 'Provide supportive care', 'Keep the chicken warm and make clean water and appropriate nutrition easy to access.', 2),
        ('infectious-coryza', 'Request veterinary treatment guidance', 'Ask a poultry veterinarian about appropriate treatment and flock-level control before administering medication.', 3),
        ('infectious-coryza', 'Clean and disinfect housing', 'Remove contaminated material and clean shared feeders, drinkers, and surfaces using an approved poultry-safe process.', 4),
        ('infectious-coryza', 'Monitor breathing and appetite', 'Record breathing effort, nasal discharge, activity, water intake, and appetite during each check.', 5),
        ('infectious-coryza', 'Perform follow-up health check', 'Repeat the health check and update this monitoring record before ending isolation.', 6),
        ('fowl-pox', 'Isolate and observe the chicken', 'Separate the affected chicken and check lesions, appetite, activity, and breathing each day.', 1),
        ('fowl-pox', 'Keep lesions clean and dry', 'Clean affected areas only with poultry-safe care advised by a veterinarian; do not pick scabs or apply unapproved products.', 2),
        ('fowl-pox', 'Control mosquito exposure', 'Reduce standing water and mosquito access around the coop to limit spread between birds.', 3),
        ('fowl-pox', 'Provide supportive care', 'Keep clean water, feed, shade, and a low-stress resting area available.', 4),
        ('fowl-pox', 'Check for secondary infection', 'Contact a poultry veterinarian if lesions worsen, develop discharge, or the chicken stops eating or drinking.', 5),
        ('fowl-pox', 'Perform follow-up health check', 'Repeat the health check and record lesion and behavior changes before ending monitoring.', 6),
        ('coccidiosis', 'Isolate affected chicken', 'Separate the chicken from the flock and use dedicated equipment while illness signs are present.', 1),
        ('coccidiosis', 'Request anticoccidial treatment guidance', 'Ask a poultry veterinarian to confirm the appropriate approved anticoccidial product and course for the flock.', 2),
        ('coccidiosis', 'Support hydration and nutrition', 'Keep clean water and easily accessible feed available, and record appetite and drinking behavior.', 3),
        ('coccidiosis', 'Clean and replace contaminated litter', 'Remove wet or contaminated litter and maintain a dry, clean living area to reduce reinfection pressure.', 4),
        ('coccidiosis', 'Monitor droppings and weakness', 'Record droppings, activity, weight loss, pale combs, and signs of dehydration during each check.', 5),
        ('coccidiosis', 'Perform follow-up health check', 'Repeat the health check after the veterinarian-directed treatment course and update the record.', 6),
        ('newcastle-disease', 'Isolate immediately', 'Separate the affected chicken and stop shared equipment from moving between the isolate area and the flock.', 1),
        ('newcastle-disease', 'Contact a poultry veterinarian', 'Seek urgent professional guidance because Newcastle disease can spread quickly and may require official reporting.', 2),
        ('newcastle-disease', 'Follow biosecurity instructions', 'Limit visitors and movement, change footwear or clothing, and disinfect equipment as directed by authorities.', 3),
        ('newcastle-disease', 'Provide supportive care only as advised', 'Maintain access to clean water, feed, warmth, and low-stress shelter while awaiting professional guidance.', 4),
        ('newcastle-disease', 'Monitor neurologic and breathing signs', 'Record breathing difficulty, coughing, weakness, balance changes, tremors, and appetite at each check.', 5),
        ('newcastle-disease', 'Perform follow-up health check', 'Repeat the health check and follow the veterinarian or animal-health authority decision before ending monitoring.', 6),
        ('avian-influenza-bird-flu', 'Isolate and restrict movement', 'Do not move the affected bird, eggs, equipment, or people between areas without following biosecurity guidance.', 1),
        ('avian-influenza-bird-flu', 'Contact animal-health authorities', 'Report suspected avian influenza promptly to the appropriate veterinary or animal-health authority.', 2),
        ('avian-influenza-bird-flu', 'Follow official instructions', 'Do not administer unapproved treatment or dispose of birds until official instructions are provided.', 3),
        ('avian-influenza-bird-flu', 'Record flock exposure', 'Document affected birds, contact history, deaths, movement, and observed signs for the veterinarian or authority.', 4),
        ('avian-influenza-bird-flu', 'Perform authorized follow-up check', 'Continue checks only as directed by the responsible veterinarian or animal-health authority.', 5),
        ('mareks-disease', 'Isolate affected chicken', 'Separate the chicken and avoid sharing equipment with the healthy flock while the diagnosis is reviewed.', 1),
        ('mareks-disease', 'Request veterinary confirmation', 'Ask a poultry veterinarian to confirm the diagnosis and discuss flock management and welfare decisions.', 2),
        ('mareks-disease', 'Provide welfare-focused supportive care', 'Keep feed and water accessible and reduce stress; monitor whether the chicken can stand, eat, and drink.', 3),
        ('mareks-disease', 'Strengthen flock biosecurity', 'Clean equipment and review vaccination, sourcing, and housing practices with a poultry professional.', 4),
        ('mareks-disease', 'Monitor mobility and appetite', 'Record weakness, paralysis, balance, appetite, hydration, and signs of distress at each check.', 5),
        ('mareks-disease', 'Perform follow-up health check', 'Repeat the health check and document the veterinarian-directed outcome before ending monitoring.', 6)
) as protocol(slug, title, description, task_order)
join public.diseases d on d.slug = protocol.slug;