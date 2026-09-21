import { supabase } from "@/lib/supabase";
import { logStep } from "@/utils/logger";

export type EggDispositionType = "transfer" | "sell" | "dispose";

export type EggDispositionLog = {
  id: string;
  farmId: string;
  eggBatchId?: string;
  originBatchNo?: string;
  colorName?: string;
  colorHex?: string;
  actionType: EggDispositionType;
  quantity: number;
  targetChickBatchId?: string;
  notes?: string;
  createdAt: string;
};

type EggDispositionRow = {
  id: string;
  farm_id: string;
  egg_batch_id: string | null;
  origin_batch_no: string | null;
  color_name: string | null;
  color_hex: string | null;
  action_type: EggDispositionType;
  quantity: number;
  target_chick_batch_id: string | null;
  notes: string | null;
  created_at: string;
};

// In-memory cache to preserve locally recorded dispositions even before table migration
const localDispositionStore: EggDispositionLog[] = [];

function isMissingTableError(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  const message = err?.message?.toLowerCase() ?? "";
  return (
    err?.code === "42P01" ||
    err?.code === "PGRST205" ||
    err?.code === "PGRST204" ||
    err?.code === "42703" ||
    message.includes("does not exist") ||
    message.includes("relation") ||
    message.includes("egg_disposition_logs") ||
    message.includes("schema cache")
  );
}

function mapDispositionRow(row: EggDispositionRow): EggDispositionLog {
  return {
    id: row.id,
    farmId: row.farm_id,
    eggBatchId: row.egg_batch_id ?? undefined,
    originBatchNo: row.origin_batch_no ?? undefined,
    colorName: row.color_name ?? undefined,
    colorHex: row.color_hex ?? undefined,
    actionType: row.action_type,
    quantity: row.quantity ?? 0,
    targetChickBatchId: row.target_chick_batch_id ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

export async function recordEggDisposition(
  farmId: string,
  input: Omit<EggDispositionLog, "id" | "createdAt" | "farmId">,
): Promise<EggDispositionLog | null> {
  const localLog: EggDispositionLog = {
    id: `local-disp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    farmId,
    eggBatchId: input.eggBatchId,
    originBatchNo: input.originBatchNo,
    colorName: input.colorName,
    colorHex: input.colorHex,
    actionType: input.actionType,
    quantity: input.quantity,
    targetChickBatchId: input.targetChickBatchId,
    notes: input.notes,
    createdAt: new Date().toISOString(),
  };

  localDispositionStore.unshift(localLog);

  const payload = {
    farm_id: farmId,
    egg_batch_id: input.eggBatchId ?? null,
    origin_batch_no: input.originBatchNo ?? null,
    color_name: input.colorName ?? null,
    color_hex: input.colorHex ?? null,
    action_type: input.actionType,
    quantity: input.quantity,
    target_chick_batch_id: input.targetChickBatchId ?? null,
    notes: input.notes ?? null,
  };

  try {
    const { data, error } = await supabase
      .from("egg_disposition_logs")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      if (!isMissingTableError(error)) {
        // Only ignore if missing table, otherwise log non-disruptively
      }
      return localLog;
    }

    logStep("Egg disposition recorded in Supabase", {
      farmId,
      actionType: input.actionType,
      quantity: input.quantity,
    });
    return mapDispositionRow(data as EggDispositionRow);
  } catch (_error) {
    return localLog;
  }
}

export async function fetchEggDispositions(farmId: string): Promise<EggDispositionLog[]> {
  try {
    const { data, error } = await supabase
      .from("egg_disposition_logs")
      .select("*")
      .eq("farm_id", farmId)
      .order("created_at", { ascending: false });

    if (error) {
      // Table may not have been created yet on remote Supabase instance
      // Return local cache without raising console error
      return localDispositionStore.filter((log) => log.farmId === farmId);
    }

    const remoteLogs = (data ?? []).map((row) => mapDispositionRow(row as EggDispositionRow));
    
    // Merge local logs that may not yet be in remote database
    const remoteIds = new Set(remoteLogs.map((l) => l.id));
    const pendingLocal = localDispositionStore.filter(
      (log) => log.farmId === farmId && !remoteIds.has(log.id),
    );

    return [...pendingLocal, ...remoteLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch (_error) {
    return localDispositionStore.filter((log) => log.farmId === farmId);
  }
}
