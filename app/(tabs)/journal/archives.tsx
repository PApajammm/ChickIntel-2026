import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";

import { JournalLogCard } from "@/components/journal/journal-log-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { HealthTypography } from "@/constants/health-typography";
import { useBehaviors } from "@/hooks/use-behaviors";
import { useAuth } from "@/providers/auth-provider";
import {
    clearArchivedHealthJournalEntries,
    fetchArchivedHealthJournalEntries,
    formatJournalDateTime,
    type HealthJournalSavedScan,
} from "@/utils/supabase-health-journal";
import { mapBehaviorIdsToLabels } from "@/utils/supabase-behaviors";
import { logError } from "@/utils/logger";

const TAB_BAR_OFFSET = 55;

export default function ArchivesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeFarm, configured } = useAuth();
  const [entries, setEntries] = useState<HealthJournalSavedScan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [clearModalVisible, setClearModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  async function handleClearArchives() {
    if (!activeFarm?.id || isDeleting) return;

    setIsDeleting(true);
    try {
      await clearArchivedHealthJournalEntries(activeFarm.id);
      setEntries([]);
      setClearModalVisible(false);
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => null);
    } catch (error) {
      logError("Failed to clear archives", error, { farmId: activeFarm.id });
      Alert.alert(
        "Clear Archives Failed",
        "Could not clear archived logs right now. Please try again.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

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
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color="#FFF"
            />
          </TouchableOpacity>
          <Text style={styles.title}>Archives</Text>

          {entries.length > 0 && (
            <TouchableOpacity
              onPress={() => setClearModalVisible(true)}
              style={styles.clearHeaderBtn}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Clear all archives"
            >
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={22}
                color="#FFF"
              />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          data={entries}
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
              behaviorLabels={mapBehaviorIdsToLabels(item.behaviorIds, behaviorItems)}
              additionalObservation={item.additionalObservation}
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
                No archived health logs. Items moved to Archives will appear here.
              </Text>
            </View>
          }
          contentContainerStyle={{
            paddingBottom: insets.bottom + TAB_BAR_OFFSET + 20,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
        />
      </View>

      {/* Confirmation Modal for Clearing Archives */}
      <Modal
        visible={clearModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setClearModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setClearModalVisible(false)}
        >
          <Pressable
            style={styles.modalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalIconWrap}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={32}
                color="#DC2626"
              />
            </View>
            <Text style={styles.modalTitle}>Clear Archives?</Text>
            <Text style={styles.modalMessage}>
              This will permanently delete all {entries.length} archived health log(s) from Supabase storage. This action cannot be undone.
            </Text>
            <View style={styles.modalRow}>
              <Pressable
                onPress={() => setClearModalVisible(false)}
                disabled={isDeleting}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnSecondary,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleClearArchives()}
                disabled={isDeleting}
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <Text style={styles.modalBtnPrimaryText}>
                  {isDeleting ? "Clearing..." : "Delete All"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    color: ChickIntelPalette.gray2,
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
