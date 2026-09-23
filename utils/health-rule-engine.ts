import type { HealthBehaviorItem } from "@/constants/health-scan-behaviors";
import type { HealthImageInferenceResult, HealthImagePrediction } from "@/utils/health-image-inference";

export type DiseaseSlug =
  | "bumblefoot"
  | "chronic-respiratory-disease"
  | "infectious-coryza"
  | "fowl-pox"
  | "healthy"
  | "unknown";

export type DiseaseProfile = {
  slug: DiseaseSlug;
  displayName: string;
  classifierLabels: string[];
  primaryBehaviors: string[];
  supportingBehaviors: string[];
  conflictingBehaviors: string[];
  behaviorWeight: number;
  description: string;
};

export const DISEASE_PROFILES: Record<DiseaseSlug, DiseaseProfile> = {
  bumblefoot: {
    slug: "bumblefoot",
    displayName: "Bumblefoot",
    classifierLabels: ["bumblefoot", "pododermatitis"],
    primaryBehaviors: ["Limping", "Sitting / Lying Constantly"],
    supportingBehaviors: ["Stumbling / Incoordination", "Isolating from Flock", "Lethargy"],
    conflictingBehaviors: ["Panting", "Head Shaking / Twisting"],
    behaviorWeight: 35,
    description: "Bacterial foot infection causing inflammation, limping, and scabs on foot pads.",
  },
  "chronic-respiratory-disease": {
    slug: "chronic-respiratory-disease",
    displayName: "Chronic Respiratory Disease",
    classifierLabels: ["crd", "chronic respiratory disease", "chronic-respiratory-disease", "mycoplasma"],
    primaryBehaviors: ["Panting", "Wing Drooping"],
    supportingBehaviors: ["Huddling", "Lethargy", "Reduced Feed Intake", "Abnormal Vocalization"],
    conflictingBehaviors: ["Limping"],
    behaviorWeight: 30,
    description: "Chronic respiratory infection causing persistent labored breathing, panting, and weakness.",
  },
  "infectious-coryza": {
    slug: "infectious-coryza",
    displayName: "Infectious Coryza",
    classifierLabels: ["infectious coryza", "coryza", "infectious-coryza"],
    primaryBehaviors: ["Head Shaking / Twisting", "Reduced Water Intake"],
    supportingBehaviors: ["Reduced Feed Intake", "Isolating from Flock", "Lethargy", "Huddling"],
    conflictingBehaviors: ["Limping"],
    behaviorWeight: 30,
    description: "Acute upper respiratory bacterial disease causing facial swelling and discharge.",
  },
  "fowl-pox": {
    slug: "fowl-pox",
    displayName: "Fowlpox",
    classifierLabels: ["fowlpox", "fowl pox", "fowl-pox"],
    primaryBehaviors: ["Excessive Scratching / Preening"],
    supportingBehaviors: ["Head Shaking / Twisting", "Reduced Feed Intake", "Lethargy"],
    conflictingBehaviors: ["Limping"],
    behaviorWeight: 25,
    description: "Viral disease forming scab-like nodules on combs, wattles, and unfeathered skin.",
  },
  healthy: {
    slug: "healthy",
    displayName: "Healthy Chicken",
    classifierLabels: ["healthy", "normal"],
    primaryBehaviors: [],
    supportingBehaviors: [],
    conflictingBehaviors: [
      "Limping",
      "Sitting / Lying Constantly",
      "Panting",
      "Wing Drooping",
      "Head Shaking / Twisting",
      "Lethargy",
    ],
    behaviorWeight: 20,
    description: "No significant clinical signs of disease detected.",
  },
  unknown: {
    slug: "unknown",
    displayName: "Inconclusive Scan",
    classifierLabels: [],
    primaryBehaviors: [],
    supportingBehaviors: [],
    conflictingBehaviors: [],
    behaviorWeight: 0,
    description: "Symptoms and image analysis were inconclusive.",
  },
};

export type EvaluatedDiseaseAssessment = {
  resolvedSlug: DiseaseSlug;
  resolvedDisplayName: string;
  classifierLabel: string;
  confidence: number;
  detectionSource: "image_model" | "image_plus_behavior" | "manual";
  supportingBehaviorsFound: string[];
  conflictingBehaviorsFound: string[];
  diagnosticNotes: string[];
  differentialDiagnosis?: {
    diseaseName: string;
    reason: string;
  };
};

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Maps a classifier label to its standard DiseaseProfile.
 */
export function matchProfileByClassifierLabel(label: string): DiseaseProfile | null {
  const norm = normalizeText(label);
  for (const profile of Object.values(DISEASE_PROFILES)) {
    for (const cLabel of profile.classifierLabels) {
      if (normalizeText(cLabel) === norm || norm.includes(normalizeText(cLabel))) {
        return profile;
      }
    }
  }
  return null;
}

/**
 * Computes behavior support score (0 to 100) for a given disease profile.
 */
export function calculateBehaviorSupport(
  profile: DiseaseProfile,
  selectedBehaviorNames: string[],
): { score: number; primaryMatches: string[]; supportingMatches: string[]; conflictMatches: string[] } {
  const normalizedSelected = selectedBehaviorNames.map(normalizeText);

  const primaryMatches = profile.primaryBehaviors.filter((b) =>
    normalizedSelected.includes(normalizeText(b)),
  );
  const supportingMatches = profile.supportingBehaviors.filter((b) =>
    normalizedSelected.includes(normalizeText(b)),
  );
  const conflictMatches = profile.conflictingBehaviors.filter((b) =>
    normalizedSelected.includes(normalizeText(b)),
  );

  let rawScore = 0;
  rawScore += primaryMatches.length * 35;
  rawScore += supportingMatches.length * 15;
  rawScore -= conflictMatches.length * 25;

  return {
    score: Math.max(0, Math.min(100, rawScore)),
    primaryMatches,
    supportingMatches,
    conflictMatches,
  };
}

/**
 * Multi-Factor Assessment Engine
 * Evaluates both the raw AI image predictions and selected behavior symptoms to produce
 * an accurate, medically consistent diagnosis and handle edge-cases like:
 * 1. Image says Coryza/CRD, but user selected Limping / Foot swelling -> Resolves Bumblefoot.
 * 2. Image says respiratory, user selected Panting / Wing Drooping -> Refines to CRD.
 * 3. Image says respiratory, user selected Head Shaking / Nasal discharge -> Refines to Coryza.
 * 4. Image says Fowlpox, user selected Excessive Scratching -> Strong Fowlpox confirmation.
 */
export function evaluateHealthAssessment({
  imageInference,
  selectedBehaviorNames,
}: {
  imageInference: HealthImageInferenceResult | null;
  selectedBehaviorNames: string[];
}): EvaluatedDiseaseAssessment {
  const topPrediction = imageInference?.topPrediction;
  const rawTopLabel = topPrediction?.className ?? "";
  const rawImageConfidence = Number(topPrediction?.confidence ?? 0);
  const predictions = imageInference?.predictions ?? [];

  const topProfile = matchProfileByClassifierLabel(rawTopLabel);

  // Check specific high-priority symptom rules:
  const hasLimping = selectedBehaviorNames.some((b) =>
    normalizeText(b).includes("limping") || normalizeText(b).includes("sitting"),
  );
  const hasPanting = selectedBehaviorNames.some((b) =>
    normalizeText(b).includes("panting"),
  );
  const hasWingDrooping = selectedBehaviorNames.some((b) =>
    normalizeText(b).includes("wing drooping"),
  );
  const hasHeadShaking = selectedBehaviorNames.some((b) =>
    normalizeText(b).includes("head shaking"),
  );
  const hasScratching = selectedBehaviorNames.some((b) =>
    normalizeText(b).includes("scratching") || normalizeText(b).includes("preening"),
  );

  const notes: string[] = [];

  // RULE 1: BUMBLEFOOT VS RESPIRATORY MISCLASSIFICATION
  // If the user selected Limping / Foot issue, but the image classifier mistakenly returned Coryza/CRD
  if (hasLimping && (!hasPanting && !hasHeadShaking)) {
    const bumblefootProfile = DISEASE_PROFILES.bumblefoot;
    const bumblefootStats = calculateBehaviorSupport(bumblefootProfile, selectedBehaviorNames);
    
    // If the top image label is Coryza or CRD or Healthy but limping is prominent
    if (
      topProfile?.slug === "infectious-coryza" ||
      topProfile?.slug === "chronic-respiratory-disease" ||
      topProfile?.slug === "healthy" ||
      !topProfile
    ) {
      notes.push("Limping and mobility symptoms strongly point to a foot condition rather than respiratory disease.");
      
      const adjustedConfidence = Math.max(
        78,
        Math.min(95, 75 + bumblefootStats.primaryMatches.length * 10),
      );

      return {
        resolvedSlug: "bumblefoot",
        resolvedDisplayName: bumblefootProfile.displayName,
        classifierLabel: "bumblefoot",
        confidence: adjustedConfidence,
        detectionSource: "image_plus_behavior",
        supportingBehaviorsFound: bumblefootStats.primaryMatches.concat(bumblefootStats.supportingMatches),
        conflictingBehaviorsFound: [],
        diagnosticNotes: notes,
        differentialDiagnosis: topProfile ? {
          diseaseName: topProfile.displayName,
          reason: "Visual image classifier suggested respiratory signs, but observed limping and physical symptoms confirm localized foot inflammation.",
        } : undefined,
      };
    }
  }

  // RULE 2: CRD VS INFECTIOUS CORYZA DIFFERENTIATION
  // Both are respiratory diseases, but:
  // - CRD is characterized by panting (open-mouth breathing), wing drooping, huddling, and chronic weakness.
  // - Coryza is characterized by acute facial/sinus swelling, foul nasal discharge, and head shaking.
  const isRespiratoryPrediction =
    topProfile?.slug === "infectious-coryza" ||
    topProfile?.slug === "chronic-respiratory-disease";

  if (isRespiratoryPrediction || (hasPanting || hasHeadShaking)) {
    const crdScore = (hasPanting ? 40 : 0) + (hasWingDrooping ? 30 : 0);
    const coryzaScore = (hasHeadShaking ? 40 : 0);

    if (crdScore > coryzaScore && crdScore >= 30) {
      // Strong CRD symptoms
      const crdProfile = DISEASE_PROFILES["chronic-respiratory-disease"];
      const stats = calculateBehaviorSupport(crdProfile, selectedBehaviorNames);
      notes.push("Panting and drooping wings indicate lower respiratory distress characteristic of Chronic Respiratory Disease (CRD).");

      const blendedConfidence = Math.max(
        rawImageConfidence,
        Math.min(96, Math.round(rawImageConfidence * 0.6 + 35)),
      );

      return {
        resolvedSlug: "chronic-respiratory-disease",
        resolvedDisplayName: crdProfile.displayName,
        classifierLabel: "chronic-respiratory-disease",
        confidence: blendedConfidence > 0 ? blendedConfidence : 82,
        detectionSource: "image_plus_behavior",
        supportingBehaviorsFound: stats.primaryMatches.concat(stats.supportingMatches),
        conflictingBehaviorsFound: stats.conflictMatches,
        diagnosticNotes: notes,
        differentialDiagnosis: topProfile?.slug === "infectious-coryza" ? {
          diseaseName: "Infectious Coryza",
          reason: "Both are respiratory conditions; however, labored panting and drooping wings suggest chronic lower respiratory involvement (CRD) rather than isolated facial sinusitis.",
        } : undefined,
      };
    }

    if (coryzaScore > crdScore && coryzaScore >= 30) {
      // Strong Coryza symptoms
      const coryzaProfile = DISEASE_PROFILES["infectious-coryza"];
      const stats = calculateBehaviorSupport(coryzaProfile, selectedBehaviorNames);
      notes.push("Head shaking and facial irritation correlate with upper respiratory sinus congestion (Infectious Coryza).");

      const blendedConfidence = Math.max(
        rawImageConfidence,
        Math.min(96, Math.round(rawImageConfidence * 0.6 + 35)),
      );

      return {
        resolvedSlug: "infectious-coryza",
        resolvedDisplayName: coryzaProfile.displayName,
        classifierLabel: "infectious-coryza",
        confidence: blendedConfidence > 0 ? blendedConfidence : 82,
        detectionSource: "image_plus_behavior",
        supportingBehaviorsFound: stats.primaryMatches.concat(stats.supportingMatches),
        conflictingBehaviorsFound: stats.conflictMatches,
        diagnosticNotes: notes,
        differentialDiagnosis: topProfile?.slug === "chronic-respiratory-disease" ? {
          diseaseName: "Chronic Respiratory Disease (CRD)",
          reason: "Frequent head shaking and facial discharge align more closely with acute Infectious Coryza than lower tracheal CRD.",
        } : undefined,
      };
    }
  }

  // RULE 3: FOWLPOX CONFIRMATION
  if (topProfile?.slug === "fowl-pox" || hasScratching) {
    if (topProfile?.slug === "fowl-pox") {
      const stats = calculateBehaviorSupport(topProfile, selectedBehaviorNames);
      if (hasScratching) {
        notes.push("Observed scratching and preening behavior corroborates cutaneous scab discomfort from Fowlpox.");
      }
      
      const finalConf = stats.primaryMatches.length > 0
        ? Math.min(98, Math.round(rawImageConfidence * 0.7 + 28))
        : rawImageConfidence;

      return {
        resolvedSlug: "fowl-pox",
        resolvedDisplayName: topProfile.displayName,
        classifierLabel: rawTopLabel || "fowlpox",
        confidence: finalConf,
        detectionSource: stats.primaryMatches.length > 0 ? "image_plus_behavior" : "image_model",
        supportingBehaviorsFound: stats.primaryMatches.concat(stats.supportingMatches),
        conflictingBehaviorsFound: stats.conflictMatches,
        diagnosticNotes: notes,
      };
    }
  }

  // STANDARD EVALUATION:
  if (topProfile && topProfile.slug !== "unknown") {
    const stats = calculateBehaviorSupport(topProfile, selectedBehaviorNames);
    const hasBehaviorCorroboration = stats.primaryMatches.length > 0 || stats.supportingMatches.length > 0;
    
    let blendedConfidence = rawImageConfidence;
    if (hasBehaviorCorroboration && rawImageConfidence > 0) {
      blendedConfidence = Math.min(98, Math.round(rawImageConfidence * 0.75 + (stats.score * 0.25)));
    } else if (stats.conflictMatches.length > 0 && rawImageConfidence > 0) {
      blendedConfidence = Math.max(45, Math.round(rawImageConfidence * 0.8 - (stats.conflictMatches.length * 10)));
      notes.push(`Observed behaviors (${stats.conflictMatches.join(", ")}) do not typically match ${topProfile.displayName}.`);
    }

    return {
      resolvedSlug: topProfile.slug,
      resolvedDisplayName: topProfile.displayName,
      classifierLabel: rawTopLabel,
      confidence: blendedConfidence,
      detectionSource: hasBehaviorCorroboration ? "image_plus_behavior" : "image_model",
      supportingBehaviorsFound: stats.primaryMatches.concat(stats.supportingMatches),
      conflictingBehaviorsFound: stats.conflictMatches,
      diagnosticNotes: notes,
    };
  }

  // FALLBACK:
  return {
    resolvedSlug: "unknown",
    resolvedDisplayName: rawTopLabel ? topProfile?.displayName ?? rawTopLabel : "Inconclusive Scan",
    classifierLabel: rawTopLabel,
    confidence: rawImageConfidence,
    detectionSource: "image_model",
    supportingBehaviorsFound: [],
    conflictingBehaviorsFound: [],
    diagnosticNotes: ["Insufficient data to confidently resolve a specific disease."],
  };
}
