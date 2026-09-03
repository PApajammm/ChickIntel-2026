import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { BlurCard } from "@/components/ui/blur-card";
import {
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
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import {
    Alert,
    Animated,
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

const DEFAULT_INVENTORY_TABS = [
  { id: "equipment", label: "Equipment", icon: "tools" },
  { id: "feeds", label: "Feeds", icon: "barley" },
  { id: "medicine", label: "Medicine", icon: "pill" },
  { id: "vitamins", label: "Vitamins", icon: "bottle-tonic-plus-outline" },
] as const;

type InventoryTab = {
  id: string;
  label: string;
  icon: string;
};
type InventoryTabId = string;

const DEFAULT_INVENTORY_CATEGORIES = [
  "Equipment",
  "Feeds",
  "Medicine",
  "Vitamins",
];

function getCategoryTab(categoryOrType?: string): InventoryTabId {
  const normalized = (categoryOrType || "").trim().toLowerCase();
  if (normalized.includes("feed")) return "feeds";
  if (
    normalized.includes("medicin") ||
    normalized.includes("vaccin") ||
    normalized.includes("antibiotic")
  ) {
    return "medicine";
  }
  if (normalized.includes("vitamin") || normalized.includes("supplem")) {
    return "vitamins";
  }
  if (normalized.includes("equip") || normalized.includes("tool")) {
    return "equipment";
  }
  return normalized || "equipment";
}

function getCategoryIcon(category: string) {
  const normalized = category.trim().toLowerCase();
  if (normalized.includes("feed")) return "barley";
  if (normalized.includes("medicin") || normalized.includes("vaccin")) {
    return "pill";
  }
  if (normalized.includes("vitamin") || normalized.includes("supplem")) {
    return "bottle-tonic-plus-outline";
  }
  if (
    normalized.includes("clean") ||
    normalized.includes("sanit") ||
    normalized.includes("wash")
  ) {
    return "spray-bottle";
  }
  return "package-variant";
}

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

const ExpiredAlertBanner = ({
  expirationSummary,
  activeExpirationFilter,
  setActiveExpirationFilter,
  totalCount,
}: {
  expirationSummary: {
    expiredCount: number;
    expiringSoonCount: number;
  };
  activeExpirationFilter: "all" | "active" | "expired" | "expiring-soon";
  setActiveExpirationFilter: (
    filter: "all" | "active" | "expired" | "expiring-soon",
  ) => void;
  totalCount: number;
}) => {
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let isMounted = true;
    let loopCount = 0;

    const runLoop = () => {
      if (!isMounted || loopCount >= 10) {
        if (isMounted) {
          Animated.timing(blinkAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: Platform.OS !== "web",
          }).start();
        }
        return;
      }

      loopCount += 1;

      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.1,
          duration: 500,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start(({ finished }) => {
        if (finished && isMounted) {
          runLoop();
        }
      });
    };

    runLoop();

    return () => {
      isMounted = false;
      blinkAnim.stopAnimation();
    };
  }, [blinkAnim]);

  return (
    <Animated.View
      style={[
        styles.expAlertCard,
        {
          opacity: blinkAnim.interpolate({
            inputRange: [0.1, 1],
            outputRange: [0.72, 1],
          }),
        },
      ]}
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
          <Animated.View
            style={[
              styles.expAlertIconWrap,
              {
                opacity: blinkAnim,
                transform: [
                  {
                    scale: blinkAnim.interpolate({
                      inputRange: [0.1, 1],
                      outputRange: [0.88, 1.12],
                    }),
                  },
                ],
              },
            ]}
          >
            <MaterialCommunityIcons
              name={
                expirationSummary.expiredCount > 0
                  ? "alert-decagram"
                  : "clock-alert"
              }
              size={41}
              color={expirationSummary.expiredCount > 0 ? "#EF4444" : "#F59E0B"}
            />
          </Animated.View>
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

        {/* Filter Mini Tabs (matching Tasks Preview) */}
        <View style={styles.previewSegmentedContainer}>
          <TouchableOpacity
            style={[
              styles.previewSegmentedItem,
              activeExpirationFilter === "all" &&
                styles.previewSegmentedItemActive,
            ]}
            onPress={() => setActiveExpirationFilter("all")}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="layers-outline"
              size={13}
              color={
                activeExpirationFilter === "all"
                  ? "#FFFFFF"
                  : "rgba(255, 255, 255, 0.65)"
              }
            />
            <Text
              style={[
                styles.previewSegmentedText,
                activeExpirationFilter === "all" &&
                  styles.previewSegmentedTextActive,
              ]}
            >
              All Items ({totalCount})
            </Text>
          </TouchableOpacity>

          {expirationSummary.expiredCount > 0 && (
            <TouchableOpacity
              style={[
                styles.previewSegmentedItem,
                activeExpirationFilter === "expired" &&
                  styles.previewSegmentedItemActive,
              ]}
              onPress={() =>
                setActiveExpirationFilter(
                  activeExpirationFilter === "expired" ? "all" : "expired",
                )
              }
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={13}
                color={
                  activeExpirationFilter === "expired"
                    ? "#EF4444"
                    : "rgba(255, 255, 255, 0.65)"
                }
              />
              <Text
                style={[
                  styles.previewSegmentedText,
                  activeExpirationFilter === "expired"
                    ? styles.previewSegmentedTextExpiredActive
                    : null,
                ]}
              >
                Expired ({expirationSummary.expiredCount})
              </Text>
            </TouchableOpacity>
          )}

          {expirationSummary.expiringSoonCount > 0 && (
            <TouchableOpacity
              style={[
                styles.previewSegmentedItem,
                activeExpirationFilter === "expiring-soon" &&
                  styles.previewSegmentedItemActive,
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
                    ? "#FCD34D"
                    : "rgba(255, 255, 255, 0.65)"
                }
              />
              <Text
                style={[
                  styles.previewSegmentedText,
                  activeExpirationFilter === "expiring-soon" &&
                    styles.previewSegmentedTextActive,
                ]}
              >
                Expiring Soon ({expirationSummary.expiringSoonCount})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
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

  const [selectedTab, setSelectedTab] = useState<InventoryTabId>("equipment");
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
  const [typeOptions, setTypeOptions] = useState<string[]>(
    DEFAULT_INVENTORY_CATEGORIES,
  );
  const [newItemType, setNewItemType] = useState("Select Category");
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("");
  const [newItemUnit, setNewItemUnit] = useState("Measurement unit");
  const [newItemDate, setNewItemDate] = useState(new Date());
  const [newItemExpDate, setNewItemExpDate] = useState<Date | undefined>(
    undefined,
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showExpDatePicker, setShowExpDatePicker] = useState(false);

  const inventoryTabs = useMemo<InventoryTab[]>(() => {
    // 1. The 4 canonical default inventory tabs (always guaranteed to be present)
    const baseTabs: InventoryTab[] = DEFAULT_INVENTORY_TABS.map((tab) => ({
      ...tab,
    }));

    // 2. Include any additional custom categories from typeOptions that don't map to the base 4
    typeOptions.forEach((type) => {
      const trimmed = type.trim();
      if (!trimmed) return;
      const tabId = getCategoryTab(trimmed);
      if (!baseTabs.some((t) => t.id === tabId)) {
        baseTabs.push({
          id: tabId,
          label: trimmed,
          icon: getCategoryIcon(trimmed),
        });
      }
    });

    return baseTabs;
  }, [typeOptions]);

  useEffect(() => {
    if (!inventoryTabs.some((tab) => tab.id === selectedTab)) {
      setSelectedTab(inventoryTabs[0]?.id ?? "equipment");
    }
  }, [inventoryTabs, selectedTab]);

  // Category Tabs Horizontal Scroll & Pagination Dots State
  const tabScrollRef = useRef<ScrollView>(null);
  const [tabBarWidth, setTabBarWidth] = useState(0);
  const [tabScrollX, setTabScrollX] = useState(0);
  const [tabMaxScroll, setTabMaxScroll] = useState(0);

  const totalTabPages = useMemo(() => {
    return Math.max(1, Math.ceil(inventoryTabs.length / 4));
  }, [inventoryTabs.length]);

  const activeTabPageIndex = useMemo(() => {
    if (totalTabPages <= 1 || tabMaxScroll <= 0) return 0;
    const progress = Math.max(0, Math.min(1, tabScrollX / tabMaxScroll));
    return Math.min(
      totalTabPages - 1,
      Math.round(progress * (totalTabPages - 1)),
    );
  }, [tabScrollX, tabMaxScroll, totalTabPages]);

  // When >4 categories exist, size each item so exactly 4 tabs fit in the visible container
  const tabItemWidth = useMemo(() => {
    if (tabBarWidth <= 0) return undefined;
    // 3px padding on each side (6px total) and 3px gap between 4 visible items (3 * 3px = 9px)
    return Math.floor((tabBarWidth - 15) / 4);
  }, [tabBarWidth]);

  const handleTabScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } =
        event.nativeEvent;
      const x = contentOffset.x;
      const maxScroll = Math.max(
        0,
        contentSize.width - layoutMeasurement.width,
      );
      setTabScrollX(x);
      setTabMaxScroll(maxScroll);
    },
    [],
  );

  const handleTabContentSizeChange = useCallback(
    (contentWidth: number) => {
      if (tabBarWidth > 0) {
        setTabMaxScroll(Math.max(0, contentWidth - tabBarWidth));
      }
    },
    [tabBarWidth],
  );

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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      fetchInventoryCategoryOptions()
        .then((options) => {
          if (!cancelled) {
            const merged = [
              ...new Set([...DEFAULT_INVENTORY_CATEGORIES, ...options]),
            ];
            setTypeOptions(merged);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            logError("Inventory category lookup load failed", error);
          }
        });

      return () => {
        cancelled = true;
      };
    }, []),
  );

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

  const tabAlerts = useMemo(() => {
    const alerts: Record<string, { total: number; hasExpired: boolean }> = {};

    const now = new Date();
    effectiveItems.forEach((item) => {
      const tab = getCategoryTab(item.type);
      alerts[tab] ??= { total: 0, hasExpired: false };
      alerts[tab].total += 1;
      if (item.expirationDate) {
        const meta = getExpirationStatus(item.expirationDate, now);
        if (meta.isExpired) {
          alerts[tab].hasExpired = true;
        }
      }
    });

    return alerts;
  }, [effectiveItems]);

  const currentTabGroups = useMemo(() => {
    return activeCategoryGroups.filter(
      ([groupTitle]) => getCategoryTab(groupTitle) === selectedTab,
    );
  }, [activeCategoryGroups, selectedTab]);

  const currentTabExpiredItems = useMemo(() => {
    return expiredItemsList.filter(
      (item) => getCategoryTab(item.type) === selectedTab,
    );
  }, [expiredItemsList, selectedTab]);

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
      newItemType === "Choose type" || newItemType === "Select Category"
        ? "Other"
        : newItemType;

    try {
      await addInventoryItem({
        type: normalizedType,
        name: newItemName.trim() || "Unnamed Item",
        qty: parsedQty,
        unit:
          newItemUnit === "Choose Measurement unit" ||
          newItemUnit === "Measurement unit"
            ? "pcs"
            : newItemUnit,
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
    setNewItemType("Select Category");
    setNewItemName("");
    setNewItemQty("");
    setNewItemUnit("Measurement unit");
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
    const selectedTabMeta = inventoryTabs.find((t) => t.id === selectedTab);
    const isCategoryTitle =
      groupTitle.toLowerCase() === selectedTab.toLowerCase() ||
      groupTitle.toLowerCase() ===
        (selectedTabMeta?.label.toLowerCase() || "") ||
      groupTitle.toLowerCase().startsWith("expired ");

    const displayTitle = isExpiredTable
      ? "Expired Stock"
      : isCategoryTitle
        ? "Active Stock"
        : `Active Stock (${groupTitle})`;

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
                <MaterialCommunityIcons
                  name="alert-decagram"
                  size={20}
                  color="#EF4444"
                />
              ) : null}
              <View>
                <Text
                  style={[
                    styles.tableSectionTitle,
                    isExpiredTable && styles.tableSectionTitleExpired,
                  ]}
                >
                  {displayTitle}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.tableMetaPill,
                isExpiredTable && styles.tableMetaPillExpired,
              ]}
            >
              <Text
                style={[
                  styles.tableSectionMeta,
                  isExpiredTable && styles.tableSectionMetaExpired,
                ]}
              >
                {groupItems.length} {isExpiredTable ? "expired " : ""}item
                {groupItems.length === 1 ? "" : "s"}
              </Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.tableScrollContent}
          >
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
                <View
                  style={[
                    styles.colActions,
                    styles.headerCell,
                    { justifyContent: "center" },
                  ]}
                >
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
                    <View
                      style={[
                        styles.colStatus,
                        styles.cell,
                        styles.colStatusCell,
                      ]}
                    >
                      {isExpiredTable ? (
                        <View style={styles.stockStatusWrap}>
                          <View style={styles.quarantinePill}>
                            <MaterialCommunityIcons
                              name="cancel"
                              size={12}
                              color="#DC2626"
                            />
                            <Text style={styles.quarantinePillText}>
                              For disposal
                            </Text>
                          </View>
                          <Text style={styles.expiredQtyText} numberOfLines={1}>
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
                              numberOfLines={1}
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
                            numberOfLines={1}
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
                              size={23}
                              color={ChickIntelPalette.gray1}
                            />
                          </TouchableOpacity>
                        )}
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
                          accessibilityLabel="Discard expired supply"
                        >
                          <MaterialCommunityIcons
                            name="trash-can-outline"
                            size={23}
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
      <StatusBar style="dark" />
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
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Inventory</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setNewItemType(
              inventoryTabs.find((tab) => tab.id === selectedTab)?.label ||
                "Select Category",
            );
            setAddModalVisible(true);
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Add inventory item"
        >
          <MaterialCommunityIcons name="plus" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 15 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.content}>
          {/* Expiration Alert Summary Banner with Guaranteed Blinking Animation */}
          {!loadingItems && !inventoryError && expirationSummary.hasAlerts ? (
            <ExpiredAlertBanner
              expirationSummary={expirationSummary}
              activeExpirationFilter={activeExpirationFilter}
              setActiveExpirationFilter={setActiveExpirationFilter}
              totalCount={effectiveItems.length}
            />
          ) : null}

          {/* Category tabs container with 4 default visible tabs & pagination dots if >4 */}
          <View style={styles.tabSectionHeader}>
            <View
              style={styles.segmentWrap}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                if (w > 0 && Math.abs(w - tabBarWidth) > 1) {
                  setTabBarWidth(w);
                }
              }}
            >
              <ScrollView
                ref={tabScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={handleTabScroll}
                onContentSizeChange={handleTabContentSizeChange}
                contentContainerStyle={[
                  styles.segmentScrollContent,
                  inventoryTabs.length <= 4 && styles.segmentScrollContentGrow,
                ]}
              >
                {inventoryTabs.map((tab) => {
                  const isActive = selectedTab === tab.id;
                  const hasExpired = tabAlerts[tab.id]?.hasExpired;
                  return (
                    <Pressable
                      key={tab.id}
                      onPress={() => setSelectedTab(tab.id)}
                      style={[
                        styles.segment,
                        inventoryTabs.length > 4 && tabItemWidth
                          ? { width: tabItemWidth }
                          : styles.segmentFlex,
                        isActive
                          ? styles.segmentActive
                          : styles.segmentInactive,
                      ]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`${tab.label} tab`}
                    >
                      <MaterialCommunityIcons
                        name={tab.icon as any}
                        size={13}
                        color={isActive ? "#FFFFFF" : "#4A5452"}
                      />
                      <Text
                        style={[
                          styles.segmentText,
                          isActive
                            ? styles.segmentTextActive
                            : styles.segmentTextInactive,
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.8}
                      >
                        {tab.label}
                      </Text>
                      {hasExpired ? (
                        <View
                          style={[
                            styles.segmentAlertDot,
                            isActive && styles.segmentAlertDotActive,
                          ]}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Subtle pagination indicator dots beneath tabs */}
            {inventoryTabs.length > 4 && totalTabPages > 1 ? (
              <View style={styles.paginationDotsContainer}>
                {Array.from({ length: totalTabPages }).map((_, idx) => {
                  const isDotActive = activeTabPageIndex === idx;
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.paginationDot,
                        isDotActive && styles.paginationDotActive,
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>

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

          {/* Active Category Tables for Selected Tab */}
          {!loadingItems && !inventoryError
            ? currentTabGroups.map(([groupTitle, groupItems]) =>
                renderInventoryTable(groupTitle, groupItems, false),
              )
            : null}

          {/* Dedicated Expired Items Table for Selected Tab */}
          {!loadingItems && !inventoryError && currentTabExpiredItems.length > 0
            ? renderInventoryTable(
                `Expired ${inventoryTabs.find((t) => t.id === selectedTab)?.label || "Supplies"}`,
                currentTabExpiredItems,
                true,
              )
            : null}

          {/* Tab Empty State when no items exist for this tab */}
          {!loadingItems &&
          !inventoryError &&
          effectiveItems.length > 0 &&
          currentTabGroups.length === 0 &&
          currentTabExpiredItems.length === 0 ? (
            <BlurCard
              style={styles.tabEmptyCard}
              borderRadius={14}
              intensity={16}
            >
              <View style={styles.tabEmptyInner}>
                <View style={styles.tabEmptyIconWrap}>
                  <MaterialCommunityIcons
                    name={
                      inventoryTabs.find((t) => t.id === selectedTab)
                        ?.icon as any
                    }
                    size={32}
                    color={ChickIntelPalette.green1}
                  />
                </View>
                <Text style={styles.tabEmptyTitle}>
                  No {inventoryTabs.find((t) => t.id === selectedTab)?.label}{" "}
                  Items
                </Text>
                <Text style={styles.tabEmptySubtitle}>
                  You don't have any items under this category yet.
                </Text>
                <TouchableOpacity
                  style={styles.tabEmptyAddBtn}
                  onPress={() => {
                    setNewItemType(
                      inventoryTabs.find((tab) => tab.id === selectedTab)
                        ?.label || "Choose type",
                    );
                    setAddModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="plus" size={16} color="#FFF" />
                  <Text style={styles.tabEmptyAddBtnText}>
                    Add {inventoryTabs.find((t) => t.id === selectedTab)?.label}
                  </Text>
                </TouchableOpacity>
              </View>
            </BlurCard>
          ) : null}
        </View>
      </ScrollView>

      {/* Add New Item Modal */}
      <Modal
        visible={addModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalScreen}>
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
            style={styles.modalKeyboardArea}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={insets.top}
          >
            <View
              style={[
                styles.modalHeaderContainer,
                { paddingTop: insets.top + 10 },
              ]}
            >
              <View style={styles.modalTopBar}>
                <TouchableOpacity
                  onPress={() => setAddModalVisible(false)}
                  style={styles.modalBackButton}
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

              <View style={styles.modalTitleCard}>
                <View style={styles.modalKickerRow}>
                  <MaterialCommunityIcons
                    name="package-variant-plus"
                    size={15}
                    color="#CAE3DD"
                  />
                  <Text style={styles.modalKickerText}>Inventory stock</Text>
                </View>
                <Text style={styles.modalPageTitle}>Add New Item</Text>
                <Text style={styles.modalPageSubtitle}>
                  Track quantity, unit, delivery date, and expiry details.
                </Text>
              </View>

              <View style={styles.modalSummaryChipRow}>
                <View style={styles.modalSummaryChip}>
                  <MaterialCommunityIcons
                    name="cube-outline"
                    size={12}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalSummaryChipText} numberOfLines={1}>
                    {newItemType === "Select Category" ||
                    newItemType === "Choose type"
                      ? "No category yet"
                      : newItemType}
                  </Text>
                </View>
                <View style={styles.modalSummaryChip}>
                  <MaterialCommunityIcons
                    name="scale-balance"
                    size={12}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalSummaryChipText} numberOfLines={1}>
                    {newItemQty.trim() || "0"}{" "}
                    {newItemUnit === "Measurement unit" ||
                    newItemUnit === "Choose Measurement unit"
                      ? "unit"
                      : newItemUnit}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={[
                styles.modalScrollContent,
                { paddingBottom: insets.bottom + 24 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <View style={styles.modalFormSection}>
                <View style={styles.modalFormSectionHeader}>
                  <MaterialCommunityIcons
                    name="clipboard-text-outline"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalFormSectionTitle}>Item details</Text>
                </View>

                <ChickSelectRow
                  value={newItemType}
                  placeholder="Select Category"
                  rowStyle={styles.compactSelectRow}
                  onPress={() =>
                    setSelectionModal({
                      visible: true,
                      title: "Select Category",
                      options: typeOptions,
                      value: newItemType,
                      onSelect: setNewItemType,
                    })
                  }
                />

                <ChickTextInput
                  placeholder="Item name"
                  value={newItemName}
                  onChangeText={setNewItemName}
                  style={styles.compactInput}
                />
              </View>

              <View style={styles.modalFormSection}>
                <View style={styles.modalFormSectionHeader}>
                  <MaterialCommunityIcons
                    name="chart-box-outline"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalFormSectionTitle}>Stock amount</Text>
                </View>

                <View style={styles.addModalTwoColumn}>
                  <View style={styles.addModalColumn}>
                    <ChickTextInput
                      placeholder="Quantity"
                      keyboardType="numeric"
                      value={newItemQty}
                      onChangeText={setNewItemQty}
                      style={styles.compactInput}
                    />
                  </View>

                  <View style={styles.addModalColumn}>
                    <ChickSelectRow
                      value={newItemUnit}
                      placeholder="Measurement unit"
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

              <View style={styles.modalFormSection}>
                <View style={styles.modalFormSectionHeader}>
                  <MaterialCommunityIcons
                    name="calendar-month-outline"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalFormSectionTitle}>Stock dates</Text>
                </View>

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
                      {newItemDate
                        ? `Date of purchase: ${formatAppDate(newItemDate)}`
                        : "Date of purchase"}
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

                {hasExpirationDate(newItemType) ? (
                  <>
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
                            ? `Expiration date: ${formatAppDate(newItemExpDate)}`
                            : "Expiration date"}
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
                  </>
                ) : (
                  <View style={styles.addModalInfoCallout}>
                    <MaterialCommunityIcons
                      name="information-outline"
                      size={17}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.addModalInfoText}>
                      Expiration appears for feeds, medicines, vitamins, and
                      other perishable supplies.
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setAddModalVisible(false)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel adding item"
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalSaveButton,
                    { opacity: pressed ? 0.9 : 1 },
                  ]}
                  onPress={handleSaveNewItem}
                  accessibilityRole="button"
                  accessibilityLabel="Add new inventory item"
                >
                  <Text style={styles.modalSaveButtonText}>Add Item</Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Edit Item Modal (Stock Update) */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalScreen}>
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
            style={styles.modalKeyboardArea}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={insets.top}
          >
            <View
              style={[
                styles.modalHeaderContainer,
                { paddingTop: insets.top + 10 },
              ]}
            >
              <View style={styles.modalTopBar}>
                <TouchableOpacity
                  onPress={() => setEditModalVisible(false)}
                  style={styles.modalBackButton}
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

              <View style={styles.modalTitleCard}>
                <View style={styles.modalKickerRow}>
                  <MaterialCommunityIcons
                    name="package-variant-closed-check"
                    size={15}
                    color="#CAE3DD"
                  />
                  <Text style={styles.modalKickerText}>Stock update</Text>
                </View>
                <Text style={styles.modalPageTitle} numberOfLines={2}>
                  {editingItem?.name || "Edit Item"}
                </Text>
                <Text style={styles.modalPageSubtitle}>
                  Add restock quantity and refresh delivery or expiry dates.
                </Text>
              </View>

              <View style={styles.modalSummaryChipRow}>
                <View style={styles.modalSummaryChip}>
                  <MaterialCommunityIcons
                    name="cube-outline"
                    size={12}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalSummaryChipText} numberOfLines={1}>
                    {editingItem?.type || "Inventory"}
                  </Text>
                </View>
                <View style={styles.modalSummaryChip}>
                  <MaterialCommunityIcons
                    name="warehouse"
                    size={12}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalSummaryChipText} numberOfLines={1}>
                    {formatQuantityValue(editingItem?.qty ?? 0)}{" "}
                    {editingItem?.unit || ""}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={[
                styles.modalScrollContent,
                { paddingBottom: insets.bottom + 24 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              <View style={styles.modalFormSection}>
                <View style={styles.modalFormSectionHeader}>
                  <MaterialCommunityIcons
                    name="archive-check-outline"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalFormSectionTitle}>
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

              <View style={styles.modalFormSection}>
                <View style={styles.modalFormSectionHeader}>
                  <MaterialCommunityIcons
                    name="plus-box-outline"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalFormSectionTitle}>
                    Restock amount
                  </Text>
                </View>
                <ChickTextInput
                  placeholder="Quantity to add"
                  keyboardType="numeric"
                  value={restockQty}
                  onChangeText={setRestockQty}
                  style={styles.compactInput}
                />
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

              <View style={styles.modalFormSection}>
                <View style={styles.modalFormSectionHeader}>
                  <MaterialCommunityIcons
                    name="calendar-sync-outline"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalFormSectionTitle}>Stock dates</Text>
                </View>

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
                      {editDeliveryDate
                        ? `Delivery date: ${formatAppDate(editDeliveryDate)}`
                        : "Delivery date"}
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

                {editingItem && hasExpirationDate(editingItem.type) ? (
                  <>
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
                            ? `Expiration date: ${formatAppDate(editExpirationDate)}`
                            : "Expiration date"}
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
                          Selected date marks this batch as expired!
                        </Text>
                      </View>
                    ) : null}
                  </>
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

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={styles.modalCancelButton}
                  onPress={() => setEditModalVisible(false)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel stock update"
                >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalSaveButton,
                    { opacity: pressed ? 0.9 : 1 },
                  ]}
                  onPress={handleSaveChanges}
                  accessibilityRole="button"
                  accessibilityLabel="Save stock update changes"
                >
                  <Text style={styles.modalSaveButtonText}>Save Changes</Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

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
    marginTop: 4,
    marginBottom: 8,
  },
  tabSectionHeader: {
    backgroundColor: "transparent",
    marginTop: verticalScale(12),
    marginBottom: verticalScale(4),
    width: "100%",
  },
  segmentWrap: {
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    borderRadius: 12,
    padding: 3,
    width: "100%",
    overflow: "hidden",
  },
  segmentScrollContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  segmentScrollContentGrow: {
    flexGrow: 1,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: verticalScale(38),
    borderRadius: 9,
    paddingHorizontal: moderateScale(2),
    gap: 2,
  },
  segmentFlex: {
    flex: 1,
  },
  segmentActive: {
    backgroundColor: ChickIntelPalette.green1,
  },
  segmentInactive: {
    backgroundColor: "transparent",
  },
  paginationDotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: verticalScale(6),
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(51, 51, 51, 0.25)",
  },
  paginationDotActive: {
    width: 16,
    borderRadius: 3,
    backgroundColor: ChickIntelPalette.gray1,
  },
  segmentText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    lineHeight: 15,
    color: "#4A5452",
    flexShrink: 1,
  },
  segmentTextActive: {
    color: "#FFFFFF",
  },
  segmentTextInactive: {
    color: "#4A5452",
  },
  segmentAlertDot: {
    width: scale(6),
    height: verticalScale(6),
    borderRadius: 3,
    backgroundColor: "#DC2626",
    marginLeft: 1,
  },
  segmentAlertDotActive: {
    backgroundColor: "#FFD2D2",
  },
  tabEmptyCard: {
    overflow: "hidden",
    marginTop: 12,
  },
  tabEmptyInner: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 14,
    paddingVertical: verticalScale(28),
    paddingHorizontal: moderateScale(20),
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  tabEmptyIconWrap: {
    width: scale(52),
    height: verticalScale(52),
    borderRadius: 26,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  tabEmptyTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  tabEmptySubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.gray2,
    textAlign: "center",
  },
  tabEmptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: ChickIntelPalette.green1,
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(8),
    borderRadius: 10,
    marginTop: 6,
  },
  tabEmptyAddBtnText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: "#FFFFFF",
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
    paddingHorizontal: moderateScale(16),
  },
  tableContainer: {
    overflow: "hidden",
    marginTop: 12,
  },
  tableSurface: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
  },
  tableSurfaceExpired: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
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
    paddingHorizontal: moderateScale(9),
    paddingVertical: verticalScale(3),
    borderRadius: 8,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
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
    color: "#B91C1C",
  },
  tableSectionMeta: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: "#2C3333",
  },
  tableSectionMetaExpired: {
    color: "#991B1B",
    fontWeight: "700",
  },
  tableScrollContent: {
    minWidth: "100%",
  },
  tableInner: {
    width: "100%",
    minWidth: scale(310),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2D6A4F",
    paddingVertical: verticalScale(9),
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    width: "100%",
  },
  headerRowExpired: {
    backgroundColor: "#2D6A4F",
  },
  headerCell: {
    justifyContent: "flex-start",
    paddingHorizontal: moderateScale(6),
    flexDirection: "row",
    alignItems: "center",
  },
  headerText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: "#FFF",
  },
  sortIcon: {
    marginLeft: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: verticalScale(10),
    backgroundColor: "transparent",
    width: "100%",
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.04)",
  },
  cell: {
    justifyContent: "center",
    paddingHorizontal: moderateScale(6),
    flexDirection: "row",
    alignItems: "center",
  },
  rowTextMain: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    flexShrink: 1,
  },
  rowTextMuted: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: "#666",
    fontStyle: "italic",
  },
  emptyStateText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 18,
    color: ChickIntelPalette.gray2,
    textAlign: "center",
    paddingVertical: verticalScale(10),
  },

  // Column Widths — fixed anchor widths + flex status to guarantee rock-solid alignment across all rows
  colSelection: { width: scale(40), justifyContent: "center" },
  colType: { width: scale(90), justifyContent: "space-between" },
  colName: {
    width: scale(112),
    justifyContent: "flex-start",
  },
  colQty: { width: scale(54), justifyContent: "flex-start" },
  colUnit: { width: scale(54), justifyContent: "flex-start" },
  colDate: { width: scale(96), justifyContent: "flex-start" },
  colStatus: {
    flex: 1,
    minWidth: scale(145),
    justifyContent: "flex-start",
  },
  colStatusCell: {
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
  },
  colActions: {
    width: scale(72),
    justifyContent: "center",
    alignItems: "center",
  },

  itemDateStack: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 2,
    marginTop: 2,
  },
  dateSimpleText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: "rgba(51, 51, 51, 0.65)",
    fontWeight: "500",
  },
  expSimpleText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
  },
  expAlertCard: {
    marginBottom: verticalScale(14),
    borderRadius: 10,
    overflow: "hidden",
  },
  expAlertCardInner: {
    padding: moderateScale(14),
    borderRadius: 10,
    gap: 12,
    backgroundColor: "#262E2D",
  },
  expAlertCardInnerDanger: {
    backgroundColor: "#262E2D",
  },
  expAlertCardInnerWarning: {
    backgroundColor: "#262E2D",
  },
  expAlertHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  expAlertIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: verticalScale(2),
  },
  expAlertHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  expAlertTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(15),
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  expAlertSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 17,
    color: "rgba(255, 255, 255, 0.88)",
    marginTop: 2,
    fontWeight: "500",
  },
  previewSegmentedContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 8,
    padding: 3,
    gap: 3,
    alignSelf: "flex-start",
  },
  previewSegmentedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(5),
    borderRadius: 6,
  },
  previewSegmentedItemActive: {
    backgroundColor: "#3E4846",
  },
  previewSegmentedText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.65)",
  },
  previewSegmentedTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  previewSegmentedTextExpiredActive: {
    color: "#EF4444",
    fontWeight: "700",
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
    gap: 4,
    flexWrap: "wrap",
    width: "100%",
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
    fontSize: responsiveFontSize(10),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
    textAlign: "left",
    alignSelf: "flex-start",
  },
  stockStatusWrap: {
    width: "100%",
    alignItems: "flex-start",
    gap: 4,
  },
  stockBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(2.5),
    gap: 4,
  },
  stockBadgeDot: {
    width: scale(6),
    height: verticalScale(6),
    borderRadius: 999,
  },
  stockBadgeText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(9.5),
    fontWeight: "700",
  },
  stockBarTrack: {
    width: "100%",
    height: verticalScale(6),
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.08)",
    overflow: "hidden",
    alignSelf: "flex-start",
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
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(2),
    borderRadius: 5,
    gap: 3,
  },
  quarantinePillText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(9.5),
    fontWeight: "700",
    color: "#DC2626",
    textAlign: "left",
  },
  expiredQtyText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(9.5),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
    textAlign: "left",
    alignSelf: "flex-start",
  },

  actionsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  actionBtn: {
    padding: moderateScale(3),
    borderRadius: 6,
  },

  // Add Item & Stock Update Modal (Batch Profile Consistency)
  modalScreen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.light1,
  },
  modalKeyboardArea: {
    flex: 1,
  },
  modalHeaderContainer: {
    paddingHorizontal: moderateScale(16),
    gap: 12,
    flexShrink: 0,
    paddingBottom: 12,
  },
  modalTopBar: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalBackButton: {
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
  modalTitleCard: {
    borderRadius: 14,
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(14),
    backgroundColor: ChickIntelPalette.green1,
    gap: 4,
  },
  modalKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modalKickerText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    letterSpacing: 0.55,
    textTransform: "uppercase",
    color: "#CAE3DD",
  },
  modalPageTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    lineHeight: 26,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: "#FFFFFF",
  },
  modalPageSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 17,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.88)",
  },
  modalSummaryChipRow: {
    flexDirection: "row",
    gap: 6,
  },
  modalSummaryChip: {
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
  },
  modalSummaryChipText: {
    flexShrink: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  modalScrollContent: {
    paddingHorizontal: moderateScale(16),
    gap: 12,
    paddingTop: verticalScale(4),
  },
  modalFormSection: {
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(14),
    backgroundColor: "rgba(254, 254, 254, 0.92)",
  },
  modalFormSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalFormSectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(14),
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
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(12),
    backgroundColor: "rgba(202, 227, 221, 0.24)",
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
  modalActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: verticalScale(4),
    marginBottom: verticalScale(12),
  },
  modalCancelButton: {
    flex: 1,
    height: verticalScale(52),
    borderRadius: 14,
    backgroundColor: "rgba(254, 254, 254, 0.88)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelButtonText: {
    color: ChickIntelPalette.gray1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "700",
  },
  modalSaveButton: {
    flex: 1,
    height: verticalScale(52),
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.green1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#317667",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(4) },
    elevation: 3,
  },
  modalSaveButtonText: {
    color: "#FFF",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "700",
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
