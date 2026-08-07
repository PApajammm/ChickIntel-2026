# Disease Import Template

Use this template to convert the `Chicken Information` Google Doc / PDF into structured disease records for ChickIntel.

One disease entry should become:

- 1 row in `diseases`
- 0..n rows in `disease_aliases`
- 0..n rows in `disease_symptoms`
- 0..n rows in `disease_treatments`
- 0..n rows in `disease_reference_images`
- optional rows in `disease_detection_rules`

## Template Per Disease

Copy this block once for each disease from the PDF/Google Doc.

```md
## Disease

- Name:
- Slug:
- Short label:
- Severity: low | medium | high | critical
- Summary:
- Source: Chicken Information PDF

### Aliases
- 

### Symptoms
- symptom_code:
  Label in source:
  Primary: yes/no
  Weight: 1.0

### Treatments
- Title:
  Treatment text:
  Medication match:
  Vitamin match:
  Sort order:

### Reference Images
- File name:
  Caption:
  Body region:
  Example type: reference

### Detection Rules
- Rule name:
  Required symptom codes:
  Optional symptom codes:
  Blocked symptom codes:
  Min score:
```

## Example

```md
## Disease

- Name: Bird Flu
- Slug: bird-flu
- Short label: Bird flu
- Severity: critical
- Summary: Viral disease that may cause respiratory distress, weakness, and sudden flock decline.
- Source: Chicken Information PDF

### Aliases
- Avian Influenza

### Symptoms
- symptom_code: labored_breathing
  Label in source: Difficulty breathing
  Primary: yes
  Weight: 1.5

- symptom_code: weak
  Label in source: Weakness
  Primary: yes
  Weight: 1.2

- symptom_code: lethargic
  Label in source: Lethargy
  Primary: no
  Weight: 1.0

### Treatments
- Title: Immediate isolation
  Treatment text: Isolate suspected birds and contact a veterinarian immediately.
  Medication match:
  Vitamin match:
  Sort order: 1

- Title: Supportive care
  Treatment text: Provide clean water, reduce stress, and monitor flock exposure.
  Medication match:
  Vitamin match: Electrolyte Plus
  Sort order: 2

### Reference Images
- File name: bird-flu-01.jpg
  Caption: Facial swelling and respiratory signs
  Body region: head
  Example type: reference

### Detection Rules
- Rule name: bird-flu-basic
  Required symptom codes: labored_breathing
  Optional symptom codes: weak, lethargic, discharge
  Blocked symptom codes:
  Min score: 2.0
```

## Mapping Rules

### Name / slug

- `name` should match the disease title from the source
- `slug` should be lowercase kebab-case
- example:
  - `Bird Flu` -> `bird-flu`

### Symptoms

Map source symptoms to existing `symptoms.code` values where possible:

- `Restless` -> `restless`
- `Stressed` -> `stressed`
- `Weakness` -> `weak`
- `Lethargy` -> `lethargic`
- `Poor appetite` -> `poor_appetite`
- `Difficulty breathing` -> `labored_breathing`
- `Nasal discharge` -> `discharge`
- `Ruffled feathers` -> `ruffled_feathers`
- `Isolating from flock` -> `isolating`

If the document contains symptoms not covered by the current table, list them separately first before import. They may require new rows in `symptoms`.

### Medications / vitamins

If a treatment mentions an existing lookup value, map it to:

- `medications.name`
- `vitamins.name`

Otherwise, leave the match blank and keep the full treatment in `treatment_text`.

### Images

- Put the actual image file in Supabase Storage
- save only the file path or URL in the database
- recommended storage path:
  - `disease-reference-images/<slug>/<filename>`

## Import Order

1. Fill this template for all diseases from the PDF/Doc.
2. Confirm missing symptom codes or unmatched meds/vitamins.
3. Upload reference images to Supabase Storage.
4. Insert into `diseases`.
5. Insert into related child tables.
6. Wire the health detection flow to use `disease_id`.

## Review Checklist

Before importing, confirm:

- disease name is consistent
- slug is unique
- symptoms are mapped correctly
- treatment text is clean and readable
- image filenames are prepared
- severity is assigned
- all aliases are captured
