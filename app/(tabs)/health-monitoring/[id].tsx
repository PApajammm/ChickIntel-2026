import {
  moderateScale,
  responsiveFontSize,
  scale,
  verticalScale,
} from "@/utils/responsive";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCameraPermissions } from "expo-camera";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HealthInputSummaryCard } from "@/components/health-scan/health-input-summary-card";
import { HealthResultCard } from "@/components/health-scan/health-result-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { HealthTypography } from "@/constants/health-typography";
import { useBehaviors } from "@/hooks/use-behaviors";
import { useAuth } from "@/providers/auth-provider";
import { logError } from "@/utils/logger";
import { mapBehaviorIdsToLabels } from "@/services/health/supabase-behaviors";
import {
  fetchDiseaseDetails,
  type DiseaseDetails,
} from "@/services/health/supabase-diseases";
import type { HealthJournalSavedScan } from "@/services/health/supabase-health-journal";
import {
  fetchHealthMonitoringRecordById,
  fetchHealthMonitoringScanHistory,
  fetchHealthMonitoringTasks,
  updateDiseaseRecordStatus,
  updateHealthMonitoringTaskOccurrence,
  type HealthMonitoringRecord,
  type HealthMonitoringTask,
  type HealthMonitoringTaskOccurrence,
} from "@/services/health/supabase-health-monitoring";

type TreatmentOccurrenceEntry = {
  task: HealthMonitoringTask;
  occurrence: HealthMonitoringTaskOccurrence;
};

function formatScanDate(savedAt?: string) {
  if (!savedAt) return "Unknown date";
  const d = new Date(savedAt);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${m}/${day}/${y} | ${displayHours}:${minutes} ${suffix}`;
}

function getMonitoringDays(startedAt: string, completedAt?: string) {
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt ?? Date.now()).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
}

function getDateKey(dateValue: string) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "unknown";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTreatmentDayNumber(startedAt: string, dueAt: string) {
  const start = new Date(startedAt);
  const due = new Date(dueAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(due.getTime())) return 1;
  start.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.max(
    1,
    Math.floor((due.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1,
  );
}

function formatTreatmentDayDate(dateKey: string) {
  if (dateKey === "unknown") return "Unknown date";
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isBlockedByEarlierDay(
  occurrence: HealthMonitoringTaskOccurrence,
  occurrences: HealthMonitoringTaskOccurrence[],
) {
  const occurrenceDateKey = getDateKey(occurrence.dueAt);
  if (occurrenceDateKey === "unknown") return false;

  return occurrences.some(
    (item) => getDateKey(item.dueAt) < occurrenceDateKey && !item.completed,
  );
}

export default function HealthMonitoringDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeFarm, configured } = useAuth();
  const { id: idParam, refresh: refreshParam } = useLocalSearchParams<{
    id: string | string[];
    refresh?: string | string[];
  }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const [record, setRecord] = useState<HealthMonitoringRecord | undefined>();
  const [scanHistory, setScanHistory] = useState<HealthJournalSavedScan[]>([]);
  const [selectedDiseaseId, setSelectedDiseaseId] = useState<string | null>(
    null,
  );
  const [treatmentTasks, setTreatmentTasks] = useState<HealthMonitoringTask[]>(
    [],
  );
  const [treatmentNotes, setTreatmentNotes] = useState<Record<string, string>>(
    {},
  );
  const [noteModalContext, setNoteModalContext] = useState<{
    task: HealthMonitoringTask;
    occurrence: HealthMonitoringTaskOccurrence;
  } | null>(null);
  const [pendingTreatmentCompletion, setPendingTreatmentCompletion] = useState<{
    task: HealthMonitoringTask;
    occurrence: HealthMonitoringTaskOccurrence;
  } | null>(null);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [isProtocolExpanded, setIsProtocolExpanded] = useState(true);
  const [protocolTaskFilter, setProtocolTaskFilter] = useState<
    "All" | "Pending" | "Overdue" | "Completed"
  >("All");
  const [diseaseDetails, setDiseaseDetails] = useState<DiseaseDetails | null>(
    null,
  );
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const { behaviors: behaviorItems } = useBehaviors();

  const refresh = useCallback(async () => {
    if (typeof id !== "string" || !id || !configured || !activeFarm?.id) {
      setRecord(undefined);
      setScanHistory([]);
      return;
    }

    try {
      const [nextRecord, history, tasks] = await Promise.all([
        fetchHealthMonitoringRecordById(activeFarm.id, id),
        fetchHealthMonitoringScanHistory(activeFarm.id, id),
        fetchHealthMonitoringTasks(activeFarm.id, id),
      ]);

      if (!nextRecord) {
        router.back();
        return;
      }

      setRecord(nextRecord);
      setScanHistory(history);
      setTreatmentTasks(tasks);
    } catch (error) {
      logError("Health monitoring detail load failed", error, {
        farmId: activeFarm.id,
        id,
      });
      router.back();
    }
  }, [activeFarm?.id, configured, id, router]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    if (refreshParam) {
      void refresh();
    }
  }, [refreshParam, refresh]);

  // All disease records associated with this chicken
  const allDiseaseRecords = useMemo(() => {
    if (scanHistory.length > 0) return scanHistory;
    if (record?.healthLog) return [record.healthLog];
    return [];
  }, [scanHistory, record?.healthLog]);

  // Active diseases vs Resolved/History diseases
  const activeDiseaseRecords = useMemo(() => {
    return allDiseaseRecords.filter((item) => {
      const status = (item.actionStatus || "").toLowerCase();
      return status !== "recovered" && status !== "deceased" && status !== "resolved";
    });
  }, [allDiseaseRecords]);

  const resolvedDiseaseRecords = useMemo(() => {
    return allDiseaseRecords.filter((item) => {
      const status = (item.actionStatus || "").toLowerCase();
      return status === "recovered" || status === "deceased" || status === "resolved";
    });
  }, [allDiseaseRecords]);

  // Active health log / disease currently selected for view
  const currentHealthLog = useMemo(() => {
    if (selectedDiseaseId) {
      const found = allDiseaseRecords.find((d) => d.id === selectedDiseaseId);
      if (found) return found;
    }
    return (
      activeDiseaseRecords[0] ??
      allDiseaseRecords[0] ??
      record?.healthLog
    );
  }, [selectedDiseaseId, allDiseaseRecords, activeDiseaseRecords, record?.healthLog]);

  // Health history entries are all other scans/diseases not currently active in primary view
  const historyEntries = useMemo(() => {
    return allDiseaseRecords.filter(
      (scan) => scan.id !== currentHealthLog?.id,
    );
  }, [allDiseaseRecords, currentHealthLog?.id]);

  const behaviorLabels = useMemo(
    () =>
      currentHealthLog
        ? mapBehaviorIdsToLabels(currentHealthLog.behaviorIds, behaviorItems)
        : [],
    [currentHealthLog, behaviorItems],
  );

  // Tasks belonging specifically to the currently selected disease
  const currentDiseaseTasks = useMemo(() => {
    if (!currentHealthLog) return treatmentTasks;
    const tagged = treatmentTasks.filter(
      (task) => task.healthLogId === currentHealthLog.id,
    );
    // If tasks were not tagged with healthLogId (e.g. single/legacy disease), return all monitoring tasks
    return tagged.length > 0 ? tagged : treatmentTasks;
  }, [currentHealthLog, treatmentTasks]);

  useEffect(() => {
    if (!currentHealthLog?.diseaseId) {
      setDiseaseDetails(null);
      return;
    }

    let cancelled = false;

    fetchDiseaseDetails(currentHealthLog.diseaseId)
      .then((details) => {
        if (!cancelled) setDiseaseDetails(details);
      })
      .catch(() => {
        if (!cancelled) setDiseaseDetails(null);
      });

    return () => {
      cancelled = true;
    };
  }, [currentHealthLog?.diseaseId]);

  const openAddDisease = useCallback(async () => {
    if (!record) return;

    if (Platform.OS !== "web" && !cameraPermission?.granted) {
      try {
        await requestCameraPermission();
      } catch (error) {
        logError("Camera permission request failed", error);
      }
    }

    router.push({
      pathname: "/(tabs)/scanner",
      params: {
        monitoringId: record.id,
        chtTag: record.chtTag,
        initialMode: "health",
        flowAction: "add_disease",
      },
    } as never);
  }, [cameraPermission?.granted, record, requestCameraPermission, router]);

  const toggleTreatmentOccurrence = useCallback(
    (
      task: HealthMonitoringTask,
      occurrence: HealthMonitoringTaskOccurrence,
    ) => {
      const allOccurrences = currentDiseaseTasks.flatMap(
        (entry) => entry.occurrences,
      );
      if (
        !activeFarm?.id ||
        occurrence.completed ||
        isBlockedByEarlierDay(occurrence, allOccurrences)
      ) {
        return;
      }
      setPendingTreatmentCompletion({ task, occurrence });
    },
    [activeFarm?.id, currentDiseaseTasks],
  );

  const confirmTreatmentCompletion = useCallback(async () => {
    if (!activeFarm?.id || !pendingTreatmentCompletion) return;

    const { task, occurrence } = pendingTreatmentCompletion;
    const completedAt = new Date().toISOString();
    setPendingTreatmentCompletion(null);
    setTreatmentTasks((previous) =>
      previous.map((entry) =>
        entry.id === task.id
          ? {
              ...entry,
              occurrences: entry.occurrences.map((item) =>
                item.id === occurrence.id
                  ? {
                      ...item,
                      completed: true,
                      completedAt,
                      status: "Completed",
                    }
                  : item,
              ),
            }
          : entry,
      ),
    );

    try {
      await updateHealthMonitoringTaskOccurrence(
        activeFarm.id,
        occurrence.id,
        true,
      );
    } catch (error) {
      logError("Treatment occurrence update failed", error, {
        occurrenceId: occurrence.id,
      });
      void refresh();
    }
  }, [activeFarm?.id, pendingTreatmentCompletion, refresh]);

  const saveTreatmentNote = useCallback(
    async (
      task: HealthMonitoringTask,
      occurrence: HealthMonitoringTaskOccurrence,
    ) => {
      if (!activeFarm?.id) return;
      const treatmentNote = treatmentNotes[occurrence.id] ?? "";
      try {
        await updateHealthMonitoringTaskOccurrence(
          activeFarm.id,
          occurrence.id,
          occurrence.completed,
          treatmentNote,
        );
        setTreatmentTasks((previous) =>
          previous.map((entry) =>
            entry.id === task.id
              ? {
                  ...entry,
                  occurrences: entry.occurrences.map((item) =>
                    item.id === occurrence.id
                      ? { ...item, treatmentNote }
                      : item,
                  ),
                }
              : entry,
          ),
        );
      } catch (error) {
        logError("Treatment occurrence note update failed", error, {
          occurrenceId: occurrence.id,
        });
      }
      setNoteModalContext(null);
    },
    [activeFarm?.id, treatmentNotes],
  );

  const openNoteEditor = useCallback(
    (
      task: HealthMonitoringTask,
      occurrence: HealthMonitoringTaskOccurrence,
    ) => {
      setTreatmentNotes((previous) => ({
        ...previous,
        [occurrence.id]:
          previous[occurrence.id] ?? occurrence.treatmentNote ?? "",
      }));
      setNoteModalContext({ task, occurrence });
    },
    [],
  );

  const confirmResolveDisease = useCallback(async () => {
    if (!activeFarm?.id || !currentHealthLog) return;
    setResolveModalVisible(false);
    try {
      await updateDiseaseRecordStatus(
        activeFarm.id,
        currentHealthLog.id,
        "Recovered",
      );
      void refresh();
    } catch (error) {
      logError("Failed to mark disease as recovered", error);
    }
  }, [activeFarm?.id, currentHealthLog, refresh]);

  if (!record) {
    return null;
  }

  const healthLog = currentHealthLog;
  const resultSeverity =
    healthLog?.actionStatus === "Isolation" ||
    diseaseDetails?.severity === "high" ||
    diseaseDetails?.severity === "critical";
  const canAddDisease = record.monitoringStatus === "Active";
  const monitoringDays = getMonitoringDays(
    healthLog?.savedAt ?? record.createdAt,
    record.monitoringCompletedAt,
  );
  const diseaseStartDate = healthLog?.savedAt ?? record.createdAt;

  const treatmentOccurrences = currentDiseaseTasks.flatMap((task) =>
    task.occurrences.map((occurrence) => ({ task, occurrence })),
  );
  const completedOccurrenceCount = treatmentOccurrences.filter(
    ({ occurrence }) => occurrence.completed,
  ).length;

  const filteredTreatmentOccurrences = treatmentOccurrences
    .filter(
      ({ occurrence }) =>
        protocolTaskFilter === "All" ||
        occurrence.status === protocolTaskFilter,
    )
    .sort(
      (left, right) =>
        new Date(left.occurrence.dueAt).getTime() -
          new Date(right.occurrence.dueAt).getTime() ||
        left.task.sortOrder - right.task.sortOrder,
    );

  const treatmentDayGroups = filteredTreatmentOccurrences.reduce<
    {
      dateKey: string;
      dayNumber: number;
      items: TreatmentOccurrenceEntry[];
    }[]
  >((groups, item) => {
    const dateKey = getDateKey(item.occurrence.dueAt);
    const existingGroup = groups.find((group) => group.dateKey === dateKey);
    if (existingGroup) {
      existingGroup.items.push(item);
      return groups;
    }

    return [
      ...groups,
      {
        dateKey,
        dayNumber: getTreatmentDayNumber(
          diseaseStartDate,
          item.occurrence.dueAt,
        ),
        items: [item],
      },
    ];
  }, []);

  const isCurrentDiseaseActive =
    healthLog &&
    healthLog.actionStatus !== "Recovered" &&
    healthLog.actionStatus !== "Deceased" &&
    healthLog.actionStatus !== "Resolved";

  const renderTreatmentOccurrence = ({
    task,
    occurrence,
  }: {
    task: HealthMonitoringTask;
    occurrence: HealthMonitoringTaskOccurrence;
  }) => {
    const isOverdue = occurrence.status === "Overdue";
    const isBlocked = isBlockedByEarlierDay(
      occurrence,
      treatmentOccurrences.map((entry) => entry.occurrence),
    );

    return (
      <View
        key={occurrence.id}
        style={[
          styles.protocolTaskCard,
          isOverdue ? styles.protocolTaskCardOverdue : null,
        ]}
      >
        <View style={styles.protocolTaskRow}>
          <Pressable
            style={styles.protocolTaskToggle}
            onPress={() => void toggleTreatmentOccurrence(task, occurrence)}
            disabled={occurrence.completed || isBlocked}
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: occurrence.completed,
              disabled: occurrence.completed || isBlocked,
            }}
          >
            <MaterialCommunityIcons
              name={
                occurrence.completed
                  ? "checkbox-marked"
                  : isBlocked
                    ? "lock-outline"
                    : "checkbox-blank-outline"
              }
              size={22}
              color={
                occurrence.completed
                  ? ChickIntelPalette.green1
                  : isBlocked
                    ? ChickIntelPalette.textMuted
                    : isOverdue
                      ? "#B45309"
                      : ChickIntelPalette.gray2
              }
            />
            <View style={styles.protocolTaskCopy}>
              <Text
                style={[
                  styles.protocolTaskText,
                  occurrence.completed && styles.protocolTaskTextCompleted,
                ]}
              >
                {task.title}
              </Text>
              {task.description ? (
                <Text style={styles.protocolTaskDescription}>
                  {task.description}
                </Text>
              ) : null}
              {occurrence.dueAt ? (
                <Text
                  style={[
                    styles.protocolTaskMeta,
                    isOverdue ? styles.protocolTaskMetaOverdue : null,
                  ]}
                >
                  {isOverdue ? "Overdue" : "Due"}:{" "}
                  {formatScanDate(occurrence.dueAt)}
                </Text>
              ) : null}
              {occurrence.completedAt ? (
                <Text style={styles.protocolTaskMeta}>
                  Completed: {formatScanDate(occurrence.completedAt)}
                </Text>
              ) : null}
              {occurrence.completedBy ? (
                <Text style={styles.protocolTaskMeta}>
                  Completed by: Farmer
                </Text>
              ) : null}
              {isBlocked ? (
                <Text style={styles.protocolTaskMetaBlocked}>
                  Complete the previous day&apos;s tasks first
                </Text>
              ) : null}
            </View>
          </Pressable>
          <TouchableOpacity
            style={styles.protocolNoteIconButton}
            onPress={() => openNoteEditor(task, occurrence)}
            accessibilityRole="button"
            accessibilityLabel={`Add note for ${task.title}`}
          >
            <MaterialCommunityIcons
              name="note-edit-outline"
              size={17}
              color={ChickIntelPalette.green1}
            />
          </TouchableOpacity>
        </View>
        {occurrence.treatmentNote?.trim() ? (
          <View style={styles.protocolNotePreview}>
            <MaterialCommunityIcons
              name="note-edit-outline"
              size={16}
              color={ChickIntelPalette.green1}
            />
            <View style={styles.protocolNoteCopy}>
              <Text style={styles.protocolNoteLabel}>Treatment note</Text>
              <Text style={styles.protocolNoteText}>
                {occurrence.treatmentNote.trim()}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const detectionDateFormatted = healthLog?.savedAt
    ? formatScanDate(healthLog.savedAt)
    : record.createdAt
      ? new Date(record.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      : "";

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/health-monitoring");
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color={ChickIntelPalette.gray1}
          />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Health Monitoring</Text>
        <View style={styles.topMeta}>
          <Text style={styles.chtTag}>{record.chtTag}</Text>
          <Text style={styles.monitoringStatus}>{record.monitoringStatus}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 25 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Batch No.</Text>
            <Text style={styles.metaValue}>{record.batchNo ?? "-"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Detected Date</Text>
            <Text style={styles.metaValue}>{detectionDateFormatted}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Monitoring Days</Text>
            <Text style={styles.metaValue}>{monitoringDays} days</Text>
          </View>
        </View>

        {/* Action: Add New Disease to this chicken */}
        {canAddDisease ? (
          <Pressable
            onPress={() => void openAddDisease()}
            style={({ pressed }) => [
              styles.addDiseaseButton,
              { opacity: pressed ? 0.88 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Add New Disease"
          >
            <MaterialCommunityIcons
              name="plus-circle-outline"
              size={19}
              color="#FFFFFF"
            />
            <Text style={styles.addDiseaseButtonText}>Add New Disease</Text>
          </Pressable>
        ) : null}

        {/* Multiple Disease Switcher Tabs if chicken has multiple active disease records */}
        {activeDiseaseRecords.length > 1 ? (
          <View style={styles.diseaseSelectorCard}>
            <View style={styles.diseaseSelectorHeader}>
              <MaterialCommunityIcons
                name="format-list-bulleted"
                size={16}
                color={ChickIntelPalette.green1}
              />
              <Text style={styles.diseaseSelectorLabel}>
                Active Disease Records ({activeDiseaseRecords.length})
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.diseasePillRow}
            >
              {activeDiseaseRecords.map((item) => {
                const isSelected = item.id === currentHealthLog?.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setSelectedDiseaseId(item.id)}
                    style={[
                      styles.diseasePill,
                      isSelected && styles.diseasePillActive,
                    ]}
                    activeOpacity={0.8}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View
                      style={[
                        styles.diseasePillDot,
                        isSelected && styles.diseasePillDotActive,
                      ]}
                    />
                    <Text
                      style={[
                        styles.diseasePillText,
                        isSelected && styles.diseasePillTextActive,
                      ]}
                    >
                      {item.detectedIllness}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {healthLog && (
          <>
            <HealthInputSummaryCard
              photoUri={healthLog.photoUri}
              detectedIllness={healthLog.detectedIllness}
              detectionDescription={diseaseDetails?.description}
              selectedLabels={behaviorLabels}
              additionalObservation={healthLog.additionalObservation}
            />

            <View style={styles.cardSpacer} />

            <HealthResultCard
              resultSeverity={resultSeverity}
              diseaseName={healthLog.detectedIllness}
              resultSummary={
                diseaseDetails?.diseaseName ?? healthLog.resultSummary
              }
              resultDescription={diseaseDetails?.description}
              recommendationText={healthLog.recommendationText}
              treatmentSteps={diseaseDetails?.treatmentSteps}
              actionStatus={healthLog.actionStatus || record.monitoringStatus}
              durationValue={healthLog.durationValue}
            />

            {/* Treatment Protocol Section (Independent per disease) */}
            <View style={styles.protocolSection}>
              <TouchableOpacity
                style={styles.protocolHeader}
                onPress={() => setIsProtocolExpanded((expanded) => !expanded)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={
                  isProtocolExpanded
                    ? "Hide treatment protocol tasks"
                    : "Show treatment protocol tasks"
                }
                accessibilityState={{ expanded: isProtocolExpanded }}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.protocolTitleRow}>
                    <Text style={styles.protocolTitle}>Treatment Protocol</Text>
                    <View style={styles.diseaseBadge}>
                      <Text style={styles.diseaseBadgeText}>
                        {healthLog.detectedIllness}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.protocolSubtitle}>
                    {treatmentOccurrences.length > 0
                      ? `${completedOccurrenceCount}/${treatmentOccurrences.length} tasks completed`
                      : "No treatment tasks were provided for this disease."}
                  </Text>
                </View>
                <View style={styles.protocolHeaderActions}>
                  <MaterialCommunityIcons
                    name="medical-bag"
                    size={22}
                    color={ChickIntelPalette.green1}
                  />
                  <MaterialCommunityIcons
                    name={isProtocolExpanded ? "chevron-up" : "chevron-down"}
                    size={24}
                    color={ChickIntelPalette.gray1}
                  />
                </View>
              </TouchableOpacity>

              {isProtocolExpanded ? (
                <>
                  <View style={styles.protocolFilterRow}>
                    {(["All", "Pending", "Overdue", "Completed"] as const).map(
                      (filter) => (
                        <Pressable
                          key={filter}
                          onPress={() => setProtocolTaskFilter(filter)}
                          style={[
                            styles.protocolFilterItem,
                            protocolTaskFilter === filter
                              ? styles.protocolFilterItemActive
                              : null,
                          ]}
                        >
                          <Text
                            style={[
                              styles.protocolFilterText,
                              protocolTaskFilter === filter
                                ? styles.protocolFilterTextActive
                                : null,
                            ]}
                          >
                            {filter}
                          </Text>
                        </Pressable>
                      ),
                    )}
                  </View>

                  {treatmentDayGroups.length > 0 ? (
                    treatmentDayGroups.map((group) => (
                      <View key={group.dateKey} style={styles.protocolDayGroup}>
                        <View style={styles.protocolDayHeader}>
                          <View style={styles.protocolDayTag}>
                            <MaterialCommunityIcons
                              name="calendar-clock-outline"
                              size={13}
                              color="#8F4800"
                            />
                            <Text style={styles.protocolGroupTitle}>
                              Day {group.dayNumber}
                            </Text>
                          </View>
                          <Text style={styles.protocolDayDate}>
                            {formatTreatmentDayDate(group.dateKey)}
                          </Text>
                        </View>
                        {group.items.map(renderTreatmentOccurrence)}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.protocolEmptyText}>
                      No tasks match this filter.
                    </Text>
                  )}

                  {/* Individual Disease Resolution Action */}
                  {isCurrentDiseaseActive ? (
                    <TouchableOpacity
                      style={styles.resolveDiseaseBtn}
                      onPress={() => setResolveModalVisible(true)}
                      activeOpacity={0.85}
                    >
                      <MaterialCommunityIcons
                        name="checkbox-marked-circle-outline"
                        size={18}
                        color={ChickIntelPalette.green1}
                      />
                      <Text style={styles.resolveDiseaseBtnText}>
                        Mark {healthLog.detectedIllness} as Recovered
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              ) : null}
            </View>

            {/* Health History Section: Preserves all previous & resolved disease records */}
            <View style={styles.historySection}>
              <View style={styles.historyHeaderRow}>
                <MaterialCommunityIcons
                  name="history"
                  size={20}
                  color={ChickIntelPalette.green1}
                />
                <Text style={styles.historyTitle}>Health History</Text>
              </View>
              <Text style={styles.historySubtitle}>
                {historyEntries.length > 0
                  ? "Previous disease records and scans for this chicken are preserved in reverse chronological order."
                  : "All current and past disease records for this chicken will be preserved here."}
              </Text>

              {historyEntries.length > 0 ? (
                <View style={styles.historyList}>
                  {historyEntries.map((scan) => {
                    const historyBehaviorLabels = mapBehaviorIdsToLabels(
                      scan.behaviorIds,
                      behaviorItems,
                    );
                    const isScanRecovered =
                      scan.actionStatus === "Recovered" ||
                      scan.actionStatus === "Resolved";

                    return (
                      <TouchableOpacity
                        key={scan.id}
                        style={styles.historyEntryCard}
                        onPress={() => setSelectedDiseaseId(scan.id)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.historyEntryHeader}>
                          <Text style={styles.historyEntryTitle}>
                            {formatScanDate(scan.savedAt)}
                          </Text>
                          <View
                            style={[
                              styles.historyStatusBadge,
                              isScanRecovered
                                ? styles.historyStatusRecovered
                                : styles.historyStatusActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.historyStatusBadgeText,
                                isScanRecovered
                                  ? styles.historyStatusRecoveredText
                                  : styles.historyStatusActiveText,
                              ]}
                            >
                              {scan.actionStatus || "Active"}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.historyEntryDisease}>
                          {scan.detectedIllness}
                        </Text>
                        <Text style={styles.historyEntryValue}>
                          {historyBehaviorLabels.length > 0
                            ? historyBehaviorLabels.join(", ")
                            : "No specific behaviors recorded"}
                        </Text>
                        {scan.additionalObservation?.trim() ? (
                          <Text style={styles.historyEntryValue}>
                            Note: {scan.additionalObservation.trim()}
                          </Text>
                        ) : null}
                        <View style={styles.historyViewDetailsRow}>
                          <Text style={styles.historyViewDetailsText}>
                            View protocol & tasks
                          </Text>
                          <MaterialCommunityIcons
                            name="chevron-right"
                            size={16}
                            color={ChickIntelPalette.green1}
                          />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

      {/* Task Completion Confirmation Modal */}
      <Modal
        visible={pendingTreatmentCompletion !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingTreatmentCompletion(null)}
      >
        <View style={styles.confirmModalBackdrop}>
          <View style={styles.confirmModalCard}>
            <View style={styles.confirmModalTopRow}>
              <View style={styles.confirmIconBadge}>
                <MaterialCommunityIcons
                  name="medical-bag"
                  size={23}
                  color={ChickIntelPalette.green1}
                />
              </View>
              <TouchableOpacity
                onPress={() => setPendingTreatmentCompletion(null)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close treatment confirmation"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={ChickIntelPalette.gray2}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.confirmModalTitle}>Complete treatment?</Text>
            <Text style={styles.confirmModalBody}>
              Confirm this treatment was completed for this monitored chicken.
            </Text>
            <View style={styles.confirmDetailsBox}>
              <View style={styles.confirmDetailRow}>
                <Text style={styles.confirmDetailLabel}>Chicken</Text>
                <Text style={styles.confirmDetailValue}>{record.chtTag}</Text>
              </View>
              <View style={styles.confirmDetailRow}>
                <Text style={styles.confirmDetailLabel}>Disease</Text>
                <Text style={styles.confirmDetailValue}>
                  {currentHealthLog?.detectedIllness}
                </Text>
              </View>
              <View style={styles.confirmDetailRow}>
                <Text style={styles.confirmDetailLabel}>Task</Text>
                <Text style={styles.confirmDetailValue} numberOfLines={2}>
                  {pendingTreatmentCompletion?.task.title}
                </Text>
              </View>
              <View style={styles.confirmDetailRow}>
                <Text style={styles.confirmDetailLabel}>Due</Text>
                <Text style={styles.confirmDetailValue}>
                  {pendingTreatmentCompletion
                    ? formatScanDate(
                        pendingTreatmentCompletion.occurrence.dueAt,
                      )
                    : ""}
                </Text>
              </View>
            </View>
            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setPendingTreatmentCompletion(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDoneButton}
                onPress={() => void confirmTreatmentCompletion()}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={17}
                  color="#FFFFFF"
                />
                <Text style={styles.confirmDoneText}>Mark as done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Resolve Disease Confirmation Modal */}
      <Modal
        visible={resolveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResolveModalVisible(false)}
      >
        <View style={styles.confirmModalBackdrop}>
          <View style={styles.confirmModalCard}>
            <View style={styles.confirmModalTopRow}>
              <View style={styles.confirmIconBadge}>
                <MaterialCommunityIcons
                  name="checkbox-marked-circle-outline"
                  size={24}
                  color={ChickIntelPalette.green1}
                />
              </View>
              <TouchableOpacity
                onPress={() => setResolveModalVisible(false)}
                hitSlop={10}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={ChickIntelPalette.gray2}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.confirmModalTitle}>Mark as Recovered?</Text>
            <Text style={styles.confirmModalBody}>
              {`Are you sure ${currentHealthLog?.detectedIllness} has fully resolved for ${record.chtTag}? This disease record will be saved in Health History.`}
            </Text>
            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={styles.confirmCancelButton}
                onPress={() => setResolveModalVisible(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDoneButton}
                onPress={() => void confirmResolveDisease()}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="check"
                  size={17}
                  color="#FFFFFF"
                />
                <Text style={styles.confirmDoneText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Treatment Note Editor Modal */}
      <Modal
        visible={noteModalContext !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteModalContext(null)}
      >
        <KeyboardAvoidingView
          style={styles.noteKeyboardAvoiding}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.noteModalBackdrop}>
            <View style={styles.noteModalCard}>
              <View style={styles.noteModalHeader}>
                <View style={styles.noteModalTitleWrap}>
                  <MaterialCommunityIcons
                    name="note-edit-outline"
                    size={20}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.noteModalTitle}>Treatment Note</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setNoteModalContext(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Close treatment note editor"
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={21}
                    color={ChickIntelPalette.gray2}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.noteModalTaskTitle}>
                {noteModalContext?.task.title}
              </Text>
              <TextInput
                autoFocus
                value={
                  noteModalContext
                    ? (treatmentNotes[noteModalContext.occurrence.id] ??
                      noteModalContext.occurrence.treatmentNote ??
                      "")
                    : ""
                }
                onChangeText={(value) => {
                  if (!noteModalContext) return;
                  setTreatmentNotes((previous) => ({
                    ...previous,
                    [noteModalContext.occurrence.id]: value,
                  }));
                }}
                placeholder="What happened during this treatment?"
                placeholderTextColor={ChickIntelPalette.gray2}
                style={styles.noteModalInput}
                multiline
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={styles.noteModalSaveButton}
                onPress={() => {
                  if (noteModalContext) {
                    void saveTreatmentNote(
                      noteModalContext.task,
                      noteModalContext.occurrence,
                    );
                  }
                }}
                accessibilityRole="button"
              >
                <Text style={styles.noteModalSaveText}>Save Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.canvas,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(16),
    marginBottom: 12,
    gap: 10,
  },
  backBtn: {
    width: scale(38),
    height: verticalScale(38),
    borderRadius: 12,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  scroll: {
    paddingHorizontal: moderateScale(16),
  },
  pageTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.55,
    color: ChickIntelPalette.gray1,
    flex: 1,
    textAlign: "center",
  },
  chtTag: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
    letterSpacing: -0.2,
    marginTop: 6,
  },
  topMeta: {
    alignItems: "flex-end",
  },
  monitoringStatus: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: "rgba(51, 51, 51, 0.62)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: moderateScale(4),
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: "#5A6262",
    textTransform: "uppercase",
    letterSpacing: 0.25,
    marginBottom: 2,
  },
  metaValue: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  addDiseaseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ChickIntelPalette.green1,
    borderRadius: 12,
    paddingVertical: verticalScale(12),
    paddingHorizontal: moderateScale(16),
    marginBottom: 14,
    shadowColor: ChickIntelPalette.green1,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: scale(0), height: verticalScale(4) },
    elevation: 3,
  },
  addDiseaseButtonText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  diseaseSelectorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
    padding: moderateScale(12),
    marginBottom: 14,
    gap: 8,
  },
  diseaseSelectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  diseaseSelectorLabel: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(12),
    fontWeight: "800",
    color: "#9A4D00",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  diseasePillRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  diseasePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(7),
    borderRadius: 20,
    backgroundColor: "rgba(247, 192, 144, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(247, 192, 144, 0.45)",
  },
  diseasePillActive: {
    backgroundColor: ChickIntelPalette.green1,
    borderColor: ChickIntelPalette.green1,
  },
  diseasePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#C17B31",
  },
  diseasePillDotActive: {
    backgroundColor: ChickIntelPalette.accent,
  },
  diseasePillText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  diseasePillTextActive: {
    color: "#FFFFFF",
  },
  protocolSection: {
    marginTop: 14,
    marginBottom: 14,
    padding: moderateScale(14),
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
    gap: 8,
  },
  protocolHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  protocolTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  protocolHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  diseaseBadge: {
    backgroundColor: "rgba(247, 192, 144, 0.22)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(247, 192, 144, 0.65)",
  },
  diseaseBadgeText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    color: "#9A4D00",
  },
  protocolFilterRow: {
    flexDirection: "row",
    gap: 6,
    padding: 3,
    borderRadius: 9,
    backgroundColor: ChickIntelPalette.lightGreen,
  },
  protocolFilterItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 7,
  },
  protocolFilterItemActive: {
    backgroundColor: ChickIntelPalette.green1,
  },
  protocolFilterText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  protocolFilterTextActive: {
    color: "#FFFFFF",
  },
  protocolTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
  },
  protocolSubtitle: {
    marginTop: 2,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: ChickIntelPalette.textMuted,
  },
  protocolTaskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 5,
  },
  protocolTaskToggle: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  protocolTaskCard: {
    borderTopWidth: 1,
    borderTopColor: ChickIntelPalette.lightGreen,
    paddingTop: 8,
  },
  protocolTaskCardOverdue: {
    borderTopColor: "rgba(180, 83, 9, 0.28)",
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderRadius: 9,
    paddingHorizontal: 8,
  },
  protocolDayGroup: {
    gap: 4,
  },
  protocolDayHeader: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  protocolDayDate: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.textMuted,
  },
  protocolTaskCopy: {
    flex: 1,
    gap: 2,
  },
  protocolTaskText: {
    flex: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 19,
    color: ChickIntelPalette.gray1,
  },
  protocolTaskTextCompleted: {
    color: ChickIntelPalette.textMuted,
    textDecorationLine: "line-through",
  },
  protocolTaskDescription: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 16,
    color: ChickIntelPalette.textMuted,
  },
  protocolTaskMeta: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: ChickIntelPalette.textMuted,
  },
  protocolTaskMetaOverdue: {
    color: "#B45309",
    fontWeight: "800",
  },
  protocolTaskMetaBlocked: {
    color: ChickIntelPalette.textMuted,
    fontWeight: "700",
  },
  protocolNotePreview: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 6,
    marginLeft: 30,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: ChickIntelPalette.lightGreen,
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
  },
  protocolNoteCopy: {
    flex: 1,
    gap: 2,
  },
  protocolNoteLabel: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(10),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
    textTransform: "uppercase",
    letterSpacing: 0.35,
  },
  protocolNoteText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 17,
    color: ChickIntelPalette.gray1,
  },
  protocolDayTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(247, 192, 144, 0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(247, 192, 144, 0.5)",
  },
  protocolGroupTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(11.5),
    fontWeight: "800",
    color: "#8F4800",
    textTransform: "uppercase",
    letterSpacing: 0.25,
  },
  protocolEmptyText: {
    marginTop: 10,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: ChickIntelPalette.textMuted,
    textAlign: "center",
  },
  protocolNoteIconButton: {
    width: 32,
    height: 32,
    marginTop: 2,
    flexShrink: 0,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ChickIntelPalette.lightGreen,
  },
  resolveDiseaseBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
    paddingVertical: verticalScale(10),
    paddingHorizontal: moderateScale(14),
    borderRadius: 10,
    backgroundColor: ChickIntelPalette.lightGreen,
    borderWidth: 1,
    borderColor: ChickIntelPalette.mediumGreen,
  },
  resolveDiseaseBtnText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12.5),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  noteModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: moderateScale(18),
    backgroundColor: "rgba(31, 46, 43, 0.45)",
  },
  noteKeyboardAvoiding: {
    flex: 1,
  },
  noteModalCard: {
    borderRadius: 16,
    padding: moderateScale(16),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
    maxHeight: "88%",
    gap: 10,
  },
  noteModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  noteModalTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  noteModalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  noteModalTaskTitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  noteModalInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 19,
    color: ChickIntelPalette.gray1,
    backgroundColor: ChickIntelPalette.lightGreen,
  },
  noteModalSaveButton: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 9,
    backgroundColor: ChickIntelPalette.green1,
  },
  noteModalSaveText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  historySection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: ChickIntelPalette.gray2,
  },
  historyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 4,
  },
  historyTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
  },
  historySubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 16,
    color: ChickIntelPalette.textMuted,
    marginBottom: 12,
  },
  historyList: {
    gap: 10,
  },
  historyEntryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
    gap: 4,
  },
  historyEntryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyEntryTitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.textMuted,
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  historyStatusRecovered: {
    backgroundColor: ChickIntelPalette.lightGreen,
    borderColor: ChickIntelPalette.mediumGreen,
  },
  historyStatusActive: {
    backgroundColor: "rgba(247, 192, 144, 0.22)",
    borderColor: "rgba(247, 192, 144, 0.65)",
  },
  historyStatusBadgeText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "800",
    textTransform: "uppercase",
  },
  historyStatusRecoveredText: {
    color: ChickIntelPalette.green1,
  },
  historyStatusActiveText: {
    color: "#9A4D00",
  },
  historyEntryDisease: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  historyEntryValue: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "#5A6161",
  },
  historyViewDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    marginTop: 4,
  },
  historyViewDetailsText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  confirmModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: moderateScale(20),
    backgroundColor: "rgba(31, 46, 43, 0.45)",
  },
  confirmModalCard: {
    borderRadius: 20,
    padding: moderateScale(16),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    gap: 7,
  },
  confirmIconBadge: {
    width: scale(42),
    height: verticalScale(42),
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ChickIntelPalette.lightGreen,
  },
  confirmModalTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  confirmModalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  confirmModalBody: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 19,
    color: ChickIntelPalette.textMuted,
  },
  confirmDetailsBox: {
    marginTop: 2,
    padding: moderateScale(10),
    borderRadius: 12,
    backgroundColor: "rgba(49, 118, 103, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.12)",
    gap: 6,
  },
  confirmDetailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  confirmDetailLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.textMuted,
    textTransform: "uppercase",
  },
  confirmDetailValue: {
    flex: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    textAlign: "right",
  },
  confirmModalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  confirmCancelButton: {
    flex: 1,
    minHeight: verticalScale(44),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.2)",
    backgroundColor: "#FFFFFF",
  },
  confirmCancelText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  confirmDoneButton: {
    flex: 1.3,
    minHeight: verticalScale(44),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 11,
    backgroundColor: ChickIntelPalette.green1,
  },
  confirmDoneText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  cardSpacer: {
    height: verticalScale(8),
  },
});
