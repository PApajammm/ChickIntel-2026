import { supabase } from "@/lib/supabase";
import type { BatchItem } from "@/utils/batch-store";

type BatchRow = {
  id: string;
  batch_no: string;
  created_at: string;
  breed_name: string;
  total_count?: number;
  female_count: number;
  male_count: number;
  unknown_count?: number;
  age_label: string;
  isolated_count: number;
  killed_count: number;
  color_name: string | null;
  color_hex: string | null;
  origin_batch_no?: string | null;
  source_egg_batch_id?: string | null;
};

function mapBatchRow(row: BatchRow): BatchItem {
  return {
    id: row.batch_no,
    originBatchNo: row.origin_batch_no ?? undefined,
    sourceEggBatchId: row.source_egg_batch_id ?? undefined,
    createdAt: row.created_at,
    breed: row.breed_name,
    totalCount: row.total_count ?? row.female_count + row.male_count,
    femaleCount: row.female_count,
    maleCount: row.male_count,
    unknownCount: row.unknown_count ?? 0,
    ageLabel: row.age_label,
    isolatedCount: row.isolated_count,
    killedCount: row.killed_count,
    colorName: row.color_name ?? "Unspecified",
    colorHex: row.color_hex ?? "#9AA3A3",
    notes: [],
  };
}

export async function fetchFarmBatches(farmId: string) {
  const current = await supabase
    .from("batches")
    .select(
      "id, batch_no, breed_name, total_count, female_count, male_count, unknown_count, age_label, isolated_count, killed_count, color_name, color_hex, origin_batch_no, source_egg_batch_id, created_at",
    )
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false });

  if (!current.error) {
    return (current.data ?? []).map((row) => mapBatchRow(row as BatchRow));
  }

  const legacy = await supabase
    .from("batches")
    .select(
      "id, batch_no, breed_name, female_count, male_count, age_label, isolated_count, killed_count, color_name, color_hex, created_at",
    )
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false });

  if (legacy.error) throw current.error;
  return (legacy.data ?? []).map((row) => mapBatchRow(row as BatchRow));
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
      total_count: input.totalCount,
      female_count: input.femaleCount,
      male_count: input.maleCount,
      unknown_count: input.unknownCount,
      age_label: input.ageLabel,
      isolated_count: input.isolatedCount,
      killed_count: input.killedCount,
      color_name: input.colorName,
      color_hex: input.colorHex,
      origin_batch_no: input.originBatchNo ?? null,
      source_egg_batch_id: input.sourceEggBatchId ?? null,
    })
    .select(
      "id, batch_no, breed_name, total_count, female_count, male_count, unknown_count, age_label, isolated_count, killed_count, color_name, color_hex, origin_batch_no, source_egg_batch_id, created_at",
    )
    .single();

  if (error) throw error;

  return mapBatchRow(data as BatchRow);
}

export async function createFarmChickBatch(
  farmId: string,
  parentBatchNo: string,
  chickCount: number,
  sourceEggBatchId: string,
) {
  const batches = await fetchFarmBatches(farmId);
  const parent = batches.find(
    (batch) =>
      batch.id.trim().toLowerCase() === parentBatchNo.trim().toLowerCase(),
  );

  if (!parent) {
    throw new Error("The parent chicken batch could not be found.");
  }

  const existingSubBatch = batches.find(
    (batch) =>
      batch.originBatchNo?.trim().toLowerCase() ===
        parent.id.trim().toLowerCase() &&
      batch.breed.trim().toLowerCase() === parent.breed.trim().toLowerCase() &&
      batch.sourceEggBatchId?.trim().toLowerCase() ===
        sourceEggBatchId.trim().toLowerCase() &&
      /^SBC-/i.test(batch.id),
  );

  if (existingSubBatch) {
    const nextTotal = existingSubBatch.totalCount + Math.max(0, chickCount);
    await updateFarmBatch(farmId, existingSubBatch.id, {
      breed: existingSubBatch.breed,
      totalCount: nextTotal,
      femaleCount: existingSubBatch.femaleCount,
      maleCount: existingSubBatch.maleCount,
      unknownCount: existingSubBatch.unknownCount + Math.max(0, chickCount),
      ageLabel: existingSubBatch.ageLabel,
      isolatedCount: existingSubBatch.isolatedCount,
      killedCount: existingSubBatch.killedCount,
    });

    return {
      ...existingSubBatch,
      totalCount: nextTotal,
      unknownCount: existingSubBatch.unknownCount + Math.max(0, chickCount),
    };
  }

  const prefix = "SBC-";
  const nextNumber =
    batches
      .filter(
        (batch) =>
          batch.originBatchNo?.trim().toLowerCase() ===
            parent.id.trim().toLowerCase() &&
          batch.breed.trim().toLowerCase() ===
            parent.breed.trim().toLowerCase(),
      )
      .map((batch) => Number.parseInt(batch.id.replace(/^SBC-/i, ""), 10))
      .filter((value) => Number.isFinite(value))
      .reduce((highest, value) => Math.max(highest, value), 0) + 1;

  return createFarmBatch(farmId, {
    id: `${prefix}${String(nextNumber).padStart(3, "0")}`,
    originBatchNo: parent.id,
    breed: parent.breed,
    totalCount: Math.max(0, chickCount),
    femaleCount: 0,
    maleCount: 0,
    unknownCount: Math.max(0, chickCount),
    ageLabel: "0 days old",
    isolatedCount: 0,
    killedCount: 0,
    colorName: parent.colorName,
    colorHex: parent.colorHex,
    sourceEggBatchId,
  });
}

export async function promoteFarmChickBatch(farmId: string, batchNo: string) {
  const batches = await fetchFarmBatches(farmId);
  const mainBatchNumbers = batches
    .filter((batch) => !/^SBC-/i.test(batch.id.trim()))
    .map((batch) => Number.parseInt(batch.id.replace(/[^0-9]/g, ""), 10))
    .filter((value) => Number.isFinite(value));
  const nextBatchNumber =
    (mainBatchNumbers.length ? Math.max(...mainBatchNumbers) : 0) + 1;
  const nextBatchNo = String(nextBatchNumber).padStart(4, "0");

  const { error } = await supabase
    .from("batches")
    .update({ batch_no: nextBatchNo, origin_batch_no: null })
    .eq("farm_id", farmId)
    .eq("batch_no", batchNo);

  if (error) throw error;

  return nextBatchNo;
}

export async function updateFarmBatch(
  farmId: string,
  batchNo: string,
  input: Pick<
    BatchItem,
    | "breed"
    | "totalCount"
    | "femaleCount"
    | "maleCount"
    | "unknownCount"
    | "ageLabel"
    | "isolatedCount"
    | "killedCount"
  >,
) {
  const { error } = await supabase
    .from("batches")
    .update({
      breed_name: input.breed,
      total_count: input.totalCount,
      female_count: input.femaleCount,
      male_count: input.maleCount,
      unknown_count: input.unknownCount,
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
      "id, batch_no, breed_name, total_count, female_count, male_count, unknown_count, age_label, isolated_count, killed_count, color_name, color_hex",
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
    totalCount: batch.totalCount,
    femaleCount: batch.femaleCount,
    maleCount: batch.maleCount,
    unknownCount: batch.unknownCount,
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
