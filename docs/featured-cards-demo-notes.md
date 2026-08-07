# Featured Cards Demo Notes

## Scope

- Feature: Home `featuredCards` now includes recent breed scans and defaults.
- File source: `utils/recent-breed-scans.ts`
- UI target: `app/(tabs)/index.tsx`

## Current Demo Behavior

- Storage is in runtime memory only (module state), not persisted.
- Recent scans are retained for 3 days max.
- Recent scans are appended from `app/(tabs)/scanner.tsx` when mode is `breed`.
- Three default cards are always included to avoid an empty carousel:
  - `Barred Rock`
  - `Silkie`
  - `Rhode Island Red`
- Home carousel starts with 3 cards minimum and expands when new scans are captured.

## Logging

- Scanner logs:
  - `Breed scan added to in-memory featured cards`
- Home logs:
  - `Home featured cards refreshed`

## Backend Handoff

- Replace in-memory list with DB/API read-write flow.
- Add dedupe rules by `scan_id` (or equivalent immutable capture ID) to avoid duplicate entries.
- Keep 3-day filtering as a query layer rule or configurable retention policy.
