import { BlurCard } from "@/components/ui/blur-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import { getCurrentBatchAgeLabel } from "@/utils/batch-store";
import {
    fetchDeletedChickenBatches,
    type ChickenBatchHistoryItem,
} from "@/services/chicken/supabase-chicken-batch-history";
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
        : date.toLocaleString();
}

type SortOption = "newest" | "oldest" | "breed_asc" | "breed_desc";

export default function ChickenBatchHistoryScreen() {
    const router = useRouter();
    const { activeFarm } = useAuth();
    const [items, setItems] = useState<ChickenBatchHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortOption, setSortOption] = useState<SortOption>("newest");

    const filteredItems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        const result = items.filter((item) => {
            if (!query) return true;
            return [item.id, item.breed, item.createdAt, item.deletedAt]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query));
        });

        return result.sort((a, b) => {
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
            const breedA = (a.breed || "General batch").toLowerCase();
            const breedB = (b.breed || "General batch").toLowerCase();
            return sortOption === "breed_asc"
                ? breedA.localeCompare(breedB)
                : breedB.localeCompare(breedA);
        });
    }, [items, searchQuery, sortOption]);

    const cycleSortOption = () => {
        setSortOption((current) => {
            if (current === "newest") return "oldest";
            if (current === "oldest") return "breed_asc";
            if (current === "breed_asc") return "breed_desc";
            return "newest";
        });
    };

    const sortLabel = {
        newest: "Deleted: Newest",
        oldest: "Deleted: Oldest",
        breed_asc: "Breed: A-Z",
        breed_desc: "Breed: Z-A",
    }[sortOption];

    const loadHistory = useCallback(async () => {
        if (!activeFarm?.id) {
            setItems([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            setItems(await fetchDeletedChickenBatches(activeFarm.id));
        } catch (loadError) {
            setError(
                loadError instanceof Error
                    ? loadError.message
                    : "Unable to load batch history.",
            );
        } finally {
            setLoading(false);
        }
    }, [activeFarm?.id]);

    useFocusEffect(
        useCallback(() => {
            void loadHistory();
        }, [loadHistory]),
    );

    return (
        <View style={styles.screen}>
            <SafeAreaView style={styles.safeArea} edges={["top"]}>
                <View style={styles.header}>
                    <Pressable
                        style={styles.headerButton}
                        onPress={() =>
                            router.replace({
                                pathname: "/(tabs)/profiles" as any,
                                params: { mode: "chicken" },
                            })
                        }
                        accessibilityRole="button"
                        accessibilityLabel="Back to chicken batches"
                    >
                        <MaterialCommunityIcons
                            name="arrow-left"
                            size={24}
                            color={ChickIntelPalette.gray1}
                        />
                    </Pressable>
                    <Text style={styles.title}>Chicken Batch History</Text>
                    <View style={{ width: 38 }} />
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
                            placeholder="Search batch #, breed, or date..."
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
                    <Pressable
                        onPress={cycleSortOption}
                        style={styles.sortChip}
                        accessibilityRole="button"
                        accessibilityLabel={`Sort history: ${sortLabel}`}
                    >
                        <MaterialCommunityIcons
                            name="sort-variant"
                            size={16}
                            color={ChickIntelPalette.green1}
                        />
                        <Text style={styles.sortChipText}>{sortLabel}</Text>
                    </Pressable>
                </View>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {loading ? (
                        <ActivityIndicator color={ChickIntelPalette.green1} />
                    ) : null}
                    {error ? (
                        <Text style={styles.emptyText}>{error}</Text>
                    ) : null}
                    {!loading && !error && items.length === 0 ? (
                        <Text style={styles.emptyText}>
                            No deleted chicken batches yet.
                        </Text>
                    ) : null}
                    {!loading &&
                    !error &&
                    items.length > 0 &&
                    filteredItems.length === 0 ? (
                        <Text style={styles.emptyText}>
                            No batches match your search.
                        </Text>
                    ) : null}
                    {filteredItems.map((item) => (
                        <BlurCard
                            key={item.historyId}
                            style={styles.card}
                            borderRadius={16}
                            intensity={0}
                        >
                            <View style={styles.cardHeader}>
                                <View style={styles.batchBadge}>
                                    <MaterialCommunityIcons
                                        name="history"
                                        size={14}
                                        color={ChickIntelPalette.green1}
                                    />
                                    <Text style={styles.batchText}>
                                        BATCH C
                                        {item.id
                                            .replace(/\D/g, "")
                                            .padStart(3, "0")}
                                    </Text>
                                </View>
                                <Text style={styles.deletedText}>
                                    Deleted {formatDate(item.deletedAt)}
                                </Text>
                            </View>
                            <Text style={styles.breed}>
                                {item.breed || "General batch"}
                            </Text>
                            <Text style={styles.meta}>
                                Created{" "}
                                {item.createdAt
                                    ? formatDate(item.createdAt)
                                    : "Date unavailable"}
                            </Text>
                            <View style={styles.metrics}>
                                <Text style={styles.metric}>
                                    Females: {item.femaleCount}
                                </Text>
                                <Text style={styles.metric}>
                                    Males: {item.maleCount}
                                </Text>
                                <Text style={styles.metric}>
                                    Age: {getCurrentBatchAgeLabel(item)}
                                </Text>
                                <Text style={styles.metric}>
                                    Loss: {item.killedCount}
                                </Text>
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
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        marginTop: 10,
        marginBottom: 12,
    },
    headerButton: {
        width: 38,
        height: 38,
        backgroundColor: "transparent",
        borderWidth: 0,
        alignItems: "center",
        justifyContent: "center",
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
    sortChip: {
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: ChickIntelPalette.lightGreen,
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
    },
    sortChipText: {
        fontFamily: ChickFont.sans,
        fontSize: 11,
        fontWeight: "700",
        color: ChickIntelPalette.green1,
    },
    scroll: { flex: 1 },
    content: { padding: 20, gap: 12, paddingBottom: 30 },
    card: {
        padding: 16,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
        shadowColor: "#000",
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 2,
    },
    cardHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
    },
    batchBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: ChickIntelPalette.lightGreen,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
    },
    batchText: {
        fontFamily: ChickFont.display,
        fontSize: 12,
        fontWeight: "800",
        color: ChickIntelPalette.green1,
    },
    deletedText: {
        flex: 1,
        textAlign: "right",
        fontFamily: ChickFont.sans,
        fontSize: 11,
        color: ChickIntelPalette.textMuted,
    },
    breed: {
        marginTop: 10,
        fontFamily: ChickFont.display,
        fontSize: 16,
        fontWeight: "800",
        color: ChickIntelPalette.gray1,
    },
    meta: {
        marginTop: 2,
        fontFamily: ChickFont.sans,
        fontSize: 12,
        color: ChickIntelPalette.textMuted,
    },
    metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
    metric: {
        fontFamily: ChickFont.sans,
        fontSize: 12,
        fontWeight: "600",
        color: ChickIntelPalette.gray1,
        backgroundColor: ChickIntelPalette.lightGreen,
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    emptyText: {
        textAlign: "center",
        paddingVertical: 20,
        fontFamily: ChickFont.sans,
        fontSize: 14,
        color: ChickIntelPalette.textMuted,
    },
});
