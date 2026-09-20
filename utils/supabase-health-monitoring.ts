import { supabase } from "@/lib/supabase";
import { adjustFarmBatchHealthCounters } from "@/utils/supabase-batches";
import { formatScheduleDateKey } from "@/utils/supabase-schedule";
import { type HealthJournalSavedScan } from "./supabase-health-journal";

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

export type HealthMonitoringTask = {
  id: string;
  monitoringId: string;
  title: string;
  description?: string;
  taskType?: string;
  dueAt?: string;
  status: "Pending" | "In Progress" | "Completed" | "Skipped" | "Overdue";
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
  treatmentNote?: string;
  scheduleTaskId?: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
  scheduledTimes?: string[];
  occurrences: HealthMonitoringTaskOccurrence[];
  sortOrder: number;
};

export type HealthMonitoringTaskOccurrence = {
  id: string;
  taskId: string;
  dueAt: string;
  completed: boolean;
  status: "Pending" | "Completed" | "Overdue";
  completedAt?: string;
  completedBy?: string;
  treatmentNote?: string;
};

type TreatmentPlanStep = {
  title: string;
  description?: string;
};

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

type HealthMonitoringTaskRow = {
  id: string;
  health_monitoring_id: string;
  title: string;
  description?: string | null;
  task_type?: string | null;
  due_at?: string | null;
  status?: HealthMonitoringTask["status"] | null;
  completed: boolean;
  completed_at?: string | null;
  completed_by?: string | null;
  treatment_note?: string | null;
  schedule_task_id?: string | null;
  frequency?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  scheduled_times?: string[] | null;
  sort_order: number;
};

type HealthMonitoringTaskOccurrenceRow = {
  id: string;
  health_monitoring_task_id: string;
  due_at: string;
  completed: boolean;
  completed_at?: string | null;
  completed_by?: string | null;
  treatment_note?: string | null;
};

function isMissingTreatmentTaskColumnError(error: unknown) {
  const value = error as { code?: string; message?: string } | null;
  const message = value?.message?.toLowerCase() ?? "";
  return (
    value?.code === "42703" ||
    value?.code === "PGRST204" ||
    message.includes("health_monitoring_tasks") ||
    message.includes("completed_by") ||
    message.includes("treatment_note") ||
    message.includes("task_type") ||
    message.includes("schedule_task_id")
  );
}

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

function addCalendarDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isPastDueDate(dueAt: string) {
  const dueDate = new Date(dueAt);
  if (Number.isNaN(dueDate.getTime())) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  return dueDate.getTime() < today.getTime();
}

function getTreatmentReminderConfig(title: string, now: Date) {
  const normalized = title.toLowerCase();
  const durationMatch = normalized.match(/for\s+(\d+)\s+days?/i);
  const weekDurationMatch = normalized.match(/for\s+(\d+)\s+weeks?/i);
  const durationDays = durationMatch
    ? Number(durationMatch[1])
    : weekDurationMatch
      ? Number(weekDurationMatch[1]) * 7
      : 7;
  const isWeekly = /\bweekly\b|once\s+a\s+week|every\s+week/i.test(normalized);
  const isDaily =
    durationDays > 0 ||
    /\bdaily\b|each day|per day|every day/i.test(normalized);
  const isTwiceDaily =
    /twice\s+(?:a|per)\s+day|2\s+times\s+(?:a|per)\s+day|every\s+12\s+hours/i.test(
      normalized,
    );
  const startDate = formatScheduleDateKey(now);
  const endDate = durationDays
    ? formatScheduleDateKey(addCalendarDays(now, durationDays - 1))
    : startDate;

  return {
    repeat: isWeekly ? "Weekly" : isDaily ? "Daily" : "Never",
    dayStep: isWeekly ? 7 : 1,
    startDate,
    endDate,
    times: isTwiceDaily
      ? ["08:00", "20:00"]
      : [
          `${String(now.getHours()).padStart(2, "0")}:${String(
            now.getMinutes(),
          ).padStart(2, "0")}`,
        ],
  };
}

function buildMonitoringProtocolSteps(
  treatmentSteps: (string | TreatmentPlanStep)[],
): TreatmentPlanStep[] {
  return treatmentSteps
    .map((rawStep) =>
      typeof rawStep === "string"
        ? { title: rawStep, description: undefined }
        : rawStep,
    )
    .map((step) => ({
      title: step.title.trim(),
      description: step.description?.trim() || undefined,
    }))
    .filter((step) => step.title);
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
    .update({
      action_status: monitoringStatus,
      archived_at:
        monitoringStatus === "Deceased" ? new Date().toISOString() : null,
    })
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
  treatmentSteps: (string | TreatmentPlanStep)[] = [],
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

  const protocolSteps = buildMonitoringProtocolSteps(treatmentSteps);

  if (protocolSteps.length > 0) {
    const now = new Date();

    for (const [index, step] of protocolSteps.entries()) {
      const title = step.title.trim();
      if (!title) continue;

      const reminderConfig = getTreatmentReminderConfig(title, now);

      const taskRow = {
        farm_id: farmId,
        health_monitoring_id: record.id,
        title,
        description:
          step.description?.trim() ||
          `Follow the validated treatment protocol for ${record.chtTag}.`,
        task_type: "Treatment",
        due_at: new Date(
          `${reminderConfig.startDate}T${reminderConfig.times[0]}:00`,
        ).toISOString(),
        status: "Pending",
        completed: false,
        schedule_task_id: null,
        frequency: reminderConfig.repeat,
        start_date: reminderConfig.startDate,
        end_date: reminderConfig.endDate,
        scheduled_times: reminderConfig.times,
        sort_order: index,
      };
      const { data: taskData, error: taskError } = await supabase
        .from("health_monitoring_tasks")
        .insert(taskRow)
        .select("id")
        .single();

      if (taskError || !taskData) {
        console.warn(
          "[health-monitoring] Treatment task could not be saved:",
          taskError?.message,
        );
        continue;
      }

      const occurrenceRows = [];
      const start = new Date(`${reminderConfig.startDate}T00:00:00`);
      const end = new Date(`${reminderConfig.endDate}T00:00:00`);
      for (
        const date = new Date(start);
        date <= end;
        date.setDate(date.getDate() + reminderConfig.dayStep)
      ) {
        for (const time of reminderConfig.times) {
          occurrenceRows.push({
            farm_id: farmId,
            health_monitoring_task_id: taskData.id,
            due_at: new Date(
              `${formatScheduleDateKey(date)}T${time}:00`,
            ).toISOString(),
          });
        }
      }

      const { error: occurrenceError } = await supabase
        .from("health_monitoring_task_occurrences")
        .insert(occurrenceRows);
      if (occurrenceError) {
        console.warn(
          "[health-monitoring] Treatment occurrences could not be saved:",
          occurrenceError.message,
        );
      }
    }
  }

  invalidateHealthMonitoringCache(farmId);

  return {
    ...record,
    batchNo: normalizedBatchNo ?? record.batchNo,
  };
}

function mapMonitoringTaskRow(
  row: HealthMonitoringTaskRow,
): HealthMonitoringTask {
  return {
    id: row.id,
    monitoringId: row.health_monitoring_id,
    title: row.title,
    description: row.description ?? undefined,
    taskType: row.task_type ?? undefined,
    dueAt: row.due_at ?? undefined,
    status: row.status ?? (row.completed ? "Completed" : "Pending"),
    completed: Boolean(row.completed),
    completedAt: row.completed_at ?? undefined,
    completedBy: row.completed_by ?? undefined,
    treatmentNote: row.treatment_note ?? undefined,
    scheduleTaskId: row.schedule_task_id ?? undefined,
    frequency: row.frequency ?? undefined,
    startDate: row.start_date ?? undefined,
    endDate: row.end_date ?? undefined,
    scheduledTimes: row.scheduled_times ?? undefined,
    occurrences: [],
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapMonitoringTaskOccurrenceRow(
  row: HealthMonitoringTaskOccurrenceRow,
): HealthMonitoringTaskOccurrence {
  const isOverdue = !row.completed && isPastDueDate(row.due_at);

  return {
    id: row.id,
    taskId: row.health_monitoring_task_id,
    dueAt: row.due_at,
    completed: Boolean(row.completed),
    status: row.completed ? "Completed" : isOverdue ? "Overdue" : "Pending",
    completedAt: row.completed_at ?? undefined,
    completedBy: row.completed_by ?? undefined,
    treatmentNote: row.treatment_note ?? undefined,
  };
}

export async function fetchHealthMonitoringTasks(
  farmId: string,
  monitoringId: string,
): Promise<HealthMonitoringTask[]> {
  const { data, error } = await supabase
    .from("health_monitoring_tasks")
    .select(
      "id, health_monitoring_id, title, description, task_type, due_at, status, completed, completed_at, completed_by, treatment_note, schedule_task_id, frequency, start_date, end_date, scheduled_times, sort_order",
    )
    .eq("farm_id", farmId)
    .eq("health_monitoring_id", monitoringId)
    .order("sort_order", { ascending: true });

  if (error) {
    if (!isMissingTreatmentTaskColumnError(error)) {
      console.warn(
        "[health-monitoring] Treatment task fetch skipped:",
        error.message,
      );
      return [];
    }

    const fallback = await supabase
      .from("health_monitoring_tasks")
      .select(
        "id, health_monitoring_id, title, completed, completed_at, sort_order",
      )
      .eq("farm_id", farmId)
      .eq("health_monitoring_id", monitoringId)
      .order("sort_order", { ascending: true });

    if (fallback.error) throw fallback.error;
    const legacyTasks = (fallback.data ?? []).map((row) =>
      mapMonitoringTaskRow(row as HealthMonitoringTaskRow),
    );
    return legacyTasks;
  }

  const tasks = (data ?? []).map((row) =>
    mapMonitoringTaskRow(row as HealthMonitoringTaskRow),
  );
  if (tasks.length === 0) return tasks;

  const { data: occurrenceRows, error: occurrenceError } = await supabase
    .from("health_monitoring_task_occurrences")
    .select(
      "id, health_monitoring_task_id, due_at, completed, completed_at, completed_by, treatment_note",
    )
    .eq("farm_id", farmId)
    .in(
      "health_monitoring_task_id",
      tasks.map((task) => task.id),
    )
    .order("due_at", { ascending: true });

  if (occurrenceError) return tasks;
  const occurrences = (occurrenceRows ?? []).map((row) =>
    mapMonitoringTaskOccurrenceRow(row as HealthMonitoringTaskOccurrenceRow),
  );
  return tasks.map((task) => ({
    ...task,
    occurrences: occurrences.filter(
      (occurrence) => occurrence.taskId === task.id,
    ),
  }));
}

export async function updateHealthMonitoringTask(
  farmId: string,
  taskId: string,
  completed: boolean,
  treatmentNote?: string,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const basePayload = {
    completed,
    completed_at: completed ? new Date().toISOString() : null,
  };
  const { error } = await supabase
    .from("health_monitoring_tasks")
    .update({
      ...basePayload,
      status: completed ? "Completed" : "Pending",
      completed_by: completed ? (userData.user?.id ?? null) : null,
      ...(treatmentNote !== undefined
        ? { treatment_note: treatmentNote.trim() || null }
        : {}),
    })
    .eq("farm_id", farmId)
    .eq("id", taskId);

  if (!error) return;
  if (!isMissingTreatmentTaskColumnError(error)) throw error;

  const fallback = await supabase
    .from("health_monitoring_tasks")
    .update(basePayload)
    .eq("farm_id", farmId)
    .eq("id", taskId);

  if (fallback.error) throw fallback.error;
}

export async function updateHealthMonitoringTaskOccurrence(
  farmId: string,
  occurrenceId: string,
  completed: boolean,
  treatmentNote?: string,
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("health_monitoring_task_occurrences")
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      completed_by: completed ? (userData.user?.id ?? null) : null,
      ...(treatmentNote !== undefined
        ? { treatment_note: treatmentNote.trim() || null }
        : {}),
    })
    .eq("farm_id", farmId)
    .eq("id", occurrenceId);

  if (error) throw error;
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
