import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { BlurCard } from "@/components/ui/blur-card";
import {
    ChickField,
    ChickSelectionModal,
    ChickSelectRow,
    ChickTextInput,
} from "@/components/ui/chick-form";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/providers/auth-provider";
import { useFarmData } from "@/providers/farm-data-provider";
import { logError, logStep } from "@/utils/logger";
import {
    computeEffectiveInventoryItems,
    getStockSeverityMeta,
    type EffectiveInventoryItem,
} from "@/utils/stock-alerts";
import {
    createInventoryItem,
    deleteInventoryItem,
    fetchInventoryItems,
    updateInventoryItem,
    type SupabaseInventoryItem,
} from "@/utils/supabase-inventory";
import { fetchInventoryCategoryOptions } from "@/utils/supabase-lookups";
import {
    fetchScheduleTaskCompletions,
    fetchScheduleTasks,
    type SupabaseScheduleTask,
    type SupabaseScheduleTaskCompletion,
} from "@/utils/supabase-schedule";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
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
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";

type InventoryItem = SupabaseInventoryItem & { baseQty?: number };

const UNIT_OPTIONS = ["kg", "lbs", "box", "pcs", "ml", "vials"];
const formatQuantityValue = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

const formatAppDate = (date?: Date | null) => {
  if (!date || Number.isNaN(date.getTime())) return "";
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const y = date.getFullYear();
  return `${m}/${day}/${y}`;
};

export default function InventoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const { activeFarm } = useAuth();
  const {
    effectiveItems,
    loading: loadingItems,
    restockItem,
    addInventoryItem,
    removeInventoryItem,
    refreshFarmData,
  } = useFarmData();
  const isDark = colorScheme === "dark";

  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Selection Modal State for Table Rows & Form Dropdowns
  const [selectionModal, setSelectionModal] = useState<{
    visible: boolean;
    title: string;
    options: string[];
    value: string;
    onSelect: (val: string) => void;
  }>({
    visible: false,
    title: "",
    options: [],
    value: "",
    onSelect: () => {},
  });

  const hasExpirationDate = (type: string) => {
    const normalized = type.trim().toLowerCase();
    return (
      normalized.includes("feed") ||
      normalized.includes("medicine") ||
      normalized.includes("medication") ||
      normalized.includes("vitamin") ||
      normalized.includes("supplement")
    );
  };

  // Add Item Modal State
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [typeOptions, setTypeOptions] = useState<string[]>([]);
  const [newItemType, setNewItemType] = useState("Choose type");
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("Choose Measurement unit");
  const [newItemDate, setNewItemDate] = useState(new Date());
  const [newItemExpDate, setNewItemExpDate] = useState<Date | undefined>(
    undefined,
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showExpDatePicker, setShowExpDatePicker] = useState(false);

  // Edit Item Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editDeliveryDate, setEditDeliveryDate] = useState<Date | undefined>(
    new Date(),
  );
  const [editExpirationDate, setEditExpirationDate] = useState<
    Date | undefined
  >(undefined);
  const [restockQty, setRestockQty] = useState("");
  const [showEditDeliveryDatePicker, setShowEditDeliveryDatePicker] =
    useState(false);
  const [showEditExpDatePicker, setShowEditExpDatePicker] = useState(false);

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || newItemDate;
    setShowDatePicker(Platform.OS === "ios");
    setNewItemDate(currentDate);
  };

  const onExpDateChange = (event: any, selectedDate?: Date) => {
    setShowExpDatePicker(Platform.OS === "ios");
    if (selectedDate) setNewItemExpDate(selectedDate);
  };

  const onEditDeliveryDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || editDeliveryDate;
    setShowEditDeliveryDatePicker(Platform.OS === "ios");
    setEditDeliveryDate(currentDate);
  };

  const onEditExpDateChange = (event: any, selectedDate?: Date) => {
    setShowEditExpDatePicker(Platform.OS === "ios");
    if (selectedDate) setEditExpirationDate(selectedDate);
  };

  const glassColor = isDark
    ? "rgba(255, 255, 255, 0.1)"
    : "rgba(255, 255, 255, 0.45)";
  const glassBorder = isDark
    ? "rgba(255, 255, 255, 0.2)"
    : "rgba(255, 255, 255, 0.6)";

  useFocusEffect(
    useCallback(() => {
      void refreshFarmData();
    }, [refreshFarmData]),
  );

  useEffect(() => {
    let cancelled = false;

    fetchInventoryCategoryOptions()
      .then((options) => {
        if (!cancelled) setTypeOptions(options);
      })
      .catch((error) => {
        if (!cancelled) {
          logError("Inventory category lookup load failed", error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const groupedItems = useMemo(() => {
    const groups = effectiveItems.reduce<
      Record<string, EffectiveInventoryItem[]>
    >((accumulator, item) => {
      const key = item.type?.trim() || "Other";
      accumulator[key] = [...(accumulator[key] ?? []), item];
      return accumulator;
    }, {});

    return Object.entries(groups).sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [effectiveItems]);

  const toggleTypeSelection = (groupItems: InventoryItem[]) => {
    const ids = groupItems.map((item) => item.id);
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const normalizeItemName = (name: string, type?: string) => {
    const trimmedName = name.trim();
    const trimmedType = type?.trim();

    if (
      trimmedType &&
      trimmedName.toLowerCase().endsWith(trimmedType.toLowerCase())
    ) {
      return trimmedName
        .slice(0, trimmedName.length - trimmedType.length)
        .trim();
    }

    if (trimmedName.toLowerCase().endsWith("feeds")) {
      return trimmedName.slice(0, trimmedName.length - 5).trim();
    }

    if (trimmedName.toLowerCase().endsWith("feed")) {
      return trimmedName.slice(0, trimmedName.length - 4).trim();
    }

    return trimmedName;
  };

  const handleSaveNewItem = async () => {
    if (!activeFarm?.id) return;
    const parsedQty = Number.parseFloat(newItemQty) || 0;
    const normalizedType =
      newItemType === "Choose type" ? "Other" : newItemType;

    try {
      await addInventoryItem({
        type: normalizedType,
        name: newItemName || "Unnamed Item",
        qty: parsedQty,
        unit: newItemUnit === "Choose Measurement unit" ? "pcs" : newItemUnit,
        purchasedDate: newItemDate,
        expirationDate: hasExpirationDate(normalizedType)
          ? newItemExpDate
          : undefined,
      });
    } catch (error) {
      logError("Inventory create failed", error, {
        farmId: activeFarm.id,
      });
      return;
    }
    setAddModalVisible(false);
    // Reset form
    setNewItemType("Choose type");
    setNewItemName("");
    setNewItemQty("");
    setNewItemUnit("Choose Measurement unit");
    setNewItemDate(new Date());
    setNewItemExpDate(undefined);
    setShowExpDatePicker(false);
  };

  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setRestockQty("");
    setEditDeliveryDate(item.deliveryDate || new Date());
    setEditExpirationDate(item.expirationDate);
    setShowEditExpDatePicker(false);
    setEditModalVisible(true);
  };

  const handleSaveChanges = async () => {
    if (!editingItem) return;
    if (!activeFarm?.id) return;

    const hasRestockValue = restockQty.trim().length > 0;
    const restockAmount = hasRestockValue ? Number.parseFloat(restockQty) : 0;

    if (
      hasRestockValue &&
      (!Number.isFinite(restockAmount) || restockAmount < 0)
    ) {
      Alert.alert(
        "Invalid restock amount",
        "Please enter a valid non-negative number.",
      );
      logError("Invalid restock quantity entered", null, {
        restockQty,
      });
      return;
    }

    const canExpire = hasExpirationDate(editingItem.type);

    try {
      await restockItem(editingItem.id, restockAmount, {
        deliveredDate: editDeliveryDate,
        expirationDate: canExpire ? editExpirationDate : undefined,
      });
    } catch (error) {
      logError("Inventory update failed", error, {
        farmId: activeFarm.id,
        itemId: editingItem.id,
      });
      Alert.alert(
        "Unable to update item",
        "The stock update could not be saved.",
      );
      return;
    }
    setRestockQty("");
    setEditModalVisible(false);
    setEditingItem(null);
  };

  const renderInventoryTable = (
    groupTitle: string,
    groupItems: EffectiveInventoryItem[],
  ) => {
    const allGroupSelected =
      groupItems.length > 0 &&
      groupItems.every((item) => selectedIds.has(item.id));

    return (
      <BlurCard
        key={groupTitle}
        style={styles.tableContainer}
        borderRadius={14}
        intensity={16}
      >
        <View
          style={[
            styles.tableSurface,
            {
              backgroundColor: glassColor,
              borderColor: glassBorder,
            },
          ]}
        >
          <View style={styles.tableSectionHeader}>
            <Text style={styles.tableSectionTitle}>{groupTitle}</Text>
            <Text style={styles.tableSectionMeta}>
              {groupItems.length} item
              {groupItems.length === 1 ? "" : "s"}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.tableInner}>
              <View style={styles.headerRow}>
                <View style={[styles.colName, styles.headerCell]}>
                  <Text style={styles.headerText}>Item Details</Text>
                </View>
                <View style={[styles.colStatus, styles.headerCell]}>
                  <Text style={styles.headerText}>Live Usage</Text>
                </View>
                <View style={[styles.colActions, styles.headerCell]}>
                  <Text style={styles.headerText}>Action</Text>
                </View>
              </View>

              {groupItems.map((item, index) => {
                const isLast = index === groupItems.length - 1;
                const stockMeta = getStockSeverityMeta(item.statusPercent);

                return (
                  <View
                    key={item.id}
                    style={[styles.row, isLast ? null : styles.rowBorder]}
                  >
                    <View
                      style={[
                        styles.colName,
                        styles.cell,
                        {
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: 4,
                        },
                      ]}
                    >
                      <Text style={styles.rowTextMain}>
                        {normalizeItemName(item.name, item.type)}
                      </Text>
                      <View style={styles.itemDateStack}>
                        <View style={styles.dateMetaTag}>
                          <MaterialCommunityIcons
                            name="calendar-outline"
                            size={11}
                            color="rgba(51, 51, 51, 0.65)"
                          />
                          <Text style={styles.dateMetaText}>
                            Ordered: {formatAppDate(item.orderDate)}
                          </Text>
                        </View>
                        {item.expirationDate ? (
                          <View
                            style={[styles.dateMetaTag, styles.expDateMetaTag]}
                          >
                            <MaterialCommunityIcons
                              name="clock-outline"
                              size={11}
                              color="#D97706"
                            />
                            <Text
                              style={[
                                styles.dateMetaText,
                                styles.expDateMetaText,
                              ]}
                            >
                              Exp: {formatAppDate(item.expirationDate)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <View style={[styles.colStatus, styles.cell]}>
                      <View style={styles.stockStatusWrap}>
                        <View
                          style={[
                            styles.stockBadge,
                            {
                              backgroundColor: stockMeta.softColor,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.stockBadgeDot,
                              {
                                backgroundColor: stockMeta.fillColor,
                              },
                            ]}
                          />
                          <Text
                            style={[
                              styles.stockBadgeText,
                              {
                                color: stockMeta.textColor,
                              },
                            ]}
                          >
                            {stockMeta.label} - {item.statusPercent}% left
                          </Text>
                        </View>
                        <View style={styles.stockBarTrack}>
                          <View
                            style={[
                              styles.stockBarFill,
                              {
                                width: `${item.statusPercent}%`,
                                backgroundColor: stockMeta.fillColor,
                              },
                            ]}
                          />
                        </View>
                        <Text
                          style={[
                            styles.stockPrimaryText,
                            {
                              color: stockMeta.textColor,
                            },
                          ]}
                        >
                          {formatQuantityValue(item.remainingQty)}/
                          {formatQuantityValue(item.baseQty)} {item.unit}{" "}
                          remaining
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.colActions, styles.cell]}>
                      <View style={styles.actionsContainer}>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => handleOpenEditModal(item)}
                        >
                          <MaterialCommunityIcons
                            name="pencil-outline"
                            size={18}
                            color="#2F80ED"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={async () => {
                            if (!activeFarm?.id) return;
                            try {
                              await removeInventoryItem(item.id);
                            } catch (error) {
                              logError("Inventory delete failed", error, {
                                farmId: activeFarm.id,
                                itemId: item.id,
                              });
                            }
                          }}
                        >
                          <MaterialCommunityIcons
                            name="trash-can-outline"
                            size={18}
                            color="#EB5757"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </BlurCard>
    );
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
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/(tabs)")
            }
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={ChickIntelPalette.gray1}
            />
          </Pressable>
          <Text style={styles.screenTitle}>Inventory</Text>
        </View>
        <Pressable
          style={styles.addButton}
          onPress={() => setAddModalVisible(true)}
        >
          <MaterialCommunityIcons
            name="plus"
            size={28}
            color={ChickIntelPalette.gray1}
          />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.content}>
          {loadingItems ? (
            <Text style={styles.emptyStateText}>Loading inventory...</Text>
          ) : null}
          {!loadingItems && inventoryError ? (
            <Text style={styles.emptyStateText}>{inventoryError}</Text>
          ) : null}
          {!loadingItems && !inventoryError && effectiveItems.length === 0 ? (
            <Text style={styles.emptyStateText}>No inventory items yet.</Text>
          ) : null}
          {!loadingItems && !inventoryError
            ? groupedItems.map(([groupTitle, groupItems]) =>
                renderInventoryTable(groupTitle, groupItems),
              )
            : null}
        </View>
      </ScrollView>

      {/* Selection Modal (Generic) */}
      <ChickSelectionModal
        visible={selectionModal.visible}
        title={selectionModal.title}
        options={selectionModal.options}
        value={selectionModal.value}
        onSelect={(opt) => selectionModal.onSelect(opt)}
        onClose={() =>
          setSelectionModal((prev) => ({ ...prev, visible: false }))
        }
      />

      {/* Add New Item Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={insets.top}
        >
          <View style={[styles.darkModalBackdrop, { paddingTop: insets.top }]}>
            <View style={styles.darkModalContent}>
              <View style={styles.addModalGrabber} />
              <ScrollView
                contentContainerStyle={styles.addModalScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                <View style={styles.addModalHero}>
                  <View style={styles.addModalIconWrap}>
                    <MaterialCommunityIcons
                      name="package-variant-plus"
                      size={26}
                      color={ChickIntelPalette.green1}
                    />
                  </View>
                  <View style={styles.addModalTitleStack}>
                    <Text style={styles.addModalKicker}>Inventory stock</Text>
                    <Text style={styles.darkModalTitle}>Add New Item</Text>
                    <Text style={styles.addModalSubtitle}>
                      Track quantity, unit, delivery date, and expiry details.
                    </Text>
                  </View>
                </View>

                <View style={styles.addModalQuickMetaRow}>
                  <View style={styles.addModalMetaPill}>
                    <MaterialCommunityIcons
                      name="cube-outline"
                      size={14}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.addModalMetaText}>
                      {newItemType === "Choose type" ? "No type yet" : newItemType}
                    </Text>
                  </View>
                  <View style={styles.addModalMetaPill}>
                    <MaterialCommunityIcons
                      name="scale-balance"
                      size={14}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.addModalMetaText}>
                      {newItemQty.trim() || "0"}{" "}
                      {newItemUnit === "Choose Measurement unit"
                        ? "unit"
                        : newItemUnit}
                    </Text>
                  </View>
                </View>

                <View style={styles.addModalSection}>
                  <View style={styles.addModalSectionHeader}>
                    <MaterialCommunityIcons
                      name="clipboard-text-outline"
                      size={18}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.addModalSectionTitle}>
                      Item details
                    </Text>
                  </View>

                  <ChickSelectRow
                    label="Type"
                    value={newItemType}
                    placeholder="Choose type"
                    rowStyle={styles.compactSelectRow}
                    onPress={() =>
                      setSelectionModal({
                        visible: true,
                        title: "Select Type",
                        options: typeOptions,
                        value: newItemType,
                        onSelect: setNewItemType,
                      })
                    }
                  />

                  <ChickField label="Item name" style={styles.compactField}>
                    <ChickTextInput
                      placeholder="Enter item name"
                      value={newItemName}
                      onChangeText={setNewItemName}
                      style={styles.compactInput}
                    />
                  </ChickField>
                </View>

                <View style={styles.addModalSection}>
                  <View style={styles.addModalSectionHeader}>
                    <MaterialCommunityIcons
                      name="chart-box-outline"
                      size={18}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.addModalSectionTitle}>
                      Stock amount
                    </Text>
                  </View>

                  <View style={styles.addModalTwoColumn}>
                    <ChickField
                      label="Qty"
                      style={[styles.compactField, styles.addModalColumn]}
                    >
                      <ChickTextInput
                        placeholder="Enter qty"
                        keyboardType="numeric"
                        value={newItemQty}
                        onChangeText={setNewItemQty}
                        style={styles.compactInput}
                      />
                    </ChickField>

                    <View style={styles.addModalColumn}>
                      <ChickSelectRow
                        label="Unit"
                        value={newItemUnit}
                        placeholder="Choose Measurement unit"
                        rowStyle={styles.compactSelectRow}
                        onPress={() =>
                          setSelectionModal({
                            visible: true,
                            title: "Select Unit",
                            options: UNIT_OPTIONS,
                            value: newItemUnit,
                            onSelect: setNewItemUnit,
                          })
                        }
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.addModalSection}>
                  <View style={styles.addModalSectionHeader}>
                    <MaterialCommunityIcons
                      name="calendar-month-outline"
                      size={18}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.addModalSectionTitle}>
                      Stock dates
                    </Text>
                  </View>

                  <ChickField
                    label="Date of purchased"
                    style={styles.compactField}
                  >
                    <TouchableOpacity
                      style={styles.dateRow}
                      onPress={() => setShowDatePicker(true)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.dateRowCopy}>
                        <MaterialCommunityIcons
                          name="calendar-blank-outline"
                          size={18}
                          color={ChickIntelPalette.green1}
                        />
                        <Text style={styles.dateRowText}>
                          {formatAppDate(newItemDate)}
                        </Text>
                      </View>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={ChickIntelPalette.gray2}
                      />
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={newItemDate}
                        mode="date"
                        display="default"
                        onChange={onDateChange}
                      />
                    )}
                  </ChickField>

                  {hasExpirationDate(newItemType) ? (
                    <ChickField
                      label="Expiration Date"
                      style={styles.compactField}
                    >
                      <TouchableOpacity
                        style={[styles.dateRow, styles.expirationDateRow]}
                        onPress={() => setShowExpDatePicker(true)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.dateRowCopy}>
                          <MaterialCommunityIcons
                            name="calendar-clock-outline"
                            size={18}
                            color="#B45309"
                          />
                          <Text
                            style={[
                              styles.dateRowText,
                              styles.expirationDateRowText,
                            ]}
                          >
                            {newItemExpDate
                              ? formatAppDate(newItemExpDate)
                              : "Select expiration date"}
                          </Text>
                        </View>
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={20}
                          color="#B45309"
                        />
                      </TouchableOpacity>
                      {showExpDatePicker && (
                        <DateTimePicker
                          value={newItemExpDate || new Date()}
                          mode="date"
                          display="default"
                          onChange={onExpDateChange}
                        />
                      )}
                    </ChickField>
                  ) : (
                    <View style={styles.addModalInfoCallout}>
                      <MaterialCommunityIcons
                        name="information-outline"
                        size={17}
                        color={ChickIntelPalette.green1}
                      />
                      <Text style={styles.addModalInfoText}>
                        Expiration appears for feeds, medicines, vitamins, and
                        supplements.
                      </Text>
                    </View>
                  )}
                </View>
                <View
                  style={[
                    styles.darkModalFooter,
                    { paddingBottom: insets.bottom + 20 },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.darkBtnCancel}
                    onPress={() => setAddModalVisible(false)}
                  >
                    <Text style={styles.darkBtnCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.darkBtnAdd}
                    onPress={handleSaveNewItem}
                  >
                    <Text style={styles.darkBtnAddText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalKeyboardArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={insets.top}
        >
          <View style={[styles.darkModalBackdrop, { paddingTop: insets.top }]}>
            <View style={styles.darkModalContent}>
              <View style={styles.addModalGrabber} />
              <ScrollView
                contentContainerStyle={styles.addModalScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
              >
                <View style={[styles.addModalHero, styles.editModalHero]}>
                  <View style={styles.addModalIconWrap}>
                    <MaterialCommunityIcons
                      name="package-variant-closed-check"
                      size={26}
                      color={ChickIntelPalette.green1}
                    />
                  </View>
                  <View style={styles.addModalTitleStack}>
                    <Text style={styles.addModalKicker}>Stock update</Text>
                    <Text style={styles.darkModalTitle} numberOfLines={2}>
                      {editingItem?.name || "Edit Item"}
                    </Text>
                    <Text style={styles.addModalSubtitle}>
                      Add restock quantity and refresh delivery or expiry dates.
                    </Text>
                  </View>
                </View>

                <View style={styles.addModalQuickMetaRow}>
                  <View style={styles.addModalMetaPill}>
                    <MaterialCommunityIcons
                      name="cube-outline"
                      size={14}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.addModalMetaText}>
                      {editingItem?.type || "Inventory"}
                    </Text>
                  </View>
                  <View style={styles.addModalMetaPill}>
                    <MaterialCommunityIcons
                      name="warehouse"
                      size={14}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.addModalMetaText}>
                      {formatQuantityValue(editingItem?.qty ?? 0)}{" "}
                      {editingItem?.unit || ""}
                    </Text>
                  </View>
                </View>

                <View style={styles.addModalSection}>
                  <View style={styles.addModalSectionHeader}>
                    <MaterialCommunityIcons
                      name="archive-check-outline"
                      size={18}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.addModalSectionTitle}>
                      Current stock
                    </Text>
                  </View>
                  <View style={styles.editStockSnapshot}>
                    <View style={styles.editStockSnapshotIcon}>
                      <MaterialCommunityIcons
                        name="package-variant"
                        size={22}
                        color={ChickIntelPalette.green1}
                      />
                    </View>
                    <View style={styles.editStockSnapshotCopy}>
                      <Text style={styles.editStockSnapshotLabel}>
                        Available now
                      </Text>
                      <Text style={styles.editStockSnapshotValue}>
                        {formatQuantityValue(editingItem?.qty ?? 0)}{" "}
                        {editingItem?.unit || ""}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.addModalSection}>
                  <View style={styles.addModalSectionHeader}>
                    <MaterialCommunityIcons
                      name="plus-box-outline"
                      size={18}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.addModalSectionTitle}>
                      Restock amount
                    </Text>
                  </View>
                  <ChickField label="Quantity to add" style={styles.compactField}>
                    <ChickTextInput
                      placeholder="Enter quantity to add"
                      keyboardType="numeric"
                      value={restockQty}
                      onChangeText={setRestockQty}
                      style={styles.compactInput}
                    />
                  </ChickField>
                  <View style={styles.addModalInfoCallout}>
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={17}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.addModalInfoText}>
                      Leave this blank to update dates without changing the
                      quantity.
                    </Text>
                  </View>
                </View>

                <View style={styles.addModalSection}>
                  <View style={styles.addModalSectionHeader}>
                    <MaterialCommunityIcons
                      name="calendar-sync-outline"
                      size={18}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.addModalSectionTitle}>
                      Stock dates
                    </Text>
                  </View>

                  <ChickField label="Delivery Date" style={styles.compactField}>
                    <TouchableOpacity
                      style={styles.dateRow}
                      onPress={() => setShowEditDeliveryDatePicker(true)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.dateRowCopy}>
                        <MaterialCommunityIcons
                          name="calendar-blank-outline"
                          size={18}
                          color={ChickIntelPalette.green1}
                        />
                        <Text style={styles.dateRowText}>
                          {formatAppDate(editDeliveryDate || new Date())}
                        </Text>
                      </View>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={ChickIntelPalette.gray2}
                      />
                    </TouchableOpacity>
                    {showEditDeliveryDatePicker && (
                      <DateTimePicker
                        value={editDeliveryDate || new Date()}
                        mode="date"
                        display="default"
                        onChange={onEditDeliveryDateChange}
                      />
                    )}
                  </ChickField>

                  {editingItem && hasExpirationDate(editingItem.type) ? (
                    <ChickField
                      label="Expiration Date"
                      style={styles.compactField}
                    >
                      <TouchableOpacity
                        style={[styles.dateRow, styles.expirationDateRow]}
                        onPress={() => setShowEditExpDatePicker(true)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.dateRowCopy}>
                          <MaterialCommunityIcons
                            name="calendar-clock-outline"
                            size={18}
                            color="#B45309"
                          />
                          <Text
                            style={[
                              styles.dateRowText,
                              styles.expirationDateRowText,
                            ]}
                          >
                            {editExpirationDate
                              ? formatAppDate(editExpirationDate)
                              : "Select expiration date"}
                          </Text>
                        </View>
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={20}
                          color="#B45309"
                        />
                      </TouchableOpacity>
                      {showEditExpDatePicker && (
                        <DateTimePicker
                          value={editExpirationDate || new Date()}
                          mode="date"
                          display="default"
                          onChange={onEditExpDateChange}
                        />
                      )}
                    </ChickField>
                  ) : (
                    <View style={styles.addModalInfoCallout}>
                      <MaterialCommunityIcons
                        name="information-outline"
                        size={17}
                        color={ChickIntelPalette.green1}
                      />
                      <Text style={styles.addModalInfoText}>
                        This item type does not require an expiration date.
                      </Text>
                    </View>
                  )}
                </View>

                <View
                  style={[
                    styles.darkModalFooter,
                    { paddingBottom: insets.bottom + 20 },
                  ]}
                >
                  <TouchableOpacity
                    style={styles.darkBtnCancel}
                    onPress={() => setEditModalVisible(false)}
                  >
                    <Text style={styles.darkBtnCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.darkBtnAdd}
                    onPress={handleSaveChanges}
                  >
                    <Text style={styles.darkBtnAddText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: moderateScale(20),
    marginTop: 10,
    marginBottom: 8,
  },
  screenTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.55,
    color: ChickIntelPalette.gray1,
  },
  addButton: {
    width: scale(44),
    height: verticalScale(44),
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.4)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  content: {
    paddingHorizontal: moderateScale(20),
  },
  tableContainer: {
    overflow: "hidden",
    marginTop: 12,
  },
  tableSurface: {
    borderWidth: 1,
    borderRadius: 5,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderColor: "rgba(49, 118, 103, 0.22)",
  },
  tableSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(45, 106, 79, 0.12)",
    backgroundColor: "rgba(156, 213, 201, 0.28)",
  },
  tableSectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  tableSectionMeta: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    color: ChickIntelPalette.gray2,
  },
  tableInner: {
    minWidth: scale(400),
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#2D6A4F",
    paddingVertical: verticalScale(10),
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  headerCell: {
    justifyContent: "center",
    paddingHorizontal: moderateScale(10),
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "600",
    color: "#FFF",
  },
  sortIcon: {
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    paddingVertical: verticalScale(12),
    backgroundColor: "transparent",
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  cell: {
    justifyContent: "center",
    paddingHorizontal: moderateScale(8),
    flexDirection: "row",
    alignItems: "center",
  },
  rowTextMain: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.gray1,
  },
  rowTextMuted: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "#666",
    fontStyle: "italic",
  },
  emptyStateText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    lineHeight: 20,
    color: ChickIntelPalette.gray2,
    textAlign: "center",
    paddingVertical: verticalScale(10),
  },

  // Column Widths — scaled for different screen sizes
  colSelection: { width: scale(40), justifyContent: "center" },
  colType: { width: scale(90), justifyContent: "space-between" },
  colName: { width: scale(120), justifyContent: "flex-start" },
  colQty: { width: scale(54), justifyContent: "flex-start" },
  colUnit: { width: scale(54), justifyContent: "flex-start" },
  colDate: { width: scale(96), justifyContent: "flex-start" },
  colStatus: { width: scale(185), justifyContent: "flex-start" },
  colActions: { width: scale(76), justifyContent: "flex-start" },

  itemDateStack: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 3,
    marginTop: 3,
  },
  dateMetaTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(2),
    borderRadius: 4,
  },
  dateMetaText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "600",
    color: "rgba(51, 51, 51, 0.75)",
  },
  expDateMetaTag: {
    backgroundColor: "rgba(217, 119, 6, 0.12)",
  },
  expDateMetaText: {
    color: "#B45309",
    fontWeight: "700",
  },

  stockPrimaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  stockStatusWrap: {
    width: "100%",
    gap: 6,
  },
  stockBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(4),
    gap: 6,
  },
  stockBadgeDot: {
    width: scale(8),
    height: verticalScale(8),
    borderRadius: 999,
  },
  stockBadgeText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
  },
  stockBarTrack: {
    width: "100%",
    height: verticalScale(8),
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
  },
  stockBarFill: {
    height: "100%",
    borderRadius: 999,
  },

  actionsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    padding: moderateScale(6),
  },

  // Add Item Modal (Project Theme)
  darkModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalKeyboardArea: {
    flex: 1,
  },
  darkModalContent: {
    flex: 1,
    backgroundColor: ChickIntelPalette.light1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: scale(0), height: -5 },
    elevation: 10,
  },
  addModalGrabber: {
    alignSelf: "center",
    width: scale(42),
    height: verticalScale(4),
    borderRadius: 999,
    marginTop: verticalScale(10),
    marginBottom: verticalScale(2),
    backgroundColor: "rgba(49, 118, 103, 0.22)",
  },
  addModalScrollContent: {
    paddingHorizontal: moderateScale(18),
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(48),
    gap: verticalScale(12),
  },
  addModalHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(14),
    backgroundColor: "rgba(202, 227, 221, 0.38)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.2)",
  },
  editModalHero: {
    backgroundColor: "rgba(156, 213, 201, 0.34)",
  },
  addModalIconWrap: {
    width: scale(48),
    height: verticalScale(48),
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(254, 254, 254, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
  },
  addModalTitleStack: {
    flex: 1,
  },
  addModalKicker: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    letterSpacing: 0.55,
    textTransform: "uppercase",
    color: ChickIntelPalette.green1,
  },
  darkModalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(22),
    lineHeight: 28,
    fontWeight: "800",
    letterSpacing: -0.45,
    color: ChickIntelPalette.gray1,
  },
  addModalSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 17,
    fontWeight: "600",
    color: ChickIntelPalette.gray2,
    marginTop: verticalScale(2),
  },
  addModalQuickMetaRow: {
    flexDirection: "row",
    gap: 8,
  },
  addModalMetaPill: {
    flex: 1,
    minHeight: verticalScale(34),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: moderateScale(10),
    backgroundColor: "rgba(254, 254, 254, 0.66)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
  },
  addModalMetaText: {
    flexShrink: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  addModalSection: {
    gap: 10,
    borderRadius: 18,
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(14),
    backgroundColor: "rgba(254, 254, 254, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.2)",
  },
  addModalSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  addModalSectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(15),
    fontWeight: "800",
    letterSpacing: -0.15,
    color: ChickIntelPalette.gray1,
  },
  addModalTwoColumn: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  addModalColumn: {
    flex: 1,
    minWidth: 0,
  },
  addModalInfoCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(10),
    backgroundColor: "rgba(202, 227, 221, 0.28)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.14)",
  },
  addModalInfoText: {
    flex: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 16,
    fontWeight: "600",
    color: ChickIntelPalette.gray2,
  },
  editStockSnapshot: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(12),
    backgroundColor: "rgba(202, 227, 221, 0.24)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.14)",
  },
  editStockSnapshotIcon: {
    width: scale(42),
    height: verticalScale(42),
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(254, 254, 254, 0.76)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
  },
  editStockSnapshotCopy: {
    flex: 1,
    minWidth: 0,
  },
  editStockSnapshotLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    letterSpacing: 0.45,
    textTransform: "uppercase",
    color: ChickIntelPalette.green1,
  },
  editStockSnapshotValue: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.35,
    color: ChickIntelPalette.gray1,
  },
  compactField: {
    gap: 6,
  },
  compactSelectRow: {
    minHeight: verticalScale(46),
    paddingVertical: verticalScale(11),
    borderRadius: 12,
    backgroundColor: "rgba(244, 248, 247, 0.96)",
  },
  compactInput: {
    minHeight: verticalScale(46),
    paddingVertical: verticalScale(11),
    borderRadius: 12,
    backgroundColor: "rgba(244, 248, 247, 0.96)",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: verticalScale(46),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.22)",
    backgroundColor: "rgba(244, 248, 247, 0.96)",
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(10),
  },
  dateRowCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateRowText: {
    flexShrink: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  expirationDateRow: {
    backgroundColor: "rgba(217, 119, 6, 0.1)",
    borderColor: "rgba(217, 119, 6, 0.28)",
  },
  expirationDateRowText: {
    color: "#B45309",
  },
  darkModalFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingTop: verticalScale(6),
    gap: 12,
  },
  darkBtnCancel: {
    flex: 1,
    backgroundColor: "rgba(254, 254, 254, 0.82)",
    paddingVertical: verticalScale(13),
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
  },
  darkBtnCancelText: {
    color: ChickIntelPalette.gray1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "600",
  },
  darkBtnAdd: {
    flex: 1,
    backgroundColor: ChickIntelPalette.green1,
    paddingVertical: verticalScale(13),
    borderRadius: 14,
    alignItems: "center",
    shadowColor: "#317667",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(5) },
    elevation: 3,
  },
  darkBtnAddText: {
    color: "#FFF",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "600",
  },
  // Modern Card Grid Styles (no longer used, but kept for potential future reference)
  itemsGrid: {
    flexDirection: "column",
    gap: 12,
  },
  itemCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: scale(0), height: verticalScale(2) },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(12),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.06)",
    gap: 10,
  },
  cardTitle: {
    flex: 1,
    flexDirection: "column",
    gap: 2,
  },
  itemName: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  itemType: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "#999",
    fontStyle: "italic",
  },
  statusBadge: {
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(4),
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadgeText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: "#FFF",
  },
  cardBody: {
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(12),
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoPair: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: verticalScale(6),
  },
  infoLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "#999",
    fontWeight: "500",
  },
  infoValue: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.gray1,
    fontWeight: "600",
  },
  statusBg: {
    width: "100%",
    height: verticalScale(6),
    backgroundColor: "rgba(0,0,0,0.06)",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 4,
  },
  statusFill: {
    height: "100%",
    borderRadius: 999,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(10),
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0, 0, 0, 0.06)",
  },
  cardActionBtn: {
    padding: moderateScale(8),
  },
});
