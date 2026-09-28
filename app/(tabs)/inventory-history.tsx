import { BlurCard } from "@/components/ui/blur-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import {
    fetchDeletedInventoryItems,
    type InventoryHistoryItem,
} from "@/utils/supabase-inventory-history";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatDate(value: Date) {
    return Number.isNaN(value.getTime())
        ? "Date unavailable"
        : value.toLocaleDateString();
}

type SortOption = "newest" | "oldest" | "name_asc" | "name_desc";

export default function InventoryHistoryScreen() {
    const router = useRouter();
    const { activeFarm } = useAuth();
    const [items, setItems] = useState<InventoryHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [sortOption, setSortOption] = useState<SortOption>("newest");

    const categories = useMemo(
        () =>
            Array.from(
                new Set(items.map((item) => item.type.trim()).filter(Boolean)),
            ).sort((left, right) => left.localeCompare(right)),
        [items],
    );

    const filteredItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const result = items.filter((item) => {
            const matchesCategory =
                categoryFilter === "all" || item.type.trim() === categoryFilter;
            if (!matchesCategory) return false;
            if (!query) return true;
            return [item.name, item.type, item.unit]
                .filter(Boolean)
                .some((value) => value.toLowerCase().includes(query));
        });

        return result.sort((left, right) => {
            if (sortOption === "newest") {
                return right.deletedAt.localeCompare(left.deletedAt);
            }
            if (sortOption === "oldest") {
                return left.deletedAt.localeCompare(right.deletedAt);
            }
            const leftName = left.name.toLowerCase();
            const rightName = right.name.toLowerCase();
            return sortOption === "name_asc"
                ? leftName.localeCompare(rightName)
                : rightName.localeCompare(leftName);
        });
    }, [categoryFilter, items, searchQuery, sortOption]);

    const cycleSortOption = () => {
        setSortOption((current) => {
            if (current === "newest") return "oldest";
            if (current === "oldest") return "name_asc";
            if (current === "name_asc") return "name_desc";
            return "newest";
        });
    };

    const sortLabel = {
        newest: "Deleted: Newest",
        oldest: "Deleted: Oldest",
        name_asc: "Name: A-Z",
        name_desc: "Name: Z-A",
    }[sortOption];
    const load = useCallback(async () => {
        if (!activeFarm?.id) {
            setItems([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            setItems(await fetchDeletedInventoryItems(activeFarm.id));
        } catch (value) {
            setError(
                value instanceof Error
                    ? value.message
                    : "Unable to load inventory history.",
            );
        } finally {
            setLoading(false);
        }
    }, [activeFarm?.id]);
    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load]),
    );
    return (
        <View style={styles.screen}>
            <SafeAreaView style={styles.safeArea} edges={["top"]}>
                <View style={styles.header}>
                    <Pressable
                        style={styles.headerButton}
                        onPress={() =>
                            router.replace("/(tabs)/inventory" as any)
                        }
                        accessibilityRole="button"
                        accessibilityLabel="Back to inventory"
                    >
                        <MaterialCommunityIcons
                            name="arrow-left"
                            size={24}
                            color={ChickIntelPalette.gray1}
                        />
                    </Pressable>
                    <Text style={styles.title}>Inventory History</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.searchFilterContainer}>
                    <View style={styles.searchBar}>
                        <MaterialCommunityIcons
                            name="magnify"
                            size={20}
                            color={ChickIntelPalette.gray1}
                        />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search item, category, or unit..."
                            placeholderTextColor={ChickIntelPalette.gray2}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 ? (
                            <Pressable
                                onPress={() => setSearchQuery("")}
                                hitSlop={8}
                            >
                                <MaterialCommunityIcons
                                    name="close-circle"
                                    size={18}
                                    color={ChickIntelPalette.gray2}
                                />
                            </Pressable>
                        ) : null}
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterPillsRow}
                    >
                        <Pressable
                            onPress={cycleSortOption}
                            style={styles.filterChip}
                        >
                            <MaterialCommunityIcons
                                name="sort-variant"
                                size={15}
                                color={ChickIntelPalette.green1}
                            />
                            <Text style={styles.filterChipText}>
                                {sortLabel}
                            </Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setCategoryFilter("all")}
                            style={[
                                styles.filterChip,
                                categoryFilter === "all" &&
                                    styles.filterChipActive,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.filterChipText,
                                    categoryFilter === "all" &&
                                        styles.filterChipTextActive,
                                ]}
                            >
                                All Categories
                            </Text>
                        </Pressable>
                        {categories.map((category) => (
                            <Pressable
                                key={category}
                                onPress={() => setCategoryFilter(category)}
                                style={[
                                    styles.filterChip,
                                    categoryFilter === category &&
                                        styles.filterChipActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        categoryFilter === category &&
                                            styles.filterChipTextActive,
                                    ]}
                                >
                                    {category}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {loading ? (
                        <ActivityIndicator color={ChickIntelPalette.green1} />
                    ) : null}
                    {error ? <Text style={styles.empty}>{error}</Text> : null}
                    {!loading && !error && items.length === 0 ? (
                        <Text style={styles.empty}>
                            No deleted inventory items yet.
                        </Text>
                    ) : null}
                    {!loading &&
                    !error &&
                    items.length > 0 &&
                    filteredItems.length === 0 ? (
                        <Text style={styles.empty}>
                            No inventory items match your filters.
                        </Text>
                    ) : null}
                    {filteredItems.map((item) => (
                        <BlurCard
                            key={item.historyId}
                            style={styles.card}
                            borderRadius={16}
                            intensity={20}
                        >
                            <View style={styles.row}>
                                <View style={styles.badge}>
                                    <MaterialCommunityIcons
                                        name="history"
                                        size={14}
                                        color={ChickIntelPalette.green1}
                                    />
                                    <Text style={styles.badgeText}>
                                        DELETED ITEM
                                    </Text>
                                </View>
                                <Text style={styles.deleted}>
                                    Deleted{" "}
                                    {formatDate(new Date(item.deletedAt))}
                                </Text>
                            </View>
                            <Text style={styles.itemTitle}>{item.name}</Text>
                            <Text style={styles.meta}>
                                {item.type} | {item.unit}
                            </Text>
                            <View style={styles.metrics}>
                                <Text style={styles.metric}>
                                    Quantity: {item.qty}
                                </Text>
                                <Text style={styles.metric}>
                                    Total: {item.totalQty}
                                </Text>
                                <Text style={styles.metric}>
                                    Purchased: {formatDate(item.orderDate)}
                                </Text>
                                {item.expirationDate ? (
                                    <Text style={styles.metric}>
                                        Expires:{" "}
                                        {formatDate(item.expirationDate)}
                                    </Text>
                                ) : null}
                            </View>
                        </BlurCard>
                    ))}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: ChickIntelPalette.canvas },
    safeArea: { flex: 1 },
    scroll: { flex: 1 },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        marginTop: 10,
        marginBottom: 12,
    },
    headerButton: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
    },
    title: {
        flex: 1,
        textAlign: "center",
        fontFamily: ChickFont.display,
        fontSize: 19,
        fontWeight: "800",
        color: ChickIntelPalette.gray1,
    },
    searchFilterContainer: {
        paddingHorizontal: 20,
        gap: 8,
        marginBottom: 4,
    },
    searchBar: {
        minHeight: 42,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: ChickIntelPalette.gray2,
    },
    searchInput: {
        flex: 1,
        minWidth: 0,
        paddingVertical: 9,
        fontFamily: ChickFont.sans,
        fontSize: 13,
        color: ChickIntelPalette.gray1,
    },
    filterPillsRow: {
        gap: 8,
        paddingVertical: 2,
    },
    filterChip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
    },
    filterChipActive: {
        backgroundColor: ChickIntelPalette.green1,
        borderColor: ChickIntelPalette.green1,
    },
    filterChipText: {
        fontFamily: ChickFont.sans,
        fontSize: 11,
        fontWeight: "700",
        color: ChickIntelPalette.gray1,
    },
    filterChipTextActive: {
        color: "#FFFFFF",
    },
    content: { padding: 20, gap: 10, paddingBottom: 30 },
    card: {
        padding: 16,
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: ChickIntelPalette.gray2,
        shadowColor: "#161E1A",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: ChickIntelPalette.lightGreen,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
    },
    badgeText: {
        fontFamily: ChickFont.sans,
        fontSize: 11,
        fontWeight: "800",
        color: ChickIntelPalette.green1,
    },
    deleted: {
        flex: 1,
        textAlign: "right",
        fontFamily: ChickFont.sans,
        fontSize: 10,
        color: ChickIntelPalette.textMuted,
    },
    itemTitle: {
        marginTop: 10,
        fontFamily: ChickFont.display,
        fontSize: 16,
        fontWeight: "800",
        color: ChickIntelPalette.gray1,
    },
    meta: {
        marginTop: 2,
        fontFamily: ChickFont.sans,
        fontSize: 11,
        color: ChickIntelPalette.textMuted,
    },
    metrics: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
    metric: {
        fontFamily: ChickFont.sans,
        fontSize: 11,
        color: ChickIntelPalette.gray1,
        backgroundColor: ChickIntelPalette.lightGreen,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 8,
    },
    empty: {
        textAlign: "center",
        paddingVertical: 20,
        fontFamily: ChickFont.sans,
        fontSize: 14,
        color: ChickIntelPalette.textMuted,
    },
});
