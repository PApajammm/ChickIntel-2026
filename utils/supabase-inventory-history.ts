import { supabase } from "@/lib/supabase";
import type { SupabaseInventoryItem } from "@/utils/supabase-inventory";

export type InventoryHistoryItem = SupabaseInventoryItem & {
  historyId: string;
  deletedAt: string;
  totalQty?: number;
  restockCreditQty?: number;
};

type InventoryHistoryRow = {
  id: string;
  item_type: string;
  item_name: string;
  qty: number;
  total_qty: number | null;
  restock_credit_qty: number | null;
  unit: string;
  purchased_date: string | null;
  delivered_date: string | null;
  expiration_date: string | null;
  deleted_at: string;
};

function parseDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00`) : undefined;
}

function mapHistoryRow(row: InventoryHistoryRow): InventoryHistoryItem {
  return {
    historyId: row.id,
    id: row.id,
    type: row.item_type,
    name: row.item_name,
    qty: row.qty,
    totalQty: row.total_qty ?? row.qty,
    restockCreditQty: row.restock_credit_qty ?? 0,
    unit: row.unit,
    statusPercent: 0,
    orderDate: parseDate(row.purchased_date) ?? new Date(row.deleted_at),
    deliveryDate: parseDate(row.delivered_date),
    expirationDate: parseDate(row.expiration_date),
    deletedAt: row.deleted_at,
  };
}

const HISTORY_COLUMNS =
  "id, item_type, item_name, qty, total_qty, restock_credit_qty, unit, purchased_date, delivered_date, expiration_date, deleted_at";

export async function recordDeletedInventoryItem(
  farmId: string,
  item: SupabaseInventoryItem,
) {
  const itemAny = item as any;
  const { error } = await supabase.from("inventory_item_history").insert({
    farm_id: farmId,
    item_type: item.type,
    item_name: item.name,
    qty: item.qty,
    total_qty: itemAny.totalQty ?? item.qty,
    restock_credit_qty: itemAny.restockCreditQty ?? null,
    unit: item.unit,
    purchased_date: item.orderDate.toISOString().slice(0, 10),
    delivered_date: item.deliveryDate?.toISOString().slice(0, 10) ?? null,
    expiration_date: item.expirationDate?.toISOString().slice(0, 10) ?? null,
  });

  if (error) throw error;
}

export async function fetchDeletedInventoryItems(farmId: string) {
  const { data, error } = await supabase
    .from("inventory_item_history")
    .select(HISTORY_COLUMNS)
    .eq("farm_id", farmId)
    .order("deleted_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapHistoryRow(row as InventoryHistoryRow));
}
