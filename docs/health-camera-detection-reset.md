# Health Camera Detection Reset

The Health Camera image detection integration has been reset.

## Current State

- The Health Camera can still capture photos.
- The scanned health result screen still opens.
- Health journal saving still works through the existing Supabase app setup.
- The app no longer calls a Roboflow model for Health Camera detection.
- The local Supabase Edge Function for Roboflow Health inference was removed.
- No Roboflow model id is active in the Expo app.

## What Was Disconnected

- Health result screen to Roboflow image inference.
- Expo app to `roboflow-health-inference`.
- Local `supabase/functions/roboflow-health-inference` files.
- Local Roboflow setup hints in `.env.example`.

## What Was Not Reset

- Supabase authentication.
- Farm data.
- Health journal tables.
- Disease knowledge tables.
- Inventory, reports, schedules, or other modules.

## Important Supabase Dashboard Cleanup

The local project is disconnected, but any already deployed Supabase Edge Function or secret may still exist in the remote Supabase project.

Check Supabase Dashboard for project `rfwejibsxlsjkmqbgfwh`:

1. Open `Edge Functions`.
2. Delete or ignore `roboflow-health-inference` if it still exists.
3. Open project secrets.
4. Remove old Health Camera Roboflow secrets if present:
   - `ROBOFLOW_API_KEY`
   - `ROBOFLOW_MODEL_ID`
   - `ROBOFLOW_WORKFLOW_URL`
   - `ROBOFLOW_BASE_URL`

The local Supabase CLI failed on this Windows setup, so dashboard cleanup is the reliable path for now.

## Fresh Setup Checklist

Use this order when connecting the new Roboflow project:

1. Confirm the exact Roboflow workspace.
2. Confirm the exact Roboflow project slug.
3. Confirm the trained version number.
4. Decide whether to use hosted model inference or a workflow URL.
5. Recreate the Supabase Edge Function locally.
6. Set fresh Supabase secrets for the selected project only.
7. Deploy the Edge Function.
8. Reconnect the Health result screen to the new function.
9. Test with one known image from the new Roboflow project.
10. Confirm the app response returns the expected model id or workflow URL.

## Target Proof

Before considering the new setup complete, the app must show or log the model identifier returned by Supabase:

```text
modelId: your-new-roboflow-project/version
```

or:

```text
modelId: your-new-roboflow-workflow-url
```
