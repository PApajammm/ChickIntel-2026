import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { BlurCard } from "@/components/ui/blur-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import { fetchFarmEggBatches } from "@/utils/supabase-egg-batches";
import {
    fetchDeletedEggBatches,
    type EggBatchHistoryItem,
} from "@/utils/supabase-egg-batch-history";
import {
    fetchEggDispositions,
    type EggDispositionLog,
    type EggDispositionType,
} from "@/utils/supabase-egg-dispositions";

type TabMode = "all" | "transfer" | "sell" | "dispose" | "deleted";
type TimeFilter = "all" | "today" | "week" | "month";

function formatDateTime(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${datePart} • ${timePart}`;
}

function formatDateOnly(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function matchesTimeframe(dateStr: string, timeframe: TimeFilter): boolean {
  if (timeframe === "all") return true;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (timeframe === "today") {
    return date >= startOfToday;
  }

  if (timeframe === "week") {
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    return date >= startOfWeek;
  }

  if (timeframe === "month") {
    const startOfMonth = new Date(startOfToday);
    startOfMonth.setMonth(startOfMonth.getMonth() - 1);
    return date >= startOfMonth;
  }

  return true;
}

export default function EggBatchHistoryScreen() {
  const router = useRouter();
  const { activeFarm } = useAuth();
  const params = useLocalSearchParams<{
    originBatchNo?: string;
    color?: string;
  }>();

  const [activeTab, setActiveTab] = useState<TabMode>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [originFilter, setOriginFilter] = useState<string>(
    params.originBatchNo ? String(params.originBatchNo).trim() : "",
  );

  const [dispositions, setDispositions] = useState<EggDispositionLog[]>([]);
  const [deletedBatches, setDeletedBatches] = useState<EggBatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!activeFarm?.id) {
      setDispositions([]);
      setDeletedBatches([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [fetchedDispositions, fetchedDeleted, activeEggBatches] =
        await Promise.all([
          fetchEggDispositions(activeFarm.id),
          fetchDeletedEggBatches(activeFarm.id),
          fetchFarmEggBatches(activeFarm.id),
        ]);

      // Combine direct disposition logs with any fallback dispositions from active batches
      const knownBatchDispositions = new Set(
        fetchedDispositions.map((d) => `${d.eggBatchId}-${d.actionType}`),
      );

      const fallbackLogs: EggDispositionLog[] = [];
      activeEggBatches.forEach((egg) => {
        if (
          egg.transferredHatchedQty > 0 &&
          !knownBatchDispositions.has(`${egg.id}-transfer`)
        ) {
          fallbackLogs.push({
            id: `fb-tr-${egg.id}`,
            farmId: activeFarm.id,
            eggBatchId: egg.id,
            originBatchNo: egg.origin || egg.batchNo,
            colorName: egg.colorName,
            colorHex: egg.colorHex,
            actionType: "transfer",
            quantity: egg.transferredHatchedQty,
            createdAt: egg.updatedAt || egg.createdAt,
            notes: "Recorded batch transfer",
          });
        }
        if (
          egg.soldQty > 0 &&
          !knownBatchDispositions.has(`${egg.id}-sell`)
        ) {
          fallbackLogs.push({
            id: `fb-sl-${egg.id}`,
            farmId: activeFarm.id,
            eggBatchId: egg.id,
            originBatchNo: egg.origin || egg.batchNo,
            colorName: egg.colorName,
            colorHex: egg.colorHex,
            actionType: "sell",
            quantity: egg.soldQty,
            createdAt: egg.updatedAt || egg.createdAt,
            notes: "Recorded batch sale",
          });
        }
        if (
          egg.disposedDamagedQty > 0 &&
          !knownBatchDispositions.has(`${egg.id}-dispose`)
        ) {
          fallbackLogs.push({
            id: `fb-dp-${egg.id}`,
            farmId: activeFarm.id,
            eggBatchId: egg.id,
            originBatchNo: egg.origin || egg.batchNo,
            colorName: egg.colorName,
            colorHex: egg.colorHex,
            actionType: "dispose",
            quantity: egg.disposedDamagedQty,
            createdAt: egg.updatedAt || egg.createdAt,
            notes: "Recorded batch disposal",
          });
        }
      });

      const allDispositions = [...fetchedDispositions, ...fallbackLogs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      setDispositions(allDispositions);
      setDeletedBatches(fetchedDeleted);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load egg history.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeFarm?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

  // Counts for tabs
  const tabCounts = useMemo(() => {
    let transferred = 0;
    let sold = 0;
    let disposed = 0;

    dispositions.forEach((item) => {
      if (item.actionType === "transfer") transferred += 1;
      if (item.actionType === "sell") sold += 1;
      if (item.actionType === "dispose") disposed += 1;
    });

    return {
      all: dispositions.length,
      transfer: transferred,
      sell: sold,
      dispose: disposed,
      deleted: deletedBatches.length,
    };
  }, [dispositions, deletedBatches]);

  // Overall totals
  const totalStats = useMemo(() => {
    let transferredEggs = 0;
    let soldEggs = 0;
    let disposedEggs = 0;

    dispositions.forEach((item) => {
      if (item.actionType === "transfer") transferredEggs += item.quantity;
      if (item.actionType === "sell") soldEggs += item.quantity;
      if (item.actionType === "dispose") disposedEggs += item.quantity;
    });

    return {
      total: transferredEggs + soldEggs + disposedEggs,
      transferredEggs,
      soldEggs,
      disposedEggs,
    };
  }, [dispositions]);

  // Filtered lists
  const filteredDispositions = useMemo(() => {
    return dispositions.filter((item) => {
      if (activeTab !== "all" && item.actionType !== activeTab) {
        return false;
      }
      if (!matchesTimeframe(item.createdAt, timeFilter)) {
        return false;
      }
      if (originFilter) {
        const itemOrigin = (item.originBatchNo ?? "").trim().toLowerCase();
        const normFilter = originFilter.trim().toLowerCase();
        if (!itemOrigin.includes(normFilter)) return false;
      }
      return true;
    });
  }, [dispositions, activeTab, timeFilter, originFilter]);

  const filteredDeleted = useMemo(() => {
    return deletedBatches.filter((item) => {
      if (!matchesTimeframe(item.deletedAt, timeFilter)) {
        return false;
      }
      if (originFilter) {
        const itemOrigin = (item.origin ?? item.batchNo ?? "").trim().toLowerCase();
        const normFilter = originFilter.trim().toLowerCase();
        if (!itemOrigin.includes(normFilter)) return false;
      }
      return true;
    });
  }, [deletedBatches, timeFilter, originFilter]);

  const getActionConfig = (type: EggDispositionType) => {
    switch (type) {
      case "transfer":
        return {
          label: "Transferred to Chicks",
          icon: "bird" as const,
          color: ChickIntelPalette.green1,
          bg: "rgba(49, 118, 103, 0.12)",
          borderColor: "rgba(49, 118, 103, 0.25)",
        };
      case "sell":
        return {
          label: "Sold Eggs",
          icon: "cart-outline" as const,
          color: "#2D8C74",
          bg: "rgba(45, 140, 116, 0.12)",
          borderColor: "rgba(45, 140, 116, 0.25)",
        };
      case "dispose":
        return {
          label: "Disposed Damaged",
          icon: "delete-sweep-outline" as const,
          color: "#923737",
          bg: "rgba(146, 55, 55, 0.12)",
          borderColor: "rgba(146, 55, 55, 0.25)",
        };
    }
  };

  return (
    <View style={styles.screen}>
      <BackgroundGradient
        width="110%"
        height="110%"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace({
                    pathname: "/(tabs)/profiles" as any,
                    params: { mode: "egg" },
                  })
            }
            accessibilityRole="button"
            accessibilityLabel="Back"
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.title}>Egg Activity & Archive</Text>
            <Text style={styles.subtitle}>
              Transfers, sales, disposals & deleted logs
            </Text>
          </View>
          <View style={styles.headerRightPlaceholder} />
        </View>

        {/* Stats Summary Banner */}
        <View style={styles.statsBanner}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalStats.transferredEggs}</Text>
            <View style={styles.statLabelRow}>
              <MaterialCommunityIcons
                name="bird"
                size={11}
                color={ChickIntelPalette.green1}
              />
              <Text style={styles.statLabel}>Transferred</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalStats.soldEggs}</Text>
            <View style={styles.statLabelRow}>
              <MaterialCommunityIcons
                name="cart-outline"
                size={11}
                color="#2D8C74"
              />
              <Text style={styles.statLabel}>Sold</Text>
            </View>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalStats.disposedEggs}</Text>
            <View style={styles.statLabelRow}>
              <MaterialCommunityIcons
                name="delete-sweep-outline"
                size={11}
                color="#923737"
              />
              <Text style={styles.statLabel}>Disposed</Text>
            </View>
          </View>
        </View>

        {/* Top Segmented Tabs */}
        <View style={styles.tabScrollWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            <Pressable
              onPress={() => setActiveTab("all")}
              style={[
                styles.tabButton,
                activeTab === "all" && styles.tabButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === "all" && styles.tabButtonTextActive,
                ]}
              >
                All ({tabCounts.all})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("transfer")}
              style={[
                styles.tabButton,
                activeTab === "transfer" && styles.tabButtonActive,
              ]}
            >
              <MaterialCommunityIcons
                name="bird"
                size={13}
                color={
                  activeTab === "transfer" ? "#FFF" : ChickIntelPalette.green1
                }
              />
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === "transfer" && styles.tabButtonTextActive,
                ]}
              >
                Transferred ({tabCounts.transfer})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("sell")}
              style={[
                styles.tabButton,
                activeTab === "sell" && styles.tabButtonActive,
              ]}
            >
              <MaterialCommunityIcons
                name="cart-outline"
                size={13}
                color={activeTab === "sell" ? "#FFF" : "#2D8C74"}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === "sell" && styles.tabButtonTextActive,
                ]}
              >
                Sold ({tabCounts.sell})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("dispose")}
              style={[
                styles.tabButton,
                activeTab === "dispose" && styles.tabButtonActive,
              ]}
            >
              <MaterialCommunityIcons
                name="delete-sweep-outline"
                size={13}
                color={activeTab === "dispose" ? "#FFF" : "#923737"}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === "dispose" && styles.tabButtonTextActive,
                ]}
              >
                Disposed ({tabCounts.dispose})
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("deleted")}
              style={[
                styles.tabButton,
                activeTab === "deleted" && styles.tabButtonActive,
              ]}
            >
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={13}
                color={activeTab === "deleted" ? "#FFF" : "#6B7280"}
              />
              <Text
                style={[
                  styles.tabButtonText,
                  activeTab === "deleted" && styles.tabButtonTextActive,
                ]}
              >
                Deleted Batches ({tabCounts.deleted})
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Filter Chips Bar */}
        <View style={styles.filterChipsRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipsContainer}
          >
            {(
              [
                { key: "all", label: "All Time" },
                { key: "today", label: "Today" },
                { key: "week", label: "This Week" },
                { key: "month", label: "This Month" },
              ] as const
            ).map((chip) => (
              <Pressable
                key={chip.key}
                onPress={() => setTimeFilter(chip.key)}
                style={[
                  styles.filterChip,
                  timeFilter === chip.key && styles.filterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    timeFilter === chip.key && styles.filterChipTextActive,
                  ]}
                >
                  {chip.label}
                </Text>
              </Pressable>
            ))}

            {originFilter ? (
              <Pressable
                onPress={() => setOriginFilter("")}
                style={[styles.filterChip, styles.filterChipActiveBatch]}
              >
                <Text style={styles.filterChipTextActiveBatch}>
                  Batch: {originFilter}
                </Text>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={14}
                  color="#FFF"
                />
              </Pressable>
            ) : null}
          </ScrollView>
        </View>

        {/* Main List Area */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color={ChickIntelPalette.green1} />
              <Text style={styles.loadingText}>Loading history & archives...</Text>
            </View>
          ) : null}

          {error ? <Text style={styles.emptyText}>{error}</Text> : null}

          {/* Render Dispositions (All, Transferred, Sold, Disposed) */}
          {!loading && activeTab !== "deleted" ? (
            filteredDispositions.length ? (
              filteredDispositions.map((item) => {
                const config = getActionConfig(item.actionType);
                return (
                  <BlurCard
                    key={item.id}
                    style={styles.card}
                    borderRadius={14}
                    intensity={20}
                  >
                    <View style={styles.cardInner}>
                      {/* Top Header Row */}
                      <View style={styles.cardTopRow}>
                        <View
                          style={[
                            styles.actionBadge,
                            {
                              backgroundColor: config.bg,
                              borderColor: config.borderColor,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={config.icon}
                            size={14}
                            color={config.color}
                          />
                          <Text
                            style={[styles.actionBadgeText, { color: config.color }]}
                          >
                            {config.label}
                          </Text>
                        </View>

                        <Text style={styles.timestampText}>
                          {formatDateTime(item.createdAt)}
                        </Text>
                      </View>

                      {/* Main Metric Row */}
                      <View style={styles.metricMainRow}>
                        <View style={styles.quantityWrap}>
                          <Text style={styles.quantityNumber}>
                            {item.quantity}
                          </Text>
                          <Text style={styles.quantityUnit}>Eggs</Text>
                        </View>

                        <View style={styles.detailsStack}>
                          {item.originBatchNo ? (
                            <View style={styles.metaRow}>
                              <MaterialCommunityIcons
                                name="bird"
                                size={13}
                                color="#52615D"
                              />
                              <Text style={styles.metaLabel}>
                                Origin: Batch {item.originBatchNo}
                              </Text>
                            </View>
                          ) : null}

                          {item.targetChickBatchId ? (
                            <View style={styles.metaRow}>
                              <MaterialCommunityIcons
                                name="arrow-right-bold"
                                size={13}
                                color={ChickIntelPalette.green1}
                              />
                              <Text
                                style={[
                                  styles.metaLabel,
                                  { color: ChickIntelPalette.green1, fontWeight: "700" },
                                ]}
                              >
                                Moved to {item.targetChickBatchId}
                              </Text>
                            </View>
                          ) : null}

                          {item.colorName ? (
                            <View style={styles.metaRow}>
                              <View
                                style={[
                                  styles.colorDot,
                                  {
                                    backgroundColor:
                                      item.colorHex || ChickIntelPalette.gray2,
                                  },
                                ]}
                              />
                              <Text style={styles.metaLabel}>
                                {item.colorName}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </View>

                      {item.notes ? (
                        <Text style={styles.notesText}>{item.notes}</Text>
                      ) : null}
                    </View>
                  </BlurCard>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons
                  name="calendar-blank-outline"
                  size={42}
                  color="#8A8F8F"
                />
                <Text style={styles.emptyTitle}>No records found</Text>
                <Text style={styles.emptySub}>
                  {timeFilter !== "all" || originFilter
                    ? "Try adjusting your timeframe or batch filter."
                    : "Activities like chick transfers, sales, and egg disposals will appear here."}
                </Text>
              </View>
            )
          ) : null}

          {/* Render Deleted Batches Tab */}
          {!loading && activeTab === "deleted" ? (
            filteredDeleted.length ? (
              filteredDeleted.map((item) => (
                <BlurCard
                  key={item.historyId}
                  style={styles.card}
                  borderRadius={14}
                  intensity={20}
                >
                  <View style={styles.cardInner}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.deletedBadge}>
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={13}
                          color="#DC2626"
                        />
                        <Text style={styles.deletedBadgeText}>
                          Deleted Batch E
                          {item.batchNo.replace(/\D/g, "").padStart(3, "0")}
                        </Text>
                      </View>
                      <Text style={styles.timestampText}>
                        {formatDateTime(item.deletedAt)}
                      </Text>
                    </View>

                    <Text style={styles.breedTitle}>
                      {item.colorName || item.origin || "Egg Batch"}
                    </Text>

                    <Text style={styles.createdDateSub}>
                      Origin: {item.origin || "Unknown"} • Originally added:{" "}
                      {formatDateOnly(item.createdAt)}
                    </Text>

                    <View style={styles.metricsRow}>
                      <View style={styles.metricChip}>
                        <Text style={styles.metricChipLabel}>Recorded</Text>
                        <Text style={styles.metricChipValue}>{item.eggQty}</Text>
                      </View>
                      <View style={styles.metricChip}>
                        <Text style={styles.metricChipLabel}>Hatched</Text>
                        <Text style={styles.metricChipValue}>
                          {item.hatchedQty}
                        </Text>
                      </View>
                      <View style={styles.metricChip}>
                        <Text style={styles.metricChipLabel}>Damaged</Text>
                        <Text style={styles.metricChipValue}>
                          {item.damagedQty}
                        </Text>
                      </View>
                      <View style={styles.metricChip}>
                        <Text style={styles.metricChipLabel}>Unhatched</Text>
                        <Text style={styles.metricChipValue}>
                          {item.unhatchedQty}
                        </Text>
                      </View>
                    </View>
                  </View>
                </BlurCard>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={42}
                  color="#8A8F8F"
                />
                <Text style={styles.emptyTitle}>No deleted batches</Text>
                <Text style={styles.emptySub}>
                  Batches removed from the active inventory will be archived here.
                </Text>
              </View>
            )
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ChickIntelPalette.light1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(16),
    paddingTop: verticalScale(6),
    paddingBottom: verticalScale(10),
  },
  backButton: {
    width: scale(40),
    height: verticalScale(40),
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.green1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.25)",
    shadowColor: "#317667",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: verticalScale(4) },
    elevation: 4,
    flexShrink: 0,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: scale(8),
  },
  title: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: "#52615D",
    marginTop: 1,
    textAlign: "center",
  },
  headerRightPlaceholder: {
    width: scale(40),
  },

  /* Stats Banner */
  statsBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginHorizontal: moderateScale(16),
    marginBottom: verticalScale(8),
    paddingVertical: verticalScale(10),
    paddingHorizontal: moderateScale(12),
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.15)",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  statLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "600",
    color: "#52615D",
  },
  statDivider: {
    width: 1,
    height: verticalScale(24),
    backgroundColor: "rgba(49, 118, 103, 0.15)",
  },

  /* Tabs */
  tabScrollWrap: {
    marginBottom: verticalScale(6),
  },
  tabsContainer: {
    paddingHorizontal: moderateScale(16),
    gap: 6,
  },
  tabButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(7),
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
  },
  tabButtonActive: {
    backgroundColor: ChickIntelPalette.green1,
    borderColor: ChickIntelPalette.green1,
  },
  tabButtonText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11.5),
    fontWeight: "700",
    color: "#40524B",
  },
  tabButtonTextActive: {
    color: "#FFFFFF",
  },

  /* Filter Chips */
  filterChipsRow: {
    marginBottom: verticalScale(8),
  },
  filterChipsContainer: {
    paddingHorizontal: moderateScale(16),
    gap: 6,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(5),
    borderRadius: 8,
    backgroundColor: "rgba(244, 248, 247, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.12)",
  },
  filterChipActive: {
    backgroundColor: "rgba(49, 118, 103, 0.14)",
    borderColor: ChickIntelPalette.green1,
  },
  filterChipText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: "#52615D",
  },
  filterChipTextActive: {
    color: ChickIntelPalette.green1,
    fontWeight: "700",
  },
  filterChipActiveBatch: {
    backgroundColor: ChickIntelPalette.green1,
    borderColor: ChickIntelPalette.green1,
  },
  filterChipTextActiveBatch: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: "#FFFFFF",
  },

  /* Scroll Content */
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: moderateScale(16),
    paddingBottom: verticalScale(30),
    gap: 10,
  },
  centerLoading: {
    paddingVertical: verticalScale(40),
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "#52615D",
  },
  emptyText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "#52615D",
    textAlign: "center",
    marginTop: 20,
  },

  /* Card */
  card: {
    padding: moderateScale(13),
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.55)",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardInner: {
    gap: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 7,
    borderWidth: 1,
  },
  actionBadgeText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
  },
  deletedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 7,
    backgroundColor: "rgba(220, 38, 38, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.25)",
  },
  deletedBadgeText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: "#DC2626",
  },
  timestampText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10.5),
    color: "#52615D",
    fontWeight: "500",
  },

  /* Main Metric Row */
  metricMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(244, 248, 247, 0.7)",
    borderRadius: 10,
    padding: moderateScale(10),
  },
  quantityWrap: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: scale(60),
    borderRightWidth: 1,
    borderRightColor: "rgba(49, 118, 103, 0.15)",
    paddingRight: scale(10),
  },
  quantityNumber: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    lineHeight: 24,
  },
  quantityUnit: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
    textTransform: "uppercase",
  },
  detailsStack: {
    flex: 1,
    gap: 4,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metaLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: "#263832",
    fontWeight: "600",
  },
  colorDot: {
    width: scale(7),
    height: verticalScale(7),
    borderRadius: 4,
  },
  notesText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: "#52615D",
    fontStyle: "italic",
    paddingLeft: 2,
  },

  /* Deleted Card Elements */
  breedTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(14),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  createdDateSub: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: "#52615D",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
  },
  metricChip: {
    flex: 1,
    backgroundColor: "rgba(49, 118, 103, 0.08)",
    borderRadius: 7,
    paddingVertical: verticalScale(5),
    paddingHorizontal: moderateScale(6),
    alignItems: "center",
  },
  metricChipLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(9.5),
    color: "#52615D",
  },
  metricChipValue: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(12.5),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    marginTop: 1,
  },

  /* Empty State */
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(40),
    paddingHorizontal: moderateScale(20),
    gap: 8,
  },
  emptyTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    marginTop: 6,
  },
  emptySub: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11.5),
    color: "#52615D",
    textAlign: "center",
    lineHeight: 16,
  },
});
