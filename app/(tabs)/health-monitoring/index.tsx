import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useMemo, useState } from "react";
import {
    FlatList,
    ListRenderItem,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { BlurCard } from "@/components/ui/blur-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { HealthTypography } from "@/constants/health-typography";
import { useAuth } from "@/providers/auth-provider";
import { logError } from "@/utils/logger";
import {
    fetchHealthMonitoringRecords,
    type HealthMonitoringRecord,
    type HealthMonitoringStatus,
    updateHealthMonitoringStatus,
} from "@/utils/supabase-health-monitoring";

type HealthMonitoringTab = "Active" | "History";
type PendingStatusChange = {
  record: HealthMonitoringRecord;
  monitoringStatus: Exclude<HealthMonitoringStatus, "Active">;
};

function formatDate(dateValue?: string) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

function getMonitoringStatusTheme(status?: string, illness?: string) {
  const normStatus = (status ?? "").toLowerCase().trim();

  // 1. Recovered -> GREEN
  if (normStatus === "recovered") {
    return {
      accentColor: ChickIntelPalette.green1,
      badgeBg: ChickIntelPalette.lightGreen,
      badgeText: ChickIntelPalette.green1,
      badgeBorder: "rgba(64, 83, 77, 0.25)",
      label: "Recovered",
    };
  }

  // 2. Dead / Deceased -> MAROON ALERT
  if (normStatus === "deceased" || normStatus === "dead") {
    return {
      accentColor: "#923737",
      badgeBg: "rgba(146, 55, 55, 0.10)",
      badgeText: "#923737",
      badgeBorder: "rgba(146, 55, 55, 0.25)",
      label: "Deceased",
    };
  }

  // 3. Isolated / Isolation -> ACCENT PEACH
  if (normStatus === "isolated" || normStatus === "isolation") {
    return {
      accentColor: ChickIntelPalette.accent,
      badgeBg: "rgba(247, 192, 144, 0.25)",
      badgeText: ChickIntelPalette.gray1,
      badgeBorder: "rgba(247, 192, 144, 0.6)",
      label: "Isolated",
    };
  }

  // 4. Monitored / Monitoring / Active -> SAGE / NEUTRAL
  let displayLabel = status?.trim();
  if (!displayLabel || displayLabel.toLowerCase() === "unknown") {
    displayLabel = "Active";
  }

  return {
    accentColor: ChickIntelPalette.mediumGreen,
    badgeBg: ChickIntelPalette.lightGreen,
    badgeText: ChickIntelPalette.gray1,
    badgeBorder: ChickIntelPalette.mediumGreen,
    label: displayLabel,
  };
}

export default function HealthMonitoringIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeFarm, configured } = useAuth();
  const [records, setRecords] = useState<HealthMonitoringRecord[]>([]);
  const [selectedTab, setSelectedTab] = useState<HealthMonitoringTab>("Active");
  const [pendingStatusChange, setPendingStatusChange] =
    useState<PendingStatusChange | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(
    null,
  );

  const refresh = useCallback(async () => {
    if (!configured || !activeFarm?.id) {
      setRecords([]);
      return;
    }

    try {
      const nextRecords = await fetchHealthMonitoringRecords(
        activeFarm.id,
        true,
      );
      setRecords(nextRecords);
    } catch (error) {
      logError("Health monitoring load failed", error, {
        farmId: activeFarm.id,
      });
      setRecords([]);
    }
  }, [activeFarm?.id, configured]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const displayedRecords = useMemo(() => {
    if (selectedTab === "Active") {
      return records.filter((record) => record.monitoringStatus === "Active");
    }

    return records.filter((record) => record.monitoringStatus !== "Active");
  }, [records, selectedTab]);

  const completeMonitoring = useCallback(
    async (
      record: HealthMonitoringRecord,
      monitoringStatus: Exclude<HealthMonitoringStatus, "Active">,
    ) => {
      if (!activeFarm?.id) {
        setStatusUpdateError("No active farm selected. Please sign in again.");
        return;
      }

      const completedAt = new Date().toISOString();

      setRecords((prev) =>
        prev.map((entry) =>
          entry.id === record.id
            ? {
                ...entry,
                monitoringStatus,
                monitoringCompletedAt: completedAt,
              }
            : entry,
        ),
      );
      setSelectedTab("History");

      try {
        await updateHealthMonitoringStatus(
          activeFarm.id,
          record.id,
          monitoringStatus,
        );
        await refresh();
      } catch (error) {
        logError("Health monitoring status update failed", error, {
          farmId: activeFarm.id,
          id: record.id,
          monitoringStatus,
        });
        setStatusUpdateError(
          "Unable to update this monitoring record. Please try again.",
        );
        await refresh();
      }
    },
    [activeFarm?.id, refresh],
  );

  const openStatusChangeConfirm = useCallback(
    (
      record: HealthMonitoringRecord,
      monitoringStatus: Exclude<HealthMonitoringStatus, "Active">,
    ) => {
      setStatusUpdateError(null);
      setPendingStatusChange({ record, monitoringStatus });
    },
    [],
  );

  const confirmPendingStatusChange = useCallback(() => {
    if (!pendingStatusChange) return;

    const { record, monitoringStatus } = pendingStatusChange;
    setPendingStatusChange(null);
    void completeMonitoring(record, monitoringStatus);
  }, [completeMonitoring, pendingStatusChange]);

  const renderItem: ListRenderItem<HealthMonitoringRecord> = useCallback(
    ({ item }) => {
      const disease = item.healthLog?.detectedIllness ?? "Unknown";
      const isHistory = selectedTab === "History";
      const status = isHistory
        ? item.monitoringStatus
        : (item.healthLog?.actionStatus ?? "Active");
      const date = formatDate(
        isHistory
          ? (item.monitoringCompletedAt ?? item.updatedAt)
          : item.createdAt,
      );
      const batchNo = item.batchNo ?? "No Batch";
      const theme = getMonitoringStatusTheme(status, disease);

      return (
        <BlurCard style={styles.card} borderRadius={10} intensity={20}>
          <Pressable
            onPress={() =>
              router.push(`/(tabs)/health-monitoring/${item.id}` as any)
            }
            style={({ pressed }) => [
              styles.cardPressable,
              { opacity: pressed ? 0.92 : 1 },
            ]}
          >
            {/* Header: CHT Tag + Status Pill */}
            <View style={styles.cardHeader}>
              <View style={styles.leftTagWrap}>
                <View style={styles.chtPillBadge}>
                  <MaterialCommunityIcons
                    name="tag-outline"
                    size={12}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.chtTag}>{item.chtTag}</Text>
                </View>

                <View style={styles.timeWrap}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={12}
                    color={ChickIntelPalette.gray2}
                  />
                  <Text style={styles.cardDate}>{date}</Text>
                </View>
              </View>

              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: theme.badgeBg,
                    borderColor: theme.badgeBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: theme.accentColor },
                  ]}
                />
                <Text
                  style={[styles.statusPillText, { color: theme.badgeText }]}
                >
                  {theme.label}
                </Text>
              </View>
            </View>

            {/* Content Layout */}
            <View style={styles.cardContentLayout}>
              <View style={styles.thumbWrapper}>
                {item.healthLog?.photoUri ? (
                  <Image
                    source={{ uri: item.healthLog.photoUri }}
                    style={styles.cardThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.cardThumbPlaceholder}>
                    <MaterialCommunityIcons
                      name="bird"
                      size={28}
                      color={ChickIntelPalette.green1}
                    />
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.diseaseTitle} numberOfLines={1}>
                  {disease}
                </Text>

                <View style={styles.metaBadgeRow}>
                  <View style={styles.batchPill}>
                    <MaterialCommunityIcons
                      name="home-outline"
                      size={12}
                      color="#4A5252"
                    />
                    <Text style={styles.batchText}>Batch: {batchNo}</Text>
                  </View>
                </View>
              </View>
            </View>
          </Pressable>

          {!isHistory ? (
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => openStatusChangeConfirm(item, "Recovered")}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.recoveredButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={15}
                  color={ChickIntelPalette.green1}
                />
                <Text style={styles.recoveredButtonText}>
                  Recovered
                </Text>
              </Pressable>
              <Pressable
                onPress={() => openStatusChangeConfirm(item, "Deceased")}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.deceasedButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <MaterialCommunityIcons
                  name="close-circle-outline"
                  size={15}
                  color="#923737"
                />
                <Text style={styles.deceasedButtonText}>Deceased</Text>
              </Pressable>
            </View>
          ) : null}
        </BlurCard>
      );
    },
    [openStatusChangeConfirm, router, selectedTab],
  );

  const confirmMessage =
    pendingStatusChange?.monitoringStatus === "Recovered"
      ? "Has this chicken fully recovered and returned to its batch?"
      : "Are you sure you want to mark this chicken as deceased?";

  return (
    <View style={styles.screen}>
      <View
        style={[
          styles.safeContent,
          { paddingTop: insets.top + 10, paddingHorizontal: 20 },
        ]}
      >
        <StatusBar style="dark" />
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)")
            }
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={ChickIntelPalette.gray1}
            />
          </TouchableOpacity>
          <Text style={styles.pageTitle} numberOfLines={1}>Health Monitoring</Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <View style={styles.tabs}>
          {(["Active", "History"] as const).map((tab) => {
            const active = selectedTab === tab;
            return (
              <Pressable
                key={tab}
                onPress={() => setSelectedTab(tab)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <MaterialCommunityIcons
                  name={tab === "Active" ? "heart-pulse" : "history"}
                  size={16}
                  color={active ? "#FFFFFF" : "#4A5452"}
                />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <FlatList
          data={displayedRecords}
          extraData={{ selectedTab, records }}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: 15 }]}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={<View style={styles.listTop} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {selectedTab === "Active"
                  ? 'No chickens are being monitored yet. Complete a health scan and use the "Add to Health Monitoring" option on the result screen to start tracking.'
                  : "No completed monitoring records yet. Recovered and deceased chickens will appear here."}
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>

      <Modal
        visible={pendingStatusChange !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingStatusChange(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPendingStatusChange(null)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Confirm</Text>
            <Text style={styles.modalMessage}>{confirmMessage}</Text>
            <View style={styles.modalRow}>
              <Pressable
                onPress={() => setPendingStatusChange(null)}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnSecondary,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmPendingStatusChange}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <Text style={styles.modalBtnPrimaryText}>Confirm</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={statusUpdateError !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusUpdateError(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setStatusUpdateError(null)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Update failed</Text>
            <Text style={styles.modalMessage}>{statusUpdateError}</Text>
            <Pressable
              onPress={() => setStatusUpdateError(null)}
              style={({ pressed }) => [
                styles.modalBtn,
                styles.modalBtnPrimary,
                styles.modalBtnFull,
                { opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <Text style={styles.modalBtnPrimaryText}>OK</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.canvas,
  },
  safeContent: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  pageTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.55,
    color: ChickIntelPalette.gray1,
  },
  headerRightPlaceholder: {
    width: scale(40),
  },
  backButton: {
    width: scale(40),
    height: verticalScale(40),
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: verticalScale(38),
    borderRadius: 8,
    paddingHorizontal: moderateScale(10),
    gap: 6,
    backgroundColor: "transparent",
  },
  tabActive: {
    backgroundColor: ChickIntelPalette.green1,
  },
  tabText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.textMuted,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  listTop: {
    height: verticalScale(12),
  },
  listContent: {
    flexGrow: 1,
    justifyContent: "flex-start",
  },
  sep: {
    height: verticalScale(8),
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 44,
  },
  emptyText: {
    ...HealthTypography.meta,
    textAlign: "center",
    paddingHorizontal: moderateScale(12),
  },
  card: {
    position: "relative",
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
    shadowColor: "#161E1A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: verticalScale(2) },
    elevation: 2,
    overflow: "hidden",
  },
  cardPressable: {
    gap: 0,
    paddingLeft: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  leftTagWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  chtPillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ChickIntelPalette.lightGreen,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ChickIntelPalette.mediumGreen,
  },
  chtTag: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(12),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
    letterSpacing: -0.2,
  },
  timeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cardDate: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: ChickIntelPalette.textMuted,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: scale(6),
    height: verticalScale(6),
    borderRadius: 3,
  },
  statusPillText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  cardContentLayout: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  thumbWrapper: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: scale(0), height: verticalScale(2) },
  },
  cardThumb: {
    width: scale(72),
    height: verticalScale(72),
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.lightGreen,
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
  },
  cardThumbPlaceholder: {
    width: scale(72),
    height: verticalScale(72),
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.lightGreen,
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  diseaseTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: ChickIntelPalette.gray1,
    marginBottom: 4,
  },
  metaBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  batchPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ChickIntelPalette.lightGreen,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ChickIntelPalette.mediumGreen,
  },
  batchText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: ChickIntelPalette.gray2,
  },
  actionButton: {
    flex: 1,
    minHeight: verticalScale(38),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: moderateScale(10),
  },
  recoveredButton: {
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.26)",
  },
  deceasedButton: {
    backgroundColor: "rgba(146, 55, 55, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(146, 55, 55, 0.24)",
  },
  recoveredButtonText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
    textAlign: "center",
  },
  deceasedButtonText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    color: "#923737",
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(51, 51, 51, 0.38)",
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(24),
  },
  modalCard: {
    width: "100%",
    maxWidth: scale(340),
    borderRadius: 12,
    padding: moderateScale(16),
    backgroundColor: ChickIntelPalette.light1,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: scale(0), height: verticalScale(8) },
    elevation: 8,
  },
  modalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    marginBottom: 8,
  },
  modalMessage: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    lineHeight: 20,
    color: "rgba(51, 51, 51, 0.78)",
    marginBottom: 16,
  },
  modalRow: {
    flexDirection: "row",
    gap: moderateScale(12),
  },
  modalBtn: {
    flex: 1,
    minHeight: verticalScale(42),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: scale(10),
    paddingHorizontal: moderateScale(16),
  },
  modalBtnFull: {
    flex: 0,
    width: "100%",
  },
  modalBtnSecondary: {
    backgroundColor: ChickIntelPalette.lightGreen,
    borderWidth: 1,
    borderColor: ChickIntelPalette.mediumGreen,
  },
  modalBtnPrimary: {
    backgroundColor: ChickIntelPalette.green1,
  },
  modalBtnSecondaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  modalBtnPrimaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
