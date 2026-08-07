type CapturedPhoto = {
    uri: string;
    width?: number;
    height?: number;
};

export type HealthCaptureIssue =
    | "missing_uri"
    | "low_resolution"
    | "too_wide"
    | "too_tall";

export type HealthCaptureAssessment = {
    isAcceptable: boolean;
    issues: HealthCaptureIssue[];
    width: number | null;
    height: number | null;
};

const MIN_EDGE_PX = 900;
const MIN_ASPECT_RATIO = 0.6;
const MAX_ASPECT_RATIO = 1.8;

export function assessHealthCapture(
    photo: CapturedPhoto,
): HealthCaptureAssessment {
    const width =
        typeof photo.width === "number" && Number.isFinite(photo.width)
            ? photo.width
            : null;
    const height =
        typeof photo.height === "number" && Number.isFinite(photo.height)
            ? photo.height
            : null;
    const issues: HealthCaptureIssue[] = [];

    if (!photo.uri) {
        issues.push("missing_uri");
    }

    if (width !== null && height !== null) {
        const shortestEdge = Math.min(width, height);
        const aspectRatio = width / height;

        if (shortestEdge < MIN_EDGE_PX) {
            issues.push("low_resolution");
        }

        if (aspectRatio > MAX_ASPECT_RATIO) {
            issues.push("too_wide");
        }

        if (aspectRatio < MIN_ASPECT_RATIO) {
            issues.push("too_tall");
        }
    }

    return {
        isAcceptable: issues.length === 0,
        issues,
        width,
        height,
    };
}

export function buildHealthCaptureGuidance(
    assessment: HealthCaptureAssessment,
) {
    if (assessment.issues.length === 0) {
        return "The image looks usable for symptom review.";
    }

    const guidance = assessment.issues.map((issue) => {
        switch (issue) {
            case "missing_uri":
                return "The image was not captured correctly. Please retake the photo.";
            case "low_resolution":
                return "Move closer or hold the phone steady so the bird stays sharp and large enough in frame.";
            case "too_wide":
                return "Keep the bird more centered in the guide and avoid capturing too much empty background.";
            case "too_tall":
                return "Rotate or reposition the phone so the head, comb, eyes, and feathers stay clearly inside the guide.";
        }
    });

    return guidance.join(" ");
}
