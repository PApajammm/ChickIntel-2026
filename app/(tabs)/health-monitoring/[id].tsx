import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCameraPermissions } from "expo-camera";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { HealthInputSummaryCard } from "@/components/health-scan/health-input-summary-card";
import { HealthResultCard } from "@/components/health-scan/health-result-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { HealthTypography } from "@/constants/health-typography";
import { useBehaviors } from "@/hooks/use-behaviors";
import { useAuth } from "@/providers/auth-provider";
import { logError } from "@/utils/logger";
import {
  fetchDiseaseDetails,
  type DiseaseDetails,
} from "@/utils/supabase-diseases";
import type { HealthJournalSavedScan } from "@/utils/supabase-health-journal";
import {
  fetchHealthMonitoringRecordById,
  fetchHealthMonitoringScanHistory,
  type HealthMonitoringRecord,
} from "@/utils/supabase-health-monitoring";
import { mapBehaviorIdsToLabels } from "@/utils/supabase-behaviors";

const TAB_BAR_OFFSET = 55;

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
  return `${m}/${day}/${y} • ${displayHours}:${minutes} ${suffix}`;
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
      const [nextRecord, history] = await Promise.all([
        fetchHealthMonitoringRecordById(activeFarm.id, id),
        fetchHealthMonitoringScanHistory(activeFarm.id, id),
      ]);

      if (!nextRecord) {
        router.back();
        return;
      }

      setRecord(nextRecord);
      setScanHistory(history);
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

  if (!record) {
    return null;
  }

  const healthLog = currentHealthLog;
  const resultSeverity =
    healthLog?.actionStatus === "Isolation" ||
    diseaseDetails?.severity === "high" ||
    diseaseDetails?.severity === "critical";
  const canRescan = record.monitoringStatus === "Active";

  const dateAdded = record.createdAt
    ? new Date(record.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  const lastUpdated = record.updatedAt
    ? new Date(record.updatedAt).toLocaleDateString("en-US", {
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
          <MaterialCommunityIcons
            name="arrow-left"
            size={22}
            color="#FFF"
          />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Health Monitoring</Text>
        <View style={styles.topMeta}>
          <Text style={styles.chtTag}>{record.chtTag}</Text>
          <Text style={styles.monitoringStatus}>{record.monitoringStatus}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + TAB_BAR_OFFSET + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Batch No.</Text>
            <Text style={styles.metaValue}>{record.batchNo ?? "—"}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Date Added</Text>
            <Text style={styles.metaValue}>{dateAdded}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Last Updated</Text>
            <Text style={styles.metaValue}>{lastUpdated}</Text>
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
    color: ChickIntelPalette.gray2,
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
