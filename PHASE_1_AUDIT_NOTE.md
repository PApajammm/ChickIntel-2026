# ChickIntel Expo OTA Update Implementation Plan

Status: Multi-phase plan. Phase 1 is the audit gate. No files modified yet. No configuration changes. No package installs. No build commands. No APK build. No EAS changes.

## Overall Goal

Prepare the existing ChickIntel Expo React Native application for Expo EAS Update (OTA updates), then implement the OTA update flow carefully in a controlled, staged sequence.

This plan is intentionally phased so that the project is audited before any change is made, and each later phase is blocked until the previous phase is reviewed and approved.

---

## PHASE 1: AUDIT THE EXISTING CHICKINTEL EXPO PROJECT

Objective:
Audit the current ChickIntel Expo React Native project to prepare it for Expo EAS Update (OTA updates), without modifying any project files in this phase.

Inspect:

1. Project structure
2. package.json
3. app.json or app.config.js/ts
4. eas.json
5. Expo SDK version
6. React Native version
7. Whether expo-updates is installed
8. Existing EAS configuration
9. Existing EAS project ID
10. Expo account/owner configuration
11. Existing build profiles
12. Existing update channels
13. Existing runtimeVersion configuration, if any
14. Any existing OTA/update-related code
15. Current Git status

Important guardrails:

- Do not install packages.
- Do not edit files.
- Do not run commands that modify the project.
- Do not change EAS configuration.
- Do not build an APK.
- Do not proceed to Phase 2 automatically.
- Wait for approval before making any changes.

After inspection, report:

A. What is already configured correctly.
B. What is missing for EAS Update.
C. What needs to be changed.
D. Whether the current APK can receive OTA updates.
E. Whether a new APK is needed before OTA updates can work.
F. Which files would need modification.
G. Any risks or configuration conflicts found.

Also explain the difference between:

- APK version
- OTA update
- EAS build
- EAS update
- EAS channel
- runtimeVersion

Status: Not started until the audit is performed and reviewed.

---

## PHASE 2: CONFIGURE EXPO EAS UPDATE

The project audit from Phase 1 is complete.

Now configure the existing ChickIntel project for Expo EAS Update.

Important constraints:

- Only make changes necessary for EAS Update.
- Do not modify unrelated ChickIntel features.
- Do not redesign the application.
- Do not change database logic.
- Do not change Supabase functionality.
- Do not change authentication.
- Do not change existing screens unless required for the update system.
- Before changing anything, review the Phase 1 findings.

Configure:

1. expo-updates if it is missing.
2. EAS Update configuration.
3. The correct Expo project association.
4. The production update channel.
5. The appropriate runtimeVersion strategy.
6. Any required app.json/app.config changes.
7. Any required eas.json changes.

Use the existing Expo account/project configuration whenever possible.

Important:

- Do not accidentally configure development builds to receive production updates.
- Do not overwrite existing EAS profiles unless necessary.
- Do not remove existing build configuration.
- Do not build the APK yet.

After making the changes:

1. List every file modified.
2. Show what was changed.
3. Explain why each change was necessary.
4. Check the configuration for errors.
5. Run appropriate validation commands that do not create a production build.
6. Explain exactly what command will be used to create the production APK.

Stop after Phase 2.

Status: Blocked until Phase 1 review and approval.

---

## PHASE 3: CREATE THE OTA-ENABLED PRODUCTION APK

The EAS Update configuration has now been completed and reviewed.

Now prepare the first production APK that will receive OTA updates.

Important checks before building:

1. The production build uses the correct production channel.
2. The Expo project ID is correct.
3. The runtimeVersion configuration is correct.
4. expo-updates is configured correctly.
5. The build profile does not accidentally use a development channel.
6. No existing ChickIntel features were changed unnecessarily.
7. Do not modify unrelated application code.

First show the exact EAS build command recommended.

Explain:

- Which profile will be used.
- Which channel it uses.
- Why this APK will be capable of receiving OTA updates.
- What users will need to do when installing this APK.

Then, if the configuration is correct, run the appropriate production EAS build command.

After the build is complete:

1. Verify that the build completed successfully.
2. Explain how to install the APK.
3. Explain how to verify that the installed APK is connected to the correct EAS Update channel.
4. Do not implement the update popup yet.

The purpose is only to create and verify the OTA-enabled production APK.

Stop after Phase 3.

Status: Blocked until Phase 2 completion and approval.

---

## PHASE 4: IMPLEMENT THE CHICKINTEL OTA UPDATE NOTIFICATION

The OTA-enabled production APK from Phase 3 is now available.

Now implement the in-app OTA update notification.

Goal:
When ChickIntel detects a compatible OTA update, show a clean update dialog.

Expected UI:

Title:
"New Update Available"

Message:
"A new version of ChickIntel is available with improvements and new features."

Buttons:

- "Update Now"
- "Later"

Update now flow:

1. Check for an available OTA update.
2. Show the update dialog.
3. User taps "Update Now".
4. Download the update.
5. Show an appropriate loading state.
6. Reload the application after the update is downloaded.
7. User continues using ChickIntel with the updated code.

Later flow:

1. User taps "Later".
2. Close the dialog.
3. Continue using ChickIntel normally.
4. Do not repeatedly show the same popup during the same session.

Technical requirements:

- Use the official Expo Updates API.
- Use appropriate update functionality such as:
  - checking for updates
  - fetching the update
  - reloading the application
- Handle errors safely.

If the update check fails:

- Do not prevent the user from opening ChickIntel.
- Do not crash the application.
- Do not repeatedly show an error popup.

Startup behavior:

- The update check should not significantly delay app startup.
- Do not check for updates excessively.
- Keep the existing ChickIntel UI and navigation intact.
- Use the existing design system, fonts, spacing, colors, and components where possible.
- Do not create unnecessary dependencies.

Version information:

- If ChickIntel already has an About or Settings section, consider displaying the current application version there.
- Clearly distinguish:
  - Native APK version
  - OTA update
- Do not change the APK version every time an OTA update is published.

After implementation:

1. List every modified file.
2. Explain each modification.
3. Explain the complete update flow.
4. Check TypeScript errors.
5. Check for lint/build issues if available.
6. Confirm that the app still works when no OTA update exists.
7. Confirm that the app still works when the update check fails.

Stop after Phase 4.

Status: Blocked until Phase 3 completion and approval.

---

## PHASE 5: TEST THE COMPLETE OTA UPDATE SYSTEM

The ChickIntel OTA update system has now been implemented.

Do not add new features.

Test the complete OTA update flow.

Test 1: No update available

Verify:

1. ChickIntel starts normally.
2. The update check runs.
3. No update dialog appears.
4. The user can use the application normally.

Test 2: OTA update available

Create a small safe test change, such as a minor UI text change.

Publish it to the correct production EAS Update channel.

Verify:

1. Existing OTA-enabled APK detects the update.
2. "New Update Available" appears.
3. "Later" closes the dialog.
4. "Update Now" downloads the update.
5. The application reloads.
6. The new change appears.

Test 3: Update check failure

Simulate or safely test an update-check failure.

Verify:

1. ChickIntel does not crash.
2. The user can still use the application.
3. No endless error popup appears.

Test 4: Native change limitation

Explain which future ChickIntel changes will require a new APK instead of an OTA update.

Test 5: Production commands

Provide the final commands to use for:

- Publishing a compatible OTA update.
- Building a new APK when a native change is required.
- Checking the production update channel.
- Viewing EAS Update information.

Final documentation:

Create a concise section explaining this workflow:

Normal code/feature change
→ Git commit
→ Git push
→ Test
→ EAS Update
→ User receives OTA update

Native change
→ Git commit
→ Git push
→ EAS Build
→ New APK
→ User installs new APK

Also explain what changes are safe for OTA and what changes require a new APK.

Do not modify unrelated ChickIntel functionality.

After testing, report any problems found and how they were fixed.

Do not automatically make additional changes beyond what is required for OTA update functionality.

Status: Blocked until Phase 4 completion and approval.

---

## Approval Gate Summary

This plan intentionally prevents automatic progression:

- Phase 1 must be completed and reviewed before Phase 2.
- Phase 2 must be completed and reviewed before Phase 3.
- Phase 3 must be completed and reviewed before Phase 4.
- Phase 4 must be completed and reviewed before Phase 5.

Only after review and approval should the next phase begin.

---

## Notes

This document is the complete staged roadmap for the ChickIntel Expo OTA update effort. The current status remains audit-only and unchanged until explicit approval is given for the next phase.
