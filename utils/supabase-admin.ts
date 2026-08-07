import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

export type FarmerData = {
  id: string;
  name: string;
  email: string;
  farmCount: number;
  isActive: boolean;
  lastLogin: string;
  created_at: string;
};

/**
 * Format last login date string into a friendly relative time (e.g. "Just now", "5m ago", "2h ago", "Jul 22").
 */
function formatLastLogin(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Never";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Fetch all farmers from public.profiles and combine with their farm memberships count from public.farm_members.
 */
export async function fetchFarmers(): Promise<FarmerData[]> {
  const [{ data: profiles, error: profilesError }, { data: members, error: membersError }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, display_name, email, is_active, created_at, last_login_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("farm_members")
        .select("user_id"),
    ]);

  if (profilesError) throw profilesError;
  if (membersError) throw membersError;

  const farmCounts = (members || []).reduce((acc, m) => {
    if (m.user_id) {
      acc[m.user_id] = (acc[m.user_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (profiles || []).map((p: any) => ({
    id: p.id,
    name: p.display_name || p.email?.split("@")[0] || "Unknown Farmer",
    email: p.email || "",
    farmCount: farmCounts[p.id] || 0,
    isActive: p.is_active !== false,
    lastLogin: formatLastLogin(p.last_login_at),
    created_at: p.created_at,
  }));
}

/**
 * Provisions a new farmer user account via an isolated Supabase Auth client,
 * then automatically connects the new farmer as a member of the active admin farm.
 */
export async function createFarmer(email: string, name: string, pgword: string): Promise<string> {
  const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await tempClient.auth.signUp({
    email: email.trim().toLowerCase(),
    password: pgword,
    options: {
      data: {
        display_name: name,
      },
    },
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Failed to create farmer account.");
  }

  const newUserId = data.user.id;

  // 1. Fetch active farm ID
  const { data: farmData } = await supabase
    .from("farms")
    .select("id")
    .limit(1);

  const farmId = farmData?.[0]?.id;

  // 2. Ensure public.profiles record exists with display_name, is_active, and default_farm_id
  await supabase
    .from("profiles")
    .upsert({
      id: newUserId,
      email: data.user.email,
      display_name: name,
      is_active: true,
      default_farm_id: farmId ?? null,
    });

  // 3. Connect farmer to the farm in public.farm_members
  if (farmId) {
    await supabase
      .from("farm_members")
      .upsert(
        {
          farm_id: farmId,
          user_id: newUserId,
          role: "farmer",
        },
        { onConflict: "farm_id,user_id" }
      );
  }

  return newUserId;
}

/**
 * Update the profile details of an existing farmer (name, is_active).
 */
export async function updateFarmer(id: string, name: string, isActive: boolean): Promise<void> {
  const updateData: { is_active: boolean; display_name?: string } = {
    is_active: isActive,
  };
  
  if (name && name.trim() !== "") {
    updateData.display_name = name.trim();
  }

  const { error } = await supabase
    .from("profiles")
    .update(updateData)
    .eq("id", id);

  if (error) throw error;
}

/**
 * Toggle active status of a farmer without modifying their display_name.
 */
export async function toggleFarmerStatus(id: string, currentStatus: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      is_active: !currentStatus,
    })
    .eq("id", id);

  if (error) throw error;
}

export type BreedData = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  created_at?: string;
};

export type ItemTypeData = {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  created_at?: string;
};

/**
 * Fetch all chicken breeds from public.breeds.
 */
export async function fetchBreeds(): Promise<BreedData[]> {
  const { data, error } = await supabase
    .from("breeds")
    .select("id, name, purpose, is_active, created_at")
    .order("name", { ascending: true });

  if (error) throw error;

  return (data || []).map((b: any) => ({
    id: b.id,
    name: b.name,
    description: b.purpose || "",
    isActive: b.is_active !== false,
    created_at: b.created_at,
  }));
}

/**
 * Create a new chicken breed in public.breeds.
 */
export async function createBreed(name: string, description: string): Promise<BreedData> {
  const { data, error } = await supabase
    .from("breeds")
    .insert({
      name: name.trim(),
      purpose: description.trim(),
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    description: data.purpose || "",
    isActive: data.is_active !== false,
    created_at: data.created_at,
  };
}

/**
 * Update an existing chicken breed in public.breeds.
 */
export async function updateBreed(
  id: string,
  name: string,
  description: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("breeds")
    .update({
      name: name.trim(),
      purpose: description.trim(),
      is_active: isActive,
    })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Toggle active status of a breed in public.breeds.
 */
export async function toggleBreedStatus(id: string, currentStatus: boolean): Promise<void> {
  const { error } = await supabase
    .from("breeds")
    .update({ is_active: !currentStatus })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Fetch all inventory item types / categories from public.inventory_categories.
 */
export async function fetchItemTypes(): Promise<ItemTypeData[]> {
  const { data, error } = await supabase
    .from("inventory_categories")
    .select("id, name, description, is_active, created_at")
    .order("name", { ascending: true });

  if (error) throw error;

  return (data || []).map((i: any) => ({
    id: i.id,
    name: i.name,
    description: i.description || "",
    isActive: i.is_active !== false,
    created_at: i.created_at,
  }));
}

/**
 * Create a new inventory item type in public.inventory_categories.
 */
export async function createItemType(name: string, description: string): Promise<ItemTypeData> {
  const { data, error } = await supabase
    .from("inventory_categories")
    .insert({
      name: name.trim(),
      description: description.trim(),
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    name: data.name,
    description: data.description || "",
    isActive: data.is_active !== false,
    created_at: data.created_at,
  };
}

/**
 * Update an existing inventory item type in public.inventory_categories.
 */
export async function updateItemType(
  id: string,
  name: string,
  description: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from("inventory_categories")
    .update({
      name: name.trim(),
      description: description.trim(),
      is_active: isActive,
    })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Toggle active status of an inventory item type in public.inventory_categories.
 */
export async function toggleItemTypeStatus(id: string, currentStatus: boolean): Promise<void> {
  const { error } = await supabase
    .from("inventory_categories")
    .update({ is_active: !currentStatus })
    .eq("id", id);

  if (error) throw error;
}
