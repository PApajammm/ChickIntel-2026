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

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { HealthInputSummaryCard } from "@/components/health-scan/health-input-summary-card";
import { HealthResultCard } from "@/components/health-scan/health-result-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { HealthTypography } from "@/constants/health-typography";
import { useBehaviors } from "@/hooks/use-behaviors";
import { useAuth } from "@/providers/auth-provider";
import { logError } from "@/utils/logger";
import { mapBehaviorIdsToLabels } from "@/utils/supabase-behaviors";
import {
    fetchDiseaseDetails,
    type DiseaseDetails,
} from "@/utils/supabase-diseases";
import type { HealthJournalSavedScan } from "@/utils/supabase-health-journal";
import {
    fetchHealthMonitoringRecordById,
    fetchHealthMonitoringScanHistory,
    fetchHealthMonitoringTasks,
    updateHealthMonitoringTaskOccurrence,
    type HealthMonitoringRecord,
    type HealthMonitoringTask,
    type HealthMonitoringTaskOccurrence,
} from "@/utils/supabase-health-monitoring";

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

  const currentHealthLog = scanHistory[0] ?? record?.healthLog;

  const historyEntries = useMemo(() => {
    if (scanHistory.length <= 1) return [];
    return scanHistory.slice(1);
  }, [scanHistory]);

  const behaviorLabels = useMemo(
    () =>
      currentHealthLog
        ? mapBehaviorIdsToLabels(currentHealthLog.behaviorIds, behaviorItems)
        : [],
    [currentHealthLog, behaviorItems],
  );

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

  const openRescan = useCallback(async () => {
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
      },
    } as never);
  }, [cameraPermission?.granted, record, requestCameraPermission, router]);

  const toggleTreatmentOccurrence = useCallback(
    (
      task: HealthMonitoringTask,
      occurrence: HealthMonitoringTaskOccurrence,
    ) => {
      if (!activeFarm?.id || occurrence.completed) return;
      setPendingTreatmentCompletion({ task, occurrence });
    },
    [activeFarm?.id],
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

  if (!record) {
    return null;
  }

  const healthLog = currentHealthLog;
  const resultSeverity =
    healthLog?.actionStatus === "Isolation" ||
    diseaseDetails?.severity === "high" ||
    diseaseDetails?.severity === "critical";
  const canRescan = record.monitoringStatus === "Active";
  const monitoringDays = getMonitoringDays(
    record.createdAt,
    record.monitoringCompletedAt,
  );
  const treatmentOccurrences = treatmentTasks.flatMap((task) =>
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
          record.createdAt,
          item.occurrence.dueAt,
        ),
        items: [item],
      },
    ];
  }, []);

  const renderTreatmentOccurrence = ({
    task,
    occurrence,
  }: {
    task: HealthMonitoringTask;
    occurrence: HealthMonitoringTaskOccurrence;
  }) => {
    const isOverdue = occurrence.status === "Overdue";

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
            disabled={occurrence.completed}
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: occurrence.completed,
              disabled: occurrence.completed,
            }}
          >
            <MaterialCommunityIcons
              name={
                occurrence.completed
                  ? "checkbox-marked"
                  : "checkbox-blank-outline"
              }
              size={22}
              color={
                occurrence.completed
                  ? ChickIntelPalette.green1
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
            </View>
          </Pressable>
          <TouchableOpacity
            style={styles.protocolNoteIconButton}
            onPress={() => openNoteEditor(task, occurrence)}
            accessibilityRole="button"
            accessibilityLabel={`Add note for ${task.title}`}
          >
            <MaterialCommunityIcons
              name="pencil-outline"
              size={17}
              color={ChickIntelPalette.green1}
            />
          </TouchableOpacity>
        </View>
        <Text style={styles.protocolTaskMeta}>
          {formatScanDate(occurrence.dueAt)}
          {occurrence.treatmentNote
            ? ` | Note: ${occurrence.treatmentNote}`
            : ""}
        </Text>
      </View>
    );
  };

  const dateAdded = record.createdAt
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
      <BackgroundGradient
        width="110%"
        height="110%"
        preserveAspectRatio="xMidYMid slice"
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ scale: 1.08 }, { translateY: -14 }] },
        ]}
      />
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backBtn}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Health Monitoring</Text>
        <View style={styles.topMeta}>
          <Text style={styles.chtTag}>{record.chtTag}</Text>
          <Text style={styles.monitoringStatus}>{record.monitoringStatus}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 15 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Batch No.</Text>
            <Text style={styles.metaValue}>{record.batchNo ?? "-"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Date Added</Text>
            <Text style={styles.metaValue}>{dateAdded}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Monitoring Days</Text>
            <Text style={styles.metaValue}>{monitoringDays} days</Text>
          </View>
        </View>

        {canRescan ? (
          <Pressable
            onPress={() => void openRescan()}
            style={({ pressed }) => [
              styles.retakeButton,
              { opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <MaterialCommunityIcons
              name="camera-outline"
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.retakeButtonText}>Re-take Picture</Text>
          </Pressable>
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
                <View>
                  <Text style={styles.protocolTitle}>Treatment Protocol</Text>
                  <Text style={styles.protocolSubtitle}>
                    {treatmentOccurrences.length > 0
                      ? `${completedOccurrenceCount}/${treatmentOccurrences.length} occurrences completed`
                      : "No treatment tasks were provided for this result."}
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
                          <Text style={styles.protocolGroupTitle}>
                            Day {group.dayNumber}
                          </Text>
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
                </>
              ) : null}
            </View>
            <View style={styles.historySection}>
              <Text style={styles.historyTitle}>Health History</Text>
              <Text style={styles.historySubtitle}>
                {historyEntries.length > 0
                  ? "Prior scans and retakes for this chicken are listed below in reverse chronological order."
                  : "Initial assessment recorded above. Previous retake and update scans for this chicken will appear here."}
              </Text>

              {historyEntries.length > 0 ? (
                <View style={styles.historyList}>
                  {historyEntries.map((scan) => {
                    const historyBehaviorLabels = mapBehaviorIdsToLabels(
                      scan.behaviorIds,
                      behaviorItems,
                    );

                    return (
                      <View key={scan.id} style={styles.historyEntryCard}>
                        <View style={styles.historyEntryHeader}>
                          <Text style={styles.historyEntryTitle}>
                            {formatScanDate(scan.savedAt)}
                          </Text>
                          <Text style={styles.historyEntryStatus}>
                            {scan.actionStatus || "Monitoring"}
                          </Text>
                        </View>
                        <Text style={styles.historyEntryDisease}>
                          {scan.detectedIllness}
                        </Text>
                        <Text style={styles.historyEntryValue}>
                          {historyBehaviorLabels.length > 0
                            ? historyBehaviorLabels.join(", ")
                            : "No behaviors recorded"}
                        </Text>
                        <Text style={styles.historyEntryValue}>
                          {scan.additionalObservation?.trim() ||
                            "No observation added"}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>

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

      <Modal
        visible={noteModalContext !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteModalContext(null)}
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
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.light1,
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
    width: scale(42),
    height: verticalScale(42),
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.green1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.25)",
    shadowColor: "#317667",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(4) },
    elevation: 4,
    flexShrink: 0,
  },
  savedMeta: {
    ...HealthTypography.meta,
    fontSize: responsiveFontSize(12),
    marginTop: 8,
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
  retakeButton: {
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
  retakeButtonText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  protocolSection: {
    marginTop: 14,
    marginBottom: 14,
    padding: moderateScale(14),
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
    gap: 8,
  },
  protocolHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  protocolHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  protocolFilterRow: {
    flexDirection: "row",
    gap: 6,
    padding: 3,
    borderRadius: 9,
    backgroundColor: "rgba(49, 118, 103, 0.08)",
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
    borderTopColor: "rgba(49, 118, 103, 0.12)",
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
  protocolGroupTitle: {
    marginTop: 6,
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(12),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    textTransform: "uppercase",
  },
  protocolEmptyText: {
    marginTop: 10,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: ChickIntelPalette.textMuted,
    textAlign: "center",
  },
  protocolNoteInput: {
    minHeight: 38,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: ChickIntelPalette.gray1,
    backgroundColor: "rgba(244, 248, 247, 0.7)",
  },
  protocolNoteButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: ChickIntelPalette.green1,
  },
  protocolNoteButtonText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  protocolSavedNote: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 16,
    color: ChickIntelPalette.gray1,
  },
  protocolNoteIconButton: {
    width: 32,
    height: 32,
    marginTop: 2,
    flexShrink: 0,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(49, 118, 103, 0.1)",
  },
  noteModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: moderateScale(18),
    backgroundColor: "rgba(20, 31, 29, 0.42)",
  },
  noteModalCard: {
    borderRadius: 14,
    padding: moderateScale(16),
    backgroundColor: "#FFFFFF",
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
    borderColor: "rgba(49, 118, 103, 0.2)",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 19,
    color: ChickIntelPalette.gray1,
    backgroundColor: "rgba(244, 248, 247, 0.7)",
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
    borderTopColor: "rgba(49, 118, 103, 0.14)",
  },
  historyTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
    marginBottom: 4,
  },
  historySubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 16,
    color: "#5A6161",
    marginBottom: 12,
  },
  historyList: {
    gap: 10,
  },
  historyEntryCard: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 12,
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
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
  confirmModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: moderateScale(20),
    backgroundColor: "rgba(22, 38, 32, 0.48)",
  },
  confirmModalCard: {
    borderRadius: 20,
    padding: moderateScale(16),
    backgroundColor: "#F8FCFA",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.2)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    gap: 7,
  },
  confirmIconBadge: {
    width: scale(42),
    height: verticalScale(42),
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(49, 118, 103, 0.13)",
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
  historyEntryStatus: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
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
  cardSpacer: {
    height: verticalScale(8),
  },
});
