import * as FileSystem from "expo-file-system/legacy";

import { supabase } from "@/lib/supabase";

export type HealthImagePrediction = {
    className: string;
    confidence: number;
};

export type HealthImageInferenceResult = {
    modelId: string;
    topPrediction: HealthImagePrediction | null;
    predictions: HealthImagePrediction[];
};

const HEALTH_CLASSIFIER_DISPLAY_NAMES: Record<string, string> = {
    bumblefoot: "Bumblefoot",
    crd: "Chronic Respiratory Disease",
};

export function normalizeHealthClassifierLabel(label: string) {
    return label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

export function getHealthClassifierDisplayName(label: string) {
    const normalized = normalizeHealthClassifierLabel(label);
    if (!normalized) return "";

    return (
        HEALTH_CLASSIFIER_DISPLAY_NAMES[normalized] ??
        normalized
            .split(" ")
            .map((part) =>
                part.length > 0
                    ? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`
                    : part,
            )
            .join(" ")
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

export async function inferDiseaseFromImage(
    photoUri: string,
): Promise<HealthImageInferenceResult | null> {
    if (!photoUri) return null;

    try {
        const imageBase64 = await photoUriToBase64(photoUri);
        const { data, error } = await supabase.functions.invoke(
            "roboflow-health-inference",
            {
                body: { imageBase64 },
            },
        );

        if (error || !data) {
            return null;
        }

        return data as HealthImageInferenceResult;
    } catch {
        return null;
    }
}
