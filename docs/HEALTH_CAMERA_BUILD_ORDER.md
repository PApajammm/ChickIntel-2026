# Health Camera Build Order

This file tracks the `Health` camera flow step by step.

## Current Reset Status

Health Camera image detection has been reset.

- camera capture still works
- scanned health result still opens
- journal save still works
- Roboflow image inference is disconnected
- Supabase Edge Function inference is disconnected
- reconnect steps are tracked in `docs/health-camera-detection-reset.md`

## Step 1. Camera Capture

Flow:

- open health camera
- preview chicken in camera
- capture image
- pass image to the next screen

### Implemented

- camera permission request
- live back-camera preview
- flash toggle
- zoom slider
- shutter button capture
- captured image URI is passed forward
- camera framing guide exists
- health-specific capture guidance exists
- capture timestamp can be passed into the health flow
- capture dimensions can be passed into the health flow
- basic image quality validation before continuing
- captured image is usable for manual review
- capture works for the current symptom confirmation flow

### Partial

- camera quality still depends on the user taking a clear photo
- blur and lighting checks are still not truly analyzed yet

### Not Implemented

- true blur detection
- true lighting validation
- image preprocessing for AI detection

Main files:

- [scanner.tsx](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/app/(tabs)/scanner.tsx)
- [camera-viewport.tsx](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/components/scanner/camera-viewport.tsx)
- [viewfinder-overlay.tsx](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/components/scanner/viewfinder-overlay.tsx)
- [scanner-shutter.tsx](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/components/scanner/scanner-shutter.tsx)

## Step 2. Image Detection / AI Detection

Flow:

- analyze the captured image
- suggest possible disease based on the picture
- return description and confidence

### Implemented

- reset placeholder result while Roboflow is disconnected

### Partial

- disease data already exists in Supabase and can support future detection

### Not Implemented

- picture-only disease detection
- symptom detection directly from image
- image-based confidence score
- real AI or model inference
- detection before symptom confirmation

Main files:

- [result.tsx](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/app/(tabs)/scanned-health/result.tsx)
- [health-camera-detection-reset.md](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/docs/health-camera-detection-reset.md)

## Step 3. Scanned Health Input

Flow:

- show captured image
- let user confirm visible symptoms
- pass selected symptoms to result screen

### Implemented

- captured image preview is shown
- symptom checklist exists
- selected symptoms are passed to the result screen

### Partial

- the screen works as a symptom confirmation step
- current detection text is a reset placeholder before the new Roboflow setup is added

### Not Implemented

- real disease detected from image before user symptom selection
- auto-filled visible symptoms from image analysis

Main files:

- [index.tsx](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/app/(tabs)/scanned-health/index.tsx)
- [health-input-summary-card.tsx](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/components/health-scan/health-input-summary-card.tsx)
- [symptom-checklist.tsx](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/components/health-scan/symptom-checklist.tsx)

## Step 4. Scanned Health Result

Flow:

- show detected disease
- show disease description and symptoms
- show treatment recommendation
- let user save the result

### Implemented

- result screen exists
- matched disease name can be shown
- disease summary can be shown
- disease symptoms can be shown
- treatment recommendation can be shown
- save button exists

### Partial

- current result is a reset placeholder and not a disease diagnosis

### Not Implemented

- result generated directly from image AI detection
- ranked disease predictions from image
- confidence display from real image model

Main files:

- [result.tsx](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/app/(tabs)/scanned-health/result.tsx)
- [health-result-card.tsx](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/components/health-scan/health-result-card.tsx)

## Step 5. Health Journal Logs

Flow:

- save scanned disease result
- show saved logs in journal list
- open full journal detail

### Implemented

- health scan can be saved
- saved logs appear in journal list
- journal detail screen exists
- disease name can be saved
- disease id, confidence, and detection source can be saved

### Partial

- journal is synced with the current symptom-based disease matching flow
- journal quality depends on the result data being correct first

### Not Implemented

- journal entries generated from real picture-based AI detection
- richer audit trail for image-analysis output

Main files:

- [supabase-health-journal.ts](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/utils/supabase-health-journal.ts)
- [index.tsx](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/app/(tabs)/journal/index.tsx)
- [[id].tsx](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/app/(tabs)/journal/[id].tsx)

## Step 6. Disease Database Support

Flow:

- store disease knowledge
- use it for result content and future AI support

### Implemented

- disease tables exist
- disease seed batch was prepared and loaded
- diseases, symptoms, treatments, and rules can be queried

### Partial

- current app uses this data mainly for symptom-rule matching and display

### Not Implemented

- reference-image driven matching
- image embedding or model-ready disease image pipeline

Main files:

- [disease-knowledge-setup.sql](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/supabase/disease-knowledge-setup.sql)
- [disease-knowledge-batch-1.sql](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/supabase/disease-knowledge-batch-1.sql)
- [supabase-diseases.ts](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/utils/supabase-diseases.ts)

## Simple Order

1. Camera Capture
2. Image Detection / AI Detection
3. Scanned Health Input
4. Scanned Health Result
5. Health Journal Logs
6. Disease Database Support
