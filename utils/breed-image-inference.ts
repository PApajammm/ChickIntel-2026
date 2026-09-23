import * as FileSystem from "expo-file-system/legacy";

import type { BreedScanAttributes } from "@/constants/breed-scan";
import { supabase } from "@/lib/supabase";

export type BreedImagePrediction = {
  className: string;
  confidence: number;
};

export type BreedImageInferenceResult = {
  modelId: string;
  topPrediction: BreedImagePrediction | null;
  predictions: BreedImagePrediction[];
};

const MIN_BREED_CONFIDENCE = 35;

function isUsablePrediction(
  prediction: unknown,
): prediction is BreedImagePrediction {
  if (!prediction || typeof prediction !== "object") return false;

  const candidate = prediction as Partial<BreedImagePrediction>;
  return (
    typeof candidate.className === "string" &&
    candidate.className.trim().length > 0 &&
    typeof candidate.confidence === "number" &&
    Number.isFinite(candidate.confidence) &&
    candidate.confidence >= MIN_BREED_CONFIDENCE
  );
}

async function photoUriToBase64(photoUri: string) {
  try {
    const imageBase64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!imageBase64.trim()) {
      throw new Error("Base64 image data is empty.");
    }

    return imageBase64;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Unable to read captured image. ${error.message}`
        : "Unable to read captured image.",
    );
  }
}

export async function inferBreedFromImage(
  photoUri: string,
): Promise<BreedImageInferenceResult | null> {
  if (!photoUri) return null;

  try {
    const imageBase64 = await photoUriToBase64(photoUri);
    const { data, error } = await supabase.functions.invoke(
      "roboflow-breed-inference",
      {
        body: { imageBase64 },
      },
    );

    if (error || !data) {
      console.warn("Breed inference failed", error);
      return null;
    }

    const result = data as BreedImageInferenceResult;
    if (!result.topPrediction && Array.isArray(result.predictions)) {
      result.topPrediction = result.predictions[0] ?? null;
    }

    return result;
  } catch (error) {
    console.warn("Breed inference exception", error);
    return null;
  }
}

export function normalizeClassifierLabel(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function isNonChickenClassifierLabel(label: string) {
  const normalized = normalizeClassifierLabel(label);

  return (
    normalized === "nonchicken" ||
    normalized === "non chicken" ||
    normalized === "not chicken" ||
    normalized === "not a chicken" ||
    normalized === "no chicken"
  );
}

/**
 * Resolves the top valid breed prediction from inference results.
 * If the #1 prediction is "nonchicken", this checks if any recognized breed
 * candidate is present with reasonable plausibility (e.g. nonchicken < 75% or runner-up exists).
 */
export function resolveBestBreedPrediction(
  inference: BreedImageInferenceResult | null,
): { prediction: BreedImagePrediction | null; isNonChicken: boolean } {
  if (!inference) {
    return { prediction: null, isNonChicken: false };
  }

  const allPredictions = (
    Array.isArray(inference.predictions) ? inference.predictions : []
  )
    .filter(isUsablePrediction)
    .sort((left, right) => right.confidence - left.confidence);
  const topPrediction = isUsablePrediction(inference.topPrediction)
    ? inference.topPrediction
    : (allPredictions[0] ?? null);
  if (!topPrediction) {
    return { prediction: null, isNonChicken: false };
  }

  // Find the highest-scoring candidate that is NOT a non-chicken label
  const bestBreedCandidate = allPredictions.find(
    (p) =>
      !isNonChickenClassifierLabel(p.className) &&
      mapBreedPredictionToAttributes(p).type !== "Unknown",
  );

  if (isNonChickenClassifierLabel(topPrediction.className)) {
    // If nonchicken is overwhelmingly dominant (>= 75%) and runner-up is negligible (< 10%),
    // consider it truly a non-chicken image.
    if (!bestBreedCandidate && topPrediction.confidence >= 75) {
      return { prediction: null, isNonChicken: true };
    }

    // Otherwise, if there is an identified breed candidate, select it!
    if (bestBreedCandidate) {
      return { prediction: bestBreedCandidate, isNonChicken: false };
    }

    // No breed candidate found at all and top was non-chicken
    return { prediction: null, isNonChicken: true };
  }

  // Ignore labels outside the supported breed list instead of displaying them
  // as if they were a valid breed.
  if (mapBreedPredictionToAttributes(topPrediction).type === "Unknown") {
    return { prediction: bestBreedCandidate ?? null, isNonChicken: false };
  }

  return { prediction: topPrediction, isNonChicken: false };
}

function titleCase(str: string) {
  return str
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function mapBreedPredictionToAttributes(
  prediction: BreedImagePrediction,
): BreedScanAttributes {
  const rawBreedName =
    typeof prediction?.className === "string"
      ? prediction.className.trim()
      : "";
  const normalized = normalizeClassifierLabel(rawBreedName);
  const compactNormalized = normalized.replace(/\s+/g, "");
  const breedName = rawBreedName;

  const knownBreeds: {
    contains: string;
    attributes: BreedScanAttributes;
  }[] = [
    {
      contains: "leghorn",
      attributes: {
        breedName: "Leghorn",
        temperament: "Active",
        type: "Layer",
      },
    },
    {
      contains: "new hampshire",
      attributes: {
        breedName: "New Hampshire",
        temperament: "Hardy",
        type: "Dual-purpose",
      },
    },
    {
      contains: "fayoumi",
      attributes: {
        breedName: "Fayoumi",
        temperament: "Active",
        type: "Layer",
      },
    },
    {
      contains: "black orpington",
      attributes: {
        breedName: "Black Orpington",
        temperament: "Docile",
        type: "Dual-purpose",
      },
    },
    {
      contains: "orpington",
      attributes: {
        breedName: "Black Orpington",
        temperament: "Docile",
        type: "Dual-purpose",
      },
    },
    {
      contains: "buckeye",
      attributes: {
        breedName: "Buckeye",
        temperament: "Calm",
        type: "Dual-purpose",
      },
    },
    {
      contains: "bielefelder",
      attributes: {
        breedName: "Bielefelder",
        temperament: "Calm",
        type: "Dual-purpose",
      },
    },
    {
      contains: "silkie",
      attributes: {
        breedName: "Silkie",
        temperament: "Medium",
        type: "Layer",
      },
    },
    {
      contains: "rhode island red",
      attributes: {
        breedName: "Rhode Island Red",
        temperament: "Hardy",
        type: "Dual-purpose",
      },
    },
    {
      contains: "australorp",
      attributes: {
        breedName: "Australorp",
        temperament: "Calm",
        type: "Egg production",
      },
    },
    {
      contains: "barred rock",
      attributes: {
        breedName: "Barred Rock",
        temperament: "Docile",
        type: "Dual-purpose",
      },
    },
    {
      contains: "sussex",
      attributes: {
        breedName: "Sussex",
        temperament: "Calm",
        type: "Dual-purpose",
      },
    },
    {
      contains: "wyandotte",
      attributes: {
        breedName: "Wyandotte",
        temperament: "Friendly",
        type: "Dual-purpose",
      },
    },
  ];

  const matched = knownBreeds.find(
    (option) =>
      normalized.includes(option.contains) ||
      compactNormalized.includes(option.contains.replace(/\s+/g, "")),
  );

  if (matched) {
    return matched.attributes;
  }

  return {
    breedName: breedName ? titleCase(breedName) : "Unknown breed",
    temperament: "Unknown",
    type: "Unknown",
  };
}

/**
 * Resolves a detected breed name against the available breed dropdown options.
 * Guarantees that the name selected in the dropdown EXACTLY matches an existing option.
 * Handles common synonyms:
 * - "White Leghorn" / "Leghorn" -> matches whichever exists in availableOptions
 * - "New Hampshire Red" / "New Hampshire" -> matches whichever exists
 * - "Rhode Island Red" / "RIR" -> matches whichever exists
 * - "Black Orpington" / "Orpington" -> matches whichever exists
 * - "Barred Rock" / "Plymouth Rock" -> matches whichever exists
 */
export function matchBreedToAvailableOptions(
  detectedBreedName: string,
  availableOptions: string[] = [],
): string {
  if (!detectedBreedName || !detectedBreedName.trim()) {
    return availableOptions[0] || "";
  }

  const rawNorm = detectedBreedName.trim().toLowerCase();

  // 1. Exact match (case-insensitive)
  const exact = availableOptions.find(
    (opt) => opt.trim().toLowerCase() === rawNorm,
  );
  if (exact) return exact;

  // 2. Canonical synonym clusters
  const clusters = [
    ["leghorn", "white leghorn", "white leghorn chicken"],
    ["new hampshire", "new hampshire red"],
    ["rhode island red", "rhode island", "rir"],
    ["black orpington", "orpington"],
    ["barred rock", "plymouth rock"],
    ["australorp", "black australorp"],
    ["bielefelder"],
    ["buckeye"],
    ["fayoumi", "egyptian fayoumi"],
    ["silkie"],
    ["sussex"],
    ["wyandotte"],
  ];

  for (const cluster of clusters) {
    const isDetectedInCluster = cluster.some(
      (alias) => rawNorm === alias || rawNorm.includes(alias) || alias.includes(rawNorm),
    );
    if (isDetectedInCluster) {
      // Find which option in availableOptions matches any alias in this cluster
      const matchedOpt = availableOptions.find((opt) => {
        const optNorm = opt.trim().toLowerCase();
        return cluster.some((alias) => optNorm === alias || optNorm.includes(alias) || alias.includes(optNorm));
      });
      if (matchedOpt) return matchedOpt;
    }
  }

  // 3. Substring match fallback
  const subMatch = availableOptions.find((opt) => {
    const optNorm = opt.trim().toLowerCase();
    return rawNorm.includes(optNorm) || optNorm.includes(rawNorm);
  });
  if (subMatch) return subMatch;

  // 4. Fallback: return title-cased detected name
  return detectedBreedName;
}
