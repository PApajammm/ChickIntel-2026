import {
    ActivityLogData,
    fetchActivityLogs,
    filterActivityLogs,
    getActivityLogStats,
    type ActivityLogFilter,
} from "@/utils/activity-logs";
import {
    createBreed,
    createFarmer,
    createItemType,
    fetchBreeds,
    fetchFarmers,
    fetchItemTypes,
    toggleBreedStatus,
    toggleFarmerStatus,
    toggleItemTypeStatus,
    updateBreed,
    updateFarmer,
    updateItemType,
    type BreedData,
    type FarmerData,
    type ItemTypeData,
} from "@/utils/supabase-admin";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
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
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BlurCard } from "@/components/ui/blur-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { getFarmColors } from "@/constants/farm-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type TabKey = "farmers" | "breeds" | "items" | "logs";

export default function AdminDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = getFarmColors(colorScheme);

  // Tab State
  const [activeTab, setActiveTab] = useState<TabKey>("farmers");

  // Dynamic Data State connected to Supabase
  const [farmers, setFarmers] = useState<FarmerData[]>([]);
  const [breeds, setBreeds] = useState<BreedData[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemTypeData[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogData[]>([]);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logActionFilter, setLogActionFilter] =
    useState<ActivityLogFilter>("all");
  const [loading, setLoading] = useState(false);

  const loadFarmers = async () => {
    setLoading(true);
    try {
      const data = await fetchFarmers();
      setFarmers(data);
    } catch (err: any) {
      console.error(err);
      Alert.alert(
        "Error",
        err.message || "Failed to load farmers from database.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadBreeds = async () => {
    setLoading(true);
    try {
      const data = await fetchBreeds();
      setBreeds(data);
    } catch (err: any) {
      console.error(err);
      Alert.alert(
        "Error",
        err.message || "Failed to load breeds from database.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadItemTypes = async () => {
    setLoading(true);
    try {
      const data = await fetchItemTypes();
      setItemTypes(data);
    } catch (err: any) {
      console.error(err);
      Alert.alert(
        "Error",
        err.message || "Failed to load item types from database.",
      );
    } finally {
      setLoading(false);
    }
  };

  const loadActivityLogs = async () => {
    setLoading(true);
    setLogsError(null);
    try {
      const data = await fetchActivityLogs();
      setActivityLogs(data);
    } catch (err: any) {
      console.error("[ActivityLogs]", err);
      setLogsError(err.message || "Failed to load activity logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "farmers") {
      loadFarmers();
    } else if (activeTab === "breeds") {
      loadBreeds();
    } else if (activeTab === "items") {
      loadItemTypes();
    } else if (activeTab === "logs") {
      loadActivityLogs();
    }
  }, [activeTab]);

  // Search queries
  const [searchQuery, setSearchQuery] = useState("");

  // Filtered lists
  const filteredFarmers = useMemo(() => {
    return farmers.filter(
      (f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.email.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [farmers, searchQuery]);

  const filteredBreeds = useMemo(() => {
    return breeds.filter(
      (b) =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.description &&
          b.description.toLowerCase().includes(searchQuery.toLowerCase())),
    );
  }, [breeds, searchQuery]);

  const filteredItems = useMemo(() => {
    return itemTypes.filter(
      (i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.description &&
          i.description.toLowerCase().includes(searchQuery.toLowerCase())),
    );
  }, [itemTypes, searchQuery]);

  const filteredLogs = useMemo(() => {
    return filterActivityLogs(activityLogs, searchQuery, logActionFilter);
  }, [activityLogs, searchQuery, logActionFilter]);

  const logStats = useMemo(
    () => getActivityLogStats(activityLogs),
    [activityLogs],
  );

  function avatarColorForLog(name: string): string {
    const colors = [
      ChickIntelPalette.green1,
      ChickIntelPalette.green2,
      "#6C8B3D",
      "#B76E3E",
      "#2D6B73",
    ];
    const code = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return colors[code % colors.length];
  }

  // Modals visibility
  const [farmerModalVisible, setFarmerModalVisible] = useState(false);
  const [breedModalVisible, setBreedModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);

  // Selected item for edits
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [farmerForm, setFarmerForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    isActive: true,
  });
  const [breedForm, setBreedForm] = useState({
    name: "",
    description: "",
    isActive: true,
  });
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    isActive: true,
  });

  // Form Validation Errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Reset helper
  const clearForm = () => {
    setFarmerForm({
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      isActive: true,
    });
    setBreedForm({ name: "", description: "", isActive: true });
    setItemForm({ name: "", description: "", isActive: true });
    setEditingId(null);
    setFormErrors({});
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // Farmer Handlers
  const handleOpenAddFarmer = () => {
    clearForm();
    setFarmerModalVisible(true);
  };

  const handleOpenEditFarmer = (farmer: FarmerData) => {
    clearForm();
    setEditingId(farmer.id);
    setFarmerForm({
      name: farmer.name,
      email: farmer.email,
      password: "",
      confirmPassword: "",
      isActive: farmer.isActive,
    });
    setFarmerModalVisible(true);
  };

  function getEmailPrefix(val: string): string {
    if (!val) return "";
    let clean = val.trim().toLowerCase();
    if (clean.includes("@")) {
      clean = clean.split("@")[0];
    }
    return clean;
  }

  const handleSaveFarmer = async () => {
    const errors: Record<string, string> = {};
    const cleanPrefix = getEmailPrefix(farmerForm.email);
    const fullEmail = editingId
      ? farmerForm.email.trim().toLowerCase()
      : `${cleanPrefix}@gmail.com`;

    if (!farmerForm.name.trim()) errors.name = "Full Name is required";
    if (!editingId) {
      if (!cleanPrefix) {
        errors.email = "Email prefix is required (e.g. brian)";
      }
    } else if (!fullEmail) {
      errors.email = "Email address is required";
    }

    // Password required only for new farmers
    if (!editingId) {
      if (!farmerForm.password) {
        errors.password = "Password is required";
      } else if (farmerForm.password.length < 6) {
        errors.password = "Password must be at least 6 characters";
      }
      if (farmerForm.password !== farmerForm.confirmPassword) {
        errors.confirmPassword = "Passwords do not match";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        // Edit
        await updateFarmer(editingId, farmerForm.name, farmerForm.isActive);
        Alert.alert("Success", "Farmer account updated successfully.");
      } else {
        // Create
        await createFarmer(fullEmail, farmerForm.name, farmerForm.password);
        Alert.alert(
          "Success",
          `Farmer account created successfully.\nEmail: ${fullEmail}`,
        );
      }
      setFarmerModalVisible(false);
      clearForm();
      await loadFarmers();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save farmer account.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFarmerActive = (id: string, currentStatus: boolean) => {
    const actionText = currentStatus ? "deactivate" : "reactivate";
    Alert.alert(
      "Confirm Action",
      `Are you sure you want to ${actionText} this farmer account?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Proceed",
          onPress: async () => {
            setLoading(true);
            try {
              await toggleFarmerStatus(id, currentStatus);
              Alert.alert(
                "Success",
                `Farmer account ${actionText}d successfully.`,
              );
              await loadFarmers();
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.message || `Failed to ${actionText} farmer.`,
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  // Breed Handlers
  const handleOpenAddBreed = () => {
    clearForm();
    setBreedModalVisible(true);
  };

  const handleOpenEditBreed = (breed: BreedData) => {
    clearForm();
    setEditingId(breed.id);
    setBreedForm({
      name: breed.name,
      description: breed.description,
      isActive: breed.isActive,
    });
    setBreedModalVisible(true);
  };

  const handleSaveBreed = async () => {
    const errors: Record<string, string> = {};
    if (!breedForm.name.trim()) errors.name = "Breed name is required";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await updateBreed(
          editingId,
          breedForm.name,
          breedForm.description,
          breedForm.isActive,
        );
        Alert.alert("Success", "Breed updated successfully.");
      } else {
        await createBreed(breedForm.name, breedForm.description);
        Alert.alert("Success", "Breed added successfully.");
      }
      setBreedModalVisible(false);
      clearForm();
      await loadBreeds();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save breed.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBreedActive = (id: string, currentStatus: boolean) => {
    const actionText = currentStatus ? "deactivate" : "reactivate";
    Alert.alert(
      "Confirm Action",
      `Are you sure you want to ${actionText} this breed?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Proceed",
          onPress: async () => {
            setLoading(true);
            try {
              await toggleBreedStatus(id, currentStatus);
              Alert.alert("Success", `Breed ${actionText}d successfully.`);
              await loadBreeds();
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.message || `Failed to ${actionText} breed.`,
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  // Item Handlers
  const handleOpenAddItem = () => {
    clearForm();
    setItemModalVisible(true);
  };

  const handleOpenEditItem = (item: ItemTypeData) => {
    clearForm();
    setEditingId(item.id);
    setItemForm({
      name: item.name,
      description: item.description,
      isActive: item.isActive,
    });
    setItemModalVisible(true);
  };

  const handleSaveItem = async () => {
    const errors: Record<string, string> = {};
    if (!itemForm.name.trim()) errors.name = "Category name is required";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setLoading(true);
    try {
      if (editingId) {
        await updateItemType(
          editingId,
          itemForm.name,
          itemForm.description,
          itemForm.isActive,
        );
        Alert.alert("Success", "Item type updated successfully.");
      } else {
        await createItemType(itemForm.name, itemForm.description);
        Alert.alert("Success", "Item type added successfully.");
      }
      setItemModalVisible(false);
      clearForm();
      await loadItemTypes();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to save item type.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItemActive = (id: string, currentStatus: boolean) => {
    const actionText = currentStatus ? "deactivate" : "reactivate";
    Alert.alert(
      "Confirm Action",
      `Are you sure you want to ${actionText} this item type?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Proceed",
          onPress: async () => {
            setLoading(true);
            try {
              await toggleItemTypeStatus(id, currentStatus);
              Alert.alert("Success", `Item type ${actionText}d successfully.`);
              await loadItemTypes();
            } catch (err: any) {
              Alert.alert(
                "Error",
                err.message || `Failed to ${actionText} item type.`,
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  // Quick stats calculations
  const stats = useMemo(() => {
    const totalFarmers = farmers.length;
    const activeFarmers = farmers.filter((f) => f.isActive).length;
    const totalBreeds = breeds.length;
    const totalItems = itemTypes.length;
    return { totalFarmers, activeFarmers, totalBreeds, totalItems };
  }, [farmers, breeds, itemTypes]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      {/* Header Bar */}
      <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.replace("/(tabs)")}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressedOpacity,
          ]}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={colors.text}
          />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Admin Console
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            Live Administration
          </Text>
        </View>
        <View style={styles.headerRightPlaceholder} />
      </View>

      {/* Tabs / Segmented Control */}
      <View style={styles.tabContainer}>
        {(["farmers", "breeds", "items", "logs"] as TabKey[]).map((tab) => {
          const isSelected = activeTab === tab;
          const label =
            tab === "farmers"
              ? "Farmers"
              : tab === "breeds"
                ? "Breeds"
                : tab === "items"
                  ? "Item Types"
                  : "Activity Logs";
          return (
            <Pressable
              key={tab}
              onPress={() => {
                setActiveTab(tab);
                setSearchQuery("");
              }}
              style={[
                styles.tabButton,
                isSelected && { backgroundColor: ChickIntelPalette.green1 },
                {
                  borderColor: isSelected
                    ? ChickIntelPalette.green1
                    : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  { color: isSelected ? "#FFFFFF" : colors.textMuted },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <MaterialCommunityIcons
            name="magnify"
            size={20}
            color={colors.textMuted}
          />
          <TextInput
            placeholder={
              activeTab === "farmers"
                ? "Search farmers..."
                : activeTab === "breeds"
                  ? "Search breeds..."
                  : activeTab === "items"
                    ? "Search item categories..."
                    : "Search activity logs..."
            }
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <MaterialCommunityIcons
                name="close"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Tab Contents */}
      <View style={styles.listContainer}>
        {activeTab === "farmers" && loading && farmers.length === 0 ? (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <ActivityIndicator size="large" color={ChickIntelPalette.green1} />
          </View>
        ) : (
          activeTab === "farmers" && (
            <FlatList
              data={filteredFarmers}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              refreshing={loading}
              onRefresh={loadFarmers}
              ListHeaderComponent={
                <View style={styles.statsCardRow}>
                  <BlurCard style={styles.statMiniCard}>
                    <Text style={[styles.statValue, { color: colors.primary }]}>
                      {stats.totalFarmers}
                    </Text>
                    <Text
                      style={[styles.statLabel, { color: colors.textMuted }]}
                    >
                      Total Farmers
                    </Text>
                  </BlurCard>
                  <BlurCard style={styles.statMiniCard}>
                    <Text style={[styles.statValue, { color: colors.success }]}>
                      {stats.activeFarmers}
                    </Text>
                    <Text
                      style={[styles.statLabel, { color: colors.textMuted }]}
                    >
                      Active
                    </Text>
                  </BlurCard>
                  <BlurCard style={styles.statMiniCard}>
                    <Text style={[styles.statValue, { color: colors.danger }]}>
                      {stats.totalFarmers - stats.activeFarmers}
                    </Text>
                    <Text
                      style={[styles.statLabel, { color: colors.textMuted }]}
                    >
                      Inactive
                    </Text>
                  </BlurCard>
                </View>
              }
              renderItem={({ item }) => (
                <BlurCard style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View
                      style={[
                        styles.avatarCircle,
                        {
                          backgroundColor: item.isActive
                            ? ChickIntelPalette.lightGreen
                            : "#E5E5E5",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          {
                            color: item.isActive
                              ? ChickIntelPalette.green1
                              : "#999",
                          },
                        ]}
                      >
                        {(item.name || "")
                          .split(" ")
                          .filter(Boolean)
                          .map((w) => w[0])
                          .join("")
                          .substring(0, 2)
                          .toUpperCase() || "F"}
                      </Text>
                    </View>
                    <View style={styles.itemDetails}>
                      <Text style={[styles.itemName, { color: colors.text }]}>
                        {item.name}
                      </Text>
                      <Text
                        style={[styles.itemEmail, { color: colors.textMuted }]}
                      >
                        {item.email}
                      </Text>
                      <Text
                        style={[styles.itemInfo, { color: colors.textMuted }]}
                      >
                        Farms:{" "}
                        <Text style={{ fontWeight: "700" }}>
                          {item.farmCount}
                        </Text>{" "}
                        | Last Login: {item.lastLogin}
                      </Text>
                    </View>
                    <View style={styles.statusSection}>
                      <View
                        style={[
                          styles.badge,
                          {
                            backgroundColor: item.isActive
                              ? colors.successSoft
                              : colors.dangerSoft,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.badgeText,
                            {
                              color: item.isActive
                                ? colors.success
                                : colors.danger,
                            },
                          ]}
                        >
                          {item.isActive ? "Active" : "Inactive"}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.cardDivider,
                      { backgroundColor: colors.border },
                    ]}
                  />
                  <View style={styles.cardActions}>
                    <Pressable
                      onPress={() => handleOpenEditFarmer(item)}
                      style={({ pressed }) => [
                        styles.actionButton,
                        pressed && styles.pressedOpacity,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="pencil-outline"
                        size={16}
                        color={colors.primary}
                      />
                      <Text
                        style={[
                          styles.actionButtonText,
                          { color: colors.primary },
                        ]}
                      >
                        Edit Details
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        handleToggleFarmerActive(item.id, item.isActive)
                      }
                      style={({ pressed }) => [
                        styles.actionButton,
                        pressed && styles.pressedOpacity,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          item.isActive
                            ? "account-off-outline"
                            : "account-check-outline"
                        }
                        size={16}
                        color={item.isActive ? colors.danger : colors.success}
                      />
                      <Text
                        style={[
                          styles.actionButtonText,
                          {
                            color: item.isActive
                              ? colors.danger
                              : colors.success,
                          },
                        ]}
                      >
                        {item.isActive ? "Deactivate" : "Reactivate"}
                      </Text>
                    </Pressable>
                  </View>
                </BlurCard>
              )}
              ListFooterComponent={<View style={{ height: 100 }} />}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons
                    name="account-search-outline"
                    size={48}
                    color={colors.textMuted}
                  />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    No farmers found matching query.
                  </Text>
                </View>
              }
            />
          )
        )}

        {activeTab === "breeds" && (
          <FlatList
            data={filteredBreeds}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.statsCardRow}>
                <BlurCard style={styles.statMiniCard}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>
                    {stats.totalBreeds}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    Total Breeds
                  </Text>
                </BlurCard>
                <BlurCard style={styles.statMiniCard}>
                  <Text style={[styles.statValue, { color: colors.success }]}>
                    {breeds.filter((b) => b.isActive).length}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    Active
                  </Text>
                </BlurCard>
                <BlurCard style={styles.statMiniCard}>
                  <Text style={[styles.statValue, { color: colors.danger }]}>
                    {breeds.filter((b) => !b.isActive).length}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    Inactive
                  </Text>
                </BlurCard>
              </View>
            }
            renderItem={({ item }) => (
              <BlurCard style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View
                    style={[
                      styles.avatarCircle,
                      {
                        backgroundColor: item.isActive
                          ? colors.primarySoft
                          : "#E5E5E5",
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="bird"
                      size={20}
                      color={item.isActive ? colors.primary : "#999"}
                    />
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={[styles.itemName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    <Text
                      style={[styles.itemEmail, { color: colors.textMuted }]}
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>
                  </View>
                  <View style={styles.statusSection}>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: item.isActive
                            ? colors.successSoft
                            : colors.dangerSoft,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          {
                            color: item.isActive
                              ? colors.success
                              : colors.danger,
                          },
                        ]}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </Text>
                    </View>
                  </View>
                </View>
                <View
                  style={[
                    styles.cardDivider,
                    { backgroundColor: colors.border },
                  ]}
                />
                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => handleOpenEditBreed(item)}
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed && styles.pressedOpacity,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={16}
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: colors.primary },
                      ]}
                    >
                      Edit Breed
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      handleToggleBreedActive(item.id, item.isActive)
                    }
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed && styles.pressedOpacity,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.isActive ? "eye-off-outline" : "eye-outline"}
                      size={16}
                      color={item.isActive ? colors.danger : colors.success}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        {
                          color: item.isActive ? colors.danger : colors.success,
                        },
                      ]}
                    >
                      {item.isActive ? "Deactivate" : "Activate"}
                    </Text>
                  </Pressable>
                </View>
              </BlurCard>
            )}
            ListFooterComponent={<View style={{ height: 100 }} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name="bird"
                  size={48}
                  color={colors.textMuted}
                />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No chicken breeds found.
                </Text>
              </View>
            }
          />
        )}

        {activeTab === "items" && (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <View style={styles.statsCardRow}>
                <BlurCard style={styles.statMiniCard}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>
                    {stats.totalItems}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    Total Types
                  </Text>
                </BlurCard>
                <BlurCard style={styles.statMiniCard}>
                  <Text style={[styles.statValue, { color: colors.success }]}>
                    {itemTypes.filter((i) => i.isActive).length}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    Active
                  </Text>
                </BlurCard>
                <BlurCard style={styles.statMiniCard}>
                  <Text style={[styles.statValue, { color: colors.danger }]}>
                    {itemTypes.filter((i) => !i.isActive).length}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    Inactive
                  </Text>
                </BlurCard>
              </View>
            }
            renderItem={({ item }) => (
              <BlurCard style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View
                    style={[
                      styles.avatarCircle,
                      {
                        backgroundColor: item.isActive
                          ? colors.accentSoft
                          : "#E5E5E5",
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="package-variant"
                      size={20}
                      color={item.isActive ? colors.accent : "#999"}
                    />
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={[styles.itemName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    <Text
                      style={[styles.itemEmail, { color: colors.textMuted }]}
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>
                  </View>
                  <View style={styles.statusSection}>
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor: item.isActive
                            ? colors.successSoft
                            : colors.dangerSoft,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          {
                            color: item.isActive
                              ? colors.success
                              : colors.danger,
                          },
                        ]}
                      >
                        {item.isActive ? "Active" : "Inactive"}
                      </Text>
                    </View>
                  </View>
                </View>
                <View
                  style={[
                    styles.cardDivider,
                    { backgroundColor: colors.border },
                  ]}
                />
                <View style={styles.cardActions}>
                  <Pressable
                    onPress={() => handleOpenEditItem(item)}
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed && styles.pressedOpacity,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="pencil-outline"
                      size={16}
                      color={colors.primary}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: colors.primary },
                      ]}
                    >
                      Edit Category
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      handleToggleItemActive(item.id, item.isActive)
                    }
                    style={({ pressed }) => [
                      styles.actionButton,
                      pressed && styles.pressedOpacity,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={item.isActive ? "eye-off-outline" : "eye-outline"}
                      size={16}
                      color={item.isActive ? colors.danger : colors.success}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        {
                          color: item.isActive ? colors.danger : colors.success,
                        },
                      ]}
                    >
                      {item.isActive ? "Deactivate" : "Activate"}
                    </Text>
                  </Pressable>
                </View>
              </BlurCard>
            )}
            ListFooterComponent={<View style={{ height: 100 }} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name="package-variant"
                  size={48}
                  color={colors.textMuted}
                />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No item types found.
                </Text>
              </View>
            }
          />
        )}

        {activeTab === "logs" && loading && activityLogs.length === 0 ? (
          <View
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
          >
            <ActivityIndicator size="large" color={ChickIntelPalette.green1} />
          </View>
        ) : (
          activeTab === "logs" && (
            <FlatList
              data={filteredLogs}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              refreshing={loading}
              onRefresh={loadActivityLogs}
              ListHeaderComponent={
                <View>
                  <View style={styles.logFilterRow}>
                    {[
                      { key: "all", label: "All" },
                      { key: "created", label: "Created" },
                      { key: "updated", label: "Updated" },
                      { key: "deleted", label: "Deleted" },
                    ].map((filter) => {
                      const selected = logActionFilter === filter.key;
                      return (
                        <Pressable
                          key={filter.key}
                          onPress={() =>
                            setLogActionFilter(filter.key as ActivityLogFilter)
                          }
                          style={[
                            styles.logFilterChip,
                            {
                              backgroundColor: selected
                                ? ChickIntelPalette.green1
                                : colors.surface,
                              borderColor: selected
                                ? ChickIntelPalette.green1
                                : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.logFilterChipText,
                              {
                                color: selected ? "#FFFFFF" : colors.textMuted,
                              },
                            ]}
                          >
                            {filter.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.statsCardRow}>
                    <BlurCard style={styles.statMiniCard}>
                      <Text
                        style={[styles.statValue, { color: colors.primary }]}
                      >
                        {logStats.total}
                      </Text>
                      <Text
                        style={[styles.statLabel, { color: colors.textMuted }]}
                      >
                        Total Events
                      </Text>
                    </BlurCard>
                    <BlurCard style={styles.statMiniCard}>
                      <Text
                        style={[styles.statValue, { color: colors.success }]}
                      >
                        {logStats.uniqueFarmers}
                      </Text>
                      <Text
                        style={[styles.statLabel, { color: colors.textMuted }]}
                      >
                        Farmers
                      </Text>
                    </BlurCard>
                    <BlurCard style={styles.statMiniCard}>
                      <Text
                        style={[styles.statValue, { color: colors.success }]}
                      >
                        {logStats.created}
                      </Text>
                      <Text
                        style={[styles.statLabel, { color: colors.textMuted }]}
                      >
                        Created
                      </Text>
                    </BlurCard>
                    <BlurCard style={styles.statMiniCard}>
                      <Text
                        style={[styles.statValue, { color: colors.accent }]}
                      >
                        {logStats.updated}
                      </Text>
                      <Text
                        style={[styles.statLabel, { color: colors.textMuted }]}
                      >
                        Updated
                      </Text>
                    </BlurCard>
                    <BlurCard style={styles.statMiniCard}>
                      <Text
                        style={[styles.statValue, { color: colors.danger }]}
                      >
                        {logStats.deleted}
                      </Text>
                      <Text
                        style={[styles.statLabel, { color: colors.textMuted }]}
                      >
                        Deleted
                      </Text>
                    </BlurCard>
                  </View>
                </View>
              }
              renderItem={({ item }) => (
                <BlurCard style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <View
                      style={[
                        styles.logAvatar,
                        { backgroundColor: item.iconBg },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.icon as any}
                        size={18}
                        color={item.iconColor}
                      />
                    </View>
                    <View
                      style={[
                        styles.logFarmerBadge,
                        { backgroundColor: avatarColorForLog(item.farmerName) },
                      ]}
                    >
                      <Text style={styles.logFarmerAvatarText}>
                        {item.avatar}
                      </Text>
                    </View>
                    <View style={styles.logDetails}>
                      <Text style={[styles.logAction, { color: colors.text }]}>
                        <Text style={{ fontWeight: "700" }}>
                          {item.farmerName}
                        </Text>{" "}
                        {item.action}
                      </Text>
                      <Text
                        style={[styles.logTarget, { color: colors.textMuted }]}
                      >
                        {item.target}
                      </Text>
                      {item.details ? (
                        <Text
                          style={[
                            styles.logTarget,
                            {
                              color: colors.textMuted,
                              fontSize: 11,
                              marginTop: 2,
                            },
                          ]}
                        >
                          {item.details}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.logTimeSection}>
                      <Text
                        style={[styles.logTime, { color: colors.textMuted }]}
                      >
                        {item.relativeTime}
                      </Text>
                      <View
                        style={[
                          styles.logTypeBadge,
                          { backgroundColor: colors.surfaceMuted },
                        ]}
                      >
                        <Text
                          style={[
                            styles.logTypeText,
                            { color: colors.textMuted },
                          ]}
                        >
                          {item.eventType}
                        </Text>
                      </View>
                    </View>
                  </View>
                </BlurCard>
              )}
              ListFooterComponent={<View style={{ height: 100 }} />}
              ListEmptyComponent={
                logsError ? (
                  <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={48}
                      color={colors.danger}
                    />
                    <Text style={[styles.emptyText, { color: colors.danger }]}>
                      {logsError}
                    </Text>
                    <Text
                      style={[
                        styles.emptyText,
                        { color: colors.textMuted, fontSize: 12, marginTop: 4 },
                      ]}
                    >
                      Run supabase/admin-activity-logs-setup.sql in your
                      Supabase dashboard, then pull to refresh.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <MaterialCommunityIcons
                      name="magnify-remove-outline"
                      size={48}
                      color={colors.textMuted}
                    />
                    <Text
                      style={[styles.emptyText, { color: colors.textMuted }]}
                    >
                      No activity logs found yet. Activity will appear here once
                      farmers start using the app.
                    </Text>
                  </View>
                )
              }
            />
          )
        )}
      </View>

      {activeTab !== "logs" && (
        <View style={[styles.fabContainer, { bottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={() => {
              if (activeTab === "farmers") handleOpenAddFarmer();
              else if (activeTab === "breeds") handleOpenAddBreed();
              else handleOpenAddItem();
            }}
            style={({ pressed }) => [
              styles.fab,
              { backgroundColor: ChickIntelPalette.green1 },
              pressed && styles.pressedOpacity,
            ]}
          >
            <MaterialCommunityIcons name="plus" size={24} color="#FFFFFF" />
            <Text style={styles.fabText}>
              Add{" "}
              {activeTab === "farmers"
                ? "Farmer"
                : activeTab === "breeds"
                  ? "Breed"
                  : "Item Type"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Farmer Form Modal */}
      <Modal
        visible={farmerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFarmerModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.keyboardModalArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={insets.top}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalCard, { backgroundColor: colors.surface }]}
            >
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingId
                    ? "Edit Farmer Details"
                    : "Create New Farmer Account"}
                </Text>
                <Pressable onPress={() => setFarmerModalVisible(false)}>
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={colors.text}
                  />
                </Pressable>
              </View>
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Full Name
                  </Text>
                  <TextInput
                    placeholder="e.g. John Doe"
                    placeholderTextColor={colors.textMuted}
                    value={farmerForm.name}
                    onChangeText={(txt) =>
                      setFarmerForm((p) => ({ ...p, name: txt }))
                    }
                    style={[
                      styles.formInput,
                      {
                        color: colors.text,
                        borderColor: formErrors.name
                          ? colors.danger
                          : colors.border,
                      },
                    ]}
                  />
                  {formErrors.name && (
                    <Text style={[styles.formError, { color: colors.danger }]}>
                      {formErrors.name}
                    </Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Email Address
                  </Text>
                  {!editingId ? (
                    <>
                      <View
                        style={[
                          styles.emailInputContainer,
                          {
                            borderColor: formErrors.email
                              ? colors.danger
                              : colors.border,
                            backgroundColor: colors.surface,
                          },
                        ]}
                      >
                        <TextInput
                          placeholder="e.g. brian"
                          placeholderTextColor={colors.textMuted}
                          value={farmerForm.email}
                          onChangeText={(txt) => {
                            const clean = getEmailPrefix(txt);
                            setFarmerForm((p) => ({ ...p, email: clean }));
                          }}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          style={[
                            styles.formInput,
                            styles.emailInputFlex,
                            { color: colors.text },
                          ]}
                        />
                        <View
                          style={[
                            styles.emailSuffixBadge,
                            {
                              backgroundColor: colors.surfaceMuted,
                              borderLeftColor: colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.emailSuffixText,
                              { color: colors.textMuted },
                            ]}
                          >
                            @gmail.com
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.formHelperText,
                          { color: colors.textMuted },
                        ]}
                      >
                        No need to type @gmail.com — it is added automatically!
                        {farmerForm.email.trim() ? (
                          <Text
                            style={{ fontWeight: "700", color: colors.primary }}
                          >
                            {"\n"}Full Email:{" "}
                            {farmerForm.email.trim().toLowerCase()}@gmail.com
                          </Text>
                        ) : null}
                      </Text>
                    </>
                  ) : (
                    <TextInput
                      value={farmerForm.email}
                      editable={false}
                      style={[
                        styles.formInput,
                        styles.formInputDisabled,
                        {
                          color: colors.textMuted,
                          borderColor: colors.border,
                        },
                      ]}
                    />
                  )}
                  {formErrors.email && (
                    <Text style={[styles.formError, { color: colors.danger }]}>
                      {formErrors.email}
                    </Text>
                  )}
                </View>

                {!editingId ? (
                  <>
                    <View style={styles.formGroup}>
                      <Text style={[styles.formLabel, { color: colors.text }]}>
                        Password
                      </Text>
                      <View style={styles.passwordInputContainer}>
                        <TextInput
                          placeholder="At least 6 characters"
                          placeholderTextColor={colors.textMuted}
                          value={farmerForm.password}
                          onChangeText={(txt) =>
                            setFarmerForm((p) => ({ ...p, password: txt }))
                          }
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          style={[
                            styles.formInput,
                            styles.passwordInput,
                            {
                              color: colors.text,
                              borderColor: formErrors.password
                                ? colors.danger
                                : colors.border,
                            },
                          ]}
                        />
                        <Pressable
                          onPress={() => setShowPassword((prev) => !prev)}
                          style={styles.passwordVisibilityToggle}
                          accessibilityLabel={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          <MaterialCommunityIcons
                            name={showPassword ? "eye-off" : "eye"}
                            size={20}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      </View>
                      {formErrors.password && (
                        <Text
                          style={[styles.formError, { color: colors.danger }]}
                        >
                          {formErrors.password}
                        </Text>
                      )}
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={[styles.formLabel, { color: colors.text }]}>
                        Confirm Password
                      </Text>
                      <View style={styles.passwordInputContainer}>
                        <TextInput
                          placeholder="Confirm your password"
                          placeholderTextColor={colors.textMuted}
                          value={farmerForm.confirmPassword}
                          onChangeText={(txt) =>
                            setFarmerForm((p) => ({
                              ...p,
                              confirmPassword: txt,
                            }))
                          }
                          secureTextEntry={!showConfirmPassword}
                          autoCapitalize="none"
                          style={[
                            styles.formInput,
                            styles.passwordInput,
                            {
                              color: colors.text,
                              borderColor: formErrors.confirmPassword
                                ? colors.danger
                                : colors.border,
                            },
                          ]}
                        />
                        <Pressable
                          onPress={() =>
                            setShowConfirmPassword((prev) => !prev)
                          }
                          style={styles.passwordVisibilityToggle}
                          accessibilityLabel={
                            showConfirmPassword
                              ? "Hide confirm password"
                              : "Show confirm password"
                          }
                        >
                          <MaterialCommunityIcons
                            name={showConfirmPassword ? "eye-off" : "eye"}
                            size={20}
                            color={colors.textMuted}
                          />
                        </Pressable>
                      </View>
                      {formErrors.confirmPassword && (
                        <Text
                          style={[styles.formError, { color: colors.danger }]}
                        >
                          {formErrors.confirmPassword}
                        </Text>
                      )}
                    </View>
                  </>
                ) : (
                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Account Status
                    </Text>
                    <View style={styles.statusToggleRow}>
                      <Pressable
                        onPress={() =>
                          setFarmerForm((p) => ({ ...p, isActive: true }))
                        }
                        style={[
                          styles.toggleOption,
                          { borderColor: colors.border },
                          farmerForm.isActive && {
                            backgroundColor: colors.successSoft,
                            borderColor: colors.success,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="check"
                          size={16}
                          color={
                            farmerForm.isActive
                              ? colors.success
                              : colors.textMuted
                          }
                        />
                        <Text
                          style={[
                            styles.toggleOptionText,
                            {
                              color: farmerForm.isActive
                                ? colors.success
                                : colors.textMuted,
                            },
                          ]}
                        >
                          Active
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setFarmerForm((p) => ({ ...p, isActive: false }))
                        }
                        style={[
                          styles.toggleOption,
                          { borderColor: colors.border },
                          !farmerForm.isActive && {
                            backgroundColor: colors.dangerSoft,
                            borderColor: colors.danger,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="close"
                          size={16}
                          color={
                            !farmerForm.isActive
                              ? colors.danger
                              : colors.textMuted
                          }
                        />
                        <Text
                          style={[
                            styles.toggleOptionText,
                            {
                              color: !farmerForm.isActive
                                ? colors.danger
                                : colors.textMuted,
                            },
                          ]}
                        >
                          Inactive
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </ScrollView>
              <View
                style={[styles.modalActions, { borderTopColor: colors.border }]}
              >
                <Pressable
                  onPress={() => setFarmerModalVisible(false)}
                  style={styles.cancelBtn}
                >
                  <Text
                    style={[styles.cancelBtnText, { color: colors.textMuted }]}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveFarmer}
                  style={[
                    styles.saveBtn,
                    { backgroundColor: ChickIntelPalette.green1 },
                  ]}
                >
                  <Text style={styles.saveBtnText}>
                    {editingId ? "Save Changes" : "Create Farmer"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Breed Form Modal */}
      <Modal
        visible={breedModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBreedModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.keyboardModalArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={insets.top}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalCard, { backgroundColor: colors.surface }]}
            >
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingId ? "Edit Breed Details" : "Add New Breed"}
                </Text>
                <Pressable onPress={() => setBreedModalVisible(false)}>
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={colors.text}
                  />
                </Pressable>
              </View>
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Breed Name
                  </Text>
                  <TextInput
                    placeholder="e.g. Rhode Island Red"
                    placeholderTextColor={colors.textMuted}
                    value={breedForm.name}
                    onChangeText={(txt) =>
                      setBreedForm((p) => ({ ...p, name: txt }))
                    }
                    style={[
                      styles.formInput,
                      {
                        color: colors.text,
                        borderColor: formErrors.name
                          ? colors.danger
                          : colors.border,
                      },
                    ]}
                  />
                  {formErrors.name && (
                    <Text style={[styles.formError, { color: colors.danger }]}>
                      {formErrors.name}
                    </Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Description
                  </Text>
                  <TextInput
                    placeholder="Describe breed temperament, egg laying, attributes..."
                    placeholderTextColor={colors.textMuted}
                    value={breedForm.description}
                    onChangeText={(txt) =>
                      setBreedForm((p) => ({ ...p, description: txt }))
                    }
                    multiline
                    numberOfLines={4}
                    style={[
                      styles.formInput,
                      styles.textArea,
                      { color: colors.text, borderColor: colors.border },
                    ]}
                  />
                </View>

                {editingId && (
                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Breed Status
                    </Text>
                    <View style={styles.statusToggleRow}>
                      <Pressable
                        onPress={() =>
                          setBreedForm((p) => ({ ...p, isActive: true }))
                        }
                        style={[
                          styles.toggleOption,
                          { borderColor: colors.border },
                          breedForm.isActive && {
                            backgroundColor: colors.successSoft,
                            borderColor: colors.success,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="check"
                          size={16}
                          color={
                            breedForm.isActive
                              ? colors.success
                              : colors.textMuted
                          }
                        />
                        <Text
                          style={[
                            styles.toggleOptionText,
                            {
                              color: breedForm.isActive
                                ? colors.success
                                : colors.textMuted,
                            },
                          ]}
                        >
                          Active
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setBreedForm((p) => ({ ...p, isActive: false }))
                        }
                        style={[
                          styles.toggleOption,
                          { borderColor: colors.border },
                          !breedForm.isActive && {
                            backgroundColor: colors.dangerSoft,
                            borderColor: colors.danger,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="close"
                          size={16}
                          color={
                            !breedForm.isActive
                              ? colors.danger
                              : colors.textMuted
                          }
                        />
                        <Text
                          style={[
                            styles.toggleOptionText,
                            {
                              color: !breedForm.isActive
                                ? colors.danger
                                : colors.textMuted,
                            },
                          ]}
                        >
                          Inactive
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </ScrollView>
              <View
                style={[styles.modalActions, { borderTopColor: colors.border }]}
              >
                <Pressable
                  onPress={() => setBreedModalVisible(false)}
                  style={styles.cancelBtn}
                >
                  <Text
                    style={[styles.cancelBtnText, { color: colors.textMuted }]}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveBreed}
                  style={[
                    styles.saveBtn,
                    { backgroundColor: ChickIntelPalette.green1 },
                  ]}
                >
                  <Text style={styles.saveBtnText}>
                    {editingId ? "Save Changes" : "Add Breed"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Item Type Form Modal */}
      <Modal
        visible={itemModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setItemModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.keyboardModalArea}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={insets.top}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.modalCard, { backgroundColor: colors.surface }]}
            >
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingId
                    ? "Edit Category Details"
                    : "Add New Item Category"}
                </Text>
                <Pressable onPress={() => setItemModalVisible(false)}>
                  <MaterialCommunityIcons
                    name="close"
                    size={24}
                    color={colors.text}
                  />
                </Pressable>
              </View>
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Category Name
                  </Text>
                  <TextInput
                    placeholder="e.g. Supplements"
                    placeholderTextColor={colors.textMuted}
                    value={itemForm.name}
                    onChangeText={(txt) =>
                      setItemForm((p) => ({ ...p, name: txt }))
                    }
                    style={[
                      styles.formInput,
                      {
                        color: colors.text,
                        borderColor: formErrors.name
                          ? colors.danger
                          : colors.border,
                      },
                    ]}
                  />
                  {formErrors.name && (
                    <Text style={[styles.formError, { color: colors.danger }]}>
                      {formErrors.name}
                    </Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.text }]}>
                    Description
                  </Text>
                  <TextInput
                    placeholder="Describe inventory category usage, notes..."
                    placeholderTextColor={colors.textMuted}
                    value={itemForm.description}
                    onChangeText={(txt) =>
                      setItemForm((p) => ({ ...p, description: txt }))
                    }
                    multiline
                    numberOfLines={4}
                    style={[
                      styles.formInput,
                      styles.textArea,
                      { color: colors.text, borderColor: colors.border },
                    ]}
                  />
                </View>

                {editingId && (
                  <View style={styles.formGroup}>
                    <Text style={[styles.formLabel, { color: colors.text }]}>
                      Category Status
                    </Text>
                    <View style={styles.statusToggleRow}>
                      <Pressable
                        onPress={() =>
                          setItemForm((p) => ({ ...p, isActive: true }))
                        }
                        style={[
                          styles.toggleOption,
                          { borderColor: colors.border },
                          itemForm.isActive && {
                            backgroundColor: colors.successSoft,
                            borderColor: colors.success,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="check"
                          size={16}
                          color={
                            itemForm.isActive
                              ? colors.success
                              : colors.textMuted
                          }
                        />
                        <Text
                          style={[
                            styles.toggleOptionText,
                            {
                              color: itemForm.isActive
                                ? colors.success
                                : colors.textMuted,
                            },
                          ]}
                        >
                          Active
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          setItemForm((p) => ({ ...p, isActive: false }))
                        }
                        style={[
                          styles.toggleOption,
                          { borderColor: colors.border },
                          !itemForm.isActive && {
                            backgroundColor: colors.dangerSoft,
                            borderColor: colors.danger,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="close"
                          size={16}
                          color={
                            !itemForm.isActive
                              ? colors.danger
                              : colors.textMuted
                          }
                        />
                        <Text
                          style={[
                            styles.toggleOptionText,
                            {
                              color: !itemForm.isActive
                                ? colors.danger
                                : colors.textMuted,
                            },
                          ]}
                        >
                          Inactive
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </ScrollView>
              <View
                style={[styles.modalActions, { borderTopColor: colors.border }]}
              >
                <Pressable
                  onPress={() => setItemModalVisible(false)}
                  style={styles.cancelBtn}
                >
                  <Text
                    style={[styles.cancelBtnText, { color: colors.textMuted }]}
                  >
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveItem}
                  style={[
                    styles.saveBtn,
                    { backgroundColor: ChickIntelPalette.green1 },
                  ]}
                >
                  <Text style={styles.saveBtnText}>
                    {editingId ? "Save Changes" : "Add Category"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitleWrap: {
    alignItems: "center",
  },
  headerTitle: {
    fontFamily: ChickFont.display,
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: 11,
    marginTop: 2,
    fontWeight: "500",
  },
  headerRightPlaceholder: {
    width: 32,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderWidth: 1.5,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  tabButtonText: {
    fontFamily: ChickFont.sans,
    fontSize: 13,
    fontWeight: "700",
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontFamily: ChickFont.sans,
    fontSize: 14,
    paddingVertical: 0,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  statsCardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  statMiniCard: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontFamily: ChickFont.display,
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    fontFamily: ChickFont.sans,
    fontSize: 9,
    marginTop: 2,
    fontWeight: "600",
  },
  itemCard: {
    marginBottom: 12,
    padding: 12,
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: ChickFont.display,
    fontSize: 14,
    fontWeight: "700",
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  itemName: {
    fontFamily: ChickFont.display,
    fontSize: 15,
    fontWeight: "700",
  },
  itemEmail: {
    fontFamily: ChickFont.sans,
    fontSize: 12,
    marginTop: 2,
  },
  itemInfo: {
    fontFamily: ChickFont.sans,
    fontSize: 10,
    marginTop: 4,
  },
  statusSection: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontFamily: ChickFont.sans,
    fontSize: 10,
    fontWeight: "700",
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  actionButtonText: {
    fontFamily: ChickFont.sans,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyText: {
    fontFamily: ChickFont.sans,
    fontSize: 13,
  },
  fabContainer: {
    position: "absolute",
    right: 16,
    left: 16,
    alignItems: "center",
  },
  fab: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabText: {
    fontFamily: ChickFont.sans,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  pressedOpacity: {
    opacity: 0.7,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  keyboardModalArea: {
    flex: 1,
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontFamily: ChickFont.display,
    fontSize: 16,
    fontWeight: "700",
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontFamily: ChickFont.sans,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  formInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontFamily: ChickFont.sans,
    fontSize: 14,
  },
  formInputDisabled: {
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    opacity: 0.75,
  },
  passwordInputContainer: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 44,
  },
  passwordVisibilityToggle: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  textArea: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: "top",
  },
  formError: {
    fontFamily: ChickFont.sans,
    fontSize: 11,
    marginTop: 4,
    fontWeight: "500",
  },
  statusToggleRow: {
    flexDirection: "row",
    gap: 12,
  },
  toggleOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderWidth: 1.5,
    borderRadius: 8,
  },
  toggleOptionText: {
    fontFamily: ChickFont.sans,
    fontSize: 13,
    fontWeight: "700",
  },
  modalActions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 10,
  },
  cancelBtnText: {
    fontFamily: ChickFont.sans,
    fontSize: 14,
    fontWeight: "700",
  },
  saveBtn: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: 10,
  },
  saveBtnText: {
    fontFamily: ChickFont.sans,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  logCard: {
    marginBottom: 12,
    padding: 12,
  },
  logFilterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  logFilterChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  logFilterChipText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  logFarmerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  logFarmerAvatarText: {
    fontFamily: ChickFont.display,
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  logDetails: {
    flex: 1,
    justifyContent: "center",
  },
  logAction: {
    fontFamily: ChickFont.sans,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  logTarget: {
    fontFamily: ChickFont.sans,
    fontSize: 12,
    marginTop: 2,
  },
  logTimeSection: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 4,
  },
  logTime: {
    fontFamily: ChickFont.sans,
    fontSize: 11,
    fontWeight: "600",
  },
  logTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logTypeText: {
    fontFamily: ChickFont.sans,
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  emailInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  emailInputFlex: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 0,
  },
  emailSuffixBadge: {
    paddingHorizontal: 12,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderLeftWidth: 1,
  },
  emailSuffixText: {
    fontFamily: ChickFont.sans,
    fontSize: 13,
    fontWeight: "700",
  },
  formHelperText: {
    fontFamily: ChickFont.sans,
    fontSize: 12,
    marginTop: 4,
  },
});
