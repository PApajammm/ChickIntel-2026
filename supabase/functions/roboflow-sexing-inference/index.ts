/// <reference path="../roboflow-breed-inference/deno.d.ts" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_WORKFLOW_URL =
  "https://serverless.roboflow.com/donut-ep62e/workflows/sexing-chicken-vsexing-chicken-2-vit-base-patch16-224-in21k-t1-logic";

type Prediction = {
  className: string;
  confidence: number;
};

type RoboflowRecord = {
  class?: unknown;
  class_name?: unknown;
  label?: unknown;
  name?: unknown;
  confidence?: unknown;
  confidence_score?: unknown;
  probability?: unknown;
  score?: unknown;
  top?: unknown;
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function emptyResult(modelId: string, error?: string) {
  return {
    modelId,
    topPrediction: null,
    predictions: [],
    ...(error ? { error } : {}),
  };
}

function normalizeConfidence(value: unknown) {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) return 0;
  const percentage = numericValue > 1 ? numericValue : numericValue * 100;
  return Math.max(0, Math.min(100, Math.round(percentage * 100) / 100));
}

function normalizeSexLabel(label: string) {
  const normalized = label.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  if (
    normalized === "cock" ||
    normalized === "male" ||
    normalized === "rooster" ||
    normalized === "cockerel"
  ) {
    return "cock";
  }

  if (
    normalized === "hen" ||
    normalized === "female" ||
    normalized === "pullet"
  ) {
    return "hen";
  }

  return null;
}

function pickClassName(record: RoboflowRecord) {
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

function collectPredictions(value: unknown, predictions: Prediction[]) {
  if (!value || typeof value !== "object") return;

  if (Array.isArray(value)) {
    value.forEach((item) => collectPredictions(item, predictions));
    return;
  }

  const record = value as RoboflowRecord & Record<string, unknown>;
  const className = pickClassName(record);
  const confidence =
    record.confidence ??
    record.confidence_score ??
    record.probability ??
    record.score;

  if (className) {
    const sexLabel = normalizeSexLabel(className);
    if (sexLabel) {
      predictions.push({
        className: sexLabel,
        confidence: normalizeConfidence(confidence),
      });
    }
  }

  if (typeof record.top === "string") {
    const sexLabel = normalizeSexLabel(record.top);
    if (sexLabel) {
      predictions.push({
        className: sexLabel,
        confidence: normalizeConfidence(record.confidence),
      });
    }
  }

  const predictionMap = record.predictions;
  if (
    predictionMap &&
    typeof predictionMap === "object" &&
    !Array.isArray(predictionMap)
  ) {
    Object.entries(predictionMap).forEach(([label, confidenceValue]) => {
      const sexLabel = normalizeSexLabel(label);
      if (!sexLabel) return;

      predictions.push({
        className: sexLabel,
        confidence: normalizeConfidence(confidenceValue),
      });
    });
  }

  Object.values(record).forEach((nestedValue) =>
    collectPredictions(nestedValue, predictions),
  );
}

function sortUniquePredictions(predictions: Prediction[]) {
  const byClassName = new Map<string, Prediction>();

  for (const prediction of predictions) {
    const current = byClassName.get(prediction.className);
    if (!current || prediction.confidence > current.confidence) {
      byClassName.set(prediction.className, prediction);
    }
  }

  return [...byClassName.values()].sort(
    (left, right) => right.confidence - left.confidence,
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  const apiKey = Deno.env.get("ROBOFLOW_API_KEY");
  const workflowUrl =
    Deno.env.get("ROBOFLOW_SEXING_WORKFLOW_URL") ?? DEFAULT_WORKFLOW_URL;

  if (!apiKey) {
    return jsonResponse(
      200,
      emptyResult(workflowUrl, "Roboflow API key is not configured."),
    );
  }

  let body: { imageBase64?: string } | null = null;

  try {
    body = await request.json();
  } catch {
    return jsonResponse(200, emptyResult(workflowUrl, "Invalid request body."));
  }

  const imageBase64 = body?.imageBase64?.trim();
  if (!imageBase64) {
    return jsonResponse(
      200,
      emptyResult(workflowUrl, "imageBase64 is required."),
    );
  }

  const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

  try {
    const roboflowResponse = await fetch(workflowUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        inputs: {
          image: {
            type: "base64",
            value: cleanBase64,
          },
        },
      }),
    });
    const responseText = await roboflowResponse.text();

    if (!roboflowResponse.ok) {
      return jsonResponse(
        200,
        emptyResult(
          workflowUrl,
          `Roboflow inference failed (${roboflowResponse.status}).`,
        ),
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(responseText);
    } catch {
      return jsonResponse(
        200,
        emptyResult(workflowUrl, "Roboflow returned an unreadable response."),
      );
    }

    const predictions: Prediction[] = [];
    collectPredictions(payload, predictions);
    const sortedPredictions = sortUniquePredictions(predictions);

    return jsonResponse(200, {
      modelId: workflowUrl,
      topPrediction: sortedPredictions[0] ?? null,
      predictions: sortedPredictions,
    });
  } catch {
    return jsonResponse(
      200,
      emptyResult(workflowUrl, "Unable to reach Roboflow inference."),
    );
  }
});
