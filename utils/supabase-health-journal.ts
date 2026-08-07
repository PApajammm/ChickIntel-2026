import { supabase } from "@/lib/supabase";

export type HealthJournalSavedScan = {
  id: string;
  savedAt: string;
  photoUri: string;
  detectedIllness: string;
  diseaseId?: string;
  confidence?: number;
  detectionSource?: string;
  behaviorIds: string[];
  additionalObservation?: string;
  resultSummary: string;
  recommendationText: string;
  actionStatus: string;
  durationValue: string;
  healthMonitoringId?: string;
  chtTag?: string;
};

type HealthLogRow = {
  id: string;
  saved_at?: string | null;
  photo_uri?: string | null;
  detected_illness?: string | null;
  disease_id?: string | null;
  confidence?: number | null;
  detection_source?: string | null;
  behavior_ids?: string[] | null;
  additional_observation?: string | null;
  result_summary?: string | null;
  recommendation_text?: string | null;
  action_status?: string | null;
  duration_value?: string | null;
  health_monitoring_id?: string | null;
  cht_tag?: string | null;
};

function mapHealthLogRow(row: HealthLogRow): HealthJournalSavedScan {
  return {
    id: row.id,
    savedAt: row.saved_at ?? new Date().toISOString(),
    photoUri: row.photo_uri ?? "",
    detectedIllness: row.detected_illness ?? "Healthy / Normal",
    diseaseId: row.disease_id ?? undefined,
    confidence: typeof row.confidence === "number" ? row.confidence : undefined,
    detectionSource: row.detection_source ?? undefined,
    behaviorIds: Array.isArray(row.behavior_ids) ? row.behavior_ids : [],
    additionalObservation: row.additional_observation ?? undefined,
    resultSummary: row.result_summary ?? "",
    recommendationText: row.recommendation_text ?? "",
    actionStatus: row.action_status ?? "",
    durationValue: row.duration_value ?? "",
    healthMonitoringId: row.health_monitoring_id ?? undefined,
    chtTag: row.cht_tag ?? undefined,
  };
}

import { ensurePersistentImageUri } from "@/utils/persistent-image-storage";

export async function createHealthJournalEntry(
  farmId: string,
  entry: Omit<HealthJournalSavedScan, "id" | "savedAt">,
) {
  const persistentPhotoUri = await ensurePersistentImageUri(entry.photoUri);

  const insertPayload: Record<string, any> = {
    farm_id: farmId,
    photo_uri: persistentPhotoUri || null,
    detected_illness: entry.detectedIllness,
    disease_id: entry.diseaseId ?? null,
    confidence: entry.confidence ?? null,
    detection_source: entry.detectionSource ?? null,
    behavior_ids: entry.behaviorIds,
    additional_observation: entry.additionalObservation?.trim() || null,
    result_summary: entry.resultSummary,
    recommendation_text: entry.recommendationText,
    action_status: entry.actionStatus,
    duration_value: entry.durationValue,
  };

  if (entry.healthMonitoringId) {
    insertPayload.health_monitoring_id = entry.healthMonitoringId;
  }

  let data: any;
  let error: any;

  const res = await supabase
    .from("health_logs")
    .insert(insertPayload)
    .select("*")
    .single();

  data = res.data;
  error = res.error;

  if (error) {
    const corePayload: Record<string, any> = {
      farm_id: farmId,
      photo_uri: persistentPhotoUri || null,
      detected_illness: entry.detectedIllness,
      behavior_ids: entry.behaviorIds,
      result_summary: entry.resultSummary,
      recommendation_text: entry.recommendationText,
      action_status: entry.actionStatus,
      duration_value: entry.durationValue,
    };

    const fallbackRes = await supabase
      .from("health_logs")
      .insert(corePayload)
      .select("*")
      .single();

    if (fallbackRes.error) throw fallbackRes.error;
    data = fallbackRes.data;
  }

  const saved = mapHealthLogRow(data as HealthLogRow);

  try {
    await supabase
      .from("scan_records")
      .insert({
        farm_id: farmId,
        scan_type: "health",
        image_uri: saved.photoUri || null,
        disease_id: saved.diseaseId ?? null,
        confidence: saved.confidence ?? null,
        detected_illness: saved.detectedIllness,
        raw_result: {
          diseaseId: saved.diseaseId,
          confidence: saved.confidence,
          detectionSource: saved.detectionSource,
          behaviorIds: saved.behaviorIds,
          additionalObservation: saved.additionalObservation,
          resultSummary: saved.resultSummary,
          recommendationText: saved.recommendationText,
          actionStatus: saved.actionStatus,
          durationValue: saved.durationValue,
        },
        additional_observation: saved.additionalObservation ?? null,
      });
  } catch (scanRecordErr) {
    console.warn(
      "[supabase-health-journal] scan_records insert skipped:",
      scanRecordErr,
    );
  }

  invalidateHealthJournalCache(farmId);
  return saved;
}

const journalCacheMap = new Map<string, HealthLogRow[]>();

export function invalidateHealthJournalCache(farmId?: string) {
  if (farmId) {
    journalCacheMap.delete(farmId);
  } else {
    journalCacheMap.clear();
  }
}

async function attachChtTagsToScans(
  farmId: string,
  scans: HealthJournalSavedScan[],
): Promise<HealthJournalSavedScan[]> {
  if (scans.length === 0) return scans;

  try {
    const { data: monitoringRows } = await supabase
      .from("health_monitoring")
      .select("id, health_log_id, cht_tag")
      .eq("farm_id", farmId);

    if (!monitoringRows || monitoringRows.length === 0) return scans;

    const chtMapByLogId = new Map<string, string>();
    const chtMapByMonId = new Map<string, string>();

    monitoringRows.forEach((m: any) => {
      if (m.cht_tag) {
        if (m.health_log_id) chtMapByLogId.set(m.health_log_id, m.cht_tag);
        if (m.id) chtMapByMonId.set(m.id, m.cht_tag);
      }
    });

    return scans.map((scan) => {
      const tag =
        scan.chtTag ||
        chtMapByLogId.get(scan.id) ||
        (scan.healthMonitoringId ? chtMapByMonId.get(scan.healthMonitoringId) : undefined);
      return tag ? { ...scan, chtTag: tag } : scan;
    });
  } catch {
    return scans;
  }
}

export async function fetchHealthJournalEntries(farmId: string, forceRefresh = false): Promise<HealthJournalSavedScan[]> {
  try {
    let rows: HealthLogRow[];

    if (!forceRefresh && journalCacheMap.has(farmId)) {
      rows = journalCacheMap.get(farmId)!;
    } else {
      const { data, error } = await supabase
        .from("health_logs")
        .select("*")
        .eq("farm_id", farmId)
        .order("saved_at", { ascending: false })
        .limit(50);

      if (error) {
        console.warn("[supabase-health-journal] fetchHealthJournalEntries warning:", error.message);
        if (journalCacheMap.has(farmId)) {
          rows = journalCacheMap.get(farmId)!;
        } else {
          return [];
        }
      } else {
        rows = (data ?? []) as HealthLogRow[];
        journalCacheMap.set(farmId, rows);
      }
    }

    const activeRows = rows.filter((r) => (r.action_status ?? "") !== "archived");

    activeRows.sort((a, b) => {
      const timeA = new Date(a.saved_at || (a as any).created_at || 0).getTime();
      const timeB = new Date(b.saved_at || (b as any).created_at || 0).getTime();
      return timeB - timeA;
    });

    const mapped = activeRows.map(mapHealthLogRow);
    const withTags = await attachChtTagsToScans(farmId, mapped);

    // Group entries by monitored chicken so each chicken shows 1 card with its latest scan on main list
    const groupedMap = new Map<string, HealthJournalSavedScan>();
    const standaloneEntries: HealthJournalSavedScan[] = [];

    withTags.forEach((scan) => {
      const groupKey =
        scan.healthMonitoringId || (scan.chtTag ? `cht:${scan.chtTag}` : undefined);

      if (groupKey) {
        if (!groupedMap.has(groupKey)) {
          groupedMap.set(groupKey, scan);
        }
      } else {
        standaloneEntries.push(scan);
      }
    });

    const result = [...groupedMap.values(), ...standaloneEntries];
    result.sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
    );

    return result;
  } catch (err) {
    console.warn("[supabase-health-journal] fetchHealthJournalEntries catch:", err);
    return [];
  }
}

export async function fetchArchivedHealthJournalEntries(farmId: string, forceRefresh = false): Promise<HealthJournalSavedScan[]> {
  try {
    let rows: HealthLogRow[];

    if (!forceRefresh && journalCacheMap.has(farmId)) {
      rows = journalCacheMap.get(farmId)!;
    } else {
      const { data, error } = await supabase
        .from("health_logs")
        .select("*")
        .eq("farm_id", farmId)
        .order("saved_at", { ascending: false })
        .limit(50);

      if (error) {
        console.warn("[supabase-health-journal] fetchArchivedHealthJournalEntries warning:", error.message);
        if (journalCacheMap.has(farmId)) {
          rows = journalCacheMap.get(farmId)!;
        } else {
          return [];
        }
      } else {
        rows = (data ?? []) as HealthLogRow[];
        journalCacheMap.set(farmId, rows);
      }
    }

    const archivedRows = rows.filter((r) => r.action_status === "archived");

    archivedRows.sort((a, b) => {
      const timeA = new Date(a.saved_at || (a as any).created_at || 0).getTime();
      const timeB = new Date(b.saved_at || (b as any).created_at || 0).getTime();
      return timeB - timeA;
    });

    const mapped = archivedRows.map(mapHealthLogRow);
    return await attachChtTagsToScans(farmId, mapped);
  } catch (err) {
    console.warn("[supabase-health-journal] fetchArchivedHealthJournalEntries catch:", err);
    return [];
  }
}

export async function fetchHealthJournalEntryById(farmId: string, id: string): Promise<HealthJournalSavedScan | undefined> {
  try {
    const { data, error } = await supabase
      .from("health_logs")
      .select("*")
      .eq("farm_id", farmId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.warn("[supabase-health-journal] fetchHealthJournalEntryById warning:", error.message);
      return undefined;
    }
    if (!data) return undefined;

    return mapHealthLogRow(data as HealthLogRow);
  } catch (err) {
    console.warn("[supabase-health-journal] fetchHealthJournalEntryById catch:", err);
    return undefined;
  }
}

export async function updateHealthJournalEntryNote(
  farmId: string,
  id: string,
  note: string | undefined,
) {
  const normalizedNote = note?.trim() ? note.trim() : null;

  const { error } = await supabase
    .from("health_logs")
    .update({ additional_observation: normalizedNote })
    .eq("farm_id", farmId)
    .eq("id", id);

  if (error) throw error;
  invalidateHealthJournalCache(farmId);
}

export async function removeHealthJournalEntries(
  farmId: string,
  ids: string[],
) {
  if (ids.length === 0) return;

  // Replace deletion with archiving by marking action_status
  const { error } = await supabase
    .from("health_logs")
    .update({ action_status: "archived" })
    .eq("farm_id", farmId)
    .in("id", ids);

  if (error) throw error;
  invalidateHealthJournalCache(farmId);
}

export async function unarchiveHealthJournalEntries(
  farmId: string,
  ids: string[],
) {
  if (ids.length === 0) return;

  const { error } = await supabase
    .from("health_logs")
    .update({ action_status: "" })
    .eq("farm_id", farmId)
    .in("id", ids);

  if (error) throw error;
  invalidateHealthJournalCache(farmId);
}

export async function clearArchivedHealthJournalEntries(
  farmId: string,
) {
  const { error } = await supabase
    .from("health_logs")
    .delete()
    .eq("farm_id", farmId)
    .eq("action_status", "archived");

  if (error) throw error;
  invalidateHealthJournalCache(farmId);
}

export async function deleteHealthJournalEntriesPermanently(
  farmId: string,
  ids: string[],
) {
  if (ids.length === 0) return;

  const { error } = await supabase
    .from("health_logs")
    .delete()
    .eq("farm_id", farmId)
    .in("id", ids);

  if (error) throw error;
  invalidateHealthJournalCache(farmId);
}

export function formatJournalDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

export function formatJournalDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";

  const date = formatJournalDate(iso);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${date} • ${displayHours}:${minutes} ${suffix}`;
}
