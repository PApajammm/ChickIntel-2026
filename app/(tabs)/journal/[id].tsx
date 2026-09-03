import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { HealthInputSummaryCard } from "@/components/health-scan/health-input-summary-card";
import { HealthResultCard } from "@/components/health-scan/health-result-card";
import { BlurCard } from "@/components/ui/blur-card";
import { ChipList } from "@/components/ui/chip-list";
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
import {
    fetchHealthJournalEntryById,
    formatJournalDateTime,
    type HealthJournalSavedScan,
} from "@/utils/supabase-health-journal";
import { fetchHealthMonitoringScanHistory } from "@/utils/supabase-health-monitoring";

export default function JournalDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeFarm, configured } = useAuth();
  const { id: idParam } = useLocalSearchParams<{
    id: string | string[];
  }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const [entry, setEntry] = useState<HealthJournalSavedScan | undefined>();
  const [scanHistory, setScanHistory] = useState<HealthJournalSavedScan[]>([]);
  const [diseaseDetails, setDiseaseDetails] = useState<DiseaseDetails | null>(
    null,
  );
  const { behaviors: behaviorItems } = useBehaviors();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/journal");
    }
  };

  const behaviorLabels = useMemo(
    () =>
      entry ? mapBehaviorIdsToLabels(entry.behaviorIds, behaviorItems) : [],
    [entry, behaviorItems],
  );

  const historyEntries = useMemo(() => {
    if (!entry || scanHistory.length === 0) return [];
    return scanHistory.filter((s) => s.id !== entry.id);
  }, [entry, scanHistory]);

  useEffect(() => {
    if (typeof id !== "string" || !id || !configured || !activeFarm?.id) {
      setEntry(undefined);
      setScanHistory([]);
      return;
    }

    let cancelled = false;

    fetchHealthJournalEntryById(activeFarm.id, id)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          handleBack();
          return;
        }
        setEntry(result);

        if (result.healthMonitoringId) {
          fetchHealthMonitoringScanHistory(
            activeFarm.id,
            result.healthMonitoringId,
          )
            .then((history) => {
              if (!cancelled) setScanHistory(history);
            })
            .catch(() => {
              if (!cancelled) setScanHistory([]);
            });
        } else {
          setScanHistory([]);
        }

        if (result.diseaseId) {
          fetchDiseaseDetails(result.diseaseId)
            .then((details) => {
              if (!cancelled) setDiseaseDetails(details);
            })
            .catch(() => {
              if (!cancelled) setDiseaseDetails(null);
            });
        } else {
          setDiseaseDetails(null);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        logError("Health journal detail load failed", error, {
          farmId: activeFarm.id,
          id,
        });
        handleBack();
      });

    return () => {
      cancelled = true;
    };
  }, [activeFarm?.id, configured, id]);

  if (!entry) {
    return null;
  }

  const resultSeverity =
    entry.actionStatus === "Isolation" ||
    diseaseDetails?.severity === "high" ||
    diseaseDetails?.severity === "critical";

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
        <Text style={styles.pageTitle}>Behavior Journal</Text>
        <Text style={styles.savedMeta}>
          {formatJournalDateTime(entry.savedAt)}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 15 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Observed Behaviors Header Card */}
        <BlurCard
          style={styles.observedBehaviorsCard}
          borderRadius={10}
          intensity={20}
        >
          <View style={styles.observedBehaviorsInner}>
            <View style={styles.observedHeaderRow}>
              <View style={styles.observedTitleGroup}>
                <MaterialCommunityIcons
                  name="eye-check-outline"
                  size={16}
                  color={ChickIntelPalette.green1}
                />
                <Text style={styles.observedHeaderLabel}>
                  OBSERVED BEHAVIORS
                </Text>
              </View>
              {behaviorLabels.length > 0 ? (
                <View style={styles.observedCountBadge}>
                  <Text style={styles.observedCountText}>
                    {behaviorLabels.length}{" "}
                    {behaviorLabels.length === 1 ? "trait" : "traits"}
                  </Text>
                </View>
              ) : null}
            </View>

            {behaviorLabels.length > 0 ? (
              <View style={styles.observedChipsWrap}>
                <ChipList labels={behaviorLabels} />
              </View>
            ) : (
              <Text style={styles.noBehaviorsText}>
                No observed behaviors recorded
              </Text>
            )}
          </View>
        </BlurCard>

        <View style={styles.cardSpacer} />

        {/* Disease Information - Supporting Information */}
        <HealthInputSummaryCard
          photoUri={entry.photoUri}
          detectedIllness={entry.detectedIllness}
          detectionDescription={diseaseDetails?.description}
          additionalObservation={entry.additionalObservation}
        />

        <View style={styles.cardSpacer} />

        <HealthResultCard
          resultSeverity={resultSeverity}
          diseaseName={entry.detectedIllness}
          resultSummary={diseaseDetails?.diseaseName ?? entry.resultSummary}
          resultDescription={diseaseDetails?.description}
          recommendationText={entry.recommendationText}
          treatmentSteps={diseaseDetails?.treatmentSteps}
          actionStatus={entry.actionStatus}
          durationValue={entry.durationValue}
        />

        {historyEntries.length > 0 ? (
          <View style={styles.historySection}>
            <Text style={styles.historyTitle}>Health History</Text>
            <Text style={styles.historySubtitle}>
              Prior scans and retakes for this chicken are listed below in
              reverse chronological order.
            </Text>

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
                        {formatJournalDateTime(scan.savedAt)}
                      </Text>
                      <Text style={styles.historyEntryStatus}>
                        {scan.actionStatus || "Recorded"}
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
          </View>
        ) : null}
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
  cardSpacer: {
    height: verticalScale(8),
  },
  observedBehaviorsCard: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
    position: "relative",
  },
  observedBehaviorsInner: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(14),
    gap: 10,
  },
  observedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  observedTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  observedHeaderLabel: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  observedCountBadge: {
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(2),
    borderRadius: 6,
  },
  observedCountText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  observedChipsWrap: {
    marginTop: 2,
  },
  noBehaviorsText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.gray2,
    fontStyle: "italic",
  },
  behaviorSection: {
    backgroundColor: "rgba(202, 227, 221, 0.4)",
    borderRadius: 12,
    padding: moderateScale(14),
    marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
    marginBottom: 8,
    letterSpacing: -0.1,
  },
  behaviorChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  behaviorChip: {
    backgroundColor: ChickIntelPalette.lightGreen,
    borderRadius: 8,
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(5),
  },
  behaviorChipText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  observationText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    lineHeight: 20,
    fontWeight: "500",
    color: ChickIntelPalette.gray1,
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
});
