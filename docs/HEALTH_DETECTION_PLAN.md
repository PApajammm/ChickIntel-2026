# Health Detection Plan

This plan is for the ChickIntel `Health` camera flow where:

1. The user captures a chicken image.
2. The system detects a possible disease.
3. The app shows the result screen.
4. The result is saved into `Health Journal Logs`.

The Google Doc / PDF `Chicken Information` should be used as the disease knowledge base and reference source for this feature.

## Short Answer

Yes, this is an AI camera workflow.

But it has two separate parts:

- `Knowledge base`: disease names, symptoms, treatments, and reference images
- `Detection engine`: model/rules/service that decides which disease is most likely from the captured image and selected symptoms

The PDF/Google Doc is the knowledge base, not the model by itself.

## What The PDF / Google Doc Should Become

The document should be converted into structured disease data.

For each disease in `Chicken Information`, store:

- disease name
- alternate names
- summary / short description
- severity
- matching symptoms
- recommended treatment
- supporting medication/vitamin references if applicable
- one or more reference images
- original source note such as `Chicken Information PDF`

## Database Tables Added

The schema file [disease-knowledge-setup.sql](/C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/supabase/disease-knowledge-setup.sql) adds:

- `diseases`
- `disease_aliases`
- `disease_symptoms`
- `disease_treatments`
- `disease_reference_images`
- `disease_detection_rules`

It also extends:

- `health_logs`
  - `disease_id`
  - `detection_source`
  - `confidence`
- `scan_records`
  - `disease_id`
  - `confidence`

## Recommended Storage Strategy

### Text / metadata

Store in Supabase Postgres:

- names
- symptoms
- treatments
- severity
- detection rules

### Images

Store reference images in Supabase Storage, then save their paths in:

- `disease_reference_images.image_path`

Do not store the raw image files directly in table rows.

## How The AI Camera Flow Should Work

### Phase A: Knowledge import

1. Read the PDF/Google Doc.
2. Split it disease by disease.
3. Insert disease records into `diseases`.
4. Map listed symptoms to existing `symptoms` rows.
5. Insert treatment guidance into `disease_treatments`.
6. Upload reference images into Supabase Storage.
7. Save image paths in `disease_reference_images`.

### Phase B: Detection pipeline

When the user captures an image:

1. App uploads image or sends image to detection service.
2. Detection service returns:
   - `disease_id`
   - `disease_name`
   - `confidence`
   - optional visual findings
3. App opens health input/result flow with:
   - detected disease name
   - confidence
   - captured image
4. User confirms additional symptoms/behaviors.
5. System combines:
   - image detection
   - selected symptoms
   - disease rules / knowledge base
6. Result screen is shown.
7. Save to `health_logs` and `scan_records`.

## Detection Options

### Option 1: Real image model

Best long-term approach.

Use a model/API that predicts disease from the photo.

Expected output:

- probable disease
- confidence score
- optional top-3 candidates

### Option 2: AI + rule hybrid

Practical first production version.

Flow:

- image model suggests disease candidate
- symptom checklist refines/validates candidate
- final result is generated from the disease knowledge base

This is the recommended approach for this app.

### Option 3: Rules only

Not a real image detector.

The image is captured, but the diagnosis is driven only by selected symptoms and disease rules. This is acceptable as a temporary fallback, but it is not true AI camera detection.

## Recommended Result Structure

For the result screen and journal, save:

- `detectedIllness`
- `disease_id`
- `confidence`
- `detection_source`
- `behaviorIds`
- `resultSummary`
- `recommendationText`
- `actionStatus`
- `durationValue`
- captured image URI

## Journal Behavior

The `Health Journal Logs` should show:

- detected illness name
- that it came from image-based detection
- recommendations tied to that disease
- saved image
- selected symptom chips

The journal should not depend on generic wording alone. It should be disease-specific whenever `disease_id` or detected disease name is available.

## Import Work Needed Next

To make the PDF/Google Doc usable, the next implementation step is:

1. extract all diseases from the source
2. normalize disease names
3. match symptoms to `symptoms`
4. upload/store reference images
5. create a seed/import file for Supabase

## Important Limitation

Saving the PDF content into the database does not automatically make the camera detect diseases.

It gives the app:

- the knowledge to display disease details
- the rules to support decisions
- the content for the journal

But actual AI image detection still requires a model or external service.

## Recommended Next Technical Step

After the schema is applied, the next step should be:

1. create a disease import template from the PDF
2. build a `utils/supabase-diseases.ts` query layer
3. update the health scan flow to save:
   - `disease_id`
   - `confidence`
   - `detection_source`
4. decide whether image detection will use:
   - custom model
   - third-party vision API
   - temporary rules-only fallback
