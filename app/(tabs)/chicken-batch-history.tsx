import { BlurCard } from "@/components/ui/blur-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import { getCurrentBatchAgeLabel } from "@/utils/batch-store";
import {
    fetchDeletedChickenBatches,
    type ChickenBatchHistoryItem,
} from "@/utils/supabase-chicken-batch-history";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : date.toLocaleString();
}

export default function ChickenBatchHistoryScreen() {
  const router = useRouter();
  const { activeFarm } = useAuth();
  const [items, setItems] = useState<ChickenBatchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            <MaterialCommunityIcons name="arrow-left" size={24} color={ChickIntelPalette.gray1} />
          </Pressable>
          <Text style={styles.title}>Chicken Batch History</Text>
          <View style={{ width: 38 }} />
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <ActivityIndicator color={ChickIntelPalette.green1} />
          ) : null}
          {error ? <Text style={styles.emptyText}>{error}</Text> : null}
          {!loading && !error && items.length === 0 ? (
            <Text style={styles.emptyText}>
              No deleted chicken batches yet.
            </Text>
          ) : null}
          {items.map((item) => (
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
                    BATCH C{item.id.replace(/\D/g, "").padStart(3, "0")}
                  </Text>
                </View>
                <Text style={styles.deletedText}>
                  Deleted {formatDate(item.deletedAt)}
                </Text>
              </View>
              <Text style={styles.breed}>{item.breed || "General batch"}</Text>
              <Text style={styles.meta}>
                Created{" "}
                {item.createdAt
                  ? formatDate(item.createdAt)
                  : "Date unavailable"}
              </Text>
              <View style={styles.metrics}>
                <Text style={styles.metric}>Females: {item.femaleCount}</Text>
                <Text style={styles.metric}>Males: {item.maleCount}</Text>
                <Text style={styles.metric}>
                  Age: {getCurrentBatchAgeLabel(item)}
                </Text>
                <Text style={styles.metric}>Loss: {item.killedCount}</Text>
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
