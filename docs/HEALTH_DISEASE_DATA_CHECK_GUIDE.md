# Health Disease Data Check Guide

This guide shows how to:

1. run the first disease batch SQL
2. check the disease data in Supabase
3. add another disease later

## Files To Run

Run these in order:

1. [disease-knowledge-setup.sql](/C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/supabase/disease-knowledge-setup.sql)
2. [disease-knowledge-batch-1.sql](/C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/supabase/disease-knowledge-batch-1.sql)

You already ran step 1.

## How To Run Batch 1

In Supabase SQL Editor:

1. open the SQL editor
2. paste the contents of `supabase/disease-knowledge-batch-1.sql`
3. run it

Expected result:

- success message
- no error

## How To Check The Data

### Check diseases table

Run:

```sql
select slug, name, severity, is_active
from public.diseases
order by name;
```

### Check symptom links per disease

Run:

```sql
select
    d.name as disease,
    s.code as symptom_code,
    s.label as symptom_label,
    ds.weight,
    ds.is_primary
from public.disease_symptoms ds
join public.diseases d on d.id = ds.disease_id
join public.symptoms s on s.id = ds.symptom_id
order by d.name, ds.is_primary desc, s.label;
```

### Check treatments per disease

Run:

```sql
select
    d.name as disease,
    dt.sort_order,
    dt.title,
    dt.treatment_text
from public.disease_treatments dt
join public.diseases d on d.id = dt.disease_id
order by d.name, dt.sort_order;
```

### Check reference images

Run:

```sql
select
    d.name as disease,
    dri.image_path,
    dri.image_caption,
    dri.body_region
from public.disease_reference_images dri
join public.diseases d on d.id = dri.disease_id
order by d.name;
```

### Check detection rules

Run:

```sql
select
    d.name as disease,
    r.rule_name,
    r.required_symptom_codes,
    r.optional_symptom_codes,
    r.min_score
from public.disease_detection_rules r
join public.diseases d on d.id = r.disease_id
order by d.name;
```

## How To Add Another Disease Later

Use this process:

1. fill a new block in [DISEASE_IMPORT_TEMPLATE.md](/C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/docs/DISEASE_IMPORT_TEMPLATE.md)
2. map symptoms to existing `symptoms.code`
3. if a symptom does not exist, add it first to `public.symptoms`
4. create insert SQL for:
   - `diseases`
   - `disease_aliases`
   - `disease_symptoms`
   - `disease_treatments`
   - `disease_reference_images`
   - optional `disease_detection_rules`
5. run the SQL in Supabase
6. verify using the queries above

## Important Rule When Adding Diseases

Always add missing symptoms first.

Why:

- `disease_symptoms` depends on valid `symptoms.id`
- if the symptom row does not exist yet, the disease-symptom insert will fail

## How To Check If A Symptom Already Exists

Run:

```sql
select code, label
from public.symptoms
order by label;
```

## How To Check If A Disease Already Exists

Run:

```sql
select slug, name
from public.diseases
where slug = 'your-disease-slug';
```

## Recommended Practice

- use one SQL batch file per screenshot batch
- keep slugs stable
- keep image path naming consistent
- prefer `on conflict` safe inserts so reruns do not duplicate records
