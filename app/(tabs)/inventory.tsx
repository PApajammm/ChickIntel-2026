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
import { logError } from "@/utils/logger";
import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import {
    getExpirationStatus,
    getStockSeverityMeta,
    type EffectiveInventoryItem,
} from "@/utils/stock-alerts";
import type { SupabaseInventoryItem } from "@/utils/supabase-inventory";
import { fetchInventoryCategoryOptions } from "@/utils/supabase-lookups";
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
  const isDark = false;

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

  const [activeExpirationFilter, setActiveExpirationFilter] = useState<
    "all" | "active" | "expired" | "expiring-soon"
  >("all");

  const expirationSummary = useMemo(() => {
    let expiredCount = 0;
    let expiringSoonCount = 0;
    const now = new Date();

    effectiveItems.forEach((item) => {
      if (item.expirationDate) {
        const meta = getExpirationStatus(item.expirationDate, now);
        if (meta.isExpired) {
          expiredCount += 1;
        } else if (meta.isExpiringSoon) {
          expiringSoonCount += 1;
        }
      }
    });

    return {
      expiredCount,
      expiringSoonCount,
      hasAlerts: expiredCount > 0 || expiringSoonCount > 0,
    };
  }, [effectiveItems]);

  const { activeCategoryGroups, expiredItemsList } = useMemo(() => {
    const now = new Date();
    const expiredList: EffectiveInventoryItem[] = [];
    const activeList: EffectiveInventoryItem[] = [];

    effectiveItems.forEach((item) => {
      if (item.expirationDate) {
        const meta = getExpirationStatus(item.expirationDate, now);
        if (meta.isExpired) {
          expiredList.push(item);
          return;
        }
      }
      activeList.push(item);
    });

    // Apply activeExpirationFilter if user clicks chips
    let filteredActive = activeList;
    let filteredExpired = expiredList;

    if (activeExpirationFilter === "expired") {
      filteredActive = [];
    } else if (activeExpirationFilter === "expiring-soon") {
      filteredExpired = [];
      filteredActive = activeList.filter((item) => {
        if (!item.expirationDate) return false;
        const meta = getExpirationStatus(item.expirationDate, now);
        return meta.isExpiringSoon;
      });
    } else if (activeExpirationFilter === "active") {
      filteredExpired = [];
    }

    const groups = filteredActive.reduce<
      Record<string, EffectiveInventoryItem[]>
    >((accumulator, item) => {
      const key = item.type?.trim() || "Other";
      accumulator[key] = [...(accumulator[key] ?? []), item];
      return accumulator;
    }, {});

    const sortedGroups = Object.entries(groups).sort(([left], [right]) =>
      left.localeCompare(right),
    );

    return {
      activeCategoryGroups: sortedGroups,
      expiredItemsList: filteredExpired,
    };
  }, [effectiveItems, activeExpirationFilter]);

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
    isExpiredTable: boolean = false,
  ) => {
    return (
      <BlurCard
        key={groupTitle}
        style={styles.tableContainer}
        borderRadius={14}
        intensity={16}
      >
        <View style={styles.tableSurface}>
          <View style={styles.tableSectionHeader}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              {isExpiredTable ? (
                <View style={styles.expiredBadgeIcon}>
                  <MaterialCommunityIcons
                    name="alert-octagon"
                    size={16}
                    color="#FFF"
                  />
                </View>
              ) : null}
              <View>
                <Text style={styles.tableSectionTitle}>
                  {groupTitle}
                </Text>
              </View>
            </View>
            <View style={styles.tableMetaPill}>
              <Text style={styles.tableSectionMeta}>
                {groupItems.length}{" "}
                {isExpiredTable ? "expired " : ""}item
                {groupItems.length === 1 ? "" : "s"}
              </Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={styles.tableInner}>
              <View style={styles.headerRow}>
                <View style={[styles.colName, styles.headerCell]}>
                  <Text style={styles.headerText}>
                    {isExpiredTable ? "Expired Item" : "Item Details"}
                  </Text>
                </View>
                <View style={[styles.colStatus, styles.headerCell]}>
                  <Text style={styles.headerText}>
                    {isExpiredTable ? "Remaining Stock" : "Live Usage"}
                  </Text>
                </View>
                <View style={[styles.colActions, styles.headerCell]}>
                  <Text style={styles.headerText}>Action</Text>
                </View>
              </View>

              {groupItems.map((item, index) => {
                const isLast = index === groupItems.length - 1;
                const stockMeta = getStockSeverityMeta(item.statusPercent);
                const expMeta = item.expirationDate
                  ? getExpirationStatus(item.expirationDate)
                  : null;

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.row,
                      isLast ? null : styles.rowBorder,
                      expMeta?.isExpired && styles.rowExpired,
                    ]}
                  >
                    <View
                      style={[
                        styles.colName,
                        styles.cell,
                        {
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: 3,
                        },
                      ]}
                    >
                      <View style={styles.itemNameHeaderRow}>
                        <Text
                          style={[
                            styles.rowTextMain,
                            expMeta?.isExpired && styles.rowTextMainExpired,
                          ]}
                          numberOfLines={1}
                        >
                          {normalizeItemName(item.name, item.type)}
                        </Text>
                        {expMeta?.isExpired && (
                          <View style={styles.inlineExpiredFlag}>
                            <Text style={styles.inlineExpiredFlagText}>
                              EXPIRED
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.itemDateStack}>
                        <Text style={styles.dateSimpleText}>
                          Ord: {formatAppDate(item.orderDate)}
                        </Text>
                        {expMeta ? (
                          <Text
                            style={[
                              styles.expSimpleText,
                              // Keep the expiry badge and strong warnings red,
                              // but render the expiration date text in the default
                              // page color when the item is already expired so
                              // it's easier on the eyes.
                              expMeta.isExpired
                                ? { color: ChickIntelPalette.gray1 }
                                : { color: expMeta.textColor },
                            ]}
                          >
                            Exp: {formatAppDate(item.expirationDate)}
                            {expMeta.isExpired &&
                            expMeta.daysRemaining !== null &&
                            expMeta.daysRemaining < 0
                              ? ` (${Math.abs(expMeta.daysRemaining)}d ago)`
                              : expMeta.isExpiringSoon &&
                                  expMeta.daysRemaining !== null
                                ? ` (${expMeta.daysRemaining}d left)`
                                : ""}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={[styles.colStatus, styles.cell]}>
                      {isExpiredTable ? (
                        <View style={styles.stockStatusWrap}>
                          <View style={styles.quarantinePill}>
                            <MaterialCommunityIcons
                              name="cancel"
                              size={12}
                              color="#DC2626"
                            />
                            <Text style={styles.quarantinePillText}>
                              Quarantined
                            </Text>
                          </View>
                          <Text style={styles.expiredQtyText}>
                            {formatQuantityValue(item.remainingQty)} {item.unit}{" "}
                            to dispose/restock
                          </Text>
                        </View>
                      ) : (
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
                      )}
                    </View>
                    <View style={[styles.colActions, styles.cell]}>
                      <View style={styles.actionsContainer}>
                        {!isExpiredTable && (
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleOpenEditModal(item)}
                            accessibilityLabel="Edit or Restock item"
                          >
                            <MaterialCommunityIcons
                              name="pencil-outline"
                              size={18}
                              color="#2F80ED"
                            />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[
                            styles.actionBtn,
                            isExpiredTable && styles.actionBtnTrashExpired,
                          ]}
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
                          accessibilityLabel="Discard expired supply"
                        >
                          <MaterialCommunityIcons
                            name="trash-can-outline"
                            size={18}
                            color="#DC2626"
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
          <Text style={styles.screenTitle}>Inventory</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setAddModalVisible(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Add inventory item"
        >
          <MaterialCommunityIcons
            name="plus"
            size={24}
            color="#FFF"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.content}>
          {/* Expiration Alert Summary Banner */}
          {!loadingItems && !inventoryError && expirationSummary.hasAlerts ? (
            <BlurCard
              style={styles.expAlertCard}
              borderRadius={16}
              intensity={20}
            >
              <View
                style={[
                  styles.expAlertCardInner,
                  expirationSummary.expiredCount > 0
                    ? styles.expAlertCardInnerDanger
                    : styles.expAlertCardInnerWarning,
                ]}
              >
                <View style={styles.expAlertHeaderRow}>
                  <View
                    style={[
                      styles.expAlertIconWrap,
                      expirationSummary.expiredCount > 0
                        ? styles.expAlertIconWrapDanger
                        : styles.expAlertIconWrapWarning,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        expirationSummary.expiredCount > 0
                          ? "alert-decagram"
                          : "clock-alert"
                      }
                      size={22}
                      color={
                        expirationSummary.expiredCount > 0
                          ? "#DC2626"
                          : "#D97706"
                      }
                    />
                  </View>
                  <View style={styles.expAlertHeaderCopy}>
                    <Text style={styles.expAlertTitle}>
                      {expirationSummary.expiredCount > 0
                        ? `${expirationSummary.expiredCount} Expired Item${expirationSummary.expiredCount === 1 ? "" : "s"} Detected!`
                        : "Supplies Expiring Soon"}
                    </Text>
                    <Text style={styles.expAlertSubtitle}>
                      {expirationSummary.expiredCount > 0
                        ? "Expired feed or medication should not be administered to your flock."
                        : `${expirationSummary.expiringSoonCount} item(s) will expire within 7 days. Plan your restock accordingly.`}
                    </Text>
                  </View>
                </View>

                {/* Filter Chips */}
                <View style={styles.expFilterRow}>
                  <TouchableOpacity
                    style={[
                      styles.expFilterChip,
                      activeExpirationFilter === "all" &&
                        styles.expFilterChipActive,
                    ]}
                    onPress={() => setActiveExpirationFilter("all")}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.expFilterChipText,
                        activeExpirationFilter === "all" &&
                          styles.expFilterChipTextActive,
                      ]}
                    >
                      All Items ({effectiveItems.length})
                    </Text>
                  </TouchableOpacity>

                  {expirationSummary.expiredCount > 0 && (
                    <TouchableOpacity
                      style={[
                        styles.expFilterChip,
                        styles.expFilterChipDanger,
                        activeExpirationFilter === "expired" &&
                          styles.expFilterChipDangerActive,
                      ]}
                      onPress={() =>
                        setActiveExpirationFilter(
                          activeExpirationFilter === "expired"
                            ? "all"
                            : "expired",
                        )
                      }
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons
                        name="alert-circle"
                        size={13}
                        color={
                          activeExpirationFilter === "expired"
                            ? "#FFF"
                            : "#DC2626"
                        }
                      />
                      <Text
                        style={[
                          styles.expFilterChipText,
                          styles.expFilterChipTextDanger,
                          activeExpirationFilter === "expired" &&
                            styles.expFilterChipTextDangerActive,
                        ]}
                      >
                        Expired ({expirationSummary.expiredCount})
                      </Text>
                    </TouchableOpacity>
                  )}

                  {expirationSummary.expiringSoonCount > 0 && (
                    <TouchableOpacity
                      style={[
                        styles.expFilterChip,
                        styles.expFilterChipWarning,
                        activeExpirationFilter === "expiring-soon" &&
                          styles.expFilterChipWarningActive,
                      ]}
                      onPress={() =>
                        setActiveExpirationFilter(
                          activeExpirationFilter === "expiring-soon"
                            ? "all"
                            : "expiring-soon",
                        )
                      }
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons
                        name="clock-alert-outline"
                        size={13}
                        color={
                          activeExpirationFilter === "expiring-soon"
                            ? "#FFF"
                            : "#D97706"
                        }
                      />
                      <Text
                        style={[
                          styles.expFilterChipText,
                          styles.expFilterChipTextWarning,
                          activeExpirationFilter === "expiring-soon" &&
                            styles.expFilterChipTextWarningActive,
                        ]}
                      >
                        Expiring Soon ({expirationSummary.expiringSoonCount})
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </BlurCard>
          ) : null}

          {loadingItems ? (
            <Text style={styles.emptyStateText}>Loading inventory...</Text>
          ) : null}
          {!loadingItems && inventoryError ? (
            <Text style={styles.emptyStateText}>{inventoryError}</Text>
          ) : null}
          {!loadingItems && !inventoryError && effectiveItems.length === 0 ? (
            <Text style={styles.emptyStateText}>No inventory items yet.</Text>
          ) : null}
          {!loadingItems &&
          !inventoryError &&
          effectiveItems.length > 0 &&
          activeCategoryGroups.length === 0 &&
          expiredItemsList.length === 0 ? (
            <View style={styles.emptyFilterWrap}>
              <MaterialCommunityIcons
                name="filter-variant-remove"
                size={36}
                color={ChickIntelPalette.gray2}
              />
              <Text style={styles.emptyStateText}>
                No items match the selected expiration filter.
              </Text>
              <TouchableOpacity
                style={styles.resetFilterBtn}
                onPress={() => setActiveExpirationFilter("all")}
              >
                <Text style={styles.resetFilterBtnText}>Show All Items</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Regular Active Inventory Category Tables */}
          {!loadingItems && !inventoryError
            ? activeCategoryGroups.map(([groupTitle, groupItems]) =>
                renderInventoryTable(groupTitle, groupItems, false),
              )
            : null}

          {/* Dedicated Expired Items Table (Positioned Below Active Categories) */}
          {!loadingItems && !inventoryError && expiredItemsList.length > 0
            ? renderInventoryTable("Expired Supplies", expiredItemsList, true)
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
                      {newItemType === "Choose type"
                        ? "No type yet"
                        : newItemType}
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
                    <Text style={styles.addModalSectionTitle}>Stock dates</Text>
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
                  <ChickField
                    label="Quantity to add"
                    style={styles.compactField}
                  >
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
                    <Text style={styles.addModalSectionTitle}>Stock dates</Text>
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
                      {editExpirationDate &&
                      getExpirationStatus(editExpirationDate).isExpired ? (
                        <View
                          style={[
                            styles.addModalInfoCallout,
                            {
                              backgroundColor: "rgba(220, 38, 38, 0.08)",
                              borderColor: "rgba(220, 38, 38, 0.28)",
                              marginTop: 6,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="alert-circle"
                            size={16}
                            color="#DC2626"
                          />
                          <Text
                            style={[
                              styles.addModalInfoText,
                              { color: "#B91C1C", fontWeight: "700" },
                            ]}
                          >
                            This item is past its expiration date! Please update
                            the expiration date when restocking with a new
                            batch.
                          </Text>
                        </View>
                      ) : null}
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
  tableSurfaceExpired: {
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
  tableSectionHeaderExpired: {
    backgroundColor: "rgba(156, 213, 201, 0.28)",
    paddingVertical: verticalScale(10),
  },
  expiredBadgeIcon: {
    width: scale(28),
    height: verticalScale(28),
    borderRadius: 8,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  expiredSublabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: "#B91C1C",
    fontWeight: "500",
    marginTop: 1,
  },
  tableMetaPill: {
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  tableMetaPillExpired: {
    backgroundColor: "rgba(220, 38, 38, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.25)",
  },
  tableSectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  tableSectionTitleExpired: {
    color: ChickIntelPalette.gray1,
  },
  tableSectionMeta: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    color: ChickIntelPalette.gray2,
  },
  tableSectionMetaExpired: {
    color: "#B91C1C",
    fontWeight: "700",
  },
  tableInner: {
    minWidth: scale(440),
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#2D6A4F",
    paddingVertical: verticalScale(10),
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  headerRowExpired: {
    backgroundColor: "#2D6A4F",
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
  colName: { width: scale(150), justifyContent: "flex-start" },
  colQty: { width: scale(54), justifyContent: "flex-start" },
  colUnit: { width: scale(54), justifyContent: "flex-start" },
  colDate: { width: scale(96), justifyContent: "flex-start" },
  colStatus: { width: scale(180), justifyContent: "flex-start" },
  colActions: { width: scale(76), justifyContent: "flex-start" },

  itemDateStack: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    marginTop: 2,
  },
  dateSimpleText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: "rgba(51, 51, 51, 0.65)",
    fontWeight: "500",
  },
  expSimpleText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
  },
  expAlertCard: {
    marginBottom: verticalScale(14),
    overflow: "hidden",
  },
  expAlertCardInner: {
    padding: moderateScale(14),
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  expAlertCardInnerDanger: {
    backgroundColor: "rgba(254, 242, 242, 0.94)",
    borderColor: "rgba(220, 38, 38, 0.28)",
  },
  expAlertCardInnerWarning: {
    backgroundColor: "rgba(254, 252, 232, 0.94)",
    borderColor: "rgba(217, 119, 6, 0.28)",
  },
  expAlertHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  expAlertIconWrap: {
    width: scale(40),
    height: verticalScale(40),
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  expAlertIconWrapDanger: {
    backgroundColor: "rgba(220, 38, 38, 0.14)",
  },
  expAlertIconWrapWarning: {
    backgroundColor: "rgba(217, 119, 6, 0.14)",
  },
  expAlertHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  expAlertTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(15),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
    letterSpacing: -0.2,
  },
  expAlertSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 16,
    color: ChickIntelPalette.gray2,
    marginTop: 2,
  },
  expFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  expFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(6),
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.08)",
  },
  expFilterChipActive: {
    backgroundColor: ChickIntelPalette.green1,
    borderColor: ChickIntelPalette.green1,
  },
  expFilterChipText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  expFilterChipTextActive: {
    color: "#FFF",
  },
  expFilterChipDanger: {
    backgroundColor: "rgba(220, 38, 38, 0.08)",
    borderColor: "rgba(220, 38, 38, 0.25)",
  },
  expFilterChipDangerActive: {
    backgroundColor: "#DC2626",
    borderColor: "#DC2626",
  },
  expFilterChipTextDanger: {
    color: "#B91C1C",
  },
  expFilterChipTextDangerActive: {
    color: "#FFF",
  },
  expFilterChipWarning: {
    backgroundColor: "rgba(217, 119, 6, 0.08)",
    borderColor: "rgba(217, 119, 6, 0.25)",
  },
  expFilterChipWarningActive: {
    backgroundColor: "#D97706",
    borderColor: "#D97706",
  },
  expFilterChipTextWarning: {
    color: "#B45309",
  },
  expFilterChipTextWarningActive: {
    color: "#FFF",
  },
  emptyFilterWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(24),
    gap: 8,
  },
  resetFilterBtn: {
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(7),
    borderRadius: 8,
    backgroundColor: ChickIntelPalette.green1,
  },
  resetFilterBtnText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: "#FFF",
  },

  // Table row additions
  rowExpired: {
    backgroundColor: "rgba(255, 255, 255, 0.42)",
  },
  itemNameHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  rowTextMainExpired: {
    color: ChickIntelPalette.gray1,
    fontWeight: "800",
  },
  inlineExpiredFlag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: moderateScale(5),
    paddingVertical: verticalScale(1),
    borderRadius: 4,
    backgroundColor: "rgba(220, 38, 38, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.3)",
  },
  inlineExpiredFlagText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(9),
    fontWeight: "800",
    color: "#DC2626",
    letterSpacing: 0.3,
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

  quarantinePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(220, 38, 38, 0.12)",
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 6,
    gap: 4,
  },
  quarantinePillText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: "#DC2626",
  },
  expiredQtyText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },

  actionsContainer: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    padding: moderateScale(6),
    borderRadius: 8,
  },
  actionBtnTrashExpired: {
    backgroundColor: "rgba(220, 38, 38, 0.1)",
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
