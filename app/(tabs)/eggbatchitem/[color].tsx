import {
  moderateScale,
  responsiveFontSize,
  scale,
  verticalScale,
} from "@/utils/responsive";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { BlurCard } from "@/components/ui/blur-card";
import { PrimaryFab } from "@/components/ui/primary-fab";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import {
  formatEggFertilityPercent,
  type EggBatchItem,
} from "@/utils/batch-store";
import { logError } from "@/utils/logger";
import {
  deleteFarmEggBatch,
  fetchFarmEggBatches,
  updateFarmEggBatch,
} from "@/utils/supabase-egg-batches";

const TAB_BAR_OFFSET = 55;
const FAB_OFFSET_FROM_TAB_TOP = 50;

function normalizeColor(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function matchesOriginBatch(
  egg: EggBatchItem,
  targetColor: string,
  targetBatchNo?: string,
) {
  const normTargetBatch = (targetBatchNo ?? "").trim().toLowerCase();
  const normTargetColor = (targetColor ?? "").trim().toLowerCase();

  const eggOrigin = (egg.origin ?? "").trim().toLowerCase();
  const eggBatchNo = (egg.batchNo ?? "").trim().toLowerCase();
  const eggColor = (egg.colorName ?? "").trim().toLowerCase();

  const cleanTargetBatch = normTargetBatch.replace(/^batch\s*/, "");
  const cleanEggOrigin = eggOrigin.replace(/^batch\s*/, "");
  const cleanEggBatchNo = eggBatchNo.replace(/^batch\s*/, "");

  if (cleanTargetBatch) {
    const batchMatches =
      cleanEggOrigin === cleanTargetBatch ||
      cleanEggBatchNo === cleanTargetBatch;

    if (normTargetColor) {
      return batchMatches && eggColor === normTargetColor;
    }

    return batchMatches;
  }

  if (normTargetColor) {
    return eggColor === normTargetColor;
  }

  return false;
}

type EggEditState = {
  hatchedQty: string;
  damagedQty: string;
};

function parseCount(value: string) {
  return Number.parseInt(value || "0", 10) || 0;
}

function getDerivedUnhatchedQty(
  eggQty: number,
  hatchedQty: number,
  damagedQty: number,
) {
  return Math.max(0, eggQty - hatchedQty - damagedQty);
}

export default function EggBatchColorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeFarm } = useAuth();
  const params = useLocalSearchParams<{
    color?: string;
    colorHex?: string;
    batchNo?: string;
    originBatchNo?: string;
  }>();

  const colorName = normalizeColor(params.color);
  const colorHex = normalizeColor(params.colorHex);
  const targetBatchNo =
    normalizeColor(params.batchNo) || normalizeColor(params.originBatchNo);
  const [savedEggBatches, setSavedEggBatches] = useState<EggBatchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEgg, setSelectedEgg] = useState<EggBatchItem | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editForm, setEditForm] = useState<EggEditState>({
    hatchedQty: "0",
    damagedQty: "0",
  });

  const loadEggBatches = useCallback(async () => {
    if (!activeFarm?.id) {
      setSavedEggBatches([]);
      return;
    }

    setLoading(true);

    try {
      const rows = await fetchFarmEggBatches(activeFarm.id);
      setSavedEggBatches(rows);
    } catch (error) {
      logError("Egg batch color screen load failed", error, {
        farmId: activeFarm.id,
      });
    } finally {
      setLoading(false);
    }
  }, [activeFarm?.id]);

  useEffect(() => {
    void loadEggBatches();
  }, [loadEggBatches]);

  useFocusEffect(
    useCallback(() => {
      void loadEggBatches();
    }, [loadEggBatches]),
  );

  const filteredBatches = useMemo(
    () =>
      savedEggBatches.filter((egg) =>
        matchesOriginBatch(egg, colorName, targetBatchNo),
      ),
    [colorName, targetBatchNo, savedEggBatches],
  );

  const displayHex =
    colorHex || filteredBatches[0]?.colorHex || ChickIntelPalette.gray2;

  const summaryMetrics = useMemo(() => {
    const totals = filteredBatches.reduce(
      (accumulator, egg) => ({
        hatchedQty: accumulator.hatchedQty + (egg.hatchedQty ?? 0),
        damagedQty: accumulator.damagedQty + (egg.damagedQty ?? 0),
        unhatchedQty: accumulator.unhatchedQty + (egg.unhatchedQty ?? 0),
      }),
      { hatchedQty: 0, damagedQty: 0, unhatchedQty: 0 },
    );

    return {
      batchCount: filteredBatches.length,
      fertility: formatEggFertilityPercent(totals),
    };
  }, [filteredBatches]);

  const hasSelectedEggs = selectedIds.size > 0;

  const toggleSelection = (eggId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eggId)) {
        next.delete(eggId);
      } else {
        next.add(eggId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const openEdit = (egg: EggBatchItem) => {
    setSelectedEgg(egg);
    setEditForm({
      hatchedQty: String(egg.hatchedQty ?? 0),
      damagedQty: String(egg.damagedQty ?? 0),
    });
    setEditVisible(true);
  };

  const closeEdit = () => {
    setEditVisible(false);
    setSelectedEgg(null);
  };

  const confirmDeleteEgg = (egg: EggBatchItem) => {
    Alert.alert("Delete egg batch", `Delete batch ${egg.batchNo}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!activeFarm?.id) return;

          try {
            await deleteFarmEggBatch(activeFarm.id, egg.id);
            setSavedEggBatches((prev) =>
              prev.filter((item) => item.id !== egg.id),
            );
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.delete(egg.id);
              return next;
            });
          } catch (error) {
            logError("Egg batch color screen delete failed", error, {
              farmId: activeFarm.id,
              eggBatchId: egg.id,
            });
            Alert.alert(
              "Delete failed",
              "Unable to delete this egg batch right now.",
            );
          }
        },
      },
    ]);
  };

  const confirmDeleteSelectedEggs = () => {
    if (!activeFarm?.id || selectedIds.size === 0) return;

    Alert.alert(
      "Delete selected egg batches",
      `Delete ${selectedIds.size} selected batch${selectedIds.size === 1 ? "" : "es"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await Promise.all(
                [...selectedIds].map((eggId) =>
                  deleteFarmEggBatch(activeFarm.id!, eggId),
                ),
              );
              setSavedEggBatches((prev) =>
                prev.filter((egg) => !selectedIds.has(egg.id)),
              );
              clearSelection();
            } catch (error) {
              logError("Egg batch color screen bulk delete failed", error, {
                farmId: activeFarm.id,
                selectedCount: selectedIds.size,
              });
              Alert.alert(
                "Bulk delete failed",
                "Unable to delete all selected egg batches right now.",
              );
            }
          },
        },
      ],
    );
  };

  const saveEdit = async () => {
    if (!selectedEgg) {
      closeEdit();
      return;
    }

    const updatedEgg = {
      ...selectedEgg,
      hatchedQty: parseCount(editForm.hatchedQty),
      damagedQty: parseCount(editForm.damagedQty),
      unhatchedQty: getDerivedUnhatchedQty(
        selectedEgg.eggQty ?? 0,
        parseCount(editForm.hatchedQty),
        parseCount(editForm.damagedQty),
      ),
    };

    if (!activeFarm?.id) {
      closeEdit();
      return;
    }

    try {
      await updateFarmEggBatch(activeFarm.id, selectedEgg.id, updatedEgg);
      setSavedEggBatches((prev) =>
        prev.map((egg) => (egg.id === selectedEgg.id ? updatedEgg : egg)),
      );
    } catch (error) {
      logError("Egg batch color screen update failed", error, {
        farmId: activeFarm.id,
        eggBatchId: selectedEgg.id,
      });
      return;
    }
    closeEdit();
  };

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
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 10,
            paddingBottom: insets.bottom + 96,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/profiles" as any,
                  params: { mode: "egg" },
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Back to egg batch profile"
              style={styles.backInlineBtn}
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={18}
                color={ChickIntelPalette.gray1}
              />
            </Pressable>
            <Text style={styles.pageTitle}>Egg Batches per Color / Origin</Text>
            <Text style={styles.subtitle}>
              {colorName ? (
                colorName
              ) : (
                <Text style={styles.subtitleMuted}>Selected color</Text>
              )}{" "}
              • {summaryMetrics.batchCount} batches • Fertility{" "}
              {summaryMetrics.fertility}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {hasSelectedEggs ? (
              <>
                <Pressable
                  onPress={clearSelection}
                  style={styles.headerActionBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Clear selected egg batches"
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={18}
                    color={ChickIntelPalette.gray1}
                  />
                </Pressable>
                <Pressable
                  onPress={confirmDeleteSelectedEggs}
                  style={[styles.headerActionBtn, styles.headerDeleteBtn]}
                  accessibilityRole="button"
                  accessibilityLabel="Delete selected egg batches"
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={18}
                    color="#B04B58"
                  />
                </Pressable>
              </>
            ) : null}
          </View>
        </View>

        <View style={styles.selectionHintWrap}>
          <Text style={styles.selectionHint}>
            Tap the circle on a card to select multiple egg batches.
          </Text>
        </View>

        <View style={styles.list}>
          {loading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Loading records...</Text>
              <Text style={styles.emptyText}>
                Fetching saved egg batches for this color.
              </Text>
            </View>
          ) : filteredBatches.length ? (
            filteredBatches.map((egg) => {
              const fertility = formatEggFertilityPercent(egg);
              const isSelected = selectedIds.has(egg.id);
              const unhatchedCount = getDerivedUnhatchedQty(
                egg.eggQty ?? 0,
                egg.hatchedQty ?? 0,
                egg.damagedQty ?? 0,
              );

              return (
                <BlurCard
                  key={egg.id}
                  style={[styles.card, isSelected && styles.cardSelected]}
                  borderRadius={16}
                  intensity={20}
                >
                  <View style={styles.cardMainContainer}>
                    {/* Card Header */}
                    <View style={styles.cardTopRow}>
                      <Pressable
                        onPress={() => toggleSelection(egg.id)}
                        hitSlop={10}
                        style={styles.selectButton}
                        accessibilityRole="checkbox"
                        accessibilityState={{
                          checked: isSelected,
                        }}
                        accessibilityLabel={`Select batch ${egg.batchNo}`}
                      >
                        <MaterialCommunityIcons
                          name={
                            isSelected
                              ? "check-circle"
                              : "checkbox-blank-circle-outline"
                          }
                          size={22}
                          color={
                            isSelected
                              ? ChickIntelPalette.green1
                              : ChickIntelPalette.gray2
                          }
                        />
                      </Pressable>

                      <View style={styles.headerLeftStack}>
                        <View style={styles.batchPillBadge}>
                          <MaterialCommunityIcons
                            name="egg-outline"
                            size={12}
                            color="#111111"
                          />
                          <Text style={styles.batchPillText}>
                            Batch #{egg.batchNo}
                          </Text>
                        </View>

                        <View style={styles.originValueRow}>
                          <View
                            style={[
                              styles.colorTag,
                              {
                                backgroundColor: egg.colorHex || displayHex,
                              },
                            ]}
                          />
                          <Text style={styles.originName}>
                            {egg.colorName ?? egg.origin ?? "Default"}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardActionRow}>
                        <Pressable
                          onPress={() => openEdit(egg)}
                          hitSlop={8}
                          style={({ pressed }) => [
                            styles.actionIconBtn,
                            { opacity: pressed ? 0.72 : 1 },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit batch ${egg.batchNo}`}
                        >
                          <MaterialCommunityIcons
                            name="pencil-outline"
                            size={16}
                            color="#111111"
                          />
                        </Pressable>

                        <Pressable
                          onPress={() => confirmDeleteEgg(egg)}
                          hitSlop={8}
                          style={({ pressed }) => [
                            styles.actionIconBtn,
                            { opacity: pressed ? 0.72 : 1 },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete batch ${egg.batchNo}`}
                        >
                          <MaterialCommunityIcons
                            name="trash-can-outline"
                            size={16}
                            color="#923737"
                          />
                        </Pressable>
                      </View>
                    </View>

                    {/* Metrics Grid */}
                    <View style={styles.metricGridThree}>
                      <View style={styles.metricChip}>
                        <View style={styles.metricChipHeader}>
                          <MaterialCommunityIcons
                            name="egg"
                            size={13}
                            color="#111111"
                          />
                          <Text style={styles.metricChipLabel}>Egg Qty</Text>
                        </View>
                        <Text style={styles.metricChipValue}>
                          {egg.eggQty ?? 0}
                        </Text>
                      </View>

                      <View style={styles.metricChip}>
                        <View style={styles.metricChipHeader}>
                          <MaterialCommunityIcons
                            name="check-circle-outline"
                            size={13}
                            color="#111111"
                          />
                          <Text style={styles.metricChipLabel}>Hatched</Text>
                        </View>
                        <Text style={styles.metricChipValue}>
                          {egg.hatchedQty ?? 0}
                        </Text>
                      </View>

                      <View style={styles.metricChip}>
                        <View style={styles.metricChipHeader}>
                          <MaterialCommunityIcons
                            name="timer-sand"
                            size={13}
                            color="#111111"
                          />
                          <Text style={styles.metricChipLabel}>Unhatched</Text>
                        </View>
                        <Text style={styles.metricChipValue}>
                          {unhatchedCount}
                        </Text>
                      </View>

                      <View style={styles.metricChip}>
                        <View style={styles.metricChipHeader}>
                          <MaterialCommunityIcons
                            name="egg-off-outline"
                            size={13}
                            color="#111111"
                          />
                          <Text style={styles.metricChipLabel}>Damaged</Text>
                        </View>
                        <Text style={styles.metricChipValue}>
                          {egg.damagedQty ?? 0}
                        </Text>
                      </View>

                      <View style={styles.metricChip}>
                        <View style={styles.metricChipHeader}>
                          <MaterialCommunityIcons
                            name="star-outline"
                            size={13}
                            color="#111111"
                          />
                          <Text style={styles.metricChipLabel}>
                            Fertility %
                          </Text>
                        </View>
                        <Text style={styles.metricChipValue}>{fertility}</Text>
                      </View>
                    </View>
                  </View>
                </BlurCard>
              );
            })
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No saved records yet</Text>
              <Text style={styles.emptyText}>
                Add the first batch for this color from the create screen.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <PrimaryFab
        iconName="plus"
        onPress={() =>
          router.push({
            pathname: "/(tabs)/eggbatchitem/ageunit" as any,
            params: colorName
              ? {
                  color: colorName,
                  colorHex: displayHex,
                }
              : undefined,
          })
        }
        bottom={insets.bottom + TAB_BAR_OFFSET - 2 - FAB_OFFSET_FROM_TAB_TOP}
        accessibilityLabel="Add egg batch"
      />

      <Modal visible={editVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalKeyboardArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={insets.top}
        >
          <View style={styles.modalOverlay}>
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  Update Collected Eggs Information
                </Text>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Hatched Qty. :</Text>
                  <TextInput
                    value={editForm.hatchedQty}
                    onChangeText={(value) =>
                      setEditForm((state) => ({
                        ...state,
                        hatchedQty: value.replace(/[^0-9]/g, ""),
                      }))
                    }
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#B6B6B6"
                    style={styles.modalInput}
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Damaged Qty. :</Text>
                  <TextInput
                    value={editForm.damagedQty}
                    onChangeText={(value) =>
                      setEditForm((state) => ({
                        ...state,
                        damagedQty: value.replace(/[^0-9]/g, ""),
                      }))
                    }
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#B6B6B6"
                    style={styles.modalInput}
                  />
                </View>

                <View style={styles.modalField}>
                  <Text style={styles.modalLabel}>Unhatched Qty. :</Text>
                  <View style={styles.readonlyField}>
                    <Text style={styles.readonlyValue}>
                      {getDerivedUnhatchedQty(
                        selectedEgg?.eggQty ?? 0,
                        parseCount(editForm.hatchedQty),
                        parseCount(editForm.damagedQty),
                      )}
                    </Text>
                    <Text style={styles.readonlyHint}>
                      Auto-calculated from Egg Qty minus Hatched and Damaged.
                    </Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <Pressable
                    onPress={closeEdit}
                    style={styles.cancelBtn}
                    accessibilityRole="button"
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={saveEdit}
                    style={styles.saveBtn}
                    accessibilityRole="button"
                  >
                    <Text style={styles.saveText}>Save</Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.light1,
  },
  content: {
    paddingHorizontal: moderateScale(16),
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 8,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    paddingTop: 2,
  },
  headerActionBtn: {
    width: scale(34),
    height: verticalScale(34),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.18)",
    backgroundColor: ChickIntelPalette.light1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerDeleteBtn: {
    borderColor: "rgba(176,75,88,0.2)",
    backgroundColor: "rgba(176,75,88,0.08)",
  },
  backInlineBtn: {
    width: scale(32),
    height: verticalScale(32),
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ChickIntelPalette.light1,
  },
  pageTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.55,
    color: ChickIntelPalette.gray1,
  },
  subtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: "#5A6161",
  },
  subtitleMuted: {
    fontFamily: ChickFont.sans,
    color: "#8A8F8F",
    fontSize: responsiveFontSize(13),
  },
  selectionHintWrap: {
    paddingHorizontal: moderateScale(2),
  },
  selectionHint: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: ChickIntelPalette.gray2,
  },
  backBtn: {
    width: scale(38),
    height: verticalScale(38),
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.18)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ChickIntelPalette.light1,
  },
  list: {
    gap: 10,
  },
  card: {
    position: "relative",
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    shadowColor: "#317667",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(4) },
    elevation: 3,
    overflow: "hidden",
  },
  cardSelected: {
    borderColor: "rgba(49, 118, 103, 0.5)",
    backgroundColor: "#FFFFFF",
    shadowOpacity: 0.14,
  },
  statusAccentBar: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: scale(4),
  },
  cardMainContainer: {
    paddingLeft: 2,
    gap: 12,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectButton: {
    paddingRight: 2,
  },
  headerLeftStack: {
    flex: 1,
    gap: 4,
  },
  batchPillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
    alignSelf: "flex-start",
  },
  batchPillText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(12),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
    letterSpacing: -0.2,
  },
  originValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  colorTag: {
    width: scale(8),
    height: verticalScale(8),
    borderRadius: 4,
  },
  originName: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: ChickIntelPalette.gray1,
    fontWeight: "600",
  },
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionIconBtn: {
    width: scale(30),
    height: verticalScale(30),
    borderRadius: 8,
    backgroundColor: "rgba(244, 248, 247, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  metricGridThree: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metricChip: {
    flexGrow: 1,
    minWidth: scale(90),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.14)",
    backgroundColor: "rgba(244, 248, 247, 0.65)",
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(6),
    gap: 2,
  },
  metricChipHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricChipLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: "#5A6161",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  metricChipValue: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(14),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(16),
    gap: 4,
  },
  emptyTitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  emptyText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 18,
    color: "#7F8686",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: moderateScale(20),
  },
  modalKeyboardArea: {
    flex: 1,
  },
  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  modalCard: {
    borderRadius: 5,
    backgroundColor: ChickIntelPalette.light1,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.18)",
    padding: moderateScale(16),
    gap: 10,
    alignSelf: "stretch",
  },
  modalTitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    marginBottom: 2,
  },
  modalField: {
    gap: 6,
    width: "100%",
  },
  modalLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.gray1,
    fontWeight: "700",
  },
  modalInput: {
    height: verticalScale(38),
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.14)",
    backgroundColor: ChickIntelPalette.light1,
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(0),
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.gray1,
    textAlignVertical: "center",
    width: "100%",
  },
  readonlyField: {
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.14)",
    backgroundColor: "rgba(156,213,201,0.12)",
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(10),
    gap: 2,
  },
  readonlyValue: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  readonlyHint: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 15,
    color: ChickIntelPalette.gray2,
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    minHeight: verticalScale(36),
    borderRadius: 5,
    backgroundColor: ChickIntelPalette.gray1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "600",
    color: ChickIntelPalette.light1,
  },
  saveBtn: {
    flex: 1,
    minHeight: verticalScale(36),
    borderRadius: 5,
    backgroundColor: ChickIntelPalette.light1,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
});
