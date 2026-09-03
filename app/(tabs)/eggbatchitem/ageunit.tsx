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
    FlatList,
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
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import type { BatchItem } from "@/utils/batch-store";
import { logError } from "@/utils/logger";
import { fetchFarmBatches } from "@/utils/supabase-batches";
import {
    createFarmEggBatch,
    fetchFarmEggBatches,
} from "@/utils/supabase-egg-batches";

type BatchColorOption = {
  id: string;
  batchNo: string;
  label: string;
  colorName: string;
  colorHex: string;
};

const ageUnitOptions = ["Days old", "Weeks old"] as const;

function normalizeParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function buildColorOptions(items: BatchItem[]): BatchColorOption[] {
  return items.map((item) => {
    const rawId = item.id.trim();

    return {
      id: rawId.toLowerCase(),
      batchNo: rawId,
      label: `${rawId} (${item.colorName})`,
      colorName: item.colorName,
      colorHex: item.colorHex,
    };
  });
}

function parseCount(value: string) {
  return Number.parseInt(value || "0", 10) || 0;
}

function getNextEggBatchNo(existingBatchNos: Array<string | null | undefined>) {
  const numericValues = existingBatchNos
    .map((value) => {
      const normalized = String(value ?? "").replace(/[^0-9]/g, "");
      const parsed = Number.parseInt(normalized, 10);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    })
    .filter((value): value is number => value !== null);

  const highest = numericValues.length ? Math.max(...numericValues) : 0;
  return String(highest + 1).padStart(4, "0");
}

function matchesParentBatch(
  item: { colorName?: string; origin?: string },
  parentBatchNo?: string,
  colorName?: string,
) {
  const normalizedParentBatchNo = (parentBatchNo ?? "").trim().toLowerCase();
  const normalizedColorName = (colorName ?? "").trim().toLowerCase();
  const normalizedColorNameValue = (item.colorName ?? "").trim().toLowerCase();
  const normalizedOrigin = (item.origin ?? "").trim().toLowerCase();

  if (normalizedParentBatchNo) {
    return normalizedOrigin === normalizedParentBatchNo;
  }

  return (
    normalizedColorNameValue === normalizedColorName ||
    normalizedOrigin === normalizedColorName
  );
}

export default function EggBatchAgeUnitScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeFarm } = useAuth();
  const params = useLocalSearchParams<{
    color?: string;
    colorHex?: string;
  }>();
  const colorParam = normalizeParam(params.color);
  const colorHexParam = normalizeParam(params.colorHex);

  const [batchNo, setBatchNo] = useState("");
  const [eggQty, setEggQty] = useState("");
  const [lineNo, setLineNo] = useState("");
  const [ageUnit, setAgeUnit] =
    useState<(typeof ageUnitOptions)[number]>("Days old");
  const [batchColors, setBatchColors] = useState<BatchColorOption[]>(() => []);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [colorMenuVisible, setColorMenuVisible] = useState(false);
  const [colorSearch, setColorSearch] = useState("");

  const resetForm = useCallback(() => {
    setBatchNo("");
    setEggQty("");
    setLineNo("");
    setAgeUnit("Days old");
    setSelectedColorId(null);
    setColorMenuVisible(false);
    setColorSearch("");
  }, []);

  const loadColors = useCallback(async () => {
    if (!activeFarm?.id) {
      if (colorParam) {
        setBatchColors([
          {
            id: colorParam.trim().toLowerCase(),
            batchNo: colorParam,
            label: colorParam,
            colorName: colorParam,
            colorHex: colorHexParam || ChickIntelPalette.gray2,
          },
        ]);
      } else {
        setBatchColors([]);
      }
      return;
    }

    try {
      const rows = await fetchFarmBatches(activeFarm.id);
      const liveOptions = buildColorOptions(rows);

      if (liveOptions.length) {
        setBatchColors(liveOptions);
        return;
      }

      if (colorParam) {
        setBatchColors([
          {
            id: colorParam.trim().toLowerCase(),
            batchNo: colorParam,
            label: colorParam,
            colorName: colorParam,
            colorHex: colorHexParam || ChickIntelPalette.gray2,
          },
        ]);
        return;
      }

      setBatchColors([
        {
          id: "unspecified",
          batchNo: "0001",
          label: "Unspecified",
          colorName: "Unspecified",
          colorHex: ChickIntelPalette.gray2,
        },
      ]);
    } catch (error) {
      logError("Egg batch age-unit colors load failed", error, {
        farmId: activeFarm.id,
      });
      setBatchColors([
        {
          id: colorParam ? colorParam.trim().toLowerCase() : "unspecified",
          batchNo: colorParam || "0001",
          label: colorParam || "Unspecified",
          colorName: colorParam || "Unspecified",
          colorHex: colorHexParam || ChickIntelPalette.gray2,
        },
      ]);
    }
  }, [activeFarm?.id, colorHexParam, colorParam]);

  useEffect(() => {
    void loadColors();
  }, [loadColors]);

  useEffect(() => {
    return () => {
      resetForm();
    };
  }, [resetForm]);

  useFocusEffect(
    useCallback(() => {
      resetForm();
      void loadColors();
      return () => undefined;
    }, [loadColors, resetForm]),
  );

  useEffect(() => {
    if (!batchColors.length) {
      setSelectedColorId(null);
      return;
    }

    const requested = colorParam?.toString().trim().toLowerCase();
    if (!requested) {
      setSelectedColorId(null);
      return;
    }

    const matchingOption = batchColors.find(
      (option) => option.id === requested,
    );
    if (matchingOption) {
      setSelectedColorId(requested);
    } else {
      setSelectedColorId(null);
    }
  }, [batchColors, colorParam]);

  const selectedBatchColor = useMemo(
    () =>
      selectedColorId
        ? (batchColors.find((option) => option.id === selectedColorId) ?? null)
        : null,
    [batchColors, selectedColorId],
  );

  const filteredBatchColors = useMemo(() => {
    const query = colorSearch.trim().toLowerCase();
    if (!query) return batchColors;

    return batchColors.filter((option) =>
      `${option.batchNo} ${option.colorName} ${option.label}`
        .toLowerCase()
        .includes(query),
    );
  }, [batchColors, colorSearch]);

  useEffect(() => {
    let cancelled = false;

    async function syncBatchNo() {
      if (!activeFarm?.id || !selectedBatchColor?.label) {
        if (!cancelled) {
          setBatchNo("");
        }
        return;
      }

      try {
        const rows = await fetchFarmEggBatches(activeFarm.id);
        if (cancelled) return;

        const matchingRows = rows.filter((row) =>
          matchesParentBatch(
            {
              colorName: row.colorName,
              origin: row.origin,
            },
            selectedBatchColor.batchNo,
            selectedBatchColor.colorName || selectedBatchColor.label,
          ),
        );

        if (!cancelled) {
          setBatchNo(getNextEggBatchNo(matchingRows.map((row) => row.batchNo)));
        }
      } catch (error) {
        if (!cancelled) {
          setBatchNo("");
        }
        logError("Egg batch number sync failed", error, {
          farmId: activeFarm.id,
          color: selectedBatchColor.label,
        });
      }
    }

    void syncBatchNo();

    return () => {
      cancelled = true;
    };
  }, [activeFarm?.id, selectedBatchColor?.label]);

  async function saveEgg() {
    if (!selectedBatchColor) {
      Alert.alert(
        "Batch color required",
        "Please choose a batch color from the chicken profile list.",
      );
      return;
    }

    const targetParentBatchNo = selectedBatchColor.batchNo || "0001";
    const targetEggBatchNo = batchNo.trim() || "0001";
    const targetColorName =
      selectedBatchColor.colorName || selectedBatchColor.label || "Unspecified";

    const newEgg = {
      batchNo: targetEggBatchNo,
      eggQty: parseCount(eggQty),
      lineNo: parseCount(lineNo),
      ageUnit,
      hatchedQty: 0,
      damagedQty: 0,
      unhatchedQty: parseCount(eggQty),
      colorName: targetColorName,
      colorHex: selectedBatchColor.colorHex,
      origin: targetParentBatchNo,
    };
    if (!activeFarm?.id) {
      Alert.alert("Farm missing", "No active farm was found.");
      return;
    }

    try {
      await createFarmEggBatch(activeFarm.id, newEgg);
      router.push({
        pathname: "/(tabs)/eggbatchitem/[color]" as any,
        params: {
          color: targetColorName,
          colorHex: selectedBatchColor.colorHex,
          batchNo: targetParentBatchNo,
          originBatchNo: targetParentBatchNo,
        },
      });
    } catch (error) {
      Alert.alert("Save failed", "Unable to save egg batch right now.");
      logError("Egg batch create failed", error, {
        farmId: activeFarm.id,
        batchNo: newEgg.batchNo,
      });
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
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={insets.top}
      >
        <View
          style={[
            styles.content,
            styles.pinnedHeader,
            { paddingTop: insets.top + 10 },
          ]}
        >
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={() =>
                router.replace({
                  pathname: "/(tabs)/profiles" as any,
                  params: { mode: "egg" },
                })
              }
              style={styles.backButton}
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
          </View>

          <View style={styles.titleCard}>
            <View style={styles.kickerRow}>
              <MaterialCommunityIcons
                name="egg-outline"
                size={15}
                color="#CAE3DD"
              />
              <Text style={styles.kickerText}>Egg production</Text>
            </View>
            <Text style={styles.pageTitle}>Create Egg Batch</Text>
            <Text style={styles.pageSubtitle}>
              Connect this egg set to a chicken batch and track quantity, line
              age, and color origin.
            </Text>
          </View>

          <View style={styles.summaryChipRow}>
            <View style={styles.summaryChip}>
              <MaterialCommunityIcons
                name="identifier"
                size={12}
                color={ChickIntelPalette.green1}
              />
              <Text style={styles.summaryChipText}>#{batchNo || "Auto"}</Text>
            </View>
            <View style={styles.summaryChip}>
              <MaterialCommunityIcons
                name="egg"
                size={12}
                color={ChickIntelPalette.green1}
              />
              <Text style={styles.summaryChipText}>{eggQty || "0"} eggs</Text>
            </View>
            <View style={styles.summaryChip}>
              <View
                style={[
                  styles.summaryColorDot,
                  {
                    backgroundColor:
                      selectedBatchColor?.colorHex ?? ChickIntelPalette.gray2,
                  },
                ]}
              />
              <Text style={styles.summaryChipText}>
                {selectedBatchColor?.colorName || "Color"}
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom: 15,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Form Sections */}
          <View style={styles.formSection}>
            <View style={styles.formSectionHeader}>
              <MaterialCommunityIcons
                name="link-variant"
                size={18}
                color={ChickIntelPalette.green1}
              />
              <Text style={styles.formSectionTitle}>Batch source</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Batch Color</Text>
              <Pressable
                onPress={() => setColorMenuVisible(true)}
                style={({ pressed }) => [
                  styles.select,
                  { opacity: pressed ? 0.9 : 1 },
                ]}
                accessibilityRole="button"
              >
                <View style={styles.selectLeft}>
                  <View
                    style={[
                      styles.colorDot,
                      {
                        backgroundColor:
                          selectedBatchColor?.colorHex ??
                          ChickIntelPalette.gray2,
                      },
                    ]}
                  />
                  <Text style={styles.selectText}>
                    {selectedBatchColor?.label ??
                      "Choose from live chicken colors"}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-down"
                  size={20}
                  color={ChickIntelPalette.gray2}
                />
              </Pressable>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Batch No.</Text>
              <TextInput
                value={batchNo}
                editable={false}
                selectTextOnFocus={false}
                style={[styles.input, styles.inputDisabled]}
                placeholder="Auto-generated"
                placeholderTextColor="#899696"
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <View style={styles.formSectionHeader}>
              <MaterialCommunityIcons
                name="basket-outline"
                size={18}
                color={ChickIntelPalette.green1}
              />
              <Text style={styles.formSectionTitle}>Egg count</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Egg Qty.</Text>
              <TextInput
                value={eggQty}
                onChangeText={(t) => setEggQty(t.replace(/[^0-9]/g, ""))}
                style={styles.input}
                keyboardType="number-pad"
                placeholder="120"
                placeholderTextColor="#899696"
              />
            </View>
          </View>

          <View style={styles.formSection}>
            <View style={styles.formSectionHeader}>
              <MaterialCommunityIcons
                name="calendar-clock"
                size={18}
                color={ChickIntelPalette.green1}
              />
              <Text style={styles.formSectionTitle}>Age details</Text>
            </View>

            <View style={styles.gridRow}>
              <View style={styles.ageNumberCol}>
                <Text style={styles.fieldLabel}>No.</Text>
                <TextInput
                  value={lineNo}
                  onChangeText={(t) => setLineNo(t.replace(/[^0-9]/g, ""))}
                  style={styles.input}
                  keyboardType="number-pad"
                  placeholder="12"
                  textAlignVertical="center"
                  placeholderTextColor="#899696"
                />
              </View>

              <View style={styles.ageUnitCol}>
                <Text style={styles.fieldLabel}>Age unit</Text>
                <View style={styles.previewSegmentedContainer}>
                  {ageUnitOptions.map((option) => {
                    const active = ageUnit === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setAgeUnit(option)}
                        activeOpacity={0.8}
                        style={[
                          styles.previewSegmentedItem,
                          active && styles.previewSegmentedItemActive,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={
                            option === "Days old"
                              ? "calendar-today"
                              : "calendar-week"
                          }
                          size={14}
                          color={active ? "#FFF" : "#4A5452"}
                        />
                        <Text
                          style={[
                            styles.previewSegmentedText,
                            active && styles.previewSegmentedTextActive,
                          ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          <Pressable
            onPress={saveEgg}
            style={({ pressed }) => [
              styles.saveBtn,
              { opacity: pressed ? 0.92 : 1 },
            ]}
            accessibilityRole="button"
          >
            <Text style={styles.saveText}>Save Egg Batch</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={colorMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setColorMenuVisible(false);
          setColorSearch("");
        }}
      >
        <View style={styles.menuOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setColorMenuVisible(false);
              setColorSearch("");
            }}
          />
          <View style={styles.menuCard}>
            <View style={styles.menuHeader}>
              <View>
                <Text style={styles.menuTitle}>Chicken profile colors</Text>
                <Text style={styles.menuCount}>
                  {filteredBatchColors.length} of {batchColors.length} colors
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setColorMenuVisible(false);
                  setColorSearch("");
                }}
                style={styles.menuCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Close color picker"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={18}
                  color={ChickIntelPalette.gray1}
                />
              </Pressable>
            </View>
            <View style={styles.searchField}>
              <MaterialCommunityIcons
                name="magnify"
                size={19}
                color={ChickIntelPalette.gray2}
              />
              <TextInput
                value={colorSearch}
                onChangeText={setColorSearch}
                placeholder="Search batch number or color"
                placeholderTextColor="#899696"
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {colorSearch ? (
                <Pressable
                  onPress={() => setColorSearch("")}
                  accessibilityRole="button"
                  accessibilityLabel="Clear color search"
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={18}
                    color={ChickIntelPalette.gray2}
                  />
                </Pressable>
              ) : null}
            </View>
            <FlatList
              data={filteredBatchColors}
              keyExtractor={(option) => option.id}
              style={styles.menuList}
              contentContainerStyle={styles.menuListContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              initialNumToRender={20}
              ListEmptyComponent={
                <Text style={styles.emptyMenuText}>No matching colors</Text>
              }
              renderItem={({ item: option }) => {
                const active = option.id === selectedColorId;
                return (
                  <Pressable
                    onPress={() => {
                      setSelectedColorId(option.id);
                      setColorMenuVisible(false);
                      setColorSearch("");
                    }}
                    style={({ pressed }) => [
                      styles.menuItem,
                      active && styles.menuItemActive,
                      { opacity: pressed ? 0.82 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={styles.selectLeft}>
                      <View
                        style={[
                          styles.colorDot,
                          {
                            backgroundColor: option.colorHex,
                          },
                        ]}
                      />
                      <Text style={styles.menuItemText}>{option.label}</Text>
                    </View>
                    {active ? (
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={19}
                        color={ChickIntelPalette.green1}
                      />
                    ) : null}
                  </Pressable>
                );
              }}
            />
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
  keyboardArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: moderateScale(16),
    gap: 12,
  },
  pinnedHeader: {
    flexShrink: 0,
    paddingBottom: 12,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
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
  titleCard: {
    borderRadius: 10,
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(14),
    backgroundColor: ChickIntelPalette.green1,
    gap: 4,
  },
  kickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  kickerText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    letterSpacing: 0.55,
    textTransform: "uppercase",
    color: "#CAE3DD",
  },
  pageTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: "#FFFFFF",
  },
  pageSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 17,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.88)",
  },
  summaryChipRow: {
    flexDirection: "row",
    gap: 6,
  },
  summaryChip: {
    flex: 1,
    minHeight: verticalScale(26),
    paddingVertical: verticalScale(3),
    paddingHorizontal: moderateScale(6),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 8,
    backgroundColor: "rgba(254, 254, 254, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
  },
  summaryChipText: {
    flexShrink: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  summaryColorDot: {
    width: scale(9),
    height: verticalScale(9),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },
  formSection: {
    gap: 10,
    borderRadius: 10,
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(14),
    backgroundColor: "rgba(254, 254, 254, 0.92)",
  },
  formSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  formSectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(15),
    fontWeight: "800",
    letterSpacing: -0.15,
    color: ChickIntelPalette.gray1,
  },
  rowInputs: {
    flexDirection: "row",
    gap: 10,
  },
  gridRow: {
    flexDirection: "row",
    gap: 10,
  },
  ageNumberCol: {
    width: scale(72),
    gap: 5,
  },
  ageUnitCol: {
    flex: 1,
    gap: 5,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    color: "#5E6666",
  },
  label: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  input: {
    height: verticalScale(46),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.2)",
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(0),
    backgroundColor: ChickIntelPalette.light1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.gray1,
    textAlignVertical: "center",
  },
  inputDisabled: {
    backgroundColor: "rgba(255,255,255,0.64)",
    color: ChickIntelPalette.gray2,
  },
  previewSegmentedContainer: {
    flexDirection: "row",
    height: verticalScale(46),
    backgroundColor: "rgba(49, 118, 103, 0.08)",
    borderRadius: 8,
    padding: 3,
    gap: 3,
    alignItems: "center",
  },
  previewSegmentedItem: {
    flex: 1,
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 6,
  },
  previewSegmentedItemActive: {
    backgroundColor: ChickIntelPalette.green1,
  },
  previewSegmentedText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: "#4A5452",
  },
  previewSegmentedTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  select: {
    minHeight: verticalScale(44),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.2)",
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(0),
    backgroundColor: ChickIntelPalette.light1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  selectText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.gray1,
  },
  colorDot: {
    width: scale(28),
    height: verticalScale(10),
    borderRadius: 3,
  },
  saveBtn: {
    height: verticalScale(52),
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.green1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: verticalScale(4),
    shadowColor: "#317667",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(5) },
    elevation: 3,
  },
  saveText: {
    color: ChickIntelPalette.light1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: moderateScale(20),
  },
  menuCard: {
    maxHeight: "82%",
    borderRadius: 5,
    backgroundColor: ChickIntelPalette.light1,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.18)",
    padding: moderateScale(16),
    gap: 10,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  menuTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13),
    lineHeight: 22,
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  menuCount: {
    marginTop: 2,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: ChickIntelPalette.gray2,
  },
  menuCloseButton: {
    width: scale(34),
    height: verticalScale(34),
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(49,118,103,0.1)",
  },
  searchField: {
    minHeight: verticalScale(44),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.18)",
    backgroundColor: "rgba(49,118,103,0.06)",
    paddingHorizontal: moderateScale(10),
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.gray1,
  },
  menuList: {
    flexShrink: 1,
  },
  menuListContent: {
    gap: 8,
    paddingVertical: 1,
  },
  emptyMenuText: {
    paddingVertical: verticalScale(24),
    textAlign: "center",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.gray2,
  },
  menuItem: {
    minHeight: verticalScale(48),
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "rgba(49,118,103,0.12)",
    backgroundColor: "rgba(156,213,201,0.16)",
    paddingHorizontal: moderateScale(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuItemActive: {
    borderColor: ChickIntelPalette.green1,
    backgroundColor: "rgba(49,118,103,0.14)",
  },
  menuItemText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
});
