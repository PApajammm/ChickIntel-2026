import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    FlatList,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";

import { JournalLogCard } from "@/components/journal/journal-log-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { HealthTypography } from "@/constants/health-typography";
import { useBehaviors } from "@/hooks/use-behaviors";
import { useAuth } from "@/providers/auth-provider";
import { mapBehaviorIdsToLabels } from "@/utils/supabase-behaviors";
import {
    fetchArchivedHealthJournalEntries,
    formatJournalDateTime,
    matchesJournalStatus,
    type HealthJournalSavedScan,
    type JournalStatusFilter,
} from "@/utils/supabase-health-journal";

export default function ArchivesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeFarm, configured } = useAuth();
  const [entries, setEntries] = useState<HealthJournalSavedScan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<JournalStatusFilter>("all");
  const { behaviors: behaviorItems } = useBehaviors();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/journal");
    }
  };

  const refresh = useCallback(async () => {
    if (!configured || !activeFarm?.id) {
      setEntries([]);
      setRefreshing(false);
      return;
    }

    setRefreshing(true);
    try {
      const next = await fetchArchivedHealthJournalEntries(activeFarm.id);
      setEntries(next);
    } catch {
      // keep existing entries if offline
    } finally {
      setRefreshing(false);
    }
  }, [activeFarm?.id, configured]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) =>
        matchesJournalStatus(entry.actionStatus, statusFilter),
      ),
    [entries, statusFilter],
  );

  const statusFilters: { label: string; value: JournalStatusFilter }[] = [
    { label: "Monitor", value: "monitor" },
    { label: "Isolated", value: "isolated" },
    { label: "Deceased", value: "deceased" },
    { label: "Recovered", value: "recovered" },
  ];

  return (
    <View style={styles.screen}>
      <BackgroundGradient
        width="110%"
        height="110%"
        preserveAspectRatio="xMidYMid slice"
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ scale: 1.08 }, { translateY: -14 }] },
        ]}
      />
      <View
        style={[
          styles.safeContent,
          { paddingTop: insets.top + 10, paddingHorizontal: 20 },
        ]}
      >
        <StatusBar style="dark" />
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backBtn}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            Archives
          </Text>
          <View style={styles.headerRightPlaceholder} />
        </View>

        <FlatList
          data={filteredEntries}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== "web"}
          renderItem={({ item, index }) => (
            <JournalLogCard
              chtTag={item.chtTag}
              detectedIllness={item.detectedIllness}
              actionStatus={item.actionStatus}
              timestamp={formatJournalDateTime(item.savedAt)}
              photoUri={item.photoUri}
              behaviorLabels={mapBehaviorIdsToLabels(
                item.behaviorIds,
                behaviorItems,
              )}
              additionalObservation={item.additionalObservation}
              noteValue={item.additionalObservation ?? ""}
              noteSavedAt={item.noteSavedAt}
              noteHistory={item.noteHistory}
              selected={false}
              onToggleSelect={() => {}}
              hideCheckbox
              onOpen={() => router.push(`/(tabs)/journal/${item.id}`)}
              index={index}
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No archived health logs. Items moved to Archives will appear
                here.
              </Text>
            </View>
          }
          ListHeaderComponent={
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  statusFilter === "all" && styles.filterPillActive,
                ]}
                onPress={() => setStatusFilter("all")}
              >
                <Text
                  style={[
                    styles.filterText,
                    statusFilter === "all" && styles.filterTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              {statusFilters.map((filter) => (
                <TouchableOpacity
                  key={filter.value}
                  style={[
                    styles.filterPill,
                    statusFilter === filter.value && styles.filterPillActive,
                  ]}
                  onPress={() => setStatusFilter(filter.value)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      statusFilter === filter.value && styles.filterTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          }
          contentContainerStyle={{
            paddingBottom: 15,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ChickIntelPalette.light1 },
  safeContent: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
    marginBottom: 14,
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
  title: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.55,
    color: ChickIntelPalette.gray1,
    flex: 1,
    textAlign: "center",
  },
  headerRightPlaceholder: {
    width: scale(42),
  },
  clearHeaderBtn: {
    width: scale(42),
    height: verticalScale(42),
    borderRadius: 14,
    backgroundColor: "#DC2626",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.35)",
    shadowColor: "#DC2626",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(4) },
    elevation: 4,
    flexShrink: 0,
  },
  sep: { height: verticalScale(10) },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(20),
    paddingTop: 60,
  },
  emptyText: {
    ...HealthTypography.meta,
    textAlign: "center",
  },
  filterRow: {
    gap: 8,
    paddingBottom: verticalScale(12),
  },
  filterPill: {
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(7),
    borderRadius: 999,
    backgroundColor: "rgba(202, 227, 221, 0.42)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
  },
  filterPillActive: {
    backgroundColor: ChickIntelPalette.green1,
    borderColor: ChickIntelPalette.green1,
  },
  filterText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(24),
  },
  modalCard: {
    width: "100%",
    maxWidth: scale(340),
    borderRadius: 14,
    padding: moderateScale(20),
    backgroundColor: ChickIntelPalette.light1,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: scale(0), height: verticalScale(8) },
    elevation: 8,
  },
  modalIconWrap: {
    width: scale(52),
    height: verticalScale(52),
    borderRadius: 26,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    alignSelf: "center",
  },
  modalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    textAlign: "center",
    marginBottom: 8,
  },
  modalMessage: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    lineHeight: 20,
    fontWeight: "500",
    color: ChickIntelPalette.textMuted,
    textAlign: "center",
    marginBottom: 20,
  },
  modalRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
  },
  modalBtn: {
    flex: 1,
    minHeight: verticalScale(42),
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(16),
  },
  modalBtnSecondary: {
    backgroundColor: "#F0F2F2",
  },
  modalBtnSecondaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  modalBtnPrimary: {
    backgroundColor: "#DC2626",
  },
  modalBtnPrimaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: ChickIntelPalette.light1,
  },
});
