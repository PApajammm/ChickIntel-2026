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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { BlurCard } from "@/components/ui/blur-card";
import { PrimaryFab } from "@/components/ui/primary-fab";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { getFarmColors } from "@/constants/farm-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/providers/auth-provider";
import {
  type BatchItem,
  type EggBatchItem,
  formatEggFertilityPercent,
} from "@/utils/batch-store";
import { logError, logStep } from "@/utils/logger";
import {
  deleteFarmBatch,
  fetchFarmBatches,
  updateFarmBatch,
} from "@/utils/supabase-batches";
import {
  fetchFarmEggBatches,
  updateFarmEggBatch,
} from "@/utils/supabase-egg-batches";

const TAB_BAR_OFFSET = 55;
const FAB_OFFSET_FROM_TAB_TOP = 50;
const AGE_UNIT_OPTIONS = ["Days old", "Weeks old"] as const;

type EggColorCard = {
  id: string;
  colorName: string;
  colorHex: string;
  originBatchNo: string;
  rawBatchNo: string;
  batches: number;
  fertilityRate: string;
  createdAt?: string;
};

type ChickenEditFormState = {
  breed: string;
  femaleCount: string;
  maleCount: string;
  isolatedCount: string;
  killedCount: string;
  ageLabel: (typeof AGE_UNIT_OPTIONS)[number];
};

function parseCount(value: string) {
  return Number.parseInt(value || "0", 10) || 0;
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

  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [ageUnitMenuVisible, setAgeUnitMenuVisible] = useState(false);
  const [formState, setFormState] = useState<ChickenEditFormState>({
    breed: "",
    femaleCount: "",
    maleCount: "",
    isolatedCount: "",
    killedCount: "",
    ageLabel: AGE_UNIT_OPTIONS[0],
  });

  const [selectedEgg, setSelectedEgg] = useState<EggBatchItem | null>(null);
  const [eggEditVisible, setEggEditVisible] = useState(false);
  const [eggForm, setEggForm] = useState({
    batchNo: "",
    eggQty: "",
    lineNo: "",
    ageUnit: "",
    origin: "",
  });

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
      return;
    }

    try {
      const rows = await fetchFarmEggBatches(activeFarm.id);
      setSavedEggBatches(rows);
    } catch (error) {
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
      femaleCount: String(item.femaleCount ?? 0),
      maleCount: String(item.maleCount ?? 0),
      isolatedCount: String(item.isolatedCount ?? 0),
      killedCount: String(item.killedCount ?? 0),
      ageLabel: item.ageLabel.includes("Week")
        ? AGE_UNIT_OPTIONS[1]
        : AGE_UNIT_OPTIONS[0],
    });
    setEditVisible(true);
  }

  function closeEdit() {
    setEditVisible(false);
    setSelectedBatch(null);
  }

  async function saveEdit() {
    if (!selectedBatch) return closeEdit();
    const updated: BatchItem = {
      ...selectedBatch,
      breed: formState.breed,
      femaleCount: parseCount(formState.femaleCount),
      maleCount: parseCount(formState.maleCount),
      isolatedCount: parseCount(formState.isolatedCount),
      killedCount: parseCount(formState.killedCount),
      ageLabel: formState.ageLabel,
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

  function closeEggEdit() {
    setEggEditVisible(false);
    setSelectedEgg(null);
  }

  async function saveEggEdit() {
    if (!selectedEgg) return closeEggEdit();
    const updated: EggBatchItem = {
      ...selectedEgg,
      batchNo: eggForm.batchNo,
      eggQty: parseCount(eggForm.eggQty),
      lineNo: parseCount(eggForm.lineNo),
      ageUnit:
        (eggForm.ageUnit as EggBatchItem["ageUnit"]) || selectedEgg.ageUnit,
      origin: eggForm.origin,
      colorName: selectedEgg.colorName ?? eggForm.origin,
      colorHex: selectedEgg.colorHex,
      unhatchedQty: getDerivedUnhatchedQty(
        parseCount(eggForm.eggQty),
        selectedEgg.hatchedQty ?? 0,
        selectedEgg.damagedQty ?? 0,
      ),
    };
    if (!activeFarm?.id) {
      Alert.alert("Farm missing", "No active farm was found.");
      return;
    }
    try {
      await updateFarmEggBatch(activeFarm.id, selectedEgg.id, updated);
      setSavedEggBatches((prev) =>
        prev.map((egg) => (egg.id === selectedEgg.id ? updated : egg)),
      );
    } catch (error) {
      Alert.alert("Update failed", "Unable to save egg batch changes.");
      logError("Profiles egg batch update failed", error, {
        farmId: activeFarm.id,
        eggBatchId: selectedEgg.id,
      });
      return;
    }
    closeEggEdit();
  }

  function confirmRemove(id: string) {
    Alert.alert("Delete batch", "Are you sure you want to delete this batch?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!activeFarm?.id) {
            Alert.alert("Farm missing", "No active farm was found.");
            return;
          }
          try {
            await deleteFarmBatch(activeFarm.id, id);
            setChickenData((prev) => prev.filter((item) => item.id !== id));
            logStep("Profiles chicken batch deleted", {
              farmId: activeFarm.id,
              batchNo: id,
            });
          } catch (error) {
            Alert.alert(
              "Delete failed",
              "Unable to delete this batch right now.",
            );
            logError("Profiles chicken batch delete failed", error, {
              farmId: activeFarm.id,
              batchNo: id,
            });
          }
        },
      },
    ]);
  }

  const eggColorCards = useMemo<EggColorCard[]>(() => {
    const batchMap = new Map<
      string,
      {
        batchNo: string;
        createdAt?: string;
        colorName: string;
        colorHex: string;
        count: number;
        hatchedQty: number;
        damagedQty: number;
        unhatchedQty: number;
      }
    >();

    chickenData.forEach((batch) => {
      const key = batch.id.trim().toLowerCase();
      if (!batchMap.has(key)) {
        batchMap.set(key, {
          batchNo: batch.id,
          createdAt: batch.createdAt,
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
        createdAt: egg.createdAt,
        colorName: egg.colorName || egg.origin || "Unspecified",
        colorHex: egg.colorHex || ChickIntelPalette.gray2,
        count: 0,
        hatchedQty: 0,
        damagedQty: 0,
        unhatchedQty: 0,
      };

      if (
        egg.createdAt &&
        (!existing.createdAt || egg.createdAt < existing.createdAt)
      ) {
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
      };
    });
  }, [chickenData, savedEggBatches]);

  const fabBottom =
    insets.bottom + TAB_BAR_OFFSET - 2 - FAB_OFFSET_FROM_TAB_TOP;

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
          <View style={styles.headerLeftRow}>
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
                size={22}
                color="#FFF"
              />
            </TouchableOpacity>

            <Text style={[styles.pageTitle, { color: colors.text }]}>
              {mode === "chicken" ? "Batch Profile (chicken)" : "Batch Profile (eggs)"}
            </Text>
          </View>

          {mode === "egg" ? (
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/egg-fertility-report" as any,
                  params: { overview: "Weekly" },
                })
              }
              style={styles.eggAnalyticsIconButton}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open egg fertility report"
            >
              <MaterialCommunityIcons
                name="chart-donut"
                size={22}
                color="#FFF"
              />
            </TouchableOpacity>
          ) : null}
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
              <MaterialCommunityIcons
                name="bird"
                size={16}
                color={mode === "chicken" ? "#FFFFFF" : ChickIntelPalette.gray2}
              />
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
              <MaterialCommunityIcons
                name="egg-outline"
                size={16}
                color={mode === "egg" ? "#FFFFFF" : ChickIntelPalette.gray2}
              />
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
            paddingBottom: insets.bottom + TAB_BAR_OFFSET + 96,
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
            {chickenData.map((item) => (
              <BlurCard
                key={item.id}
                style={styles.card}
                borderRadius={16}
                intensity={20}
              >
                <View style={styles.cardMainContainer}>
                  {/* Card Header: Batch Pill + Color Badge & Actions */}
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

                      {item.breed ? (
                        <Text style={styles.breedTitle}>{item.breed}</Text>
                      ) : null}
                      <Text style={styles.createdDateText}>
                        {formatCreatedDate(item.createdAt)}
                      </Text>
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
                            size={16}
                            color="#111111"
                          />
                        </Pressable>

                        <Pressable
                          onPress={() => confirmRemove(item.id)}
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
                            size={16}
                            color="#923737"
                          />
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Metrics Grid */}
                  <View style={styles.metricGridThree}>
                    <View style={styles.metricChip}>
                      <View style={styles.metricChipHeader}>
                        <MaterialCommunityIcons
                          name="gender-female"
                          size={13}
                          color="#111111"
                        />
                        <Text style={styles.metricChipLabel}>Females</Text>
                      </View>
                      <Text style={styles.metricChipValue}>
                        {item.femaleCount}
                      </Text>
                    </View>

                    <View style={styles.metricChip}>
                      <View style={styles.metricChipHeader}>
                        <MaterialCommunityIcons
                          name="gender-male"
                          size={13}
                          color="#111111"
                        />
                        <Text style={styles.metricChipLabel}>Males</Text>
                      </View>
                      <Text style={styles.metricChipValue}>
                        {item.maleCount}
                      </Text>
                    </View>

                    <View style={styles.metricChip}>
                      <View style={styles.metricChipHeader}>
                        <MaterialCommunityIcons
                          name="calendar-clock"
                          size={13}
                          color="#111111"
                        />
                        <Text style={styles.metricChipLabel}>Age</Text>
                      </View>
                      <Text style={styles.metricChipValue}>
                        {item.ageLabel}
                      </Text>
                    </View>

                    <View style={styles.metricChip}>
                      <View style={styles.metricChipHeader}>
                        <MaterialCommunityIcons
                          name="shield-alert-outline"
                          size={13}
                          color="#111111"
                        />
                        <Text style={styles.metricChipLabel}>Isolation</Text>
                      </View>
                      <Text style={styles.metricChipValue}>
                        {item.isolatedCount}
                      </Text>
                    </View>

                    <View style={styles.metricChip}>
                      <View style={styles.metricChipHeader}>
                        <MaterialCommunityIcons
                          name="heart-broken-outline"
                          size={13}
                          color="#111111"
                        />
                        <Text style={styles.metricChipLabel}>Loss</Text>
                      </View>
                      <Text style={styles.metricChipValue}>
                        {item.killedCount}
                      </Text>
                    </View>
                  </View>

                  {item.notes?.length ? (
                    <View style={styles.noteSummaryList}>
                      {item.notes.map((note) => (
                        <View key={note.id} style={styles.noteSummaryCard}>
                          <Text style={styles.noteSummaryLabel}>Note:</Text>
                          <Text style={styles.noteSummaryText}>
                            {note.text}
                          </Text>
                          <Text style={styles.noteSummaryMeta}>
                            {new Date(note.createdAt).toLocaleString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </BlurCard>
            ))}
          </View>
        ) : (
          <View style={styles.list}>
            {eggColorCards.map((item) => (
              <BlurCard
                key={item.id}
                style={styles.card}
                borderRadius={16}
                intensity={20}
              >
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/eggbatchitem/[color]" as any,
                      params: {
                        color: item.colorName,
                        colorHex: item.colorHex,
                        batchNo: item.rawBatchNo,
                        originBatchNo: item.originBatchNo,
                      },
                    })
                  }
                  style={({ pressed }) => [
                    styles.cardMainContainer,
                    { opacity: pressed ? 0.92 : 1 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.colorName} egg batches`}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.headerLeftStack}>
                      <View style={styles.batchPillBadge}>
                        <MaterialCommunityIcons
                          name="bird"
                          size={13}
                          color="#111111"
                        />
                        <Text style={styles.batchPillText}>
                          {formatProfileBatchId("C", item.originBatchNo)}
                        </Text>
                      </View>
                      <Text style={styles.createdDateText}>
                        {formatCreatedDate(item.createdAt)}
                      </Text>
                    </View>

                    <View style={styles.colorPillBadge}>
                      <View
                        style={[
                          styles.colorDot,
                          {
                            backgroundColor: item.colorHex,
                          },
                        ]}
                      />
                      <Text style={styles.colorPillText}>{item.colorName}</Text>
                    </View>
                  </View>

                  <View style={styles.metricGridTwo}>
                    <View style={styles.metricChipWide}>
                      <View style={styles.metricChipHeader}>
                        <MaterialCommunityIcons
                          name="layers-outline"
                          size={14}
                          color="#111111"
                        />
                        <Text style={styles.metricChipLabel}>
                          Total Batches
                        </Text>
                      </View>
                      <Text style={styles.metricChipValue}>{item.batches}</Text>
                    </View>

                    <View style={styles.metricChipWide}>
                      <View style={styles.metricChipHeader}>
                        <MaterialCommunityIcons
                          name="star-outline"
                          size={14}
                          color="#111111"
                        />
                        <Text style={styles.metricChipLabel}>
                          Fertility Rate
                        </Text>
                      </View>
                      <Text style={styles.metricChipValue}>
                        {item.fertilityRate}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              </BlurCard>
            ))}
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
                      ? `${formatProfileBatchId("C", selectedBatch.id)} • `
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
                  <Pressable
                    onPress={() => setAgeUnitMenuVisible(true)}
                    style={styles.modalSelect}
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

      <Modal visible={eggEditVisible} animationType="fade" transparent>
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
                    <Text style={styles.modalTitle}>Edit Egg Batch</Text>
                  </View>
                  <Text style={styles.modalSubtitle} numberOfLines={1}>
                    {formatProfileBatchId("E", eggForm.batchNo)} •{" "}
                    {eggForm.origin || "Egg Batch"}
                  </Text>
                </View>

                <View style={styles.modalBody}>
                  <Text style={styles.modalLabel}>Batch No.</Text>
                  <TextInput
                    value={eggForm.batchNo}
                    onChangeText={(t) =>
                      setEggForm((s) => ({ ...s, batchNo: t }))
                    }
                    style={styles.modalInput}
                    placeholder="Batch number"
                    placeholderTextColor={ChickIntelPalette.gray2}
                  />

                  <View style={styles.rowInputs}>
                    <View style={styles.halfInput}>
                      <Text style={styles.modalLabel}>Egg Qty</Text>
                      <TextInput
                        value={eggForm.eggQty}
                        onChangeText={(t) =>
                          setEggForm((s) => ({
                            ...s,
                            eggQty: t.replace(/[^0-9]/g, ""),
                          }))
                        }
                        keyboardType="number-pad"
                        style={styles.modalInput}
                      />
                    </View>
                    <View style={styles.halfInput}>
                      <Text style={styles.modalLabel}>Line No</Text>
                      <TextInput
                        value={eggForm.lineNo}
                        onChangeText={(t) =>
                          setEggForm((s) => ({
                            ...s,
                            lineNo: t.replace(/[^0-9]/g, ""),
                          }))
                        }
                        keyboardType="number-pad"
                        style={styles.modalInput}
                      />
                    </View>
                  </View>

                  <Text style={styles.modalLabel}>Origin</Text>
                  <TextInput
                    value={eggForm.origin}
                    onChangeText={(t) =>
                      setEggForm((s) => ({ ...s, origin: t }))
                    }
                    style={styles.modalInput}
                    placeholder="e.g. Farm A"
                    placeholderTextColor={ChickIntelPalette.gray2}
                  />

                  <Text style={styles.modalLabel}>Age unit</Text>
                  <TextInput
                    value={eggForm.ageUnit}
                    onChangeText={(t) =>
                      setEggForm((s) => ({ ...s, ageUnit: t }))
                    }
                    style={styles.modalInput}
                    placeholder="Days old / Weeks old"
                    placeholderTextColor={ChickIntelPalette.gray2}
                  />

                  <Text style={styles.modalLabel}>Unhatched Qty</Text>
                  <View style={styles.readonlyMetricRow}>
                    <Text style={styles.readonlyMetricValue}>
                      {getDerivedUnhatchedQty(
                        parseCount(eggForm.eggQty),
                        selectedEgg?.hatchedQty ?? 0,
                        selectedEgg?.damagedQty ?? 0,
                      )}
                    </Text>
                    <Text style={styles.readonlyMetricHint}>
                      Auto-calculated from total eggs minus hatched and damaged.
                    </Text>
                  </View>

                  <View style={styles.modalActions}>
                    <Pressable
                      onPress={closeEggEdit}
                      style={styles.modalCancel}
                      accessibilityRole="button"
                    >
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={saveEggEdit}
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
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.55,
    color: ChickIntelPalette.gray1,
    marginTop: 10,
    marginBottom: 8,
  },
  pageHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  headerLeftRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  segmentStickyHeader: {
    backgroundColor: "transparent",
    paddingVertical: 6,
  },
  segmentWrap: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 14,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
    shadowColor: "#317667",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: verticalScale(38),
    borderRadius: 10,
    paddingHorizontal: moderateScale(10),
    gap: 6,
  },
  segmentActive: {
    backgroundColor: ChickIntelPalette.green1,
    shadowColor: "#317667",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  segmentInactive: {
    backgroundColor: "transparent",
  },
  segmentText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    lineHeight: 18,
    color: ChickIntelPalette.gray2,
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  segmentTextInactive: {
    color: ChickIntelPalette.gray2,
  },
  list: {
    gap: 10,
  },
  emptyStateText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    lineHeight: 20,
    color: ChickIntelPalette.gray2,
    textAlign: "center",
    paddingVertical: verticalScale(12),
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
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
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
    color: "rgba(51, 51, 51, 0.58)",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorPillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(244, 248, 247, 0.9)",
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
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
    width: scale(30),
    height: verticalScale(30),
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
  iconCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metricGridThree: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  metricGridTwo: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  metricChipWide: {
    flexGrow: 1,
    minWidth: scale(130),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.14)",
    backgroundColor: "rgba(244, 248, 247, 0.65)",
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(8),
    gap: 4,
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
    color: "#667171",
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
  readonlyMetricRow: {
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
    borderRadius: 10,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(10),
    backgroundColor: "rgba(202, 227, 221, 0.25)",
    gap: 2,
  },
  readonlyMetricValue: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
  },
  readonlyMetricHint: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 15,
    color: ChickIntelPalette.gray2,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
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
});
