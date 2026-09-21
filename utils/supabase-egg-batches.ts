import { supabase } from "@/lib/supabase";
import type { EggBatchItem } from "@/utils/batch-store";

type EggBatchRow = {
  id: string;
  batch_no: string;
  egg_qty: number;
  line_no: number;
  age_unit: EggBatchItem["ageUnit"];
  hatched_qty: number;
  transferred_hatched_qty?: number | null;
  damaged_qty: number;
  disposed_damaged_qty?: number | null;
  unhatched_qty: number;
  sold_qty?: number | null;
  color_name: string | null;
  color_hex: string | null;
  origin: string | null;
  created_at: string;
  updated_at?: string | null;
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
    transferredHatchedQty: row.transferred_hatched_qty ?? 0,
    damagedQty: row.damaged_qty,
    disposedDamagedQty: row.disposed_damaged_qty ?? 0,
    unhatchedQty: row.unhatched_qty,
    soldQty: row.sold_qty ?? 0,
    colorName: row.color_name ?? undefined,
    colorHex: row.color_hex ?? undefined,
    origin: row.origin ?? row.color_name ?? "Unknown",
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

export async function fetchFarmEggBatches(farmId: string) {
  const { data, error } = await supabase
    .from("egg_batches")
    .select(
      "id, batch_no, egg_qty, line_no, age_unit, hatched_qty, transferred_hatched_qty, damaged_qty, disposed_damaged_qty, unhatched_qty, sold_qty, color_name, color_hex, origin, created_at, updated_at",
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
      transferred_hatched_qty: input.transferredHatchedQty ?? 0,
      damaged_qty: input.damagedQty,
      disposed_damaged_qty: input.disposedDamagedQty ?? 0,
      unhatched_qty: input.unhatchedQty,
      sold_qty: input.soldQty ?? 0,
      color_name: input.colorName ?? null,
      color_hex: input.colorHex ?? null,
      origin: input.origin,
    })
    .select(
      "id, batch_no, egg_qty, line_no, age_unit, hatched_qty, transferred_hatched_qty, damaged_qty, disposed_damaged_qty, unhatched_qty, sold_qty, color_name, color_hex, origin, created_at",
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
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.batchNo !== undefined) payload.batch_no = input.batchNo;
  if (input.eggQty !== undefined) payload.egg_qty = input.eggQty;
  if (input.lineNo !== undefined) payload.line_no = input.lineNo;
  if (input.ageUnit !== undefined) payload.age_unit = input.ageUnit;
  if (input.hatchedQty !== undefined) payload.hatched_qty = input.hatchedQty;
  if (input.transferredHatchedQty !== undefined) {
    payload.transferred_hatched_qty = input.transferredHatchedQty;
  }
  if (input.damagedQty !== undefined) payload.damaged_qty = input.damagedQty;
  if (input.disposedDamagedQty !== undefined) {
    payload.disposed_damaged_qty = input.disposedDamagedQty;
  }
  if (input.unhatchedQty !== undefined) {
    payload.unhatched_qty = input.unhatchedQty;
  }
  if (input.soldQty !== undefined) payload.sold_qty = input.soldQty;
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
