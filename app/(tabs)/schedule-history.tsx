import { BlurCard } from "@/components/ui/blur-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import {
    fetchDeletedScheduleTasks,
    type ScheduleHistoryItem,
} from "@/utils/supabase-schedule-history";
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

function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? "Date unavailable"
        : date.toLocaleDateString();
}

type SortOption = "newest" | "oldest" | "title_asc" | "title_desc";

export default function ScheduleHistoryScreen() {
    const router = useRouter();
    const { activeFarm } = useAuth();
    const [items, setItems] = useState<ScheduleHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Search, Filter & Sort State
    const [searchQuery, setSearchQuery] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("all");
    const [sortOption, setSortOption] = useState<SortOption>("newest");

    const load = useCallback(async () => {
        if (!activeFarm?.id) {
            setItems([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            setItems(await fetchDeletedScheduleTasks(activeFarm.id));
        } catch (value) {
            setError(
                value instanceof Error
                    ? value.message
                    : "Unable to load schedule history.",
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

    // Extract unique categories
    const categories = useMemo(() => {
        const set = new Set<string>();
        items.forEach((item) => {
            if (item.category?.trim()) {
                set.add(item.category.trim());
            }
        });
        return Array.from(set).sort();
    }, [items]);

    // Filter and sort items
    const filteredItems = useMemo(() => {
        let result = [...items];

        // Search query
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            result = result.filter((item) => {
                const titleMatch = (item.title || "").toLowerCase().includes(q);
                const categoryMatch = (item.category || "")
                    .toLowerCase()
                    .includes(q);
                const repeatMatch = (item.repeat || "")
                    .toLowerCase()
                    .includes(q);
                const timeMatch = (item.time || "").toLowerCase().includes(q);
                return titleMatch || categoryMatch || repeatMatch || timeMatch;
            });
        }

        // Category filter
        if (categoryFilter !== "all") {
            result = result.filter(
                (item) =>
                    item.category?.trim().toLowerCase() ===
                    categoryFilter.toLowerCase(),
            );
        }

        // Sorting
        result.sort((a, b) => {
            if (sortOption === "newest") {
                return (
                    new Date(b.deletedAt).getTime() -
                    new Date(a.deletedAt).getTime()
                );
            }
            if (sortOption === "oldest") {
                return (
                    new Date(a.deletedAt).getTime() -
                    new Date(b.deletedAt).getTime()
                );
            }
            if (sortOption === "title_asc") {
                return (a.title || "").localeCompare(b.title || "");
            }
            if (sortOption === "title_desc") {
                return (b.title || "").localeCompare(a.title || "");
            }
            return 0;
        });

        return result;
    }, [items, searchQuery, categoryFilter, sortOption]);

    const cycleSortOption = () => {
        if (sortOption === "newest") setSortOption("oldest");
        else if (sortOption === "oldest") setSortOption("title_asc");
        else if (sortOption === "title_asc") setSortOption("title_desc");
        else setSortOption("newest");
    };

    const getSortLabel = () => {
        switch (sortOption) {
            case "newest":
                return "Deleted: Newest";
            case "oldest":
                return "Deleted: Oldest";
            case "title_asc":
                return "Title: A-Z";
            case "title_desc":
                return "Title: Z-A";
        }
    };

    return (
        <View style={styles.screen}>
            <SafeAreaView style={styles.safeArea} edges={["top"]}>
                <View style={styles.header}>
                    <Pressable
                        style={styles.headerButton}
                        onPress={() =>
                            router.replace("/(tabs)/schedule" as any)
                        }
                        accessibilityRole="button"
                        accessibilityLabel="Back to schedule"
                    >
                        <MaterialCommunityIcons
                            name="arrow-left"
                            size={24}
                            color={ChickIntelPalette.gray1}
                        />
                    </Pressable>
                    <Text style={styles.title}>Schedule History</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Search & Filter Bar */}
                <View style={styles.searchFilterContainer}>
                    <View style={styles.searchBar}>
                        <MaterialCommunityIcons
                            name="magnify"
                            size={20}
                            color={ChickIntelPalette.gray1}
                        />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search deleted task title, category..."
                            placeholderTextColor={ChickIntelPalette.gray2}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery.length > 0 ? (
                            <Pressable
                                onPress={() => setSearchQuery("")}
                                hitSlop={8}
                                style={styles.searchClearBtn}
                            >
                                <MaterialCommunityIcons
                                    name="close-circle"
                                    size={16}
                                    color={ChickIntelPalette.gray2}
                                />
                            </Pressable>
                        ) : null}
                    </View>

                    {/* Filter and Sort Pills */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterPillsRow}
                    >
                        <Pressable
                            onPress={cycleSortOption}
                            style={[styles.filterChip, styles.sortChip]}
                        >
                            <MaterialCommunityIcons
                                name="swap-vertical"
                                size={14}
                                color={ChickIntelPalette.green1}
                            />
                            <Text style={styles.filterChipText}>
                                {getSortLabel()}
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

                        {categories.map((cat) => (
                            <Pressable
                                key={cat}
                                onPress={() => setCategoryFilter(cat)}
                                style={[
                                    styles.filterChip,
                                    categoryFilter === cat &&
                                        styles.filterChipActive,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.filterChipText,
                                        categoryFilter === cat &&
                                            styles.filterChipTextActive,
                                    ]}
                                >
                                    {cat}
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
                            No deleted schedule tasks yet.
                        </Text>
                    ) : null}
                    {!loading &&
                    !error &&
                    items.length > 0 &&
                    filteredItems.length === 0 ? (
                        <View style={styles.emptyWrap}>
                            <Text style={styles.empty}>
                                No deleted tasks match your filter.
                            </Text>
                            <Pressable
                                onPress={() => {
                                    setSearchQuery("");
                                    setCategoryFilter("all");
                                }}
                                style={styles.resetFilterBtn}
                            >
                                <Text style={styles.resetFilterText}>
                                    Clear Filters
                                </Text>
                            </Pressable>
                        </View>
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
                                        DELETED TASK
                                    </Text>
                                </View>
                                <Text style={styles.deleted}>
                                    Deleted {formatDate(item.deletedAt)}
                                </Text>
                            </View>
                            <Text style={styles.itemTitle}>{item.title}</Text>
                            <Text style={styles.meta}>
                                {item.category} | {item.repeat} | Starts{" "}
                                {formatDate(item.startDate)}
                            </Text>
                            <View style={styles.metrics}>
                                <Text style={styles.metric}>
                                    Time: {item.time}
                                </Text>
                                <Text style={styles.metric}>
                                    Category: {item.category}
                                </Text>
                                {item.endDate ? (
                                    <Text style={styles.metric}>
                                        Ends: {formatDate(item.endDate)}
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
    searchClearBtn: {
        alignItems: "center",
        justifyContent: "center",
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
    sortChip: {
        backgroundColor: ChickIntelPalette.lightGreen,
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
    emptyWrap: {
        alignItems: "center",
    },
    resetFilterBtn: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: ChickIntelPalette.lightGreen,
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
    },
    resetFilterText: {
        fontFamily: ChickFont.sans,
        fontSize: 12,
        fontWeight: "700",
        color: ChickIntelPalette.green1,
    },
});
