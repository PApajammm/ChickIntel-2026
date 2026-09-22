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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { BlurCard } from "@/components/ui/blur-card";
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";
import { PrimaryFab } from "@/components/ui/primary-fab";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { getFarmColors } from "@/constants/farm-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/providers/auth-provider";
import {
  type BatchItem,
  type EggBatchItem,
  formatBatchDateStamp,
  formatEggFertilityPercent,
  getCurrentBatchAgeLabel,
} from "@/utils/batch-store";
import { MIN_CHICKEN_BATCH_AGE_WEEKS } from "@/utils/chicken-batch-rules";
import { logError, logStep } from "@/utils/logger";
import {
  createFarmChickBatch,
  deleteFarmBatch,
  fetchFarmBatches,
  updateFarmBatch,
} from "@/utils/supabase-batches";
import { recordDeletedChickenBatch } from "@/utils/supabase-chicken-batch-history";
import { recordDeletedEggBatch } from "@/utils/supabase-egg-batch-history";
import {
  deleteFarmEggBatch,
  fetchFarmEggBatches,
  updateFarmEggBatch,
} from "@/utils/supabase-egg-batches";
import { recordEggDisposition } from "@/utils/supabase-egg-dispositions";

const TAB_BAR_OFFSET = 55;
const FAB_OFFSET_FROM_TAB_TOP = 50;
const AGE_UNIT_OPTIONS = ["Weeks old"] as const;

type EggAction = "transfer" | "sell" | "dispose";

type EggEditState = {
  hatchedQty: string;
  damagedQty: string;
};

type ChickenEditFormState = {
  breed: string;
  totalCount: string;
  femaleCount: string;
  maleCount: string;
  unknownCount: string;
  isolatedCount: string;
  killedCount: string;
  ageCount: string;
  ageLabel: (typeof AGE_UNIT_OPTIONS)[number];
};

function parseCount(value: string) {
  return Math.max(0, Number.parseInt(value || "0", 10) || 0);
}

function parseAgeLabel(value: string) {
  return value.match(/\d+(?:\.\d+)?/)?.[0] ?? "0";
}

function clampNonNegative(value: number) {
  return Math.max(0, value);
}

function getDerivedUnhatchedQty(
  eggQty: number,
  hatchedQty: number,
  damagedQty: number,
) {
  return clampNonNegative(eggQty - hatchedQty - damagedQty);
}

function formatEggBatchId(value: string | number) {
  const digits = String(value).replace(/[^0-9]/g, "");
  return `BATCH E${(digits || "1").padStart(4, "0")}`;
}

function formatOriginBatchId(value?: string | number) {
  if (!value) return "BATCH C0001";
  const digits = String(value).replace(/[^0-9]/g, "");
  return `BATCH C${(digits || "1").padStart(4, "0")}`;
}

function formatProfileBatchId(prefix: "C" | "E", value: string | number) {
  const digits = String(value).replace(/[^0-9]/g, "");
  return `BATCH ${prefix}${(digits || "1").padStart(3, "0")}`;
}

function formatCreatedDate(value?: string) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return `Added ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export default function ProfilesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeFarm } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getFarmColors(colorScheme);
  const { mode: profileModeParam } = useLocalSearchParams<{
    mode?: string;
  }>();
  const [mode, setMode] = useState<"chicken" | "egg">(
    profileModeParam === "egg" ? "egg" : "chicken",
  );

  useEffect(() => {
    if (profileModeParam === "egg" || profileModeParam === "chicken") {
      setMode(profileModeParam);
    }
  }, [profileModeParam]);

  const [chickenData, setChickenData] = useState<BatchItem[]>([]);
  const [chickenLoading, setChickenLoading] = useState(true);
  const [chickenError, setChickenError] = useState<string | null>(null);

  const [savedEggBatches, setSavedEggBatches] = useState<EggBatchItem[]>([]);
  const [eggError, setEggError] = useState<string | null>(null);

  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [ageUnitMenuVisible, setAgeUnitMenuVisible] = useState(false);
  const [formState, setFormState] = useState<ChickenEditFormState>({
    breed: "",
    totalCount: "",
    femaleCount: "",
    maleCount: "",
    unknownCount: "",
    isolatedCount: "",
    killedCount: "",
    ageCount: "",
    ageLabel: AGE_UNIT_OPTIONS[0],
  });

  const [batchToDelete, setBatchToDelete] = useState<BatchItem | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  const [selectedEgg, setSelectedEgg] = useState<EggBatchItem | null>(null);
  const [eggToDelete, setEggToDelete] = useState<EggBatchItem | null>(null);
  const [isDeletingEgg, setIsDeletingEgg] = useState(false);
  const [eggEditVisible, setEggEditVisible] = useState(false);
  const [eggEditForm, setEggEditForm] = useState<EggEditState>({
    hatchedQty: "0",
    damagedQty: "0",
  });
  const [discrepancyModalVisible, setDiscrepancyModalVisible] = useState(false);
  const [actionEgg, setActionEgg] = useState<EggBatchItem | null>(null);
  const [actionType, setActionType] = useState<EggAction>("transfer");
  const [actionQty, setActionQty] = useState("");

  const totalRecordedEggs = selectedEgg?.eggQty ?? 0;
  const hatchedCount = parseCount(eggEditForm.hatchedQty);
  const damagedCount = parseCount(eggEditForm.damagedQty);
  const totalUpdatedEggs = hatchedCount + damagedCount;
  const hasDiscrepancy = totalUpdatedEggs > totalRecordedEggs;
  const discrepancyQty = Math.max(0, totalUpdatedEggs - totalRecordedEggs);
  const derivedUnhatched = Math.max(0, totalRecordedEggs - totalUpdatedEggs);

  const loadChickenBatches = useCallback(async () => {
    if (!activeFarm?.id) {
      setChickenData([]);
      setChickenLoading(false);
      return;
    }

    setChickenLoading(true);
    setChickenError(null);

    try {
      const rows = await fetchFarmBatches(activeFarm.id);
      setChickenData(rows);
      logStep("Profiles chicken batches loaded", {
        farmId: activeFarm.id,
        count: rows.length,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load chicken batches.";
      setChickenError(message);
      logError("Profiles chicken batches load failed", error, {
        farmId: activeFarm.id,
      });
    } finally {
      setChickenLoading(false);
    }
  }, [activeFarm?.id]);

  const loadEggBatches = useCallback(async () => {
    if (!activeFarm?.id) {
      setSavedEggBatches([]);
      setEggError(null);
      return;
    }

    setEggError(null);
    try {
      const rows = await fetchFarmEggBatches(activeFarm.id);
      setSavedEggBatches(rows);
    } catch (error) {
      setEggError(
        error instanceof Error ? error.message : "Unable to load egg batches.",
      );
      logError("Profiles egg batches load failed", error, {
        farmId: activeFarm.id,
      });
    }
  }, [activeFarm?.id]);

  useEffect(() => {
    void loadChickenBatches();
    void loadEggBatches();
  }, [loadChickenBatches, loadEggBatches]);

  useFocusEffect(
    useCallback(() => {
      void loadChickenBatches();
      void loadEggBatches();
    }, [loadChickenBatches, loadEggBatches]),
  );

  function openEdit(item: BatchItem) {
    setSelectedBatch(item);
    setFormState({
      breed: item.breed || "",
      totalCount: String(item.totalCount ?? item.femaleCount + item.maleCount),
      femaleCount: String(item.femaleCount ?? 0),
      maleCount: String(item.maleCount ?? 0),
      unknownCount: String(item.unknownCount ?? 0),
      isolatedCount: String(item.isolatedCount ?? 0),
      killedCount: String(item.killedCount ?? 0),
      ageCount: parseAgeLabel(item.ageLabel),
      ageLabel: AGE_UNIT_OPTIONS[0],
    });
    setEditVisible(true);
  }

  function openEggBatches(item: BatchItem) {
    router.push({
      pathname: "/(tabs)/eggbatchitem/[color]" as any,
      params: {
        color: item.colorName,
        colorHex: item.colorHex,
        batchNo: item.id,
        originBatchNo: item.id,
        detailMode: "parent",
        breed: item.breed,
      },
    });
  }

  function closeEdit() {
    setEditVisible(false);
    setSelectedBatch(null);
  }

  async function saveEdit() {
    if (!selectedBatch) return closeEdit();
    const enteredAge = parseCount(formState.ageCount);
    const ageInDays = enteredAge * 7;

    if (ageInDays < MIN_CHICKEN_BATCH_AGE_WEEKS * 7) {
      Alert.alert(
        "Chicken is too young",
        `Chicken batches must be at least ${MIN_CHICKEN_BATCH_AGE_WEEKS} weeks old.`,
      );
      return;
    }

    const totalCount = parseCount(formState.totalCount);
    const femaleCount = parseCount(formState.femaleCount);
    const maleCount = parseCount(formState.maleCount);
    const unknownCount = parseCount(formState.unknownCount);
    if (femaleCount + maleCount + unknownCount !== totalCount) {
      Alert.alert(
        "Check bird counts",
        "Male + Female + Unknown must equal the total chicken count.",
      );
      return;
    }

    const updated: BatchItem = {
      ...selectedBatch,
      breed: formState.breed,
      totalCount,
      femaleCount,
      maleCount,
      unknownCount,
      isolatedCount: parseCount(formState.isolatedCount),
      killedCount: parseCount(formState.killedCount),
      ageLabel: `${enteredAge} ${formState.ageLabel.toLowerCase()}`,
    };
    if (!activeFarm?.id) {
      Alert.alert("Farm missing", "No active farm was found.");
      return;
    }
    try {
      await updateFarmBatch(activeFarm.id, selectedBatch.id, updated);
      setChickenData((prev) =>
        prev.map((item) => (item.id === selectedBatch.id ? updated : item)),
      );
      logStep("Profiles chicken batch updated", {
        farmId: activeFarm.id,
        batchNo: selectedBatch.id,
      });
    } catch (error) {
      Alert.alert("Update failed", "Unable to save the batch changes.");
      logError("Profiles chicken batch update failed", error, {
        farmId: activeFarm.id,
        batchNo: selectedBatch.id,
      });
      return;
    }
    closeEdit();
  }

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
                  actionEgg.origin || actionEgg.batchNo,
                  quantity,
                  actionEgg.id,
                );
                setChickenData((prev) => {
                  const exists = prev.some(
                    (b) => b.id === updatedChickBatch.id,
                  );
                  return exists
                    ? prev.map((b) =>
                        b.id === updatedChickBatch.id
                          ? updatedChickBatch
                          : b,
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
                  originBatchNo: actionEgg.origin || actionEgg.batchNo,
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
              } else {
                await updateFarmEggBatch(
                  activeFarm.id,
                  actionEgg.id,
                  nextValues,
                );
                await recordEggDisposition(activeFarm.id, {
                  eggBatchId: actionEgg.id,
                  originBatchNo: actionEgg.origin || actionEgg.batchNo,
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
              logError("Profiles egg disposition update failed", error, {
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

  const openEggEdit = (egg: EggBatchItem) => {
    setSelectedEgg(egg);
    setEggEditForm({
      hatchedQty: String(egg.hatchedQty ?? 0),
      damagedQty: String(egg.damagedQty ?? 0),
    });
    setEggEditVisible(true);
  };

  const closeEggEdit = () => {
    setEggEditVisible(false);
    setSelectedEgg(null);
  };

  const saveEggEdit = async () => {
    if (!selectedEgg) {
      closeEggEdit();
      return;
    }

    const hatched = parseCount(eggEditForm.hatchedQty);
    const damaged = parseCount(eggEditForm.damagedQty);
    const eggTotal = selectedEgg.eggQty ?? 0;

    if (hatched + damaged > eggTotal) {
      setDiscrepancyModalVisible(true);
      return;
    }

    const nowIso = new Date().toISOString();
    const updatedEgg: EggBatchItem = {
      ...selectedEgg,
      hatchedQty: hatched,
      damagedQty: damaged,
      unhatchedQty: Math.max(0, eggTotal - hatched - damaged),
      updatedAt: nowIso,
    };

    if (!activeFarm?.id) {
      closeEggEdit();
      return;
    }

    try {
      await updateFarmEggBatch(activeFarm.id, selectedEgg.id, updatedEgg);
      setSavedEggBatches((prev) =>
        prev.map((egg) => (egg.id === selectedEgg.id ? updatedEgg : egg)),
      );
    } catch (error) {
      logError("Profiles egg batch update failed", error, {
        farmId: activeFarm.id,
        eggBatchId: selectedEgg.id,
      });
      Alert.alert("Update failed", "Unable to update this egg batch right now.");
      return;
    }
    closeEggEdit();
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
      logError("Profiles egg batch delete failed", error, {
        farmId: activeFarm.id,
        eggBatchId: eggToDelete.id,
      });
      Alert.alert("Delete failed", "Unable to delete this egg batch right now.");
    } finally {
      setIsDeletingEgg(false);
    }
  };

  function confirmRemove(item: BatchItem) {
    setBatchToDelete(item);
  }

  async function handleDeleteBatchConfirm() {
    if (!batchToDelete || !activeFarm?.id) return;
    setIsDeletingBatch(true);
    try {
      await recordDeletedChickenBatch(activeFarm.id, batchToDelete);
      await deleteFarmBatch(activeFarm.id, batchToDelete.id);
      setChickenData((prev) => prev.filter((item) => item.id !== batchToDelete.id));
      logStep("Profiles chicken batch deleted", {
        farmId: activeFarm.id,
        batchNo: batchToDelete.id,
      });
      setBatchToDelete(null);
    } catch (error) {
      Alert.alert(
        "Delete failed",
        "Unable to delete this batch right now.",
      );
      logError("Profiles chicken batch delete failed", error, {
        farmId: activeFarm.id,
        batchNo: batchToDelete.id,
      });
    } finally {
      setIsDeletingBatch(false);
    }
  }

  const eggColorCards = useMemo<EggColorCard[]>(() => {
    const batchMap = new Map<
      string,
      {
        batchNo: string;
        breed: string;
        createdAt?: string;
        updatedAt?: string;
        colorName: string;
        colorHex: string;
        count: number;
        hatchedQty: number;
        damagedQty: number;
        unhatchedQty: number;
      }
    >();

    chickenData
      .filter((batch) => !batch.originBatchNo?.trim())
      .forEach((batch) => {
        const key = batch.id.trim().toLowerCase();
        if (!batchMap.has(key)) {
          batchMap.set(key, {
            batchNo: batch.id,
            breed: batch.breed,
            createdAt: batch.createdAt,
            updatedAt: batch.updatedAt,
            colorName: batch.colorName || "Default",
            colorHex: batch.colorHex || ChickIntelPalette.gray2,
            count: 0,
            hatchedQty: 0,
            damagedQty: 0,
            unhatchedQty: 0,
          });
        }
      });

    savedEggBatches.forEach((egg) => {
      const parentBatchNo = (egg.origin || egg.batchNo || "").trim();
      const key = parentBatchNo.toLowerCase();

      const existing = batchMap.get(key) ?? {
        batchNo: parentBatchNo || "0001",
        breed: "",
        createdAt: egg.createdAt,
        updatedAt: egg.updatedAt,
        colorName: egg.colorName || egg.origin || "Unspecified",
        colorHex: egg.colorHex || ChickIntelPalette.gray2,
        count: 0,
        hatchedQty: 0,
        damagedQty: 0,
        unhatchedQty: 0,
      };

      const eggLatest = egg.updatedAt || egg.createdAt;
      const existingLatest = existing.updatedAt || existing.createdAt;
      if (eggLatest && (!existingLatest || eggLatest > existingLatest)) {
        existing.updatedAt = egg.updatedAt;
        existing.createdAt = egg.createdAt;
      }

      existing.count += 1;
      existing.hatchedQty += egg.hatchedQty ?? 0;
      existing.damagedQty += egg.damagedQty ?? 0;
      existing.unhatchedQty += getDerivedUnhatchedQty(
        egg.eggQty ?? 0,
        egg.hatchedQty ?? 0,
        egg.damagedQty ?? 0,
      );

      batchMap.set(key, existing);
    });

    return [...batchMap.values()].map((item) => {
      const formattedBatchNo = item.batchNo.trim();

      return {
        id: `egg-${item.batchNo}`,
        breed: item.breed,
        colorName: item.colorName,
        colorHex: item.colorHex,
        originBatchNo: formattedBatchNo,
        rawBatchNo: item.batchNo,
        batches: item.count,
        fertilityRate: formatEggFertilityPercent({
          hatchedQty: item.hatchedQty,
          damagedQty: item.damagedQty,
          unhatchedQty: item.unhatchedQty,
        }),
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });
  }, [chickenData, savedEggBatches]);

  const chickenEggSummaries = useMemo(() => {
    const summaries: Record<
      string,
      {
        batchCount: number;
        totalEggs: number;
        hatched: number;
        unhatched: number;
        damaged: number;
      }
    > = {};

    savedEggBatches.forEach((egg) => {
      const key = (egg.origin || "").trim().toLowerCase();
      if (!key) return;
      const summary = summaries[key] ?? {
        batchCount: 0,
        totalEggs: 0,
        hatched: 0,
        unhatched: 0,
        damaged: 0,
      };
      summary.batchCount += 1;
      summary.totalEggs += egg.eggQty ?? 0;
      summary.hatched += egg.hatchedQty ?? 0;
      summary.unhatched += egg.unhatchedQty ?? 0;
      summary.damaged += egg.damagedQty ?? 0;
      summaries[key] = summary;
    });

    return summaries;
  }, [savedEggBatches]);

  const chickenSubBatchSummaries = useMemo(() => {
    return chickenData.reduce<
      Record<string, { batchCount: number; chicks: number }>
    >((summaries, batch) => {
      const origin = batch.originBatchNo?.trim().toLowerCase();
      if (!origin) return summaries;

      const summary = summaries[origin] ?? { batchCount: 0, chicks: 0 };
      summary.batchCount += 1;
      summary.chicks += batch.totalCount ?? 0;
      summaries[origin] = summary;
      return summaries;
    }, {});
  }, [chickenData]);

  const parentChickenBatches = useMemo(
    () => chickenData.filter((batch) => !batch.originBatchNo?.trim()),
    [chickenData],
  );

  const fabBottom = TAB_BAR_OFFSET - 2 - FAB_OFFSET_FROM_TAB_TOP;

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
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
      <View style={styles.fixedHeader}>
        <View style={styles.pageHeaderRow}>
          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)")
            }
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
          </Pressable>

          <Text
            style={[styles.pageTitle, { color: colors.text }]}
            numberOfLines={1}
          >
            {mode === "chicken"
              ? "Batch Profile (chicken)"
              : "Batch Profile (eggs)"}
          </Text>

          {mode === "egg" ? (
            <View style={styles.headerActions}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/egg-fertility-report" as any,
                    params: { overview: "Weekly" },
                  })
                }
                style={styles.eggAnalyticsIconButton}
                accessibilityRole="button"
                accessibilityLabel="Open egg fertility report"
              >
                <MaterialCommunityIcons
                  name="chart-donut"
                  size={18}
                  color="#FFF"
                />
              </Pressable>
              <Pressable
                onPress={() => router.push("/(tabs)/egg-batch-history" as any)}
                style={styles.eggAnalyticsIconButton}
                accessibilityRole="button"
                accessibilityLabel="Open egg batch history"
              >
                <MaterialCommunityIcons name="history" size={21} color="#FFF" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() =>
                router.push("/(tabs)/chicken-batch-history" as any)
              }
              style={styles.eggAnalyticsIconButton}
              accessibilityRole="button"
              accessibilityLabel="Open chicken batch history"
            >
              <MaterialCommunityIcons name="history" size={21} color="#FFF" />
            </Pressable>
          )}
        </View>
        <View style={styles.segmentStickyHeader}>
          <View style={styles.segmentWrap}>
            <Pressable
              onPress={() => setMode("chicken")}
              style={[
                styles.segment,
                mode === "chicken"
                  ? styles.segmentActive
                  : styles.segmentInactive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === "chicken"
                    ? styles.segmentTextActive
                    : styles.segmentTextInactive,
                ]}
              >
                Chicken Batch
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMode("egg")}
              style={[
                styles.segment,
                mode === "egg" ? styles.segmentActive : styles.segmentInactive,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  mode === "egg"
                    ? styles.segmentTextActive
                    : styles.segmentTextInactive,
                ]}
              >
                Egg Batch
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: 10,
            paddingBottom: 78,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {mode === "chicken" ? (
          <View style={styles.list}>
            {chickenLoading ? (
              <Text style={styles.emptyStateText}>
                Loading chicken batches...
              </Text>
            ) : null}
            {!chickenLoading && chickenError ? (
              <Text style={styles.emptyStateText}>{chickenError}</Text>
            ) : null}
            {!chickenLoading && !chickenError && chickenData.length === 0 ? (
              <Text style={styles.emptyStateText}>
                No chicken batches found for this farm yet.
              </Text>
            ) : null}
            {parentChickenBatches.map((item) => {
              const eggSummary = chickenEggSummaries[item.id.trim().toLowerCase()] ?? {
                batchCount: 0,
                totalEggs: 0,
                hatched: 0,
                unhatched: 0,
                damaged: 0,
              };
              const chickSummary = chickenSubBatchSummaries[item.id.trim().toLowerCase()] ?? {
                batchCount: 0,
                chicks: 0,
              };
              const totalCount =
                item.totalCount ??
                item.femaleCount + item.maleCount + item.unknownCount;

              return (
                <BlurCard
                  key={item.id}
                  style={styles.card}
                  borderRadius={16}
                  intensity={20}
                >
                  <Pressable
                    onPress={() => openEggBatches(item)}
                    style={({ pressed }) => [
                      styles.cardMainContainer,
                      { opacity: pressed ? 0.94 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Open egg batches for chicken batch ${item.id}`}
                  >
                    {/* Card Header: Batch Pill + Date, Color Badge & Actions */}
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.headerLeftStack}>
                        <View style={styles.batchPillBadge}>
                          <MaterialCommunityIcons
                            name="bird"
                            size={12}
                            color="#000000"
                          />
                          <Text style={styles.batchPillText}>
                            {formatProfileBatchId("C", item.id)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.headerRightActions}>
                        <View style={styles.colorPillBadge}>
                          <View
                            style={[
                              styles.colorDot,
                              {
                                backgroundColor:
                                  item.colorHex || ChickIntelPalette.gray2,
                              },
                            ]}
                          />
                          <Text style={styles.colorPillText}>
                            {item.colorName || "Default"}
                          </Text>
                        </View>

                        <View style={styles.iconCluster}>
                          <Pressable
                            onPress={() => openEdit(item)}
                            hitSlop={8}
                            style={({ pressed }) => [
                              styles.actionIconBtn,
                              { opacity: pressed ? 0.72 : 1 },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Edit batch ${item.id}`}
                          >
                            <MaterialCommunityIcons
                              name="pencil-outline"
                              size={15}
                              color="#111111"
                            />
                          </Pressable>

                          <Pressable
                            onPress={() => confirmRemove(item)}
                            hitSlop={8}
                            style={({ pressed }) => [
                              styles.actionIconBtn,
                              { opacity: pressed ? 0.7 : 1 },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Delete batch ${item.id}`}
                          >
                            <MaterialCommunityIcons
                              name="trash-can-outline"
                              size={15}
                              color="#923737"
                            />
                          </Pressable>
                        </View>
                      </View>
                    </View>

                    {item.breed ? (
                      <Text style={styles.breedTitle}>{item.breed}</Text>
                    ) : null}

                    <Text style={styles.createdDateText}>
                      {formatBatchDateStamp(item.createdAt, item.updatedAt)}
                    </Text>

                    {/* Row 1: Flock Composition & Age */}
                    <View style={styles.metricsRow}>
                      <View style={styles.metricChip}>
                        <Text style={styles.metricChipLabel}>Total</Text>
                        <Text style={styles.metricChipValue}>{totalCount}</Text>
                      </View>
                      <View style={styles.metricChip}>
                        <Text style={styles.metricChipLabel}>Females</Text>
                        <Text style={styles.metricChipValue}>
                          {item.femaleCount}
                        </Text>
                      </View>
                      <View style={styles.metricChip}>
                        <Text style={styles.metricChipLabel}>Males</Text>
                        <Text style={styles.metricChipValue}>{item.maleCount}</Text>
                      </View>
                      <View style={styles.metricChip}>
                        <Text style={styles.metricChipLabel}>Age</Text>
                        <Text style={styles.metricChipValue}>
                          {getCurrentBatchAgeLabel(item)}
                        </Text>
                      </View>
                    </View>

                    {/* Row 2: Health & Production */}
                    <View style={styles.metricsRow}>
                      <View style={styles.metricChip}>
                        <Text style={styles.metricChipLabel}>Isolation</Text>
                        <Text style={styles.metricChipValue}>
                          {item.isolatedCount}
                        </Text>
                      </View>
                      <View style={styles.metricChip}>
                        <Text style={styles.metricChipLabel}>Loss</Text>
                        <Text style={styles.metricChipValue}>
                          {item.killedCount}
                        </Text>
                      </View>
                      <View style={styles.metricChip}>
                        <Text style={styles.metricChipLabel}>Egg Batches</Text>
                        <Text style={styles.metricChipValue}>
                          {eggSummary.batchCount} ({eggSummary.totalEggs})
                        </Text>
                      </View>
                      <View style={styles.metricChip}>
                        <Text style={styles.metricChipLabel}>Chicks</Text>
                        <Text style={styles.metricChipValue}>
                          {chickSummary.chicks}
                        </Text>
                      </View>
                    </View>

                    {item.notes?.length ? (
                      <View style={styles.noteSummaryList}>
                        {item.notes.map((note) => (
                          <View key={note.id} style={styles.noteSummaryCard}>
                            <Text style={styles.noteSummaryLabel}>Note:</Text>
                            <Text style={styles.noteSummaryText}>{note.text}</Text>
                            <Text style={styles.noteSummaryMeta}>
                              {new Date(note.createdAt).toLocaleString()}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </Pressable>
                </BlurCard>
              );
            })}
          </View>
        ) : (
          <View style={styles.list}>
            {eggError ? (
              <Text style={styles.emptyStateText}>{eggError}</Text>
            ) : null}
            {!eggError && savedEggBatches.length === 0 ? (
              <Text style={styles.emptyStateText}>
                No egg batches found for this farm yet.
              </Text>
            ) : null}
            {savedEggBatches.map((egg) => {
              const unhatchedCount = getDerivedUnhatchedQty(
                egg.eggQty ?? 0,
                egg.hatchedQty ?? 0,
                egg.damagedQty ?? 0,
              );
              const fertility = formatEggFertilityPercent({
                hatchedQty: egg.hatchedQty,
                damagedQty: egg.damagedQty,
                unhatchedQty: unhatchedCount,
              });
              const remainingHatched = Math.max(
                0,
                (egg.hatchedQty ?? 0) - (egg.transferredHatchedQty ?? 0),
              );
              const remainingUnhatched = Math.max(
                0,
                unhatchedCount - (egg.soldQty ?? 0),
              );
              const remainingDamaged = Math.max(
                0,
                (egg.damagedQty ?? 0) - (egg.disposedDamagedQty ?? 0),
              );

              return (
                <BlurCard
                  key={egg.id}
                  style={styles.card}
                  borderRadius={16}
                  intensity={20}
                >
                  <View style={styles.cardMainContainer}>
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
                          onPress={() => openEggEdit(egg)}
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
                            backgroundColor: egg.colorHex || "#317667",
                          },
                        ]}
                      />
                      <Text style={styles.originPillText}>
                        {formatOriginBatchId(egg.origin)}
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
                        Chicks transferred: {egg.transferredHatchedQty ?? 0}/
                        {egg.hatchedQty ?? 0}
                      </Text>
                      <Text style={styles.dispositionText}>
                        Sold: {egg.soldQty ?? 0}/{egg.unhatchedQty ?? unhatchedCount}
                      </Text>
                      <Text style={styles.dispositionText}>
                        Disposed: {egg.disposedDamagedQty ?? 0}/{egg.damagedQty ?? 0}
                      </Text>
                    </View>
                  </View>
                </BlurCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      <PrimaryFab
        iconName="plus"
        onPress={() => {
          if (mode === "egg") {
            router.push({
              pathname: "/(tabs)/eggbatchitem/ageunit",
              params: { mode: "egg" },
            });
          } else {
            router.push({
              pathname: "/(tabs)/add-batch",
              params: { mode },
            });
          }
        }}
        bottom={fabBottom}
        accessibilityLabel="Create new batch"
      />

      {/* Edit Chicken Batch Modal */}
      <Modal visible={editVisible} animationType="fade" transparent>
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
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderTitleRow}>
                    <View style={styles.modalHeaderIconBadge}>
                      <MaterialCommunityIcons
                        name="pencil-outline"
                        size={20}
                        color="#FFFFFF"
                      />
                    </View>
                    <Text style={styles.modalTitle}>Edit Chicken Batch</Text>
                  </View>
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {selectedBatch
                      ? `${formatProfileBatchId("C", selectedBatch.id)} | `
                      : ""}
                    {selectedBatch?.breed || "General"}
                  </Text>
                </View>

                <View style={styles.modalBody}>
                  <Text style={styles.modalLabel}>Breed</Text>
                  <TextInput
                    value={formState.breed}
                    onChangeText={(t) =>
                      setFormState((s) => ({ ...s, breed: t }))
                    }
                    style={styles.modalInput}
                    placeholder="Breed name"
                    placeholderTextColor={ChickIntelPalette.gray2}
                  />

                  <View style={styles.rowInputs}>
                    <View style={styles.halfInput}>
                      <Text style={styles.modalLabel}>Total</Text>
                      <TextInput
                        value={formState.totalCount}
                        onChangeText={(t) =>
                          setFormState((s) => ({
                            ...s,
                            totalCount: t.replace(/[^0-9]/g, ""),
                          }))
                        }
                        keyboardType="number-pad"
                        style={styles.modalInput}
                      />
                    </View>
                    <View style={styles.halfInput}>
                      <Text style={styles.modalLabel}>Unknown</Text>
                      <TextInput
                        value={formState.unknownCount}
                        onChangeText={(t) =>
                          setFormState((s) => ({
                            ...s,
                            unknownCount: t.replace(/[^0-9]/g, ""),
                          }))
                        }
                        keyboardType="number-pad"
                        style={styles.modalInput}
                      />
                    </View>
                  </View>

                  <View style={styles.rowInputs}>
                    <View style={styles.halfInput}>
                      <Text style={styles.modalLabel}>Females</Text>
                      <TextInput
                        value={formState.femaleCount}
                        onChangeText={(t) =>
                          setFormState((s) => ({
                            ...s,
                            femaleCount: t.replace(/[^0-9]/g, ""),
                          }))
                        }
                        keyboardType="number-pad"
                        style={styles.modalInput}
                      />
                    </View>
                    <View style={styles.halfInput}>
                      <Text style={styles.modalLabel}>Males</Text>
                      <TextInput
                        value={formState.maleCount}
                        onChangeText={(t) =>
                          setFormState((s) => ({
                            ...s,
                            maleCount: t.replace(/[^0-9]/g, ""),
                          }))
                        }
                        keyboardType="number-pad"
                        style={styles.modalInput}
                      />
                    </View>
                  </View>

                  <View style={styles.rowInputs}>
                    <View style={styles.halfInput}>
                      <Text style={styles.modalLabel}>Isolation</Text>
                      <TextInput
                        value={formState.isolatedCount}
                        onChangeText={(t) =>
                          setFormState((s) => ({
                            ...s,
                            isolatedCount: t.replace(/[^0-9]/g, ""),
                          }))
                        }
                        keyboardType="number-pad"
                        style={styles.modalInput}
                      />
                    </View>
                    <View style={styles.halfInput}>
                      <Text style={styles.modalLabel}>Loss</Text>
                      <TextInput
                        value={formState.killedCount}
                        onChangeText={(t) =>
                          setFormState((s) => ({
                            ...s,
                            killedCount: t.replace(/[^0-9]/g, ""),
                          }))
                        }
                        keyboardType="number-pad"
                        style={styles.modalInput}
                      />
                    </View>
                  </View>

                  <Text style={styles.modalLabel}>Age</Text>
                  <View style={styles.ageEditRow}>
                    <TextInput
                      value={formState.ageCount}
                      onChangeText={(value) =>
                        setFormState((state) => ({
                          ...state,
                          ageCount: value.replace(/[^0-9]/g, ""),
                        }))
                      }
                      keyboardType="number-pad"
                      style={[styles.modalInput, styles.ageCountInput]}
                      placeholder={"2"}
                      placeholderTextColor={ChickIntelPalette.gray2}
                    />
                    <Pressable
                      onPress={() => setAgeUnitMenuVisible(true)}
                      style={[styles.modalSelect, styles.ageUnitSelect]}
                      accessibilityRole="button"
                    >
                      <Text style={styles.modalSelectText}>
                        {formState.ageLabel}
                      </Text>
                      <MaterialCommunityIcons
                        name="chevron-down"
                        size={18}
                        color={ChickIntelPalette.gray2}
                      />
                    </Pressable>
                  </View>
                  <Text style={styles.ageLimitHint}>Minimum: 2 weeks</Text>

                  <View style={styles.modalActions}>
                    <Pressable
                      onPress={closeEdit}
                      style={styles.modalCancel}
                      accessibilityRole="button"
                    >
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={saveEdit}
                      style={styles.modalSave}
                      accessibilityRole="button"
                    >
                      <Text style={styles.modalSaveText}>Save Changes</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Egg Action Modal (Transfer / Sell / Dispose) */}
      <Modal
        visible={actionEgg !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActionEgg(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.actionModalCard}>
            <Text style={styles.modalTitle}>
              {actionType === "transfer"
                ? "Transfer hatched eggs"
                : actionType === "sell"
                  ? "Sell unhatched eggs"
                  : "Dispose damaged eggs"}
            </Text>
            <Text style={styles.subtitle}>
              Available:{" "}
              {actionEgg ? getAvailableActionQty(actionEgg, actionType) : 0}
            </Text>
            <Text style={styles.insideLabel}>Quantity</Text>
            <TextInput
              value={actionQty}
              onChangeText={(value) =>
                setActionQty(value.replace(/[^0-9]/g, ""))
              }
              keyboardType="number-pad"
              style={[styles.modalInputInside, styles.actionQuantityInput]}
              autoFocus
              placeholder="Quantity"
              placeholderTextColor={ChickIntelPalette.gray2}
            />
            <Text style={styles.actionModalHint}>
              {actionType === "transfer"
                ? "This quantity will be recorded in the Chicks batch after confirmation."
                : actionType === "sell"
                  ? "Only remaining unhatched eggs can be sold."
                  : "Only remaining damaged eggs can be disposed. This cannot be undone."}
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setActionEgg(null)}
                style={styles.cancelBtn}
                accessibilityRole="button"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmEggAction}
                style={styles.saveBtn}
                accessibilityRole="button"
              >
                <Text style={styles.saveText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Egg Batch Modal */}
      <Modal visible={eggEditVisible} transparent animationType="fade">
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
                    value={eggEditForm.hatchedQty}
                    onChangeText={(value) =>
                      setEggEditForm((state) => ({
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
                    value={eggEditForm.damagedQty}
                    onChangeText={(value) =>
                      setEggEditForm((state) => ({
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
                  <Text style={styles.readonlyHint}>
                    Auto-calculated: Total ({totalRecordedEggs}) - Hatched (
                    {hatchedCount}) - Damaged ({damagedCount})
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <Pressable
                    onPress={closeEggEdit}
                    style={styles.cancelBtn}
                    accessibilityRole="button"
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={saveEggEdit}
                    style={[styles.saveBtn, hasDiscrepancy && styles.saveBtnDisabled]}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[
                        styles.saveText,
                        hasDiscrepancy && styles.saveTextDisabled,
                      ]}
                    >
                      Save Changes
                    </Text>
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Discrepancy Breakdown Review Modal */}
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
                name="alert-octagon"
                size={30}
                color="#DC2626"
              />
            </View>

            <Text style={styles.discrepancyModalTitle}>
              Cannot Save: Numbers Exceed Batch
            </Text>

            <Text style={styles.discrepancyModalDesc}>
              The sum of Hatched and Damaged eggs cannot exceed the initial
              recorded batch quantity.
            </Text>

            <View style={styles.discrepancyBreakdownCard}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Recorded Batch Total:</Text>
                <Text style={styles.breakdownValue}>
                  {totalRecordedEggs} eggs
                </Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Hatched Entered:</Text>
                <Text style={styles.breakdownValue}>{hatchedCount} eggs</Text>
              </View>

              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Damaged Entered:</Text>
                <Text style={styles.breakdownValue}>{damagedCount} eggs</Text>
              </View>

              <View style={[styles.breakdownRow, styles.breakdownRowTotal]}>
                <Text
                  style={[
                    styles.breakdownLabel,
                    { fontWeight: "800", color: "#DC2626" },
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

            <Pressable
              style={styles.discrepancyModalBtn}
              onPress={() => setDiscrepancyModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Review and correct egg numbers"
            >
              <Text style={styles.discrepancyModalBtnText}>
                Review & Correct
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Age Unit Menu Modal */}
      <Modal
        visible={ageUnitMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAgeUnitMenuVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAgeUnitMenuVisible(false)}
        >
          <View style={styles.ageMenuCard}>
            <Text style={styles.modalLabel}>Age unit</Text>
            {AGE_UNIT_OPTIONS.map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  setFormState((state) => ({
                    ...state,
                    ageLabel: option,
                  }));
                  setAgeUnitMenuVisible(false);
                }}
                style={({ pressed }) => [
                  styles.ageMenuOption,
                  { opacity: pressed ? 0.82 : 1 },
                ]}
                accessibilityRole="button"
              >
                <Text style={styles.ageMenuText}>{option}</Text>
                {formState.ageLabel === option ? (
                  <MaterialCommunityIcons
                    name="check"
                    size={18}
                    color={ChickIntelPalette.gray1}
                  />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Delete Chicken Batch Confirmation Modal */}
      <DeleteConfirmationModal
        visible={Boolean(batchToDelete)}
        title="Delete Chicken Batch?"
        subtitle="This action cannot be undone."
        itemBadge="CHICKEN BATCH"
        itemTitle={batchToDelete?.breed ? batchToDelete.breed : (batchToDelete?.id ? `Batch #${batchToDelete.id}` : undefined)}
        itemSubtitle={batchToDelete ? `${batchToDelete.totalCount} birds • ${formatBatchDateStamp(batchToDelete.createdAt, batchToDelete.updatedAt)}` : undefined}
        message="Are you sure you want to delete this chicken batch? This batch will be moved to deleted history."
        confirmLabel="Delete"
        isDeleting={isDeletingBatch}
        onConfirm={handleDeleteBatchConfirm}
        onCancel={() => {
          if (!isDeletingBatch) setBatchToDelete(null);
        }}
      />

      {/* Delete Egg Batch Confirmation Modal */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.light1,
  },
  fixedHeader: {
    paddingHorizontal: moderateScale(20),
    backgroundColor: "transparent",
  },
  content: {
    paddingHorizontal: moderateScale(20),
    gap: 12,
  },
  pageTitle: {
    flex: 1,
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: ChickIntelPalette.gray1,
    textAlign: "center",
  },
  pageHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
    minHeight: verticalScale(42),
  },
  headerRightPlaceholder: {
    width: scale(42),
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  segmentStickyHeader: {
    backgroundColor: "transparent",
    paddingVertical: 6,
  },
  eggAnalyticsIconButton: {
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
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 10,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.12)",
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: verticalScale(38),
    borderRadius: 10,
    paddingHorizontal: moderateScale(10),
  },
  segmentActive: {
    backgroundColor: ChickIntelPalette.green1,
  },
  segmentInactive: {
    backgroundColor: "transparent",
  },
  segmentText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    lineHeight: 18,
    color: "#4A5452",
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  segmentTextInactive: {
    color: "#4A5452",
  },
  list: {
    gap: 10,
  },
  emptyStateText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    lineHeight: 20,
    color: "#40524B",
    textAlign: "center",
    paddingVertical: verticalScale(12),
  },
  card: {
    position: "relative",
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    overflow: "hidden",
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
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerLeftStack: {
    flex: 1,
    gap: 2,
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
  breedTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: ChickIntelPalette.gray1,
  },
  createdDateText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 16,
    color: "#52615D",
    paddingBottom: 4,
    marginTop: verticalScale(-2),
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  colorPillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(244, 248, 247, 0.9)",
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    minHeight: verticalScale(28),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
  },
  colorDot: {
    width: scale(8),
    height: verticalScale(8),
    borderRadius: 4,
  },
  colorPillText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
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
  iconCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  dispositionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
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
  noteSummaryList: {
    marginTop: 6,
    gap: 6,
  },
  noteSummaryCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
    backgroundColor: "rgba(202, 227, 221, 0.25)",
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(8),
    gap: 2,
  },
  noteSummaryLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  noteSummaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 16,
    color: ChickIntelPalette.gray1,
  },
  noteSummaryMeta: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: "#52615D",
  },
  editActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(5),
    borderRadius: 999,
    backgroundColor: "rgba(254,254,254,0.58)",
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.12)",
  },
  editActionText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
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
    shadowOffset: { width: scale(0), height: verticalScale(6) },
    elevation: 8,
    padding: moderateScale(18),
    gap: 12,
  },
  actionModalCard: {
    width: "100%",
    maxWidth: scale(450),
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: moderateScale(18),
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  actionModalHint: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 16,
    color: ChickIntelPalette.textMuted,
  },
  subtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: ChickIntelPalette.green1,
  },
  modalHeader: {
    backgroundColor: ChickIntelPalette.green1,
    paddingHorizontal: moderateScale(18),
    paddingVertical: verticalScale(14),
    marginHorizontal: moderateScale(-18),
    marginTop: verticalScale(-18),
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
    color: ChickIntelPalette.gray1,
  },
  modalSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 4,
  },
  modalBody: {
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
  modalSelect: {
    minHeight: verticalScale(44),
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
    borderRadius: 10,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(10),
    backgroundColor: "#F9FAFA",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ageEditRow: {
    flexDirection: "row",
    gap: 8,
  },
  ageCountInput: {
    flex: 1,
  },
  ageUnitSelect: {
    flex: 1.5,
  },
  ageLimitHint: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    lineHeight: 14,
    fontWeight: "600",
    color: ChickIntelPalette.green1,
  },
  modalSelectText: {
    fontFamily: ChickFont.sans,
    color: ChickIntelPalette.gray1,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
  },
  ageMenuCard: {
    width: "100%",
    maxWidth: scale(400),
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: moderateScale(16),
    gap: 10,
  },
  ageMenuOption: {
    minHeight: verticalScale(42),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
    backgroundColor: "rgba(244, 248, 247, 0.9)",
    paddingHorizontal: moderateScale(12),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ageMenuText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.gray1,
    fontWeight: "600",
  },
  rowInputs: {
    flexDirection: "row",
    gap: 10,
  },
  halfInput: {
    flex: 1,
    gap: 6,
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
    marginTop: 6,
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
    maxWidth: scale(450),
    width: "100%",
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
