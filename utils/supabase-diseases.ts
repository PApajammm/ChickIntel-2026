import { supabase } from "@/lib/supabase";

type DiseaseRow = {
    id: string;
    slug: string;
    name: string;
    short_label: string | null;
    summary: string | null;
    severity: "low" | "medium" | "high" | "critical" | null;
    disease_name: string | null;
    description: string | null;
    status: string | null;
    recovery_duration: string | null;
};

type DiseaseAliasRow = {
    disease_id: string;
    alias: string;
};

type TreatmentRow = {
    disease_id: string;
    title: string;
    treatment_text: string | null;
    description: string | null;
    sort_order: number | null;
    display_order: number | null;
};

export type DiseaseDetails = {
    diseaseId: string;
    diseaseName: string;
    description: string;
    summary: string;
    severity: "low" | "medium" | "high" | "critical";
    status: string;
    recoveryDuration: string;
    treatmentSteps: string[];
};

export type MatchedDisease = DiseaseDetails & {
    confidence: number;
    actionStatus: string;
    durationValue: string;
    resultSummary: string;
    detectionDescription: string;
    recommendationText: string;
    detectionSource: "image_model";
    classifierLabel?: string;
    topPredictions?: {
        className: string;
        confidence: number;
    }[];
};

function normalizeLabel(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function normalizeSeverity(
    severity: DiseaseRow["severity"],
): "low" | "medium" | "high" | "critical" {
    return severity ?? "medium";
}

function buildTreatmentSteps(treatments: TreatmentRow[]) {
    return treatments
        .sort((left, right) => {
            const leftOrder = left.display_order ?? left.sort_order ?? 0;
            const rightOrder = right.display_order ?? right.sort_order ?? 0;
            return leftOrder - rightOrder;
        })
        .map((treatment) => treatment.description ?? treatment.treatment_text ?? "")
        .map((description) => description.trim())
        .filter(Boolean);
}

function buildDiseaseDetails(
    disease: DiseaseRow,
    treatments: TreatmentRow[],
): DiseaseDetails {
    const diseaseName = disease.disease_name ?? disease.name;
    const description = disease.description ?? disease.summary ?? "";
    const status = disease.status ?? "";
    const recoveryDuration = disease.recovery_duration ?? "";

    return {
        diseaseId: disease.id,
        diseaseName,
        description,
        summary: description,
        severity: normalizeSeverity(disease.severity),
        status,
        recoveryDuration,
        treatmentSteps: buildTreatmentSteps(
            treatments.filter((row) => row.disease_id === disease.id),
        ),
    };
}

async function fetchDiseaseKnowledgeBase() {
    const [
        { data: diseases, error: diseaseError },
        { data: aliases, error: aliasError },
        { data: treatments, error: treatmentError },
    ] = await Promise.all([
        supabase
            .from("diseases")
            .select(
                "id, slug, name, short_label, summary, severity, disease_name, description, status, recovery_duration",
            )
            .eq("is_active", true),
        supabase.from("disease_aliases").select("disease_id, alias"),
        supabase
            .from("disease_treatments")
            .select(
                "disease_id, title, treatment_text, description, sort_order, display_order",
            ),
    ]);

    if (diseaseError) throw diseaseError;
    if (aliasError) throw aliasError;
    if (treatmentError) throw treatmentError;

    return {
        diseases: (diseases ?? []) as DiseaseRow[],
        aliases: (aliases ?? []) as DiseaseAliasRow[],
        treatments: (treatments ?? []) as TreatmentRow[],
    };
}

export async function fetchDiseaseDetails(
    diseaseId: string,
): Promise<DiseaseDetails | null> {
    const { diseases, treatments } = await fetchDiseaseKnowledgeBase();
    const disease = diseases.find((row) => row.id === diseaseId);

    if (!disease) return null;

    return buildDiseaseDetails(disease, treatments);
}

export async function detectDiseaseFromClassifierLabel(
    className: string,
    confidence: number,
    predictions?: {
        className: string;
        confidence: number;
    }[],
): Promise<MatchedDisease | null> {
    if (!className.trim()) return null;

    const { diseases, aliases, treatments } = await fetchDiseaseKnowledgeBase();
    const normalizedInput = normalizeLabel(className);

    const disease = diseases.find((row) => {
        const candidates = [
            row.slug,
            row.name,
            row.short_label ?? "",
            row.disease_name ?? "",
            ...aliases
                .filter((alias) => alias.disease_id === row.id)
                .map((alias) => alias.alias),
        ].map(normalizeLabel);

        return candidates.includes(normalizedInput);
    });

    if (!disease) return null;

    const details = buildDiseaseDetails(disease, treatments);
    const treatmentText = details.treatmentSteps.join(" ");

    return {
        ...details,
        confidence: Math.max(0, Math.min(100, Math.round(confidence * 100) / 100)),
        actionStatus: details.status,
        durationValue: details.recoveryDuration,
        resultSummary: details.diseaseName,
        detectionDescription: details.description,
        recommendationText: treatmentText,
        detectionSource: "image_model",
        classifierLabel: className,
        topPredictions: predictions,
    };
}
