import { supabase } from "@/lib/supabase";

type NameRow = {
    name: string;
};

function normalizeInventoryCategoryName(name: string) {
    const normalized = name.trim().toLowerCase();

    if (normalized === "chicken feed") {
        return "Feeds";
    }

    return name.trim();
}

export async function fetchBreedOptions() {
    const { data, error } = await supabase
        .from("breeds")
        .select("name")
        .eq("is_active", true)
        .order("name", { ascending: true });

    if (error) throw error;

    return (data as NameRow[] | null)?.map((row) => row.name) ?? [];
}

export async function fetchInventoryCategoryOptions() {
    const { data, error } = await supabase
        .from("inventory_categories")
        .select("name")
        .eq("is_active", true)
        .order("name", { ascending: true });

    if (error) throw error;

    return [
        ...new Set(
            ((data as NameRow[] | null) ?? []).map((row) =>
                normalizeInventoryCategoryName(row.name),
            ),
        ),
    ];
}

export async function fetchFeedTypeOptions() {
    const { data, error } = await supabase
        .from("feed_types")
        .select("name")
        .eq("is_active", true)
        .order("name", { ascending: true });

    if (error) throw error;

    return (data as NameRow[] | null)?.map((row) => row.name) ?? [];
}

export async function fetchMedicationOptions() {
    const { data, error } = await supabase
        .from("medications")
        .select("name")
        .eq("is_active", true)
        .order("name", { ascending: true });

    if (error) throw error;

    return (data as NameRow[] | null)?.map((row) => row.name) ?? [];
}

export async function fetchVitaminOptions() {
    const { data, error } = await supabase
        .from("vitamins")
        .select("name")
        .eq("is_active", true)
        .order("name", { ascending: true });

    if (error) throw error;

    return (data as NameRow[] | null)?.map((row) => row.name) ?? [];
}
