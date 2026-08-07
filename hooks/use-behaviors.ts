import { useEffect, useState } from "react";

import type { HealthBehaviorItem } from "@/constants/health-scan-behaviors";
import {
    fetchBehaviorCategories,
    fetchBehaviors,
    type BehaviorCategory,
} from "@/utils/supabase-behaviors";

export function useBehaviors() {
    const [behaviors, setBehaviors] = useState<HealthBehaviorItem[]>([]);
    const [categories, setCategories] = useState<BehaviorCategory[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        Promise.all([fetchBehaviors(), fetchBehaviorCategories()])
            .then(([behaviorRows, categoryRows]) => {
                if (!cancelled) {
                    setBehaviors(behaviorRows);
                    setCategories(categoryRows);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setBehaviors([]);
                    setCategories([]);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return { behaviors, categories, loading };
}
