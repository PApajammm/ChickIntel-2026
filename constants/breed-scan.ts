/**
 * Breed scanner output shape. Replace `placeholderBreedInference` with API results.
 */
export type BreedScanAttributes = {
    breedName: string;
    temperament: string;
    type: string;
};

export const BREED_DETECTION_NOTE =
    "Higher detection accuracy for Full / Pure breeds only";

/** Demo values aligned with reference UI (Leghorn / Low / Layer). */
export const DEMO_BREED_ATTRIBUTES: BreedScanAttributes = {
    breedName: "Leghorn",
    temperament: "Low",
    type: "Layer",
};

export function placeholderBreedInference(): BreedScanAttributes {
    // TODO(backend): POST image URI to breed model and map response.
    return DEMO_BREED_ATTRIBUTES;
}
