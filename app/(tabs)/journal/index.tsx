import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import { useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import type { Href } from "expo-router";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import {
    Alert,
    FlatList,
    ListRenderItem,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";

import { JournalHeader } from "@/components/journal/journal-header";
import { JournalLogCard } from "@/components/journal/journal-log-card";
import { PrimaryFab } from "@/components/ui/primary-fab";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { HealthTypography } from "@/constants/health-typography";
import { useBehaviors } from "@/hooks/use-behaviors";
import { useAuth } from "@/providers/auth-provider";
import { logError, logStep } from "@/utils/logger";
import { mapBehaviorIdsToLabels } from "@/utils/supabase-behaviors";
import {
    fetchHealthJournalEntries,
    formatJournalDateTime,
    type HealthJournalSavedScan,
    removeHealthJournalEntries,
    updateHealthJournalEntryNote,
} from "@/utils/supabase-health-journal";

const TAB_BAR_OFFSET = 55;
const FAB_OFFSET_FROM_TAB_TOP = 50;

export default function JournalIndexScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeFarm, configured } = useAuth();
  const [entries, setEntries] = useState<HealthJournalSavedScan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const { behaviors: behaviorItems } = useBehaviors();
  const fabBottom = TAB_BAR_OFFSET - 2 - FAB_OFFSET_FROM_TAB_TOP;

  const refresh = useCallback(async () => {
    if (!configured || !activeFarm?.id) {
      setEntries([]);
      setRefreshing(false);
      return;
    }

    setRefreshing(true);
    try {
      const nextEntries = await fetchHealthJournalEntries(activeFarm.id, true);
      setEntries(nextEntries);
    } catch {
      logStep("Health journal entries load fallback applied", {
        farmId: activeFarm.id,
      });
      setEntries([]);
    } finally {
      setRefreshing(false);
    }
  }, [activeFarm?.id, configured]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openScannerWithPermission = useCallback(async () => {
    if (Platform.OS !== "web" && !cameraPermission?.granted) {
      try {
        const nextPermission = await requestCameraPermission();
        if (!nextPermission.granted) {
          logStep("Scanner access attempted without permission", {
            source: "journal_fab",
            canAskAgain: nextPermission.canAskAgain,
          });
        }
      } catch (e) {
        logError("Camera permission request failed", e);
      }
    }

    router.push("/(tabs)/scanner");
  }, [cameraPermission?.granted, requestCameraPermission, router]);

  const saveEntryNote = useCallback(
    async (entryId: string, note: string) => {
      if (!activeFarm?.id) return;

      try {
        await updateHealthJournalEntryNote(activeFarm.id, entryId, note);
        await refresh();
      } catch (error) {
        logError("Health journal note save failed", error, {
          farmId: activeFarm.id,
          entryId,
        });
        Alert.alert(
          "Unable to save note",
          "Your note could not be saved right now. Please try again.",
        );
      }
    },
    [activeFarm?.id, refresh],
  );

  async function onBulkArchive() {
    if (selected.size === 0) {
      Alert.alert(
        "No logs selected",
        "Select one or more health logs with the checkboxes, then tap the archive icon to move them to archives.",
      );
      return;
    }

    setArchiveModalVisible(true);
  }

  function confirmBulkArchive() {
    if (!activeFarm?.id) {
      setArchiveModalVisible(false);
      return;
    }

    void removeHealthJournalEntries(activeFarm.id, [...selected])
      .then(() => {
        setSelected(new Set());
        void refresh();
        setArchiveModalVisible(false);
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => null);
      })
      .catch((error) => {
        logError("Health journal archive failed", error, {
          farmId: activeFarm.id,
        });
        Alert.alert(
          "Unable to archive logs",
          "The selected health logs could not be archived.",
        );
        setArchiveModalVisible(false);
      });
  }

  const [isSelecting, setIsSelecting] = useState(false);

  const toggleSelecting = useCallback(() => {
    setIsSelecting((prev) => {
      if (prev) setSelected(new Set());
      return !prev;
    });
  }, []);

  const renderItem: ListRenderItem<HealthJournalSavedScan> = useCallback(
    ({ item, index }) => (
      <JournalLogCard
        chtTag={item.chtTag}
        detectedIllness={item.detectedIllness}
        actionStatus={item.actionStatus}
        timestamp={formatJournalDateTime(item.savedAt)}
        photoUri={item.photoUri}
        behaviorLabels={mapBehaviorIdsToLabels(item.behaviorIds, behaviorItems)}
        additionalObservation={item.additionalObservation}
        noteValue={item.additionalObservation ?? ""}
        onNoteSave={(note) => saveEntryNote(item.id, note)}
        selected={selected.has(item.id)}
        onToggleSelect={() => toggle(item.id)}
        hideCheckbox={!isSelecting}
        onOpen={() => router.push(`/(tabs)/journal/${item.id}` as Href)}
        index={index}
      />
    ),
    [router, selected, behaviorItems, toggle, saveEntryNote, isSelecting],
  );

  const selectionKey = `${isSelecting}-${[...selected].sort().join(",")}`;

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
        <JournalHeader
          onBackPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)")
          }
          onArchivePress={onBulkArchive}
          archiveDisabled={selected.size === 0}
          onOpenArchives={() => router.push("/(tabs)/journal/archives")}
          isSelecting={isSelecting}
          onToggleSelecting={toggleSelecting}
          selectedCount={selected.size}
        />

        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          extraData={selectionKey}
          renderItem={renderItem}
          refreshing={refreshing}
          onRefresh={() => void refresh()}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews={Platform.OS !== "web"}
          contentContainerStyle={[styles.listContent, { paddingBottom: 15 }]}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListHeaderComponent={<View style={styles.listTop} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.empty}>
                No health scans saved yet. Complete a Health scan and tap Save
                on the result screen to archive it here.
              </Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      </View>

      {entries.length === 0 && (
        <PrimaryFab
          iconName="camera-outline"
          onPress={() => void openScannerWithPermission()}
          bottom={fabBottom}
          accessibilityLabel="Open scanner"
        />
      )}

      <Modal
        visible={archiveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setArchiveModalVisible(false)}
      >
        <Pressable
          style={styles.deleteBackdrop}
          onPress={() => setArchiveModalVisible(false)}
        >
          <Pressable
            style={styles.deleteCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.deleteTitle}>Archive logs?</Text>
            <Text style={styles.deleteMessage}>
              Move {selected.size} saved health log(s) to Archives? You can
              restore them from the Archives page later.
            </Text>
            <View style={styles.deleteRow}>
              <Pressable
                onPress={() => setArchiveModalVisible(false)}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  styles.deleteBtnSecondary,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={styles.deleteBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmBulkArchive}
                style={({ pressed }) => [
                  styles.deleteBtn,
                  styles.deleteBtnPrimary,
                  { opacity: pressed ? 0.92 : 1 },
                ]}
              >
                <Text style={styles.deleteBtnPrimaryText}>Archive</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.light1,
  },
  safeContent: {
    flex: 1,
  },
  listTop: {
    height: verticalScale(14),
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
  empty: {
    ...HealthTypography.meta,
    textAlign: "center",
    paddingHorizontal: moderateScale(12),
  },
  deleteBackdrop: {
    flex: 1,
    backgroundColor: "rgba(51,51,51,0.38)",
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(24),
  },
  deleteCard: {
    width: "100%",
    maxWidth: scale(340),
    borderRadius: 5,
    padding: moderateScale(14),
    backgroundColor: ChickIntelPalette.light1,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.18)",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: scale(0), height: verticalScale(8) },
    elevation: 8,
  },
  deleteIconWrap: {
    width: scale(48),
    height: verticalScale(48),
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.lightGreen,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    alignSelf: "center",
  },
  deleteTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    textAlign: "center",
    marginBottom: 8,
  },
  deleteMessage: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    lineHeight: 20,
    fontWeight: "500",
    color: ChickIntelPalette.gray2,
    textAlign: "center",
    marginBottom: 16,
  },
  deleteRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
  },
  deleteBtn: {
    flex: 1,
    minHeight: verticalScale(40),
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(16),
  },
  deleteBtnSecondary: {
    backgroundColor: "#F0F2F2",
    borderWidth: 1,
    borderColor: "transparent",
  },
  deleteBtnSecondaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  deleteBtnPrimary: {
    backgroundColor: ChickIntelPalette.green1,
  },
  deleteBtnPrimaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: ChickIntelPalette.light1,
  },
});
