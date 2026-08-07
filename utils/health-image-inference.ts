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
