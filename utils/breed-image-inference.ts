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
