import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "@/lib/supabase";

export type SexingPrediction = {
  className: string;
  confidence: number;
};

export type SexingInferenceResult = {
  modelId: string;
  topPrediction: SexingPrediction | null;
  predictions: SexingPrediction[];
  error?: string;
};

export type ResolvedSexResult = {
  sex: "male" | "female" | "unknown";
  label: string;
  confidence: number;
};

const EMPTY_SEXING_RESULT: SexingInferenceResult = {
  modelId: "roboflow-sexing-inference",
  topPrediction: null,
  predictions: [],
};

async function photoUriToBase64(photoUri: string) {
  const imageBase64 = await FileSystem.readAsStringAsync(photoUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (!imageBase64.trim()) {
    throw new Error("Captured image data is empty.");
  }

  return imageBase64;
}

function normalizeInferenceResult(data: unknown): SexingInferenceResult {
  if (!data || typeof data !== "object") return EMPTY_SEXING_RESULT;

  const result = data as Partial<SexingInferenceResult>;
  const predictions = Array.isArray(result.predictions)
    ? result.predictions.filter(
        (prediction): prediction is SexingPrediction =>
          !!prediction &&
          typeof prediction.className === "string" &&
          typeof prediction.confidence === "number" &&
          Number.isFinite(prediction.confidence),
      )
    : [];

  const topPrediction =
    result.topPrediction &&
    typeof result.topPrediction.className === "string" &&
    typeof result.topPrediction.confidence === "number"
      ? result.topPrediction
      : (predictions[0] ?? null);

  return {
    modelId:
      typeof result.modelId === "string" && result.modelId.trim()
        ? result.modelId
        : EMPTY_SEXING_RESULT.modelId,
    topPrediction,
    predictions,
    error: typeof result.error === "string" ? result.error : undefined,
  };
}

export async function inferSexFromImage(
  photoUri: string,
): Promise<SexingInferenceResult> {
  if (!photoUri) return EMPTY_SEXING_RESULT;

  try {
    const imageBase64 = await photoUriToBase64(photoUri);
    const { data, error } = await supabase.functions.invoke(
      "roboflow-sexing-inference",
      {
        body: { imageBase64 },
      },
    );

    if (error) {
      console.warn("Sex inference request failed", error);
      return {
        ...EMPTY_SEXING_RESULT,
        error: error.message || "Sex inference request failed.",
      };
    }

    return normalizeInferenceResult(data);
  } catch (error) {
    console.warn("Sex inference exception", error);
    return {
      ...EMPTY_SEXING_RESULT,
      error:
        error instanceof Error ? error.message : "Unable to analyze image.",
    };
  }
}

export function resolveSexDetails(
  inference: SexingInferenceResult | null,
): ResolvedSexResult {
  const predictions = Array.isArray(inference?.predictions)
    ? inference.predictions
    : [];
  const candidates = inference?.topPrediction
    ? [inference.topPrediction, ...predictions]
    : predictions;
  const prediction = candidates
    .filter((candidate) => candidate && typeof candidate.className === "string")
    .sort((left, right) => right.confidence - left.confidence)[0];

  if (!prediction) {
    return { sex: "unknown", label: "", confidence: 0 };
  }

  const rawLabel = prediction.className.trim();
  const label = rawLabel.toLowerCase();

  if (
    label === "cock" ||
    label === "male" ||
    label === "rooster" ||
    label === "cockerel"
  ) {
    return {
      sex: "male",
      label: rawLabel,
      confidence: prediction.confidence,
    };
  }

  if (label === "hen" || label === "female" || label === "pullet") {
    return {
      sex: "female",
      label: rawLabel,
      confidence: prediction.confidence,
    };
  }

  return {
    sex: "unknown",
    label: rawLabel,
    confidence: prediction.confidence,
  };
}
