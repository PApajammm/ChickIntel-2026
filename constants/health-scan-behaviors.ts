export type HealthBehaviorItem = {
    id: string;
    label: string;
    categoryId?: string;
    categoryName?: string;
    description?: string;
};

export const DEFAULT_IMAGE_BASED_DETECTION =
    "Possible illness will be suggested after behavior confirmation.";
