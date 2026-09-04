import { supabase } from "@/lib/supabase";
import { adjustFarmBatchHealthCounters } from "@/utils/supabase-batches";
import {
    type HealthJournalSavedScan
} from "./supabase-health-journal";

export type HealthMonitoringRecord = {
  id: string;
  farmId: string;
  healthLogId: string;
  chtTag: string;
  batchNo?: string;
  monitoringStatus: HealthMonitoringStatus;
  monitoringCompletedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Joined health_log data (latest scan) */
  healthLog?: HealthJournalSavedScan;
  /** All scans for this chicken, newest first (detail view) */
  scanHistory?: HealthJournalSavedScan[];
};

export type HealthMonitoringStatus = "Active" | "Recovered" | "Deceased";

type LocalMonitoringOverride = {
  monitoringStatus: HealthMonitoringStatus;
  monitoringCompletedAt?: string;
  batchNo?: string;
};

type HealthMonitoringRow = {
  id: string;
  farm_id: string;
  health_log_id: string;
  cht_tag: string;
  batch_no?: string | null;
  monitoring_status?: HealthMonitoringStatus | null;
  monitoring_completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

const localStatusOverrides = new Map<string, LocalMonitoringOverride>();

const HEALTH_LOG_SELECT = "*";

const HEALTH_MONITORING_SELECT = `
    id,
    farm_id,
    health_log_id,
    cht_tag,
    batch_no,
    monitoring_status,
    monitoring_completed_at,
    created_at,
    updated_at,
    health_log:health_logs!health_log_id(
        ${HEALTH_LOG_SELECT}
    )
`;

const LEGACY_HEALTH_MONITORING_SELECT = `
    id,
    farm_id,
    health_log_id,
    cht_tag,
    created_at,
    updated_at,
    health_log:health_logs!health_log_id(
        ${HEALTH_LOG_SELECT}
    )
`;

function isMissingMonitoringStatusColumn(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  const message = err?.message?.toLowerCase() ?? "";

  return (
    err?.code === "42703" ||
    err?.code === "PGRST204" ||
    message.includes("monitoring_status") ||
    message.includes("monitoring_completed_at")
  );
}

function isMissingHealthMonitoringColumn(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  const message = err?.message?.toLowerCase() ?? "";

  return (
    isMissingMonitoringStatusColumn(error) ||
    message.includes("batch_no") ||
    message.includes("schema cache") ||
    err?.code === "PGRST204"
  );
}

function normalizeMonitoringStatus(
  status?: string | null,
): HealthMonitoringStatus {
  if (status === "Recovered" || status === "Deceased") return status;
  return "Active";
}

function localOverrideKey(farmId: string, id: string) {
  return `${farmId}:${id}`;
}

function localStorageKey(farmId: string) {
  return `chickintel:health-monitoring-status:${farmId}`;
}

function localHistoryStorageKey(farmId: string) {
  return `chickintel:health-monitoring-history:${farmId}`;
}

function readStoredOverrides(farmId: string) {
  try {
    const storage = globalThis.localStorage;
    const raw = storage?.getItem(localStorageKey(farmId));
    if (!raw) return {};

    return JSON.parse(raw) as Record<string, LocalMonitoringOverride>;
  } catch {
    return {};
  }
}

function writeStoredOverride(
  farmId: string,
  id: string,
  override: LocalMonitoringOverride,
) {
  const key = localOverrideKey(farmId, id);
  localStatusOverrides.set(key, override);

  try {
    const storage = globalThis.localStorage;
    const stored = readStoredOverrides(farmId);
    storage?.setItem(
      localStorageKey(farmId),
      JSON.stringify({
        ...stored,
        [id]: override,
      }),
    );
  } catch {
    // Local fallback is best-effort. Supabase remains the source of truth.
  }
}

function applyLocalOverride(
  farmId: string,
  record: HealthMonitoringRecord,
): HealthMonitoringRecord {
  const memoryOverride = localStatusOverrides.get(
    localOverrideKey(farmId, record.id),
  );
  const storedOverride = readStoredOverrides(farmId)[record.id];
  const override = memoryOverride ?? storedOverride;

  if (!override) return record;

  return {
    ...record,
    batchNo: override.batchNo ?? record.batchNo,
    monitoringStatus: override.monitoringStatus,
    monitoringCompletedAt: override.monitoringCompletedAt,
  };
}

function isMissingMonitoringScansTable(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  const message = err?.message?.toLowerCase() ?? "";

  return (
    err?.code === "42P01" || // undefined_table
    err?.code === "PGRST204" || // missing relationship
    err?.code === "42501" || // RLS policy violation / permission denied
    (message.includes("health_monitoring_scans") &&
      message.includes("does not exist")) ||
    message.includes("row-level security") ||
    message.includes("security policy")
  );
}

function mapHealthLogRow(hl: any): HealthJournalSavedScan {
  return {
    id: hl.id,
    savedAt: hl.saved_at,
    photoUri: hl.photo_uri ?? "",
    detectedIllness: hl.detected_illness,
    diseaseId: hl.disease_id ?? undefined,
    confidence: typeof hl.confidence === "number" ? hl.confidence : undefined,
    detectionSource: hl.detection_source ?? undefined,
    behaviorIds: hl.behavior_ids ?? [],
    additionalObservation: hl.additional_observation ?? undefined,
    resultSummary: hl.result_summary,
    recommendationText: hl.recommendation_text,
    actionStatus: hl.action_status,
    durationValue: hl.duration_value,
  };
}

function mergeHealthLogIntoHistory(
  history: HealthJournalSavedScan[],
  currentHealthLog?: HealthJournalSavedScan,
): HealthJournalSavedScan[] {
  if (!currentHealthLog) return history;
  if (history.some((scan) => scan.id === currentHealthLog.id)) {
    return history;
  }

  return [currentHealthLog, ...history];
}

export async function appendHealthLogToMonitoring(
  farmId: string,
  monitoringId: string,
  healthLogId: string,
): Promise<void> {
  const existing = await fetchHealthMonitoringRecordById(farmId, monitoringId);
  if (!existing) {
    throw new Error("Health monitoring record not found.");
  }

  // Ensure previous primary health_log is also linked to health_monitoring_id if unlinked
  if (existing.healthLogId && existing.healthLogId !== healthLogId) {
    await supabase
      .from("health_logs")
      .update({ health_monitoring_id: monitoringId })
      .eq("farm_id", farmId)
      .eq("id", existing.healthLogId);
  }

  // 1. Update the new health_log to link directly to this health_monitoring record
  const { error: logLinkError } = await supabase
    .from("health_logs")
    .update({ health_monitoring_id: monitoringId })
    .eq("farm_id", farmId)
    .eq("id", healthLogId);

  if (logLinkError) {
    console.warn(
      "[health-monitoring] Linking health_log failed/skipped (non-fatal):",
      logLinkError.message,
    );
  }

  // 2. Update health_monitoring.health_log_id to point to this new scan as primary
  const { error: updateError } = await supabase
    .from("health_monitoring")
    .update({ health_log_id: healthLogId })
    .eq("farm_id", farmId)
    .eq("id", monitoringId);

  if (updateError) throw updateError;
}

export async function fetchHealthMonitoringScanHistory(
  farmId: string,
  monitoringId: string,
): Promise<HealthJournalSavedScan[]> {
  const record = await fetchHealthMonitoringRecordById(farmId, monitoringId);
  if (!record) return [];

  // Query all health_logs directly linked to this health_monitoring_id OR matching the primary health_log_id
  const { data, error } = await supabase
    .from("health_logs")
    .select(HEALTH_LOG_SELECT)
    .eq("farm_id", farmId)
    .or(`health_monitoring_id.eq.${monitoringId},id.eq.${record.healthLogId}`)
    .order("saved_at", { ascending: false });

  if (error) {
    console.warn(
      "[health-monitoring-history] Fetch failed/skipped (fallback to primary):",
      error.message,
    );
    return record.healthLog ? [record.healthLog] : [];
  }

  const mapped = (data ?? []).map((row: any) => mapHealthLogRow(row));

  const merged = mergeHealthLogIntoHistory(mapped, record.healthLog);
  // Sort reverse-chronological (newest scan first)
  merged.sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );

  return merged;
}

async function createOutcomeAssessmentForMonitoring(
  farmId: string,
  monitoringRecord: HealthMonitoringRecord,
  monitoringStatus: Exclude<HealthMonitoringStatus, "Active">,
): Promise<void> {
  const logId = monitoringRecord.healthLogId || monitoringRecord.healthLog?.id;
  if (!logId) return;

  const { error } = await supabase
    .from("health_logs")
    .update({ action_status: monitoringStatus })
    .eq("farm_id", farmId)
    .eq("id", logId);

  if (error) {
    console.warn(
      "[health-monitoring] Failed to update action_status on health_log:",
      error.message,
    );
  }
}

function mapRow(row: HealthMonitoringRow): HealthMonitoringRecord {
  return {
    id: row.id,
    farmId: row.farm_id,
    healthLogId: row.health_log_id,
    chtTag: row.cht_tag,
    batchNo: row.batch_no ?? undefined,
    monitoringStatus: normalizeMonitoringStatus(row.monitoring_status),
    monitoringCompletedAt: row.monitoring_completed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get the next available CHT number for a farm.
 * Finds the highest existing CHT number and returns the next one.
 */
export async function getNextChtNumber(farmId: string): Promise<number> {
  const { data, error } = await supabase
    .from("health_monitoring")
    .select("cht_tag")
    .eq("farm_id", farmId);

  if (error) {
    console.warn(
      "[health-monitoring] getNextChtNumber warning:",
      error.message,
    );
    return 1;
  }

  if (!data || data.length === 0) return 1;

  let maxNum = 0;
  for (const row of data) {
    if (row.cht_tag) {
      const match = row.cht_tag.match(/CHT-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!Number.isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  return maxNum + 1;
}

/**
 * Check if a CHT tag already exists for a farm.
 */
export async function doesChtTagExist(
  farmId: string,
  chtTag: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("health_monitoring")
    .select("id")
    .eq("farm_id", farmId)
    .eq("cht_tag", chtTag)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}

/**
 * Create a new health monitoring record.
 */
export async function createHealthMonitoringRecord(
  farmId: string,
  healthLogId: string,
  chtTag: string,
  batchNo?: string,
): Promise<HealthMonitoringRecord> {
  const normalizedBatchNo = batchNo?.trim() || undefined;
  const payload = {
    farm_id: farmId,
    health_log_id: healthLogId,
    cht_tag: chtTag,
    batch_no: normalizedBatchNo,
    monitoring_status: "Active",
  };
  const { data, error } = await supabase
    .from("health_monitoring")
    .insert(payload)
    .select()
    .single();

  let record: HealthMonitoringRecord;

  if (!error) {
    record = mapRow(data as HealthMonitoringRow);
    if (normalizedBatchNo) {
      await adjustFarmBatchHealthCounters(farmId, normalizedBatchNo, {
        isolatedDelta: 1,
      });
    }
  } else {
    if (!isMissingHealthMonitoringColumn(error)) throw error;

    const { data: legacyData, error: legacyError } = await supabase
      .from("health_monitoring")
      .insert({
        farm_id: farmId,
        health_log_id: healthLogId,
        cht_tag: chtTag,
      })
      .select()
      .single();

    if (legacyError) throw legacyError;
    record = mapRow(legacyData as HealthMonitoringRow);
    if (normalizedBatchNo) {
      writeStoredOverride(farmId, record.id, {
        monitoringStatus: record.monitoringStatus,
        monitoringCompletedAt: record.monitoringCompletedAt,
        batchNo: normalizedBatchNo,
      });
      await adjustFarmBatchHealthCounters(farmId, normalizedBatchNo, {
        isolatedDelta: 1,
      });
    }
  }

  // Link initial health_log directly to the new health_monitoring record ID
  const { error: logLinkError } = await supabase
    .from("health_logs")
    .update({ health_monitoring_id: record.id })
    .eq("farm_id", farmId)
    .eq("id", healthLogId);

  if (logLinkError) {
    console.warn(
      "[health-monitoring] Linking initial health_log failed (non-fatal):",
      logLinkError.message,
    );
  }

  invalidateHealthMonitoringCache(farmId);

  return {
    ...record,
    batchNo: normalizedBatchNo ?? record.batchNo,
  };
}

/**
 * Fetch all health monitoring records for a farm, with joined health_log data.
 */
async function fetchHealthMonitoringRecordsWithManualJoin(
  farmId: string,
  filterId?: string,
  filterChtTag?: string,
): Promise<HealthMonitoringRecord[]> {
  let query = supabase
    .from("health_monitoring")
    .select(
      "id, farm_id, health_log_id, cht_tag, batch_no, monitoring_status, monitoring_completed_at, created_at, updated_at",
    )
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false });

  if (filterId) query = query.eq("id", filterId);
  if (filterChtTag) query = query.eq("cht_tag", filterChtTag);

  const { data: rows, error } = await query;
  if (error || !rows || rows.length === 0) return [];

  const healthLogIds = Array.from(
    new Set(rows.map((r: any) => r.health_log_id).filter(Boolean)),
  );

  let logsMap = new Map<string, HealthJournalSavedScan>();
  if (healthLogIds.length > 0) {
    const { data: logsData } = await supabase
      .from("health_logs")
      .select(HEALTH_LOG_SELECT)
      .in("id", healthLogIds);

    if (logsData) {
      logsData.forEach((hl: any) => {
        logsMap.set(hl.id, mapHealthLogRow(hl));
      });
    }
  }

  return rows.map((row: any) => {
    const base = mapRow(row as HealthMonitoringRow);
    const hl = logsMap.get(row.health_log_id);
    return applyLocalOverride(farmId, {
      ...base,
      healthLog: hl,
    });
  });
}

const monitoringCacheMap = new Map<string, HealthMonitoringRecord[]>();

export function invalidateHealthMonitoringCache(farmId?: string) {
  if (farmId) {
    monitoringCacheMap.delete(farmId);
  } else {
    monitoringCacheMap.clear();
  }
}

/**
 * Fetch all health monitoring records for a farm, with joined health_log data.
 */
export async function fetchHealthMonitoringRecords(
  farmId: string,
  forceRefresh = false,
): Promise<HealthMonitoringRecord[]> {
  if (!forceRefresh && monitoringCacheMap.has(farmId)) {
    return monitoringCacheMap.get(farmId)!;
  }

  const { data, error } = await supabase
    .from("health_monitoring")
    .select(HEALTH_MONITORING_SELECT)
    .eq("farm_id", farmId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!error) {
    const records = mapRows(farmId, data);
    monitoringCacheMap.set(farmId, records);
    return records;
  }

  const fallback = await fetchHealthMonitoringRecordsWithManualJoin(farmId);
  monitoringCacheMap.set(farmId, fallback);
  return fallback;
}

function mapRows(farmId: string, data: any[] | null): HealthMonitoringRecord[] {
  return (data ?? []).map((row: any) => {
    const base = mapRow(row as HealthMonitoringRow);
    const hl = row.health_log;
    return applyLocalOverride(farmId, {
      ...base,
      healthLog: hl ? mapHealthLogRow(hl) : undefined,
    });
  });
}

/**
 * Fetch a single health monitoring record by ID.
 */
export async function fetchHealthMonitoringRecordById(
  farmId: string,
  id: string,
): Promise<HealthMonitoringRecord | null> {
  const { data, error } = await supabase
    .from("health_monitoring")
    .select(HEALTH_MONITORING_SELECT)
    .eq("farm_id", farmId)
    .eq("id", id)
    .maybeSingle();

  if (!error && data) return mapSingleRow(farmId, data);

  const fallback = await fetchHealthMonitoringRecordsWithManualJoin(farmId, id);
  return fallback[0] ?? null;
}

/**
 * Fetch health monitoring record by CHT tag.
 */
export async function fetchHealthMonitoringByChtTag(
  farmId: string,
  chtTag: string,
): Promise<HealthMonitoringRecord | null> {
  const { data, error } = await supabase
    .from("health_monitoring")
    .select(HEALTH_MONITORING_SELECT)
    .eq("farm_id", farmId)
    .eq("cht_tag", chtTag)
    .maybeSingle();

  if (!error && data) return mapSingleRow(farmId, data);

  const fallback = await fetchHealthMonitoringRecordsWithManualJoin(
    farmId,
    undefined,
    chtTag,
  );
  return fallback[0] ?? null;
}

function mapSingleRow(
  farmId: string,
  data: any | null,
): HealthMonitoringRecord | null {
  if (!data) return null;

  const row = data as any;
  const base = mapRow(row as HealthMonitoringRow);
  const hl = row.health_log;
  return applyLocalOverride(farmId, {
    ...base,
    healthLog: hl ? mapHealthLogRow(hl) : undefined,
  });
}

/**
 * Link an existing health_log to a health monitoring record.
 * This is used when a future scan references an existing CHT tag.
 */
export async function linkHealthLogToMonitoring(
  farmId: string,
  chtTag: string,
  healthLogId: string,
): Promise<void> {
  const record = await fetchHealthMonitoringByChtTag(farmId, chtTag);
  if (!record) {
    throw new Error(
      `Health monitoring record with CHT tag ${chtTag} not found`,
    );
  }

  await appendHealthLogToMonitoring(farmId, record.id, healthLogId);
}

/**
 * End active monitoring without deleting the record or the linked health log.
 */
export async function updateHealthMonitoringStatus(
  farmId: string,
  id: string,
  monitoringStatus: Exclude<HealthMonitoringStatus, "Active">,
): Promise<void> {
  const existingRecord = await fetchHealthMonitoringRecordById(farmId, id);
  const completedAt = new Date().toISOString();
  const override: LocalMonitoringOverride = {
    monitoringStatus,
    monitoringCompletedAt: completedAt,
    batchNo: existingRecord?.batchNo,
  };

  if (existingRecord?.monitoringStatus === "Active") {
    await createOutcomeAssessmentForMonitoring(
      farmId,
      existingRecord,
      monitoringStatus,
    );
  }

  const { data, error } = await supabase
    .from("health_monitoring")
    .update({
      monitoring_status: monitoringStatus,
      monitoring_completed_at: completedAt,
    })
    .eq("farm_id", farmId)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    if (!isMissingMonitoringStatusColumn(error)) throw error;
    writeStoredOverride(farmId, id, override);
  } else if (!data) {
    // Update did not apply (RLS, stale row, etc.) — keep UI in sync locally.
    writeStoredOverride(farmId, id, override);
  } else {
    writeStoredOverride(farmId, id, override);
  }

  if (existingRecord?.monitoringStatus !== "Active") return;
  if (!existingRecord.batchNo) return;

  try {
    await adjustFarmBatchHealthCounters(farmId, existingRecord.batchNo, {
      isolatedDelta: -1,
      killedDelta: monitoringStatus === "Deceased" ? 1 : 0,
    });
  } catch {
    // Status change already persisted; batch counter sync is best-effort.
  }
}

export function formatChtTag(number: number): string {
  return `CHT-${String(number).padStart(4, "0")}`;
}
