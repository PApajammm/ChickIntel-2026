# Health Camera Roboflow Reconnect Plan

Use this only after choosing the exact new Roboflow project.

## Required Roboflow Details

Collect these before writing code:

- workspace name
- project slug
- trained version number
- model type
- API key
- expected class labels

The model id should look like:

```text
project-slug/version-number
```

## Reconnect Order

1. Create or confirm the Roboflow project.
2. Upload labeled health images.
3. Generate a dataset version.
4. Train the model.
5. Test one image inside Roboflow.
6. Create a new Supabase Edge Function for Health Camera inference.
7. Set Supabase secrets for the new project.
8. Deploy the Edge Function.
9. Reconnect the Health result screen to the Edge Function.
10. Show the returned `modelId` in the app during testing.

## Supabase Secrets To Add Later

Set these only after the new Roboflow project is confirmed:

```bash
supabase secrets set ROBOFLOW_API_KEY=your-new-api-key
supabase secrets set ROBOFLOW_MODEL_ID=your-new-project-slug/version-number
supabase secrets set ROBOFLOW_BASE_URL=https://serverless.roboflow.com
```

For workflow-based inference, use:

```bash
supabase secrets set ROBOFLOW_WORKFLOW_URL=your-new-workflow-url
```

## Done Means

The reset is no longer considered reconnected until a Health Camera scan returns the selected project identifier:

```text
modelId: your-new-project-slug/version-number
```
