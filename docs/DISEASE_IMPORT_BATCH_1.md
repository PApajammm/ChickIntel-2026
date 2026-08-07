# Disease Import Batch 1

Source: `Chicken Information` screenshots provided in chat.

Notes:
- Symptom codes below are mapped to the current `symptoms` table where possible.
- Some source symptoms do not yet have a matching code in the database and are marked as `NEW_SYMPTOM_NEEDED`.
- Image filenames are placeholders until the actual files are uploaded to Supabase Storage.

---

## Disease

- Name: Newcastle Disease (Viral)
- Slug: newcastle-disease
- Short label: Newcastle disease
- Severity: critical
- Summary: Viral poultry disease associated with respiratory signs, paralysis, diarrhea, and wing/neck abnormalities.
- Source: Chicken Information PDF

### Aliases
- Newcastle Disease

### Symptoms
- symptom_code: NEW_SYMPTOM_NEEDED_twisted_neck
  Label in source: Twisted neck
  Primary: yes
  Weight: 1.5

- symptom_code: NEW_SYMPTOM_NEEDED_paralysis
  Label in source: Paralysis
  Primary: yes
  Weight: 1.5

- symptom_code: NEW_SYMPTOM_NEEDED_green_diarrhea
  Label in source: Green diarrhea
  Primary: yes
  Weight: 1.2

- symptom_code: NEW_SYMPTOM_NEEDED_sneezing
  Label in source: Sneezing
  Primary: no
  Weight: 1.0

- symptom_code: discharge
  Label in source: Nasal discharge
  Primary: yes
  Weight: 1.2

- symptom_code: NEW_SYMPTOM_NEEDED_coughing
  Label in source: Coughing
  Primary: no
  Weight: 1.0

- symptom_code: NEW_SYMPTOM_NEEDED_drooping_wings
  Label in source: Drooping wings
  Primary: no
  Weight: 1.0

### Treatments
- Title: Antibiotic support
  Treatment text: Provide antibiotics.
  Medication match:
  Vitamin match:
  Sort order: 1

- Title: Isolation
  Treatment text: Isolate the bird.
  Medication match:
  Vitamin match:
  Sort order: 2

- Title: Prevention
  Treatment text: Vaccination for prevention.
  Medication match:
  Vitamin match:
  Sort order: 3

### Reference Images
- File name: newcastle-disease-01.jpg
  Caption: Bird showing weakness with drooping posture
  Body region: whole_body
  Example type: reference

### Detection Rules
- Rule name: newcastle-disease-basic
  Required symptom codes: NEW_SYMPTOM_NEEDED_twisted_neck
  Optional symptom codes: NEW_SYMPTOM_NEEDED_paralysis, NEW_SYMPTOM_NEEDED_green_diarrhea, discharge, NEW_SYMPTOM_NEEDED_sneezing, NEW_SYMPTOM_NEEDED_coughing, NEW_SYMPTOM_NEEDED_drooping_wings
  Blocked symptom codes:
  Min score: 2.5

---

## Disease

- Name: Fowl Pox (Viral)
- Slug: fowl-pox
- Short label: Fowl pox
- Severity: high
- Summary: Viral disease characterized by comb scabs, facial lesions, and yellow lesions inside the mouth.
- Source: Chicken Information PDF

### Aliases
- Fowl Pox

### Symptoms
- symptom_code: NEW_SYMPTOM_NEEDED_scabs_on_combs
  Label in source: Scabs on combs
  Primary: yes
  Weight: 1.4

- symptom_code: NEW_SYMPTOM_NEEDED_face_lesions
  Label in source: Face lesions
  Primary: yes
  Weight: 1.3

- symptom_code: NEW_SYMPTOM_NEEDED_yellow_lesions_mouth
  Label in source: Raised yellow lesions inside of mouth
  Primary: yes
  Weight: 1.5

### Treatments
- Title: Isolation
  Treatment text: Isolate the bird.
  Medication match:
  Vitamin match:
  Sort order: 1

- Title: Antiseptic care
  Treatment text: Apply antiseptic.
  Medication match:
  Vitamin match:
  Sort order: 2

- Title: Vitamin support
  Treatment text: Give Vitamin A.
  Medication match:
  Vitamin match:
  Sort order: 3

- Title: Vector control
  Treatment text: Control mosquitoes.
  Medication match:
  Vitamin match:
  Sort order: 4

### Reference Images
- File name: fowl-pox-01.jpg
  Caption: Bird with visible facial lesions around the eye and beak
  Body region: head
  Example type: reference

### Detection Rules
- Rule name: fowl-pox-basic
  Required symptom codes: NEW_SYMPTOM_NEEDED_scabs_on_combs
  Optional symptom codes: NEW_SYMPTOM_NEEDED_face_lesions, NEW_SYMPTOM_NEEDED_yellow_lesions_mouth
  Blocked symptom codes:
  Min score: 2.0

---

## Disease

- Name: Avian Influenza / Bird Flu
- Slug: avian-influenza-bird-flu
- Short label: Bird flu
- Severity: critical
- Summary: Severe viral disease associated with swelling, weakness, discoloration, sudden death, watery eyes, bleeding under the skin, and reduced egg production.
- Source: Chicken Information PDF

### Aliases
- Avian Influenza
- Bird Flu

### Symptoms
- symptom_code: NEW_SYMPTOM_NEEDED_swollen_eyes
  Label in source: Swollen eyes
  Primary: yes
  Weight: 1.4

- symptom_code: ruffled_feathers
  Label in source: Ruffled feathers
  Primary: no
  Weight: 1.0

- symptom_code: weak
  Label in source: Weakness
  Primary: yes
  Weight: 1.2

- symptom_code: NEW_SYMPTOM_NEEDED_comb_discoloration
  Label in source: Comb discoloration (blue/purple)
  Primary: yes
  Weight: 1.5

- symptom_code: NEW_SYMPTOM_NEEDED_sudden_death
  Label in source: Sudden death
  Primary: yes
  Weight: 1.7

- symptom_code: NEW_SYMPTOM_NEEDED_fluid_comb_wattles
  Label in source: Fluid in comb and wattles
  Primary: yes
  Weight: 1.3

- symptom_code: discharge
  Label in source: Watery eyes
  Primary: no
  Weight: 1.0

- symptom_code: NEW_SYMPTOM_NEEDED_bleeding_under_skin_legs
  Label in source: Bleeding under the skin on legs
  Primary: yes
  Weight: 1.4

- symptom_code: NEW_SYMPTOM_NEEDED_reduced_egg_production
  Label in source: Reduced egg production
  Primary: no
  Weight: 0.8

### Treatments
- Title: Culling
  Treatment text: Culling.
  Medication match:
  Vitamin match:
  Sort order: 1

- Title: Report case
  Treatment text: Report to the authorities.
  Medication match:
  Vitamin match:
  Sort order: 2

### Reference Images
- File name: avian-influenza-01.jpg
  Caption: Flock reference image labeled avian influenza
  Body region: whole_body
  Example type: reference

### Detection Rules
- Rule name: avian-influenza-basic
  Required symptom codes: weak
  Optional symptom codes: ruffled_feathers, discharge, NEW_SYMPTOM_NEEDED_swollen_eyes, NEW_SYMPTOM_NEEDED_comb_discoloration, NEW_SYMPTOM_NEEDED_sudden_death, NEW_SYMPTOM_NEEDED_bleeding_under_skin_legs, NEW_SYMPTOM_NEEDED_reduced_egg_production
  Blocked symptom codes:
  Min score: 2.5

---

## Disease

- Name: Marek's Disease (Viral)
- Slug: mareks-disease
- Short label: Marek's disease
- Severity: high
- Summary: Viral disease commonly associated with eye changes, abnormal pupil response, and paralysis.
- Source: Chicken Information PDF

### Aliases
- Marek's Disease
- Mareks Disease

### Symptoms
- symptom_code: NEW_SYMPTOM_NEEDED_irregular_iris_shape
  Label in source: Irregular iris shape
  Primary: yes
  Weight: 1.5

- symptom_code: NEW_SYMPTOM_NEEDED_gray_cloudy_iris
  Label in source: Gray or cloudy iris
  Primary: yes
  Weight: 1.3

- symptom_code: NEW_SYMPTOM_NEEDED_reduced_reaction_pupils_light
  Label in source: Reduced reaction of pupils to light
  Primary: yes
  Weight: 1.4

- symptom_code: NEW_SYMPTOM_NEEDED_paralysis
  Label in source: Paralysis
  Primary: yes
  Weight: 1.5

### Treatments
- Title: Culling
  Treatment text: Culling.
  Medication match:
  Vitamin match:
  Sort order: 1

### Reference Images
- File name: mareks-disease-01.jpg
  Caption: Bird showing eye changes and weakness
  Body region: head
  Example type: reference

### Detection Rules
- Rule name: mareks-disease-basic
  Required symptom codes: NEW_SYMPTOM_NEEDED_paralysis
  Optional symptom codes: NEW_SYMPTOM_NEEDED_irregular_iris_shape, NEW_SYMPTOM_NEEDED_gray_cloudy_iris, NEW_SYMPTOM_NEEDED_reduced_reaction_pupils_light
  Blocked symptom codes:
  Min score: 2.2

---

## Disease

- Name: Infectious Coryza (Bacterial)
- Slug: infectious-coryza
- Short label: Infectious coryza
- Severity: high
- Summary: Bacterial respiratory disease with swollen eyes, facial swelling, discharge, coughing, and reduced appetite.
- Source: Chicken Information PDF

### Aliases
- Coryza
- Infectious Coryza

### Symptoms
- symptom_code: NEW_SYMPTOM_NEEDED_swollen_eyes
  Label in source: Conjunctivitis (Swollen eyes)
  Primary: yes
  Weight: 1.4

- symptom_code: discharge
  Label in source: Eye discharge / Watery eyes
  Primary: yes
  Weight: 1.2

- symptom_code: NEW_SYMPTOM_NEEDED_facial_swelling
  Label in source: Facial Swelling
  Primary: yes
  Weight: 1.4

- symptom_code: discharge
  Label in source: Nasal Discharge
  Primary: yes
  Weight: 1.2

- symptom_code: NEW_SYMPTOM_NEEDED_coughing
  Label in source: Coughing
  Primary: no
  Weight: 1.0

- symptom_code: NEW_SYMPTOM_NEEDED_abnormal_sounds
  Label in source: Abnormal sounds
  Primary: no
  Weight: 1.0

- symptom_code: weak
  Label in source: Weakness
  Primary: no
  Weight: 1.0

- symptom_code: NEW_SYMPTOM_NEEDED_diarrhea
  Label in source: Diarrhea
  Primary: no
  Weight: 0.9

- symptom_code: poor_appetite
  Label in source: Loss of Appetite
  Primary: yes
  Weight: 1.0

- symptom_code: NEW_SYMPTOM_NEEDED_head_shaking
  Label in source: Head Shaking
  Primary: no
  Weight: 0.9

### Treatments
- Title: Isolation and warmth
  Treatment text: Isolate and place in a warm place.
  Medication match:
  Vitamin match:
  Sort order: 1

- Title: Stress reduction
  Treatment text: Limit stress.
  Medication match:
  Vitamin match:
  Sort order: 2

### Reference Images
- File name: infectious-coryza-01.jpg
  Caption: Bird with swollen eye and facial inflammation
  Body region: head
  Example type: reference

### Detection Rules
- Rule name: infectious-coryza-basic
  Required symptom codes: discharge
  Optional symptom codes: weak, poor_appetite, NEW_SYMPTOM_NEEDED_swollen_eyes, NEW_SYMPTOM_NEEDED_facial_swelling, NEW_SYMPTOM_NEEDED_coughing, NEW_SYMPTOM_NEEDED_abnormal_sounds, NEW_SYMPTOM_NEEDED_head_shaking
  Blocked symptom codes:
  Min score: 2.0

---

## Disease

- Name: Coccidiosis (Parasitic)
- Slug: coccidiosis
- Short label: Coccidiosis
- Severity: high
- Summary: Parasitic disease associated with bloody or foamy diarrhea, weakness, poor appetite, feather changes, flock withdrawal, and weight loss.
- Source: Chicken Information PDF

### Aliases
- Coccidiosis

### Symptoms
- symptom_code: NEW_SYMPTOM_NEEDED_bloody_yellowish_foamy_diarrhea
  Label in source: Bloody diarrhea / yellowish and foamy
  Primary: yes
  Weight: 1.5

- symptom_code: weak
  Label in source: Weakness
  Primary: yes
  Weight: 1.2

- symptom_code: ruffled_feathers
  Label in source: Ruffled feathers
  Primary: no
  Weight: 1.0

- symptom_code: poor_appetite
  Label in source: Loss of appetite
  Primary: yes
  Weight: 1.1

- symptom_code: isolating
  Label in source: Withdrawn from flock
  Primary: no
  Weight: 1.0

- symptom_code: NEW_SYMPTOM_NEEDED_poor_egg_production
  Label in source: Poor egg production
  Primary: no
  Weight: 0.8

- symptom_code: NEW_SYMPTOM_NEEDED_pale_combs_wattles
  Label in source: Pale combs and wattles
  Primary: no
  Weight: 1.0

- symptom_code: NEW_SYMPTOM_NEEDED_rapid_weight_loss
  Label in source: Rapid weight loss
  Primary: yes
  Weight: 1.2

### Treatments
- Title: Amprolium treatment
  Treatment text: Add Amprolium to chicken water for 7 days.
  Medication match: Amprolium
  Vitamin match:
  Sort order: 1

- Title: Isolation
  Treatment text: Isolate the bird.
  Medication match:
  Vitamin match:
  Sort order: 2

- Title: Sanitation
  Treatment text: Clean the coop.
  Medication match:
  Vitamin match:
  Sort order: 3

### Reference Images
- File name: coccidiosis-01.jpg
  Caption: Bird sitting weakly on the ground outdoors
  Body region: whole_body
  Example type: reference

### Detection Rules
- Rule name: coccidiosis-basic
  Required symptom codes: weak
  Optional symptom codes: poor_appetite, ruffled_feathers, isolating, NEW_SYMPTOM_NEEDED_bloody_yellowish_foamy_diarrhea, NEW_SYMPTOM_NEEDED_rapid_weight_loss, NEW_SYMPTOM_NEEDED_pale_combs_wattles
  Blocked symptom codes:
  Min score: 2.2
