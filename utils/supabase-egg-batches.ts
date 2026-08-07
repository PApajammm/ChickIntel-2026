import { supabase } from "@/lib/supabase";
import type { EggBatchItem } from "@/utils/batch-store";

type EggBatchRow = {
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
  created_at: string;
};

function normalizeEggBatchColorName(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function normalizeEggBatchOrigin(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function mapEggBatchRow(row: EggBatchRow): EggBatchItem {
  return {
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
    origin: row.origin ?? row.color_name ?? "Unknown",
    createdAt: row.created_at,
  };
}

export async function fetchFarmEggBatches(farmId: string) {
  const { data, error } = await supabase
    .from("egg_batches")
    .select(
      "id, batch_no, egg_qty, line_no, age_unit, hatched_qty, damaged_qty, unhatched_qty, color_name, color_hex, origin, created_at",
    )
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => mapEggBatchRow(row as EggBatchRow));
}

async function resolveEggBatchNo(
  farmId: string,
  colorName: string | null | undefined,
  requestedBatchNo?: string,
  originBatchNo?: string,
) {
  const normalizedColorName = normalizeEggBatchColorName(colorName);
  const normalizedOriginBatchNo = normalizeEggBatchOrigin(originBatchNo);

  const { data, error } = await supabase
    .from("egg_batches")
    .select("batch_no, color_name, origin")
    .eq("farm_id", farmId);

  if (error) throw error;

  const matchingBatchNumbers = (data ?? [])
    .filter((row) => {
      const rowOrigin =
        row && typeof row === "object" && "origin" in row ? row.origin : null;
      const rowColorName =
        row && typeof row === "object" && "color_name" in row
          ? row.color_name
          : null;

      if (normalizedOriginBatchNo) {
        if (
          normalizeEggBatchOrigin(
            typeof rowOrigin === "string" ? rowOrigin : null,
          ) !== normalizedOriginBatchNo
        ) {
          return false;
        }
      }

      if (!normalizedColorName) {
        return true;
      }

      return (
        normalizeEggBatchColorName(
          typeof rowColorName === "string" ? rowColorName : null,
        ) === normalizedColorName
      );
    })
    .map((row) => {
      const batchNo =
        row && typeof row === "object" && "batch_no" in row
          ? row.batch_no
          : null;
      return typeof batchNo === "string" ? batchNo.trim() : "";
    })
    .filter(Boolean);

  const normalizedRequestedBatchNo = requestedBatchNo?.trim();
  if (
    normalizedRequestedBatchNo &&
    !matchingBatchNumbers.includes(normalizedRequestedBatchNo)
  ) {
    return normalizedRequestedBatchNo;
  }

  let nextCounter = 1;
  while (matchingBatchNumbers.includes(String(nextCounter).padStart(4, "0"))) {
    nextCounter += 1;
  }

  return String(nextCounter).padStart(4, "0");
}

export async function createFarmEggBatch(
  farmId: string,
  input: Omit<EggBatchItem, "id" | "createdAt">,
) {
  const resolvedBatchNo = await resolveEggBatchNo(
    farmId,
    input.colorName,
    input.batchNo,
    input.origin,
  );

  const { data, error } = await supabase
    .from("egg_batches")
    .insert({
      farm_id: farmId,
      batch_no: resolvedBatchNo,
      egg_qty: input.eggQty,
      line_no: input.lineNo,
      age_unit: input.ageUnit,
      hatched_qty: input.hatchedQty,
      damaged_qty: input.damagedQty,
      unhatched_qty: input.unhatchedQty,
      color_name: input.colorName ?? null,
      color_hex: input.colorHex ?? null,
      origin: input.origin,
    })
    .select(
      "id, batch_no, egg_qty, line_no, age_unit, hatched_qty, damaged_qty, unhatched_qty, color_name, color_hex, origin, created_at",
    )
    .single();

  if (error) throw error;

  return mapEggBatchRow(data as EggBatchRow);
}

export async function updateFarmEggBatch(
  farmId: string,
  eggBatchId: string,
  input: Partial<EggBatchItem>,
) {
  const payload: Record<string, unknown> = {};

  if (input.batchNo !== undefined) payload.batch_no = input.batchNo;
  if (input.eggQty !== undefined) payload.egg_qty = input.eggQty;
  if (input.lineNo !== undefined) payload.line_no = input.lineNo;
  if (input.ageUnit !== undefined) payload.age_unit = input.ageUnit;
  if (input.hatchedQty !== undefined) payload.hatched_qty = input.hatchedQty;
  if (input.damagedQty !== undefined) payload.damaged_qty = input.damagedQty;
  if (input.unhatchedQty !== undefined) {
    payload.unhatched_qty = input.unhatchedQty;
  }
  if (input.colorName !== undefined) payload.color_name = input.colorName;
  if (input.colorHex !== undefined) payload.color_hex = input.colorHex;
  if (input.origin !== undefined) payload.origin = input.origin;

  const { error } = await supabase
    .from("egg_batches")
    .update(payload)
    .eq("farm_id", farmId)
    .eq("id", eggBatchId);

  if (error) throw error;
}

export async function deleteFarmEggBatch(farmId: string, eggBatchId: string) {
  const { error } = await supabase
    .from("egg_batches")
    .delete()
    .eq("farm_id", farmId)
    .eq("id", eggBatchId);

  if (error) throw error;
}
