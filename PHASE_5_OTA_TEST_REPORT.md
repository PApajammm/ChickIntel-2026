# Phase 5: OTA Test Report

**Date:** 2026-08-31  
**Status:** EAS-side validation complete; physical-device verification required

## Implementation Under Test

- `expo-updates`: `~29.0.20` (Expo SDK 54 compatible)
- Production channel/branch: `production`
- Runtime version: `1.0.8` via `appVersion`
- Update check policy: `NEVER` so the Phase 4 prompt controls checking and downloading
- Update URL: `https://u.expo.dev/8283a1dd-e69b-41f1-9cd5-211270c5e351`

## Test Execution

### Test 1: No update available

**EAS-side result:** PASS. The published update is Android-only, targets runtime `1.0.8`, and is assigned to `production`.

**Device result:** Requires manual confirmation: launch the installed production APK after it has applied the latest update; no dialog should appear when no newer update exists.

### Test 2: OTA update available

**EAS-side result:** PASS. Published update group:

- Group ID: `8e8a84af-4ff1-47f5-a6d8-f985a8b1b395`
- Android update ID: `01a057ac-adc4-7e60-9050-efc7347bf935`
- Runtime version: `1.0.8`
- Branch: `production`

**Device result:** Requires manual confirmation of the `New Update Available` dialog, `Later`, `Update Now`, download loading state, and reload.

### Test 3: Update check failure

The check and fetch promises are caught. A failed check does not render an error popup or block startup; a failed fetch closes the prompt and restores normal app use.

**Device result:** Network/offline simulation requires manual confirmation.

### Test 4: Native change limitation

A new APK is required for native dependency changes, app permissions, Android manifest changes, native plugins, SDK upgrades, runtime-version changes, or other native code/configuration changes. JavaScript, TypeScript, styles, assets included in the update, and screen logic are candidates for OTA updates when the runtime version remains `1.0.8`.

## Problem Found and Fixed

The first publish attempt failed because `updates.checkAutomatically` was `ON_APP_START`, which is not a valid Expo SDK 54 EAS Update manifest value. It was corrected to `NEVER` so the custom Phase 4 prompt owns the manual check/fetch flow. The corrected publish succeeded.

## Production Commands

Publish a compatible OTA update:

```bash
eas update --platform android --channel production --message "Describe the update"
```

Build a new directly installable APK for native changes:

```bash
eas build --platform android --profile production
```

Check the production channel:

```bash
eas update:list --branch production
```

View recent EAS Update information:

```bash
eas update:list --branch production
```

You can also use the EAS dashboard update-group link from the publish output.

## Release Workflow

Normal code/feature change  
→ Git commit  
→ Git push  
→ Test  
→ `eas update --platform android --channel production`  
→ User receives the OTA update

Native change  
→ Git commit  
→ Git push  
→ `eas build --platform android --profile production`  
→ New APK  
→ User installs the new APK

## Validation Limits

TypeScript validation passed. The EAS Update bundle compiled and published successfully. No ADB executable or connected Android device was available in this workspace, so physical UI interaction and reload behavior remain manual device checks.

Phase 5 stops here. No additional features, native build, or OTA publication will be started automatically.
