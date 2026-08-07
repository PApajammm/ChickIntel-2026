/// <reference path="./deno.d.ts" />

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CHICKINTEL_DISEASE_CLASSIFIER_3_MODEL_ID =
    "donut-ep62e/chickintel-disease-classifier-seug1-3-vit-base-patch16-224-in21k-t1";

type HealthPrediction = {
    className: string;
    confidence: number;
};

type RoboflowPredictionRecord = {
    class?: unknown;
    class_name?: unknown;
    label?: unknown;
    name?: unknown;
    confidence?: unknown;
    confidence_score?: unknown;
    probability?: unknown;
    score?: unknown;
};

function jsonResponse(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
        },
    });
}

function normalizeConfidence(value: unknown) {
    if (typeof value !== "number" || Number.isNaN(value)) return 0;
    const percentage = value > 1 ? value : value * 100;
    return Math.max(0, Math.min(100, Math.round(percentage * 100) / 100));
}

function pickClassName(record: RoboflowPredictionRecord) {
    const possibleNames = [
        record.class,
        record.class_name,
        record.label,
        record.name,
    ];

    return possibleNames.find(
        (value): value is string => typeof value === "string" && !!value.trim(),
    );
}

function collectPredictions(value: unknown, predictions: HealthPrediction[]) {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
        value.forEach((item) => collectPredictions(item, predictions));
        return;
    }

    const record = value as RoboflowPredictionRecord & Record<string, unknown>;
    const className = pickClassName(record);
    const confidence =
        record.confidence ??
        record.confidence_score ??
        record.probability ??
        record.score;

    if (className) {
        predictions.push({
            className,
            confidence: normalizeConfidence(confidence),
        });
    }

    if (typeof record.top === "string") {
        predictions.push({
            className: record.top,
            confidence: normalizeConfidence(record.confidence),
        });
    }

    if (Array.isArray(record.predicted_classes)) {
        for (const predictedClass of record.predicted_classes) {
            if (typeof predictedClass === "string") {
                predictions.push({
                    className: predictedClass,
                    confidence: 0,
                });
            }
        }
    }

    Object.values(record).forEach((nestedValue) =>
        collectPredictions(nestedValue, predictions),
    );
}

function sortUniquePredictions(predictions: HealthPrediction[]) {
    const byClassName = new Map<string, HealthPrediction>();

    for (const prediction of predictions) {
        const key = prediction.className.toLowerCase().trim();
        const existing = byClassName.get(key);

        if (!existing || prediction.confidence > existing.confidence) {
            byClassName.set(key, prediction);
        }
    }

    return [...byClassName.values()].sort(
        (left, right) => right.confidence - left.confidence,
    );
}

function pickPredictions(payload: unknown) {
    const predictions: HealthPrediction[] = [];
    collectPredictions(payload, predictions);
    return sortUniquePredictions(predictions);
}

Deno.serve(async (request) => {
    try {
        if (request.method === "OPTIONS") {
            return new Response("ok", { headers: corsHeaders });
        }

        if (request.method !== "POST") {
            return jsonResponse(405, { error: "Method not allowed." });
        }

        const roboflowApiKey = Deno.env.get("ROBOFLOW_API_KEY");
        const roboflowModelId =
            Deno.env.get("ROBOFLOW_HEALTH_MODEL_ID") ??
            Deno.env.get("ROBOFLOW_MODEL_ID") ??
            CHICKINTEL_DISEASE_CLASSIFIER_3_MODEL_ID;
        const roboflowBaseUrl =
            Deno.env.get("ROBOFLOW_BASE_URL") ?? "https://serverless.roboflow.com";

        if (!roboflowApiKey) {
            return jsonResponse(500, {
                error: "Roboflow secrets are not configured.",
            });
        }

        let body: { imageBase64?: string } | null = null;

        try {
            body = await request.json();
        } catch {
            return jsonResponse(400, { error: "Invalid JSON body." });
        }

        const imageBase64 = body?.imageBase64?.trim();

        if (!imageBase64) {
            return jsonResponse(400, { error: "imageBase64 is required." });
        }

        const inferenceUrl = new URL(`${roboflowBaseUrl}/${roboflowModelId}`);
        inferenceUrl.searchParams.set("api_key", roboflowApiKey);

        const roboflowResponse = await fetch(inferenceUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: imageBase64,
        });
        const responseText = await roboflowResponse.text();

        if (!roboflowResponse.ok) {
            return jsonResponse(502, {
                error: "Roboflow inference failed.",
                details: responseText,
            });
        }

        let payload: unknown;

        try {
            payload = JSON.parse(responseText);
        } catch {
            return jsonResponse(502, {
                error: "Roboflow returned a non-JSON response.",
                details: responseText,
            });
        }

        const predictions = pickPredictions(payload);

        return jsonResponse(200, {
            modelId: roboflowModelId,
            topPrediction: predictions[0] ?? null,
            predictions,
            raw: payload,
        });
    } catch (error) {
        return jsonResponse(500, {
            error: "Unhandled inference error.",
            details: error instanceof Error ? error.message : String(error),
        });
    }
});
