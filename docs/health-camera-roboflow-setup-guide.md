# Health Camera Roboflow Setup Guide

Use this guide to connect the new Roboflow Health Camera project to Supabase and the app.

## Goal

Connect this flow:

```text
Health Camera photo
-> Supabase Edge Function
-> Roboflow model
-> Health result screen
-> Health journal save
```

The Roboflow API key must stay in Supabase. Do not place it in Expo `.env`.

## Step 1. Collect Roboflow Project Details

Fill this in before coding:

```text
Workspace name:
Project slug:
Version number:
Model id:
Model type:
Class labels:
```

Verified project details:

```text
Workspace slug: donut-ep62e
Workspace display name: New Workspace
Project display name: ChickIntel Disease Classifier
Project slug: chickintel-disease-classifier-seug1
Version number: 3
Model id: donut-ep62e/chickintel-disease-classifier-seug1-3-vit-base-patch16-224-in21k-t1
Model type: ViT Classification
Class labels: fowlpox, healthy, infectious coryza, nonchicken
```

Example:

```text
Workspace name: ralph-workspace
Project slug: chicken-health-detection
Version number: 1
Model id: chicken-health-detection/1
Model type: classification
Class labels: healthy, fowl-pox, newcastle-disease
```

The model id format is:

```text
project-slug/version-number
```

## Step 2. Check Roboflow Project

In Roboflow:

1. Open the correct workspace.
2. Open the new Health Camera project.
3. Confirm the project is trained.
4. Confirm the version number.
5. Test one image inside Roboflow.
6. Copy the project slug and version number.
7. Copy or generate the private API key from the same workspace.

Important:

- API keys are workspace-scoped.
- Use the API key from the workspace that owns the project.
- Keep the private API key secret.

Status:

```text
Done: workspace verified
Done: project verified
Done: model version verified
Done: class labels verified
Done: private API key found
Done: private API key stored in Supabase secrets
```

## Step 3. Set Supabase Secrets

In Supabase Dashboard:

1. Open the `ChickIntel` Supabase project.
2. Go to `Project Settings`.
3. Open `Edge Functions`.
4. Open `Secrets`.
5. Add these secrets:

```text
ROBOFLOW_API_KEY=your-private-roboflow-api-key
ROBOFLOW_MODEL_ID=your-roboflow-model-id
ROBOFLOW_BASE_URL=https://serverless.roboflow.com
```

Example:

```text
ROBOFLOW_MODEL_ID=chicken-health-detection/1
ROBOFLOW_BASE_URL=https://serverless.roboflow.com
```

Do not add these to Expo `.env`.

Status:

```text
Done: Supabase CLI installed locally at .tools/supabase-cli/supabase.exe
Done: Supabase project verified as rfwejibsxlsjkmqbgfwh
Done: ROBOFLOW_API_KEY secret set
Done: ROBOFLOW_MODEL_ID secret set to donut-ep62e/chickintel-disease-classifier-seug1-3-vit-base-patch16-224-in21k-t1
Done: ROBOFLOW_BASE_URL secret set to https://serverless.roboflow.com
```

## Step 4. Create Supabase Edge Function

Create this local function:

```text
supabase/functions/roboflow-health-inference/index.ts
```

The function should:

1. Accept a POST body with `imageBase64`.
2. Read `ROBOFLOW_API_KEY` from Supabase secrets.
3. Read `ROBOFLOW_MODEL_ID` from Supabase secrets.
4. Send the image to Roboflow.
5. Return:

```text
modelId
topPrediction
predictions
```

The returned `modelId` is required so we can verify the correct Roboflow project is being used.

Status:

```text
Done: supabase/functions/roboflow-health-inference/index.ts created
Done: function reads ROBOFLOW_API_KEY from Supabase secrets
Done: function reads ROBOFLOW_MODEL_ID from Supabase secrets
Done: function returns modelId, topPrediction, predictions, and raw payload
```

## Step 5. Deploy Supabase Edge Function

Deploy:

```bash
supabase functions deploy roboflow-health-inference
```

If the local Supabase CLI does not work, deploy or edit the function through Supabase Dashboard.

Status:

```text
Done: roboflow-health-inference deployed to project rfwejibsxlsjkmqbgfwh
Done: function status verified as ACTIVE
Done: deployed function version verified as 9
```

## Step 6. Reconnect The App

Create or restore this app helper:

```text
utils/health-image-inference.ts
```

It should:

1. Read the captured photo URI.
2. Convert the photo to base64.
3. Call Supabase function `roboflow-health-inference`.
4. Return model prediction data to the result screen.

Reconnect this screen:

```text
app/(tabs)/scanned-health/result.tsx
```

It should:

1. Call image inference after capture.
2. Show the top prediction.
3. Show confidence.
4. Show `modelId` during testing.
5. Save the result to the Health Journal.

## Step 7. Verify The Setup

Run the app and test one Health Camera scan.

The result must show or log:

```text
modelId: your-roboflow-model-id
```

Example:

```text
modelId: chicken-health-detection/1
```

If the model id is wrong, stop and fix Supabase secrets before continuing.

## Step 8. Error Checklist

If inference fails, check these in order:

1. Supabase project is the correct project.
2. Edge Function exists and is deployed.
3. `ROBOFLOW_API_KEY` is set in Supabase secrets.
4. `ROBOFLOW_MODEL_ID` matches the new Roboflow project and version.
5. Roboflow project is trained and deployable.
6. The class labels match expected disease names or aliases.
7. Expo was restarted after code changes.

## Done Means

The setup is complete only when:

- Health Camera captures a photo.
- Supabase Edge Function receives the image.
- Roboflow returns a prediction.
- The result screen displays the prediction and confidence.
- The screen shows or logs the expected `modelId`.
- The Health Journal can save the result.
