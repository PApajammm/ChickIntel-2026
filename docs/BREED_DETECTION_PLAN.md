# Breed Detection Plan

This plan is for the ChickInteL `Breed` camera flow.

## Short Answer

Yes, `Roboflow Classification` is a good choice for breed detection.

Breed detection is usually easier than disease detection because:

- breed traits are more visually stable
- feather patterns are easier to distinguish
- body shape and comb shape are clearer than disease symptoms
- disease signs often overlap, but breeds usually have stronger visual identity

## Recommended Approach

Use `Roboflow Classification`.

Goal:

- capture a chicken image
- return the most likely breed
- return a confidence score
- show the top result in the ChickInteL breed scan result screen

## Best First Scope

Start with only `3-5` breeds.

This is better than trying to classify too many breeds at once with a small dataset.

Example starter breeds:

- `barred-rock`
- `silkie`
- `rhode-island-red`
- `bantam-rock`

Pick only the breeds you really need first.

## Dataset Target

Minimum first target:

- `50` images per breed

Better target:

- `100+` images per breed

Keep class counts balanced.

## What Images To Collect

For each breed, include:

- full-body side view
- front view
- slightly angled view
- standing posture
- different lighting
- different backgrounds
- different ages if relevant
- different feather conditions

## Avoid

- blurry images
- duplicated images
- birds partly hidden
- mixed flocks where the target bird is unclear
- screenshots with heavy text or graphics
- images where breed traits are not visible

## Important Breed Features

The model should learn:

- feather color
- feather pattern
- comb shape
- body shape
- leg feathering if present
- size/build
- head shape

## Roboflow Setup

Project type:

- `Classification`

Class rule:

- one class = one breed

Suggested class labels:

- `barred-rock`
- `silkie`
- `rhode-island-red`
- `bantam-rock`

Keep class labels simple and exact.

## App Architecture

Use the same secure flow as health detection:

1. user captures image in `Breed` mode
2. app sends image to secure backend
3. backend sends image to Roboflow
4. Roboflow returns breed prediction
5. app shows breed result
6. app saves the scan if needed

## Important Security Rule

Do **not** put the Roboflow private API key in the Expo client.

Use a backend layer:

- Supabase Edge Function

## Why Breed Detection Is Easier

Compared to health detection:

- breed images are more visually consistent
- labels are less ambiguous
- fewer overlapping signs
- easier for a small classification model

## Practical Rollout Plan

Phase 1:

- choose `3-5` breeds
- collect `50` images per breed
- train first classifier
- test in app

Phase 2:

- raise each breed to `100+` images
- improve balance and variety
- retrain

Phase 3:

- add more breeds only after the first set works well

## Current App Note

The breed flow currently uses placeholder logic in:

- [scanner.tsx](/C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/app/(tabs)/scanner.tsx)

That makes breed detection a good next AI module to replace with a real Roboflow model.

## Best Recommendation

If you want an AI module that is more likely to work sooner than health disease detection, prioritize breed detection first.
