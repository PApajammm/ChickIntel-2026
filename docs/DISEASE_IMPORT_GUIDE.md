# Disease Import Guide

This guide explains how to move the `Chicken Information` Google Doc / PDF into the new disease knowledge tables.

## Goal

Turn the source document into structured disease data that can be used for:

- AI-assisted health camera detection
- health result screen content
- health journal disease records
- treatment and symptom references

## Files To Use

- schema: [disease-knowledge-setup.sql](/C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/supabase/disease-knowledge-setup.sql)
- flow plan: [HEALTH_DETECTION_PLAN.md](/C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/docs/HEALTH_DETECTION_PLAN.md)
- import template: [DISEASE_IMPORT_TEMPLATE.md](/C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/docs/DISEASE_IMPORT_TEMPLATE.md)

## Recommended Process

### Step 1: Extract the diseases from the source

For each disease in the PDF/Google Doc, collect:

- name
- alternate names
- symptoms
- treatment
- image references
- notes/description

### Step 2: Normalize the terms

Make sure:

- disease names are consistent
- symptom names are mapped to existing symptom codes
- medication/vitamin names match current lookup values when possible

### Step 3: Fill the import template

Use one template block per disease in [DISEASE_IMPORT_TEMPLATE.md](/C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/docs/DISEASE_IMPORT_TEMPLATE.md).

### Step 4: Prepare image assets

If the PDF/Doc contains disease pictures:

- extract them as image files
- upload them to Supabase Storage
- keep a consistent path naming format

Recommended path:

- `disease-reference-images/<disease-slug>/<filename>`

### Step 5: Import into Supabase

Insert in this order:

1. `diseases`
2. `disease_aliases`
3. `disease_symptoms`
4. `disease_treatments`
5. `disease_reference_images`
6. optional `disease_detection_rules`

## How This Connects To The App

### During scan

The health camera should eventually return:

- detected disease name
- `disease_id`
- confidence score
- optional top matches

### On the result screen

The app should use the disease knowledge base to show:

- detected illness name
- disease summary
- treatment guidance
- supporting symptoms

### In journal logs

The app should save:

- `disease_id`
- `detectedIllness`
- `confidence`
- `detection_source`
- selected symptoms
- result summary
- recommendation text

## Temporary Reality

Right now the app can display and save disease-oriented content, but it still needs:

- actual disease data import
- a real image detection model/service

So the immediate next useful step is not model training first. It is:

- build the disease knowledge base from your PDF/Doc

That gives the app proper disease names, symptoms, and treatments even before the model is fully integrated.

## Best Next Step

Fill the template for the first `3 to 5` diseases only.

That is enough to:

- validate the schema
- test journal rendering
- test result wording
- prepare the future AI camera integration
