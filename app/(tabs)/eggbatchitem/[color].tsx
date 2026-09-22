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
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";
import { PrimaryFab } from "@/components/ui/primary-fab";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import {
    formatBatchDateStamp,
    formatEggFertilityPercent,
    getCurrentBatchAgeLabel,
    isEggBatchCompleted,
    type BatchItem,
    type EggBatchItem,
} from "@/utils/batch-store";
import { logError } from "@/utils/logger";
import {
    createFarmChickBatch,
    fetchFarmBatches,
    promoteFarmChickBatch,
    updateFarmBatch,
} from "@/utils/supabase-batches";
import { recordDeletedEggBatch } from "@/utils/supabase-egg-batch-history";
import {
    deleteFarmEggBatch,
    fetchFarmEggBatches,
    updateFarmEggBatch,
} from "@/utils/supabase-egg-batches";
import { recordEggDisposition } from "@/utils/supabase-egg-dispositions";

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

function formatOriginBatchId(value?: string | number) {
  if (!value) return "ORIGIN C0001";
  const digits = String(value).replace(/[^0-9]/g, "");
  return `ORIGIN C${(digits || "1").padStart(4, "0")}`;
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

type EggAction = "transfer" | "sell" | "dispose";

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

function getAgeWeeks(batch: BatchItem) {
  const ageLabel = getCurrentBatchAgeLabel(batch);
  const match = ageLabel.match(/([\d.]+)\s+Weeks?/i);
  return match ? Number.parseFloat(match[1]) : 0;
}

function formatChickBatchId(batch: BatchItem) {
  if (/^SBC-/i.test(batch.id)) return batch.id;
  const digits = batch.id.replace(/\D/g, "");
  return `SBC-${(digits || "1").padStart(3, "0")}`;
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
    detailMode?: string;
    breed?: string;
  }>();

  const colorName = normalizeColor(params.color);
  const colorHex = normalizeColor(params.colorHex);
  const targetBatchNo =
    normalizeColor(params.batchNo) || normalizeColor(params.originBatchNo);
  const detailMode = normalizeColor(params.detailMode) || "parent";
  const isEggOnlyDetail = detailMode === "egg";
  const breedName = normalizeColor(params.breed) || "Chicken";
  const [savedEggBatches, setSavedEggBatches] = useState<EggBatchItem[]>([]);
  const [savedChickBatches, setSavedChickBatches] = useState<BatchItem[]>([]);
  const [activeSection, setActiveSection] = useState<"eggs" | "chicks">("eggs");
  const [loading, setLoading] = useState(false);
  const [selectedEgg, setSelectedEgg] = useState<EggBatchItem | null>(null);
  const [eggToDelete, setEggToDelete] = useState<EggBatchItem | null>(null);
  const [isDeletingEgg, setIsDeletingEgg] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editForm, setEditForm] = useState<EggEditState>({
    hatchedQty: "0",
    damagedQty: "0",
  });
  const [discrepancyModalVisible, setDiscrepancyModalVisible] = useState(false);
  const [actionEgg, setActionEgg] = useState<EggBatchItem | null>(null);
  const [actionType, setActionType] = useState<EggAction>("transfer");
  const [actionQty, setActionQty] = useState("");
  const [selectedChick, setSelectedChick] = useState<BatchItem | null>(null);
  const [chickAgeModalVisible, setChickAgeModalVisible] = useState(false);
  const [chickAgeCount, setChickAgeCount] = useState("0");
  const [chickAgeUnit, setChickAgeUnit] = useState<"Days old" | "Weeks old">("Weeks old");
  const [savingChickAge, setSavingChickAge] = useState(false);

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
      const [eggRows, chickenRows] = await Promise.all([
        fetchFarmEggBatches(activeFarm.id),
        fetchFarmBatches(activeFarm.id),
      ]);
      setSavedEggBatches(eggRows);
      setSavedChickBatches(chickenRows);
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

  const [eggStatusFilter, setEggStatusFilter] = useState<"active" | "archived">("active");

  const filteredBatches = useMemo(
    () =>
      savedEggBatches.filter((egg) =>
        matchesOriginBatch(egg, colorName, targetBatchNo),
      ),
    [colorName, targetBatchNo, savedEggBatches],
  );

  const activeBatches = useMemo(
    () => filteredBatches.filter((egg) => !isEggBatchCompleted(egg)),
    [filteredBatches],
  );

  const archivedBatches = useMemo(
    () => filteredBatches.filter((egg) => isEggBatchCompleted(egg)),
    [filteredBatches],
  );

  const displayedEggBatches = useMemo(
    () => (eggStatusFilter === "active" ? activeBatches : archivedBatches),
    [eggStatusFilter, activeBatches, archivedBatches],
  );

  const filteredChickBatches = useMemo(() => {
    const normalizedTarget = targetBatchNo.trim().toLowerCase();
    return savedChickBatches.filter(
      (batch) =>
        (batch.originBatchNo ?? "").trim().toLowerCase() === normalizedTarget,
    );
  }, [savedChickBatches, targetBatchNo]);

  const getAvailableActionQty = (egg: EggBatchItem, type: EggAction) => {
    if (type === "transfer") {
      return Math.max(0, egg.hatchedQty - egg.transferredHatchedQty);
    }
    if (type === "sell") return Math.max(0, egg.unhatchedQty - egg.soldQty);
    return Math.max(0, egg.damagedQty - egg.disposedDamagedQty);
  };

  const openEggAction = (egg: EggBatchItem, type: EggAction) => {
    const available = getAvailableActionQty(egg, type);
    if (available <= 0) {
      Alert.alert(
        "Nothing available",
        `There are no remaining ${type === "transfer" ? "hatched eggs" : type === "sell" ? "unhatched eggs" : "damaged eggs"} for this action.`,
      );
      return;
    }
    setActionEgg(egg);
    setActionType(type);
    setActionQty(String(available));
  };

  const promoteChickBatch = (batch: BatchItem) => {
    const ageWeeks = getAgeWeeks(batch);
    if (ageWeeks < 5) {
      Alert.alert(
        "Chicks are not ready",
        `${batch.id} is ${ageWeeks.toFixed(1)} weeks old. It can move to Chicken Batches at 5 weeks.`,
      );
      return;
    }

    Alert.alert(
      "Transfer to Chicken Batches",
      `Move ${batch.id} to the main Chicken Batch list?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Transfer",
          onPress: async () => {
            if (!activeFarm?.id) return;
            try {
              await promoteFarmChickBatch(activeFarm.id, batch.id);
              setSavedChickBatches((prev) =>
                prev.filter((item) => item.id !== batch.id),
              );
            } catch (error) {
              logError("Chick batch promotion failed", error, {
                farmId: activeFarm.id,
                batchNo: batch.id,
              });
              Alert.alert(
                "Transfer failed",
                "Unable to move this chick batch right now.",
              );
            }
          },
        },
      ],
    );
  };

  const openEditChickAge = (batch: BatchItem) => {
    setSelectedChick(batch);
    const rawLabel = (batch.ageLabel || "").trim();
    const isDays = /days?/i.test(rawLabel);
    const numMatch = rawLabel.match(/([\d.]+)/);
    const numVal = numMatch ? numMatch[1] : "0";
    setChickAgeCount(numVal);
    setChickAgeUnit(isDays ? "Days old" : "Weeks old");
    setChickAgeModalVisible(true);
  };

  const saveChickAge = async () => {
    if (!selectedChick || !activeFarm?.id) {
      setChickAgeModalVisible(false);
      return;
    }

    const val = Number.parseFloat(chickAgeCount);
    if (Number.isNaN(val) || val < 0) {
      Alert.alert("Invalid age", "Please enter a valid age.");
      return;
    }

    const unitString = chickAgeUnit === "Days old" ? "days old" : "weeks old";
    const newAgeLabel = `${chickAgeCount} ${unitString}`;
    const nowIso = new Date().toISOString();

    setSavingChickAge(true);
    try {
      await updateFarmBatch(activeFarm.id, selectedChick.id, {
        breed: selectedChick.breed,
        totalCount: selectedChick.totalCount,
        femaleCount: selectedChick.femaleCount,
        maleCount: selectedChick.maleCount,
        unknownCount: selectedChick.unknownCount,
        ageLabel: newAgeLabel,
        isolatedCount: selectedChick.isolatedCount,
        killedCount: selectedChick.killedCount,
      });

      setSavedChickBatches((prev) =>
        prev.map((item) =>
          item.id === selectedChick.id
            ? {
                ...item,
                ageLabel: newAgeLabel,
                createdAt: nowIso,
                updatedAt: nowIso,
              }
            : item,
        ),
      );
      setChickAgeModalVisible(false);
      setSelectedChick(null);
    } catch (error) {
      logError("Update chick age failed", error, {
        farmId: activeFarm.id,
        batchNo: selectedChick.id,
      });
      Alert.alert("Update failed", "Unable to update chick batch age right now.");
    } finally {
      setSavingChickAge(false);
    }
  };

  const confirmEggAction = () => {
    if (!actionEgg || !activeFarm?.id) return;
    const quantity = parseCount(actionQty);
    const available = getAvailableActionQty(actionEgg, actionType);
    if (quantity <= 0 || quantity > available) {
      Alert.alert("Invalid quantity", `Enter a value from 1 to ${available}.`);
      return;
    }

    const actionLabel =
      actionType === "transfer"
        ? "transfer to chicks"
        : actionType === "sell"
          ? "mark as sold"
          : "dispose";
    Alert.alert(
      "Confirm egg action",
      `Are you sure you want to ${actionLabel} ${quantity} egg${quantity === 1 ? "" : "s"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            const nowIso = new Date().toISOString();
            const nextValues = {
              transferredHatchedQty:
                actionEgg.transferredHatchedQty +
                (actionType === "transfer" ? quantity : 0),
              soldQty:
                actionEgg.soldQty + (actionType === "sell" ? quantity : 0),
              disposedDamagedQty:
                actionEgg.disposedDamagedQty +
                (actionType === "dispose" ? quantity : 0),
              updatedAt: nowIso,
            };
            try {
              if (actionType === "transfer") {
                const updatedChickBatch = await createFarmChickBatch(
                  activeFarm.id,
                  targetBatchNo,
                  quantity,
                  actionEgg.id,
                );
                setSavedChickBatches((prev) => {
                  const exists = prev.some(
                    (batch) => batch.id === updatedChickBatch.id,
                  );
                  return exists
                    ? prev.map((batch) =>
                        batch.id === updatedChickBatch.id
                          ? updatedChickBatch
                          : batch,
                      )
                    : [updatedChickBatch, ...prev];
                });
                await updateFarmEggBatch(activeFarm.id, actionEgg.id, {
                  transferredHatchedQty:
                    actionEgg.transferredHatchedQty + quantity,
                  updatedAt: nowIso,
                });
                await recordEggDisposition(activeFarm.id, {
                  eggBatchId: actionEgg.id,
                  originBatchNo: targetBatchNo || actionEgg.origin,
                  colorName: actionEgg.colorName,
                  colorHex: actionEgg.colorHex,
                  actionType: "transfer",
                  quantity,
                  targetChickBatchId: updatedChickBatch.id,
                });
                const updatedEgg = {
                  ...actionEgg,
                  transferredHatchedQty:
                    actionEgg.transferredHatchedQty + quantity,
                  updatedAt: nowIso,
                };
                setSavedEggBatches((prev) =>
                  prev.map((egg) =>
                    egg.id === updatedEgg.id ? updatedEgg : egg,
                  ),
                );
                setActionEgg(null);
                if (!isEggOnlyDetail) setActiveSection("chicks");
              } else {
                await updateFarmEggBatch(
                  activeFarm.id,
                  actionEgg.id,
                  nextValues,
                );
                await recordEggDisposition(activeFarm.id, {
                  eggBatchId: actionEgg.id,
                  originBatchNo: targetBatchNo || actionEgg.origin,
                  colorName: actionEgg.colorName,
                  colorHex: actionEgg.colorHex,
                  actionType,
                  quantity,
                });
                const updatedEgg = { ...actionEgg, ...nextValues };
                setSavedEggBatches((prev) =>
                  prev.map((egg) =>
                    egg.id === updatedEgg.id ? updatedEgg : egg,
                  ),
                );
                setActionEgg(null);
              }
            } catch (error) {
              logError("Egg disposition update failed", error, {
                farmId: activeFarm.id,
                eggBatchId: actionEgg.id,
                actionType,
              });
              Alert.alert("Action failed", "Unable to update this egg batch.");
            }
          },
        },
      ],
    );
  };

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
    setEggToDelete(egg);
  };

  const handleDeleteEggConfirm = async () => {
    if (!eggToDelete || !activeFarm?.id) return;

    setIsDeletingEgg(true);
    try {
      await recordDeletedEggBatch(activeFarm.id, eggToDelete);
      await deleteFarmEggBatch(activeFarm.id, eggToDelete.id);
      setSavedEggBatches((prev) =>
        prev.filter((item) => item.id !== eggToDelete.id),
      );
      setEggToDelete(null);
    } catch (error) {
      logError("Egg batch color screen delete failed", error, {
        farmId: activeFarm.id,
        eggBatchId: eggToDelete.id,
      });
      Alert.alert(
        "Delete failed",
        "Unable to delete this egg batch right now.",
      );
    } finally {
      setIsDeletingEgg(false);
    }
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

    const nowIso = new Date().toISOString();
    const updatedEgg = {
      ...selectedEgg,
      hatchedQty: hatched,
      damagedQty: damaged,
      unhatchedQty: Math.max(0, eggTotal - hatched - damaged),
      updatedAt: nowIso,
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
                params: { mode: isEggOnlyDetail ? "egg" : "chicken" },
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Back to egg batch profile"
            style={styles.backButton}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.pageTitle} numberOfLines={1}>
              {isEggOnlyDetail
                ? `Egg Batches | ${breedName} Batch ${targetBatchNo}`
                : `${breedName} Batch ${targetBatchNo}`}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {colorName ? (
                colorName
              ) : (
                <Text style={styles.subtitleMuted}>Selected color</Text>
              )}{" "}
              | {summaryMetrics.batchCount} batches | Fertility at collection{" "}
              {summaryMetrics.fertility}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/egg-batch-history" as any,
                  params: {
                    originBatchNo: targetBatchNo,
                    color: colorName,
                  },
                })
              }
              style={styles.headerHistoryButton}
              accessibilityRole="button"
              accessibilityLabel="Open egg disposition history"
            >
              <MaterialCommunityIcons name="history" size={21} color="#FFF" />
            </Pressable>
          </View>
        </View>

        <View style={styles.selectionHintWrap}>
          {!isEggOnlyDetail ? (
            <View style={styles.sectionTabs}>
              <Pressable
                onPress={() => setActiveSection("eggs")}
                style={[
                  styles.sectionTab,
                  activeSection === "eggs" && styles.sectionTabActive,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeSection === "eggs" }}
              >
                <MaterialCommunityIcons
                  name="egg-outline"
                  size={15}
                  color={
                    activeSection === "eggs"
                      ? "#FFFFFF"
                      : ChickIntelPalette.gray2
                  }
                />
                <Text
                  style={[
                    styles.sectionTabText,
                    activeSection === "eggs" && styles.sectionTabTextActive,
                  ]}
                >
                  Egg Batches
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveSection("chicks")}
                style={[
                  styles.sectionTab,
                  activeSection === "chicks" && styles.sectionTabActive,
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeSection === "chicks" }}
              >
                <MaterialCommunityIcons
                  name="bird"
                  size={15}
                  color={
                    activeSection === "chicks"
                      ? "#FFFFFF"
                      : ChickIntelPalette.gray2
                  }
                />
                <Text
                  style={[
                    styles.sectionTabText,
                    activeSection === "chicks" && styles.sectionTabTextActive,
                  ]}
                >
                  Chicks
                </Text>
              </Pressable>
            </View>
          ) : null}
          <Text style={styles.selectionHint}>
            {activeSection === "eggs"
              ? "Egg records from this chicken batch. Transfer hatched eggs, sell unhatched eggs, or dispose damaged eggs."
              : "Chick batches created from this chicken batch appear here."}
          </Text>
          {activeSection === "eggs" && archivedBatches.length > 0 ? (
            <View style={styles.statusPillBar}>
              <Pressable
                onPress={() => setEggStatusFilter("active")}
                style={[
                  styles.statusPill,
                  eggStatusFilter === "active" && styles.statusPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    eggStatusFilter === "active" && styles.statusPillTextActive,
                  ]}
                >
                  Active ({activeBatches.length})
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setEggStatusFilter("archived")}
                style={[
                  styles.statusPill,
                  eggStatusFilter === "archived" && styles.statusPillActive,
                ]}
              >
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={12}
                  color={
                    eggStatusFilter === "archived"
                      ? "#FFFFFF"
                      : ChickIntelPalette.green1
                  }
                />
                <Text
                  style={[
                    styles.statusPillText,
                    eggStatusFilter === "archived" &&
                      styles.statusPillTextActive,
                  ]}
                >
                  Archived ({archivedBatches.length})
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {activeSection === "chicks" ? (
          <View style={styles.list}>
            {filteredChickBatches.length ? (
              filteredChickBatches.map((batch) => (
                <BlurCard
                  key={batch.id}
                  style={styles.card}
                  borderRadius={14}
                  intensity={20}
                >
                  <View style={styles.cardMainContainer}>
                    <View style={styles.cardTopRow}>
                      <View style={styles.batchPillBadge}>
                        <MaterialCommunityIcons
                          name="bird"
                          size={12}
                          color="#111111"
                        />
                        <Text style={styles.batchPillText}>
                          {formatChickBatchId(batch)}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.breedTitle}>
                      {batch.breed || "Chick batch"}
                    </Text>

                    <Text style={styles.createdDateText}>
                      {formatBatchDateStamp(batch.createdAt, batch.updatedAt)}
                    </Text>

                    <View style={styles.metricsRow}>
                      <View style={styles.metricChip}>
                        <Text style={styles.metricChipLabel}>Chicks</Text>
                        <Text style={styles.metricChipValue}>
                          {batch.totalCount}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => openEditChickAge(batch)}
                        style={({ pressed }) => [
                          styles.metricChip,
                          styles.metricChipEditable,
                          { opacity: pressed ? 0.75 : 1 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit age for ${formatChickBatchId(batch)}`}
                      >
                        <View style={styles.metricChipLabelRow}>
                          <Text style={styles.metricChipLabel}>Age</Text>
                          <MaterialCommunityIcons
                            name="pencil-outline"
                            size={10}
                            color="#52615D"
                          />
                        </View>
                        <Text style={styles.metricChipValue}>
                          {getCurrentBatchAgeLabel(batch)}
                        </Text>
                      </Pressable>
                      <View style={styles.metricChip}>
                        <Text style={styles.metricChipLabel}>Origin</Text>
                        <Text style={styles.metricChipValue}>
                          Batch {batch.originBatchNo || targetBatchNo || "-"}
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={() => promoteChickBatch(batch)}
                      style={({ pressed }) => [
                        styles.promoteChickBtn,
                        { opacity: pressed ? 0.78 : 1, marginTop: 4 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Transfer ${batch.id} to Chicken Batches`}
                    >
                      <MaterialCommunityIcons
                        name="arrow-up-circle-outline"
                        size={16}
                        color={ChickIntelPalette.green1}
                      />
                      <Text style={styles.promoteChickText}>
                        {getAgeWeeks(batch) >= 5
                          ? "Transfer to Chicken Batches"
                          : "Ready at 5 weeks"}
                      </Text>
                    </Pressable>
                  </View>
                </BlurCard>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No chick batches yet</Text>
                <Text style={styles.emptyText}>
                  Open Egg Batches, record hatched eggs, then create the first
                  chick batch.
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.list}>
            {loading ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Loading records...</Text>
                <Text style={styles.emptyText}>
                  Fetching saved egg batches for this color.
                </Text>
              </View>
            ) : displayedEggBatches.length ? (
              displayedEggBatches.map((egg) => {
                const isCompleted = isEggBatchCompleted(egg);
                const fertility = formatEggFertilityPercent(egg);
                const unhatchedCount = getDerivedUnhatchedQty(
                  egg.eggQty ?? 0,
                  egg.hatchedQty ?? 0,
                  egg.damagedQty ?? 0,
                );
                const remainingHatched = Math.max(
                  0,
                  egg.hatchedQty - egg.transferredHatchedQty,
                );
                const remainingUnhatched = Math.max(
                  0,
                  unhatchedCount - egg.soldQty,
                );
                const remainingDamaged = Math.max(
                  0,
                  egg.damagedQty - egg.disposedDamagedQty,
                );

                return (
                  <BlurCard
                    key={egg.id}
                    style={styles.card}
                    borderRadius={14}
                    intensity={20}
                  >
                    <View style={styles.cardMainContainer}>
                      {/* Card Header */}
                      <View style={styles.cardTopRow}>
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

                        <View style={styles.cardActionRow}>
                          {isCompleted ? (
                            <View style={styles.completedStatusBadge}>
                              <MaterialCommunityIcons
                                name="check-circle"
                                size={13}
                                color={ChickIntelPalette.green1}
                              />
                              <Text style={styles.completedStatusText}>
                                Archived
                              </Text>
                            </View>
                          ) : (
                            <>
                              <Pressable
                                onPress={() => openEggAction(egg, "transfer")}
                                hitSlop={8}
                                style={({ pressed }) => [
                                  styles.createChickBtn,
                                  { opacity: pressed ? 0.72 : 1 },
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`Transfer hatched eggs from batch ${egg.batchNo}`}
                              >
                                <MaterialCommunityIcons
                                  name="bird"
                                  size={15}
                                  color={ChickIntelPalette.green1}
                                />
                              </Pressable>
                              <Pressable
                                onPress={() => openEggAction(egg, "sell")}
                                hitSlop={8}
                                style={({ pressed }) => [
                                  styles.actionIconBtn,
                                  { opacity: pressed ? 0.72 : 1 },
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`Sell unhatched eggs from batch ${egg.batchNo}`}
                              >
                                <MaterialCommunityIcons
                                  name="cart-outline"
                                  size={15}
                                  color="#2D8C74"
                                />
                              </Pressable>
                              <Pressable
                                onPress={() => openEggAction(egg, "dispose")}
                                hitSlop={8}
                                style={({ pressed }) => [
                                  styles.actionIconBtn,
                                  { opacity: pressed ? 0.72 : 1 },
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`Dispose damaged eggs from batch ${egg.batchNo}`}
                              >
                                <MaterialCommunityIcons
                                  name="delete-sweep-outline"
                                  size={15}
                                  color="#923737"
                                />
                              </Pressable>
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
                                  size={15}
                                  color="#111111"
                                />
                              </Pressable>
                            </>
                          )}

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
                              size={15}
                              color="#923737"
                            />
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.originPillBadge}>
                        <View
                          style={[
                            styles.colorDot,
                            {
                              backgroundColor: egg.colorHex || displayHex,
                            },
                          ]}
                        />
                        <Text style={styles.originPillText}>
                          {formatOriginBatchId(egg.origin || targetBatchNo)}
                        </Text>
                      </View>

                      <Text style={styles.createdDateText}>
                        {formatBatchDateStamp(egg.createdAt, egg.updatedAt)}
                      </Text>

                      {/* Row 1: Egg Inventory */}
                      <View style={styles.metricsRow}>
                        <View style={styles.metricChip}>
                          <Text style={styles.metricChipLabel}>Recorded</Text>
                          <Text style={styles.metricChipValue}>
                            {egg.eggQty ?? 0}
                          </Text>
                        </View>
                        <View style={styles.metricChip}>
                          <Text style={styles.metricChipLabel}>Hatched</Text>
                          <Text style={styles.metricChipValue}>
                            {egg.hatchedQty ?? 0}
                          </Text>
                        </View>
                        <View style={styles.metricChip}>
                          <Text style={styles.metricChipLabel}>Damaged</Text>
                          <Text style={styles.metricChipValue}>
                            {egg.damagedQty ?? 0}
                          </Text>
                        </View>
                        <View style={styles.metricChip}>
                          <Text style={styles.metricChipLabel}>Unhatched</Text>
                          <Text style={styles.metricChipValue}>
                            {unhatchedCount}
                          </Text>
                        </View>
                      </View>

                      {/* Row 2: Availability & Rates */}
                      <View style={styles.metricsRow}>
                        <View style={styles.metricChip}>
                          <Text style={styles.metricChipLabel}>Ready to Hatch</Text>
                          <Text style={styles.metricChipValue}>
                            {remainingHatched}
                          </Text>
                        </View>
                        <View style={styles.metricChip}>
                          <Text style={styles.metricChipLabel}>Ready to Sell</Text>
                          <Text style={styles.metricChipValue}>
                            {remainingUnhatched}
                          </Text>
                        </View>
                        <View style={styles.metricChip}>
                          <Text style={styles.metricChipLabel}>To Dispose</Text>
                          <Text style={styles.metricChipValue}>
                            {remainingDamaged}
                          </Text>
                        </View>
                        <View style={styles.metricChip}>
                          <Text style={styles.metricChipLabel}>Fertility</Text>
                          <Text style={styles.metricChipValue}>{fertility}</Text>
                        </View>
                      </View>

                      <View style={styles.dispositionRow}>
                        <Text style={styles.dispositionText}>
                          Chicks transferred: {egg.transferredHatchedQty}/
                          {egg.hatchedQty}
                        </Text>
                        <Text style={styles.dispositionText}>
                          Sold: {egg.soldQty}/{egg.unhatchedQty}
                        </Text>
                        <Text style={styles.dispositionText}>
                          Disposed: {egg.disposedDamagedQty}/{egg.damagedQty}
                        </Text>
                      </View>
                    </View>
                  </BlurCard>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                {eggStatusFilter === "active" && archivedBatches.length > 0 ? (
                  <>
                    <MaterialCommunityIcons
                      name="check-decagram-outline"
                      size={36}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.emptyTitle}>All batches completed</Text>
                    <Text style={styles.emptyText}>
                      All {archivedBatches.length} egg batch(es) under this origin have been fully settled and archived.
                    </Text>
                    <Pressable
                      onPress={() => setEggStatusFilter("archived")}
                      style={styles.viewArchiveBtn}
                    >
                      <Text style={styles.viewArchiveBtnText}>
                        View Archived ({archivedBatches.length})
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.emptyTitle}>
                      {eggStatusFilter === "archived"
                        ? "No archived egg batches"
                        : "No egg batches yet"}
                    </Text>
                    <Text style={styles.emptyText}>
                      {eggStatusFilter === "archived"
                        ? "Completed egg batches will appear here."
                        : "Use the plus button below to create your first egg batch."}
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <PrimaryFab
        iconName="plus"
        variant="green"
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

      {/* Chick Age Edit Modal */}
      <Modal
        visible={chickAgeModalVisible && selectedChick !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setChickAgeModalVisible(false);
          setSelectedChick(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={insets.top}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <View style={styles.modalHeaderIconBadge}>
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={18}
                      color="#FFFFFF"
                    />
                  </View>
                  <Text style={styles.modalTitle}>Edit Chick Batch Age</Text>
                </View>
                <Text style={styles.modalSubtitle}>
                  {selectedChick
                    ? `${formatChickBatchId(selectedChick)} • ${selectedChick.breed || "Chick batch"}`
                    : "Chick batch"}
                </Text>
              </View>

              <View style={styles.modalBody}>
                <Text style={styles.modalLabel}>Age Value</Text>
                <TextInput
                  value={chickAgeCount}
                  onChangeText={(value) =>
                    setChickAgeCount(value.replace(/[^0-9.]/g, ""))
                  }
                  keyboardType="decimal-pad"
                  style={styles.modalInput}
                  placeholder="Age value"
                  placeholderTextColor={ChickIntelPalette.gray2}
                />

                <Text style={styles.modalLabel}>Age Unit</Text>
                <View style={styles.chickAgeUnitRow}>
                  <Pressable
                    onPress={() => setChickAgeUnit("Weeks old")}
                    style={[
                      styles.chickAgeUnitBtn,
                      chickAgeUnit === "Weeks old" &&
                        styles.chickAgeUnitBtnActive,
                    ]}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.chickAgeUnitBtnText,
                        chickAgeUnit === "Weeks old" &&
                          styles.chickAgeUnitBtnTextActive,
                      ]}
                    >
                      Weeks old
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setChickAgeUnit("Days old")}
                    style={[
                      styles.chickAgeUnitBtn,
                      chickAgeUnit === "Days old" &&
                        styles.chickAgeUnitBtnActive,
                    ]}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.chickAgeUnitBtnText,
                        chickAgeUnit === "Days old" &&
                          styles.chickAgeUnitBtnTextActive,
                      ]}
                    >
                      Days old
                    </Text>
                  </Pressable>
                </View>

                <Text style={styles.actionModalHint}>
                  Chicks can be transferred to Chicken Batches at 5 weeks (35 days).
                </Text>

                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => {
                      setChickAgeModalVisible(false);
                      setSelectedChick(null);
                    }}
                    style={styles.modalCancel}
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={saveChickAge}
                    style={[
                      styles.modalSave,
                      savingChickAge && { opacity: 0.6 },
                    ]}
                    disabled={savingChickAge}
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalSaveText}>
                      {savingChickAge ? "Saving..." : "Save Age"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Egg Action Modal (Transfer Hatched Eggs / Sell / Dispose) */}
      <Modal
        visible={actionEgg !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActionEgg(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={insets.top}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderTitleRow}>
                  <View style={styles.modalHeaderIconBadge}>
                    <MaterialCommunityIcons
                      name={
                        actionType === "transfer"
                          ? "bird"
                          : actionType === "sell"
                            ? "cart-outline"
                            : "delete-sweep-outline"
                      }
                      size={18}
                      color="#FFFFFF"
                    />
                  </View>
                  <Text style={styles.modalTitle}>
                    {actionType === "transfer"
                      ? "Transfer Hatched Eggs"
                      : actionType === "sell"
                        ? "Sell Unhatched Eggs"
                        : "Dispose Damaged Eggs"}
                  </Text>
                </View>
                <Text style={styles.modalSubtitle}>
                  Available:{" "}
                  {actionEgg
                    ? getAvailableActionQty(actionEgg, actionType)
                    : 0}{" "}
                  eggs ready for this action.
                </Text>
              </View>

              <View style={styles.modalBody}>
                <Text style={styles.modalLabel}>Quantity to {actionType}</Text>
                <TextInput
                  value={actionQty}
                  onChangeText={(value) =>
                    setActionQty(value.replace(/[^0-9]/g, ""))
                  }
                  keyboardType="number-pad"
                  style={styles.modalInput}
                  autoFocus
                  placeholder="Enter quantity"
                  placeholderTextColor={ChickIntelPalette.gray2}
                />
                <Text style={styles.actionModalHint}>
                  {actionType === "transfer"
                    ? "Transferred hatched eggs will be recorded as chicks under this chicken batch."
                    : actionType === "sell"
                      ? "Only remaining unhatched eggs can be marked as sold."
                      : "Only remaining damaged eggs can be disposed. This action cannot be undone."}
                </Text>
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => setActionEgg(null)}
                    style={styles.modalCancel}
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={confirmEggAction}
                    style={styles.modalSave}
                    accessibilityRole="button"
                  >
                    <Text style={styles.modalSaveText}>Continue</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
                      <Text style={{ fontWeight: "800" }}>
                        {totalUpdatedEggs}
                      </Text>
                      , which exceeds the recorded {totalRecordedEggs} eggs by{" "}
                      <Text style={{ fontWeight: "800", color: "#DC2626" }}>
                        {discrepancyQty} egg{discrepancyQty === 1 ? "" : "s"}
                      </Text>
                      . Adjust counts to save.
                    </Text>
                  </View>
                )}

                <View
                  style={[
                    styles.inputBoxInside,
                    hasDiscrepancy && styles.inputBoxDiscrepancy,
                  ]}
                >
                  <Text
                    style={[
                      styles.insideLabel,
                      hasDiscrepancy && { color: "#DC2626" },
                    ]}
                  >
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

                <View
                  style={[
                    styles.inputBoxInside,
                    hasDiscrepancy && styles.inputBoxDiscrepancy,
                  ]}
                >
                  <Text
                    style={[
                      styles.insideLabel,
                      hasDiscrepancy && { color: "#DC2626" },
                    ]}
                  >
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
                    {hasDiscrepancy
                      ? `0 (Exceeded by ${discrepancyQty})`
                      : derivedUnhatched}
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
                      {hasDiscrepancy
                        ? "Cannot Save (Mismatch)"
                        : "Save Changes"}
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
              The entered egg counts do not tally with the recorded batch
              quantity.
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

      <DeleteConfirmationModal
        visible={Boolean(eggToDelete)}
        title="Delete Egg Batch?"
        subtitle="This action cannot be undone."
        itemBadge="EGG BATCH"
        itemTitle={eggToDelete ? `Batch ${eggToDelete.batchNo}` : undefined}
        itemSubtitle={eggToDelete ? `${eggToDelete.eggQty} eggs • ${formatBatchDateStamp(eggToDelete.createdAt, eggToDelete.updatedAt)}` : undefined}
        message="Are you sure you want to delete this egg batch? This batch will be moved to deleted egg history."
        confirmLabel="Delete"
        isDeleting={isDeletingEgg}
        onConfirm={handleDeleteEggConfirm}
        onCancel={() => {
          if (!isDeletingEgg) setEggToDelete(null);
        }}
      />
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
  headerHistoryButton: {
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
    color: "#40524B",
  },
  actionGuide: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10.5),
    lineHeight: 15,
    color: "#40524B",
    backgroundColor: "rgba(49, 118, 103, 0.07)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  promoteChickBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.2)",
    backgroundColor: "rgba(49, 118, 103, 0.08)",
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  promoteChickText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: "#40524B",
  },
  sectionTabs: {
    flexDirection: "row",
    gap: 6,
    padding: 3,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.78)",
  },
  sectionTab: {
    flex: 1,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  sectionTabActive: {
    backgroundColor: ChickIntelPalette.green1,
  },
  sectionTabText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.textMuted,
  },
  sectionTabTextActive: {
    color: "#FFFFFF",
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
    gap: 2,
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
    minHeight: verticalScale(28),
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
  breedTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: ChickIntelPalette.gray1,
    marginTop: 4,
  },
  originPillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(244, 248, 247, 0.9)",
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    minHeight: verticalScale(26),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
    alignSelf: "flex-start",
    marginTop: verticalScale(2),
  },
  originPillText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(11.5),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
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
  colorDot: {
    width: scale(8),
    height: verticalScale(8),
    borderRadius: 4,
  },
  originName: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: "#263832",
    fontWeight: "600",
  },
  createdDateText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 16,
    color: "#52615D",
    paddingBottom: 10,
    marginTop: verticalScale(-2),
  },
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  createChickBtn: {
    width: scale(28),
    height: verticalScale(28),
    borderRadius: 8,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconBtn: {
    width: scale(28),
    height: verticalScale(28),
    borderRadius: 8,
    backgroundColor: "rgba(244, 248, 247, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  metricChip: {
    flex: 1,
    backgroundColor: "rgba(49, 118, 103, 0.08)",
    borderRadius: 8,
    paddingVertical: verticalScale(6),
    paddingHorizontal: moderateScale(4),
    alignItems: "center",
    justifyContent: "center",
  },
  metricChipEditable: {
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.28)",
  },
  metricChipLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  metricChipLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(9.5),
    fontWeight: "600",
    color: "#52615D",
    textAlign: "center",
  },
  metricChipValue: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(12.5),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    marginTop: 2,
    textAlign: "center",
  },
  chickAgeUnitRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  chickAgeUnitBtn: {
    flex: 1,
    paddingVertical: verticalScale(9),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.2)",
    backgroundColor: "rgba(49, 118, 103, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  chickAgeUnitBtnActive: {
    backgroundColor: ChickIntelPalette.green1,
    borderColor: ChickIntelPalette.green1,
  },
  chickAgeUnitBtnText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11.5),
    fontWeight: "700",
    color: "#40524B",
  },
  chickAgeUnitBtnTextActive: {
    color: "#FFFFFF",
  },
  dispositionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  dispositionText: {
    flexGrow: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "600",
    color: "#52615D",
    backgroundColor: "rgba(49, 118, 103, 0.06)",
    borderRadius: 6,
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(4),
    textAlign: "center",
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
    color: "#40524B",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
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
    width: "100%",
    maxWidth: scale(500),
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: verticalScale(6) },
    elevation: 8,
  },
  modalHeader: {
    backgroundColor: ChickIntelPalette.green1,
    paddingHorizontal: moderateScale(18),
    paddingVertical: verticalScale(14),
  },
  modalHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalHeaderIconBadge: {
    width: scale(32),
    height: verticalScale(32),
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(17),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 4,
  },
  modalBody: {
    padding: moderateScale(18),
    gap: 12,
  },
  modalLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: ChickIntelPalette.gray1,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
    borderRadius: 10,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(10),
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    color: ChickIntelPalette.gray1,
    backgroundColor: "#F9FAFA",
  },
  actionModalHint: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11.5),
    lineHeight: 16,
    color: ChickIntelPalette.textMuted,
  },
  modalCancel: {
    paddingVertical: verticalScale(10),
    paddingHorizontal: moderateScale(16),
    borderRadius: 10,
    backgroundColor: "#F0F2F2",
  },
  modalCancelText: {
    fontFamily: ChickFont.sans,
    color: ChickIntelPalette.gray1,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
  },
  modalSave: {
    paddingVertical: verticalScale(10),
    paddingHorizontal: moderateScale(18),
    backgroundColor: ChickIntelPalette.green1,
    borderRadius: 10,
  },
  modalSaveText: {
    fontFamily: ChickFont.sans,
    color: "#FFFFFF",
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
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
  actionQuantityInput: {
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
    borderRadius: 8,
    paddingHorizontal: moderateScale(10),
    minHeight: verticalScale(42),
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
    color: ChickIntelPalette.textMuted,
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
  statusPillBar: {
    flexDirection: "row",
    gap: 8,
    marginTop: verticalScale(6),
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(4),
    borderRadius: 999,
    backgroundColor: "rgba(49, 118, 103, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
  },
  statusPillActive: {
    backgroundColor: ChickIntelPalette.green1,
    borderColor: ChickIntelPalette.green1,
  },
  statusPillText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  statusPillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  completedStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(4),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.25)",
  },
  completedStatusText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  viewArchiveBtn: {
    marginTop: verticalScale(10),
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(8),
    borderRadius: 8,
    backgroundColor: ChickIntelPalette.green1,
  },
  viewArchiveBtnText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
