import { supabase } from "@/lib/supabase";
import type { BatchItem } from "@/utils/batch-store";

type BatchRow = {
  id: string;
  batch_no: string;
  created_at: string;
  breed_name: string;
  female_count: number;
  male_count: number;
  age_label: string;
  isolated_count: number;
  killed_count: number;
  color_name: string | null;
  color_hex: string | null;
};

function normalizeBatchColorName(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function mapBatchRow(row: BatchRow): BatchItem {
  return {
    id: row.batch_no,
    createdAt: row.created_at,
    breed: row.breed_name,
    femaleCount: row.female_count,
    maleCount: row.male_count,
    ageLabel: row.age_label,
    isolatedCount: row.isolated_count,
    killedCount: row.killed_count,
    colorName: row.color_name ?? "Unspecified",
    colorHex: row.color_hex ?? "#9AA3A3",
    notes: [],
  };
}

export async function fetchFarmBatches(farmId: string) {
  const { data, error } = await supabase
    .from("batches")
    .select(
      "id, batch_no, breed_name, female_count, male_count, age_label, isolated_count, killed_count, color_name, color_hex, created_at",
    )
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => mapBatchRow(row as BatchRow));
}

async function resolveBatchNo(farmId: string, requestedBatchNo?: string) {
  const normalizedRequestedBatchNo = requestedBatchNo?.trim();

  const { data, error } = await supabase
    .from("batches")
    .select("batch_no")
    .eq("farm_id", farmId);

  if (error) throw error;

  const existingBatchNumbers = new Set(
    (data ?? [])
      .map((row) => {
        const batchNo =
          row && typeof row === "object" && "batch_no" in row
            ? row.batch_no
            : null;
        return typeof batchNo === "string" ? batchNo.trim() : "";
      })
      .filter(Boolean),
  );

  if (
    normalizedRequestedBatchNo &&
    !existingBatchNumbers.has(normalizedRequestedBatchNo)
  ) {
    return normalizedRequestedBatchNo;
  }

  let nextCounter = 1;
  while (existingBatchNumbers.has(String(nextCounter).padStart(4, "0"))) {
    nextCounter += 1;
  }

  return String(nextCounter).padStart(4, "0");
}

export async function createFarmBatch(
  farmId: string,
  input: Omit<BatchItem, "notes">,
) {
  const resolvedBatchNo = await resolveBatchNo(farmId, input.id);

  const { data, error } = await supabase
    .from("batches")
    .insert({
      farm_id: farmId,
      batch_no: resolvedBatchNo,
      breed_name: input.breed,
      female_count: input.femaleCount,
      male_count: input.maleCount,
      age_label: input.ageLabel,
      isolated_count: input.isolatedCount,
      killed_count: input.killedCount,
      color_name: input.colorName,
      color_hex: input.colorHex,
    })
    .select(
      "id, batch_no, breed_name, female_count, male_count, age_label, isolated_count, killed_count, color_name, color_hex",
    )
    .single();

  if (error) throw error;

  return mapBatchRow(data as BatchRow);
}

export async function updateFarmBatch(
  farmId: string,
  batchNo: string,
  input: Pick<
    BatchItem,
    | "breed"
    | "femaleCount"
    | "maleCount"
    | "ageLabel"
    | "isolatedCount"
    | "killedCount"
  >,
) {
  const { error } = await supabase
    .from("batches")
    .update({
      breed_name: input.breed,
      female_count: input.femaleCount,
      male_count: input.maleCount,
      age_label: input.ageLabel,
      isolated_count: input.isolatedCount,
      killed_count: input.killedCount,
    })
    .eq("farm_id", farmId)
    .eq("batch_no", batchNo);

  if (error) throw error;
}

export async function adjustFarmBatchHealthCounters(
  farmId: string,
  batchNo: string,
  input: {
    isolatedDelta?: number;
    killedDelta?: number;
  },
) {
  const normalizedBatchNo = batchNo.trim();
  if (!normalizedBatchNo) return false;

  const { data, error } = await supabase
    .from("batches")
    .select(
      "id, batch_no, breed_name, female_count, male_count, age_label, isolated_count, killed_count, color_name, color_hex",
    )
    .eq("farm_id", farmId)
    .eq("batch_no", normalizedBatchNo)
    .maybeSingle();

  if (error) throw error;
  if (!data) return false;

  const batch = mapBatchRow(data as BatchRow);
  const nextIsolated = Math.max(
    0,
    batch.isolatedCount + (input.isolatedDelta ?? 0),
  );
  const nextKilled = Math.max(0, batch.killedCount + (input.killedDelta ?? 0));

  await updateFarmBatch(farmId, normalizedBatchNo, {
    breed: batch.breed,
    femaleCount: batch.femaleCount,
    maleCount: batch.maleCount,
    ageLabel: batch.ageLabel,
    isolatedCount: nextIsolated,
    killedCount: nextKilled,
  });

  return true;
}

export async function deleteFarmBatch(farmId: string, batchNo: string) {
  const { error } = await supabase
    .from("batches")
    .delete()
    .eq("farm_id", farmId)
    .eq("batch_no", batchNo);

  if (error) throw error;
}
