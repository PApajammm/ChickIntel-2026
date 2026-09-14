import { supabase } from "@/lib/supabase";
import type { EggBatchItem } from "@/utils/batch-store";

export type EggBatchHistoryItem = EggBatchItem & {
  historyId: string;
  deletedAt: string;
};

type EggBatchHistoryRow = {
  id: string;
  batch_no: string;
  egg_qty: number;
  line_no: number;
  age_unit: EggBatchItem["ageUnit"];
  hatched_qty: number;
  damaged_qty: number;
  unhatched_qty: number;
  color_name: string | null;
  color_hex: string | null;
  origin: string | null;
  created_at: string | null;
  deleted_at: string;
};

function mapHistoryRow(row: EggBatchHistoryRow): EggBatchHistoryItem {
  return {
    historyId: row.id,
    id: row.id,
    batchNo: row.batch_no,
    eggQty: row.egg_qty,
    lineNo: row.line_no,
    ageUnit: row.age_unit,
    hatchedQty: row.hatched_qty,
    damagedQty: row.damaged_qty,
    unhatchedQty: row.unhatched_qty,
    colorName: row.color_name ?? undefined,
    colorHex: row.color_hex ?? undefined,
    origin: row.origin ?? "Unknown",
    createdAt: row.created_at ?? "",
    deletedAt: row.deleted_at,
  };
}

const HISTORY_COLUMNS =
  "id, batch_no, egg_qty, line_no, age_unit, hatched_qty, damaged_qty, unhatched_qty, color_name, color_hex, origin, created_at, deleted_at";

export async function recordDeletedEggBatch(
  farmId: string,
  batch: EggBatchItem,
) {
  const { error } = await supabase.from("egg_batch_history").insert({
    farm_id: farmId,
    batch_no: batch.batchNo,
    egg_qty: batch.eggQty,
    line_no: batch.lineNo,
    age_unit: batch.ageUnit,
    hatched_qty: batch.hatchedQty,
    damaged_qty: batch.damagedQty,
    unhatched_qty: batch.unhatchedQty,
    color_name: batch.colorName ?? null,
    color_hex: batch.colorHex ?? null,
    origin: batch.origin,
    created_at: batch.createdAt,
  });

  if (error) throw error;
}

export async function fetchDeletedEggBatches(farmId: string) {
  const { data, error } = await supabase
    .from("egg_batch_history")
    .select(HISTORY_COLUMNS)
    .eq("farm_id", farmId)
    .order("deleted_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => mapHistoryRow(row as EggBatchHistoryRow));
}
