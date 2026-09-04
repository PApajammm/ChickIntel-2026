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
    TouchableOpacity,
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

function formatEggBatchId(value: string | number) {
  const digits = String(value).replace(/[^0-9]/g, "");
  return `BATCH E${(digits || "1").padStart(3, "0")}`;
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
  const [discrepancyModalVisible, setDiscrepancyModalVisible] = useState(false);

  const totalRecordedEggs = selectedEgg?.eggQty ?? 0;
  const hatchedCount = parseCount(editForm.hatchedQty);
  const damagedCount = parseCount(editForm.damagedQty);
  const totalUpdatedEggs = hatchedCount + damagedCount;
  const hasDiscrepancy = totalUpdatedEggs > totalRecordedEggs;
  const discrepancyQty = Math.max(0, totalUpdatedEggs - totalRecordedEggs);
  const derivedUnhatched = Math.max(0, totalRecordedEggs - totalUpdatedEggs);

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

    const hatched = parseCount(editForm.hatchedQty);
    const damaged = parseCount(editForm.damagedQty);
    const eggTotal = selectedEgg.eggQty ?? 0;

    if (hatched + damaged > eggTotal) {
      setDiscrepancyModalVisible(true);
      return;
    }

    const updatedEgg = {
      ...selectedEgg,
      hatchedQty: hatched,
      damagedQty: damaged,
      unhatchedQty: Math.max(0, eggTotal - hatched - damaged),
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
            paddingBottom: 15,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() =>
              router.replace({
                pathname: "/(tabs)/profiles" as any,
                params: { mode: "egg" },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Back to egg batch profile"
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color="#FFF"
            />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.pageTitle} numberOfLines={1}>
              Egg Batches per Color
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
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
                <TouchableOpacity
                  onPress={clearSelection}
                  style={styles.headerCloseBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Clear selected egg batches"
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="close" size={22} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmDeleteSelectedEggs}
                  style={styles.headerDeleteBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Delete selected egg batches"
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="trash-can-outline"
                    size={22}
                    color="#FFF"
                  />
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.headerRightPlaceholder} />
            )}
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
                  borderRadius={10}
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
                            {formatEggBatchId(egg.batchNo)}
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
                            size={12}
                            color="#8E9494"
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
                            size={12}
                            color="#8E9494"
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
                            size={12}
                            color="#8E9494"
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
                            size={12}
                            color="#8E9494"
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
                            size={12}
                            color="#8E9494"
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
        bottom={TAB_BAR_OFFSET - 2 - FAB_OFFSET_FROM_TAB_TOP}
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
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>
                  Update Collected Eggs Information
                </Text>

                {/* Batch Quantity Reference Pill */}
                <View style={styles.batchInfoRefRow}>
                  <MaterialCommunityIcons
                    name="egg-outline"
                    size={15}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.batchInfoRefText}>
                    Recorded Egg Batch Quantity:{" "}
                    <Text style={styles.batchInfoValueEmphasized}>
                      {totalRecordedEggs} eggs
                    </Text>
                  </Text>
                </View>

                {/* Discrepancy Warning Banner */}
                {hasDiscrepancy && (
                  <View style={styles.discrepancyBanner}>
                    <View style={styles.discrepancyBannerHeader}>
                      <MaterialCommunityIcons
                        name="alert-octagon"
                        size={16}
                        color="#DC2626"
                      />
                      <Text style={styles.discrepancyBannerTitle}>
                        Numbers Do Not Tally
                      </Text>
                    </View>
                    <Text style={styles.discrepancyBannerDesc}>
                      Hatched ({hatchedCount}) + Damaged ({damagedCount}) ={" "}
                      <Text style={{ fontWeight: "800" }}>{totalUpdatedEggs}</Text>, which
                      exceeds the recorded {totalRecordedEggs} eggs by{" "}
                      <Text style={{ fontWeight: "800", color: "#DC2626" }}>
                        {discrepancyQty} egg{discrepancyQty === 1 ? "" : "s"}
                      </Text>
                      . Adjust counts to save.
                    </Text>
                  </View>
                )}

                <View style={[styles.inputBoxInside, hasDiscrepancy && styles.inputBoxDiscrepancy]}>
                  <Text style={[styles.insideLabel, hasDiscrepancy && { color: "#DC2626" }]}>
                    Hatched Qty.
                  </Text>
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
                    placeholderTextColor="#9CA3AF"
                    style={styles.modalInputInside}
                  />
                </View>

                <View style={[styles.inputBoxInside, hasDiscrepancy && styles.inputBoxDiscrepancy]}>
                  <Text style={[styles.insideLabel, hasDiscrepancy && { color: "#DC2626" }]}>
                    Damaged Qty.
                  </Text>
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
                    placeholderTextColor="#9CA3AF"
                    style={styles.modalInputInside}
                  />
                </View>

                <View
                  style={[
                    styles.inputBoxInside,
                    styles.readonlyBoxInside,
                    hasDiscrepancy && styles.inputBoxDiscrepancy,
                  ]}
                >
                  <Text
                    style={[
                      styles.insideLabel,
                      hasDiscrepancy && { color: "#DC2626" },
                    ]}
                  >
                    Unhatched Qty. {hasDiscrepancy ? "(Mismatch)" : ""}
                  </Text>
                  <Text
                    style={[
                      styles.readonlyValueInside,
                      hasDiscrepancy && { color: "#DC2626" },
                    ]}
                  >
                    {hasDiscrepancy ? `0 (Exceeded by ${discrepancyQty})` : derivedUnhatched}
                  </Text>
                  <Text
                    style={[
                      styles.readonlyHint,
                      hasDiscrepancy && { color: "#991B1B" },
                    ]}
                  >
                    {hasDiscrepancy
                      ? `Sum of Hatched (${hatchedCount}) and Damaged (${damagedCount}) cannot exceed ${totalRecordedEggs}.`
                      : `Auto-calculated: ${totalRecordedEggs} Egg Qty - ${hatchedCount} Hatched - ${damagedCount} Damaged.`}
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={closeEdit}
                    style={styles.cancelBtn}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel changes"
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (hasDiscrepancy) {
                        setDiscrepancyModalVisible(true);
                        return;
                      }
                      saveEdit();
                    }}
                    disabled={hasDiscrepancy}
                    style={[
                      styles.saveBtn,
                      hasDiscrepancy && styles.saveBtnDisabled,
                    ]}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Save changes"
                  >
                    <Text
                      style={[
                        styles.saveText,
                        hasDiscrepancy && styles.saveTextDisabled,
                      ]}
                    >
                      {hasDiscrepancy ? "Cannot Save (Mismatch)" : "Save Changes"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Discrepancy Warning Notification Modal */}
      <Modal
        visible={discrepancyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDiscrepancyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.discrepancyModalCard}>
            <View style={styles.discrepancyModalIconWrap}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={36}
                color="#DC2626"
              />
            </View>
            <Text style={styles.discrepancyModalTitle}>
              Egg Numbers Do Not Tally
            </Text>
            <Text style={styles.discrepancyModalDesc}>
              The entered egg counts do not tally with the recorded batch quantity.
            </Text>

            <View style={styles.discrepancyBreakdownCard}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Recorded Total Eggs:</Text>
                <Text style={styles.breakdownValue}>{totalRecordedEggs}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Hatched Quantity:</Text>
                <Text style={styles.breakdownValue}>{hatchedCount}</Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Damaged Quantity:</Text>
                <Text style={styles.breakdownValue}>{damagedCount}</Text>
              </View>
              <View style={[styles.breakdownRow, styles.breakdownRowTotal]}>
                <Text
                  style={[
                    styles.breakdownLabel,
                    { fontWeight: "700", color: "#DC2626" },
                  ]}
                >
                  Total Sum Entered:
                </Text>
                <Text
                  style={[
                    styles.breakdownValue,
                    { fontWeight: "800", color: "#DC2626" },
                  ]}
                >
                  {totalUpdatedEggs} ({discrepancyQty} excess)
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.discrepancyModalBtn}
              onPress={() => setDiscrepancyModalVisible(false)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Review and correct egg numbers"
            >
              <Text style={styles.discrepancyModalBtnText}>
                Review & Correct
              </Text>
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
  content: {
    paddingHorizontal: moderateScale(16),
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  headerLeftRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitleWrap: {
    flex: 1,
    gap: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  headerCloseBtn: {
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
  headerDeleteBtn: {
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
  backButton: {
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
  headerRightPlaceholder: {
    width: scale(42),
  },
  pageTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.55,
    color: ChickIntelPalette.gray1,
    textAlign: "center",
  },
  subtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: ChickIntelPalette.green1,
    textAlign: "center",
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
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderRadius: 10,
    overflow: "hidden",
  },
  cardSelected: {
    backgroundColor: "#FFFFFF",
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
    alignItems: "flex-start",
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
    fontSize: responsiveFontSize(9),
    fontWeight: "700",
    color: "#8E9494",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  metricChipValue: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(14),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    textAlign: "right",
    paddingRight: moderateScale(10),
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
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
    padding: moderateScale(18),
    gap: 12,
    alignSelf: "stretch",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  modalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  batchInfoRefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(49, 118, 103, 0.09)",
    paddingHorizontal: moderateScale(11),
    paddingVertical: verticalScale(7),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.2)",
  },
  batchInfoRefText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "#334155",
    fontWeight: "600",
  },
  batchInfoValueEmphasized: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13.5),
    fontWeight: "900",
    color: ChickIntelPalette.green1,
    letterSpacing: -0.2,
  },
  discrepancyBanner: {
    backgroundColor: "rgba(220, 38, 38, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.3)",
    borderRadius: 10,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(8),
    gap: 3,
  },
  discrepancyBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  discrepancyBannerTitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "800",
    color: "#DC2626",
  },
  discrepancyBannerDesc: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11.5),
    lineHeight: 16,
    color: "#7F1D1D",
  },
  inputBoxDiscrepancy: {
    borderColor: "rgba(220, 38, 38, 0.4)",
    backgroundColor: "rgba(220, 38, 38, 0.03)",
  },
  inputBoxInside: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: moderateScale(12),
    paddingTop: verticalScale(7),
    paddingBottom: verticalScale(5),
    gap: 1,
    width: "100%",
  },
  readonlyBoxInside: {
    backgroundColor: "rgba(156, 213, 201, 0.14)",
    borderColor: "rgba(49, 118, 103, 0.2)",
    paddingBottom: verticalScale(7),
  },
  insideLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10.5),
    color: ChickIntelPalette.green1,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  modalInputInside: {
    minHeight: verticalScale(30),
    paddingHorizontal: 0,
    paddingVertical: verticalScale(1),
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    width: "100%",
  },
  readonlyValueInside: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    paddingVertical: verticalScale(2),
  },
  readonlyHint: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10.5),
    lineHeight: 14,
    color: ChickIntelPalette.gray2,
    marginTop: 1,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: verticalScale(6),
  },
  cancelBtn: {
    flex: 1,
    minHeight: verticalScale(42),
    borderRadius: 10,
    backgroundColor: "#F0F4F3",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  saveBtn: {
    flex: 1,
    minHeight: verticalScale(42),
    borderRadius: 10,
    backgroundColor: ChickIntelPalette.green1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.25)",
    shadowColor: "#317667",
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  saveBtnDisabled: {
    backgroundColor: "#CBD5E1",
    borderColor: "rgba(0, 0, 0, 0.08)",
    shadowOpacity: 0,
    elevation: 0,
  },
  saveText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  saveTextDisabled: {
    color: "#64748B",
  },
  discrepancyModalCard: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: moderateScale(20),
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  discrepancyModalIconWrap: {
    width: scale(52),
    height: verticalScale(52),
    borderRadius: 26,
    backgroundColor: "rgba(220, 38, 38, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  discrepancyModalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "800",
    color: "#1E293B",
    textAlign: "center",
  },
  discrepancyModalDesc: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12.5),
    lineHeight: 17,
    color: "#64748B",
    textAlign: "center",
  },
  discrepancyBreakdownCard: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
    marginVertical: verticalScale(4),
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  breakdownRowTotal: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: verticalScale(6),
    marginTop: verticalScale(2),
  },
  breakdownLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "#475569",
    fontWeight: "600",
  },
  breakdownValue: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12.5),
    color: "#1E293B",
    fontWeight: "700",
  },
  discrepancyModalBtn: {
    width: "100%",
    backgroundColor: ChickIntelPalette.green1,
    paddingVertical: verticalScale(11),
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: verticalScale(4),
  },
  discrepancyModalBtnText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13.5),
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
