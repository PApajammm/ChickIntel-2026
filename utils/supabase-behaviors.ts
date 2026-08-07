import type { HealthBehaviorItem } from "@/constants/health-scan-behaviors";
import { supabase } from "@/lib/supabase";

export type BehaviorCategory = {
    id: string;
    name: string;
};

type HealthBehaviorRow = {
    id: string;
    name: string;
    description: string | null;
    category_id: string;
    category:
        | {
              id: string;
              name: string;
          }
        | {
              id: string;
              name: string;
          }[]
        | null;
};

let cachedBehaviorCategories: BehaviorCategory[] | null = null;
let cachedBehaviors: HealthBehaviorItem[] | null = null;

export async function fetchBehaviorCategories() {
    if (cachedBehaviorCategories) return cachedBehaviorCategories;

    try {
        const { data, error } = await supabase
            .from("behavior_categories")
            .select("id, name")
            .order("name", { ascending: true });

        if (error) throw error;
        cachedBehaviorCategories = (data ?? []) as BehaviorCategory[];
        return cachedBehaviorCategories;
    } catch (err) {
        if (cachedBehaviorCategories) return cachedBehaviorCategories;
        throw err;
    }
}

export async function fetchBehaviors(): Promise<HealthBehaviorItem[]> {
    if (cachedBehaviors) return cachedBehaviors;

    try {
        const { data, error } = await supabase
            .from("health_behaviors")
            .select("id, name, description, category_id, category:behavior_categories(id, name)")
            .order("name", { ascending: true });

        if (error) throw error;

        cachedBehaviors = ((data ?? []) as HealthBehaviorRow[]).map<HealthBehaviorItem>((row) => {
            const category = Array.isArray(row.category)
                ? row.category[0]
                : row.category;

            return {
                id: row.id,
                label: row.name,
                description: row.description ?? undefined,
                categoryId: row.category_id,
                categoryName: category?.name,
            };
        });

        return cachedBehaviors;
    } catch (err) {
        if (cachedBehaviors) return cachedBehaviors;
        throw err;
    }
}

export function mapBehaviorIdsToLabels(
    behaviorIds: string[],
    items: HealthBehaviorItem[] = [],
) {
    if (!Array.isArray(behaviorIds) || behaviorIds.length === 0) return [];

    const map = new Map<string, string>();
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        map.set(it.id, it.label);
        map.set(it.label.toLowerCase(), it.label);
    }

    return behaviorIds
        .map((idOrLabel) => {
            if (!idOrLabel || typeof idOrLabel !== "string") return "";
            const matched = map.get(idOrLabel) || map.get(idOrLabel.toLowerCase());
            return matched ?? idOrLabel;
        })
        .filter(Boolean);
}
