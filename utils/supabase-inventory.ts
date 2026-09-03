import { supabase } from "@/lib/supabase";

export type SupabaseInventoryItem = {
  id: string;
  type: string;
  name: string;
  qty: number;
  unit: string;
  statusPercent: number;
  orderDate: Date;
  deliveryDate?: Date;
  expirationDate?: Date;
};

type InventoryRow = {
  id: string;
  item_type: string;
  item_name: string;
  qty: number;
  unit: string;
  status_percent: number;
  purchased_date: string | null;
  delivered_date: string | null;
  expiration_date?: string | null;
};

function formatDatabaseDate(date?: Date | null) {
  if (!date) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeInventoryType(type: string) {
  const normalized = type.trim().toLowerCase();

  if (normalized === "chicken feed") {
    return "Feeds";
  }

  return type.trim();
}

function normalizeInventoryName(name: string) {
  return name.trim().toLowerCase();
}

function mapInventoryRow(row: InventoryRow): SupabaseInventoryItem {
  return {
    id: row.id,
    type: normalizeInventoryType(row.item_type),
    name: row.item_name,
    qty: Number(row.qty),
    unit: row.unit,
    statusPercent: row.status_percent,
    orderDate: row.purchased_date ? new Date(row.purchased_date) : new Date(),
    deliveryDate: row.delivered_date ? new Date(row.delivered_date) : undefined,
    expirationDate: row.expiration_date
      ? new Date(row.expiration_date)
      : undefined,
  };
}

import { fetchInventoryCategoryOptions } from "./supabase-lookups";

export async function fetchInventoryItems(farmId: string) {
  const [{ data, error }, activeCategoryOptions] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(
        "id, item_type, item_name, qty, unit, status_percent, purchased_date, delivered_date, expiration_date",
      )
      .eq("farm_id", farmId)
      .order("created_at", { ascending: false }),
    fetchInventoryCategoryOptions().catch(() => []),
  ]);

  if (error) throw error;

  const mapped = (data ?? []).map((row) =>
    mapInventoryRow(row as InventoryRow),
  );

  if (!activeCategoryOptions.length) {
    return mapped;
  }

  const activeCategorySet = new Set([
    "equipment",
    "feeds",
    "medicine",
    "vitamins",
    ...activeCategoryOptions.map((cat) => cat.trim().toLowerCase()),
  ]);

  return mapped.filter((item) =>
    activeCategorySet.has(item.type.trim().toLowerCase()),
  );
}

export async function createInventoryItem(
  farmId: string,
  input: {
    type: string;
    name: string;
    qty: number;
    unit: string;
    price?: number;
    purchasedDate?: Date;
    deliveredDate?: Date;
    expirationDate?: Date;
  },
) {
  const normalizedType = normalizeInventoryType(input.type);
  const normalizedName = normalizeInventoryName(input.name);

  const { data: existingRows, error: lookupError } = await supabase
    .from("inventory_items")
    .select(
      "id, item_type, item_name, qty, unit, status_percent, purchased_date, delivered_date, expiration_date",
    )
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false });

  if (lookupError) throw lookupError;

  const existingMatch = (existingRows ?? []).find((row) => {
    const rowType = normalizeInventoryType(
      typeof row.item_type === "string" ? row.item_type : "",
    );
    const rowName = normalizeInventoryName(
      typeof row.item_name === "string" ? row.item_name : "",
    );

    return rowType === normalizedType && rowName === normalizedName;
  });

  if (existingMatch) {
    const nextQty = Number(existingMatch.qty) + input.qty;
    const { data, error } = await supabase
      .from("inventory_items")
      .update({
        qty: nextQty,
        unit: input.unit,
        price: input.price ?? null,
        purchased_date: formatDatabaseDate(input.purchasedDate),
        delivered_date: formatDatabaseDate(input.deliveredDate),
        expiration_date: formatDatabaseDate(input.expirationDate),
      })
      .eq("farm_id", farmId)
      .eq("id", existingMatch.id)
      .select(
        "id, item_type, item_name, qty, unit, status_percent, purchased_date, delivered_date, expiration_date",
      )
      .single();

    if (error) throw error;

    return mapInventoryRow(data as InventoryRow);
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      farm_id: farmId,
      item_type: normalizedType,
      item_name: input.name,
      qty: input.qty,
      unit: input.unit,
      price: input.price ?? null,
      status_percent: 100,
      purchased_date: formatDatabaseDate(input.purchasedDate),
      delivered_date: formatDatabaseDate(input.deliveredDate),
      expiration_date: formatDatabaseDate(input.expirationDate),
    })
    .select(
      "id, item_type, item_name, qty, unit, status_percent, purchased_date, delivered_date, expiration_date",
    )
    .single();

  if (error) throw error;

  return mapInventoryRow(data as InventoryRow);
}

export async function updateInventoryItemDeliveryDate(
  farmId: string,
  itemId: string,
  deliveredDate?: Date,
) {
  const { error } = await supabase
    .from("inventory_items")
    .update({
      delivered_date: formatDatabaseDate(deliveredDate),
    })
    .eq("farm_id", farmId)
    .eq("id", itemId);

  if (error) throw error;
}

export async function updateInventoryItem(
  farmId: string,
  itemId: string,
  input: {
    qty?: number;
    statusPercent?: number;
    deliveredDate?: Date;
    expirationDate?: Date;
  },
) {
  const payload: Record<string, unknown> = {};
  if (input.qty !== undefined) {
    payload.qty = input.qty;
  }
  if (input.statusPercent !== undefined) {
    payload.status_percent = input.statusPercent;
  }
  if (input.deliveredDate !== undefined) {
    payload.delivered_date = formatDatabaseDate(input.deliveredDate);
  }
  if (input.expirationDate !== undefined) {
    payload.expiration_date = formatDatabaseDate(input.expirationDate);
  }

  if (Object.keys(payload).length === 0) {
    return;
  }

  const { error } = await supabase
    .from("inventory_items")
    .update(payload)
    .eq("farm_id", farmId)
    .eq("id", itemId);

  if (error) throw error;
}

export async function deleteInventoryItem(farmId: string, itemId: string) {
  const { error } = await supabase
    .from("inventory_items")
    .delete()
    .eq("farm_id", farmId)
    .eq("id", itemId);

  if (error) throw error;
}
