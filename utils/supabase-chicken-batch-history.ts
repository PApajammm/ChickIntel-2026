import { supabase } from "@/lib/supabase";
import type { BatchItem } from "@/utils/batch-store";

export type ChickenBatchHistoryItem = BatchItem & {
  historyId: string;
  deletedAt: string;
};

type ChickenBatchHistoryRow = {
  id: string;
  batch_no: string;
  breed_name: string;
  female_count: number;
  male_count: number;
  age_label: string;
  isolated_count: number;
  killed_count: number;
  color_name: string | null;
  color_hex: string | null;
  created_at: string | null;
  deleted_at: string;
};

function mapHistoryRow(row: ChickenBatchHistoryRow): ChickenBatchHistoryItem {
  return {
    historyId: row.id,
    id: row.batch_no,
    createdAt: row.created_at ?? undefined,
    deletedAt: row.deleted_at,
    breed: row.breed_name,
    totalCount: row.female_count + row.male_count,
    femaleCount: row.female_count,
    maleCount: row.male_count,
    unknownCount: 0,
    ageLabel: row.age_label,
    isolatedCount: row.isolated_count,
    killedCount: row.killed_count,
    colorName: row.color_name ?? "Unspecified",
    colorHex: row.color_hex ?? "#9AA3A3",
    notes: [],
  };
}

const HISTORY_COLUMNS =
  "id, batch_no, breed_name, female_count, male_count, age_label, isolated_count, killed_count, color_name, color_hex, created_at, deleted_at";

export async function recordDeletedChickenBatch(
  farmId: string,
  batch: BatchItem,
) {
  const { error } = await supabase.from("chicken_batch_history").insert({
    farm_id: farmId,
    batch_no: batch.id,
    breed_name: batch.breed,
    female_count: batch.femaleCount,
    male_count: batch.maleCount,
    age_label: batch.ageLabel,
    isolated_count: batch.isolatedCount,
    killed_count: batch.killedCount,
    color_name: batch.colorName,
    color_hex: batch.colorHex,
    created_at: batch.createdAt ?? null,
  });

  if (error) throw error;
}

export async function fetchDeletedChickenBatches(farmId: string) {
  const { data, error } = await supabase
    .from("chicken_batch_history")
    .select(HISTORY_COLUMNS)
    .eq("farm_id", farmId)
    .order("deleted_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) =>
    mapHistoryRow(row as ChickenBatchHistoryRow),
  );
}
