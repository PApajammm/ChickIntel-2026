import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "@/lib/supabase";
import type { BreedScanAttributes } from "@/constants/breed-scan";

export type BreedImagePrediction = {
  className: string;
  confidence: number;
};

export type BreedImageInferenceResult = {
  modelId: string;
  topPrediction: BreedImagePrediction | null;
  predictions: BreedImagePrediction[];
};

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

  const topPrediction = inference.topPrediction;
  if (!topPrediction) {
    return { prediction: null, isNonChicken: false };
  }

  const allPredictions = Array.isArray(inference.predictions)
    ? inference.predictions
    : [topPrediction];

  // Find the highest-scoring candidate that is NOT a non-chicken label
  const bestBreedCandidate = allPredictions.find(
    (p) => !isNonChickenClassifierLabel(p.className) && p.className.trim().length > 0,
  );

  if (isNonChickenClassifierLabel(topPrediction.className)) {
    // If nonchicken is overwhelmingly dominant (>= 75%) and runner-up is negligible (< 10%),
    // consider it truly a non-chicken image.
    if (
      topPrediction.confidence >= 75 &&
      (!bestBreedCandidate || bestBreedCandidate.confidence < 10)
    ) {
      return { prediction: null, isNonChicken: true };
    }

    // Otherwise, if there is an identified breed candidate, select it!
    if (bestBreedCandidate) {
      return { prediction: bestBreedCandidate, isNonChicken: false };
    }

    // No breed candidate found at all and top was non-chicken
    return { prediction: null, isNonChicken: true };
  }

  // Top prediction is already a chicken breed
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
  const normalized = normalizeClassifierLabel(prediction.className);
  const breedName = prediction.className.trim();

  const knownBreeds: {
    contains: string;
    attributes: BreedScanAttributes;
  }[] = [
    {
      contains: "leghorn",
      attributes: {
        breedName: "White Leghorn",
        temperament: "Low",
        type: "Layer",
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

  const matched = knownBreeds.find((option) =>
    normalized.includes(option.contains),
  );

  if (matched) {
    return matched.attributes;
  }

  return {
    breedName: titleCase(breedName),
    temperament: "Unknown",
    type: "Unknown",
  };
}
