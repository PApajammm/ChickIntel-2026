import BackgroundGradient from "@/assets_imported/background-gradient.svg";
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
      <BackgroundGradient
        width="110%"
        height="110%"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      />
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
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
          </Pressable>
          <Text style={styles.title}>Chicken Batch History</Text>
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
              intensity={20}
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
  screen: { flex: 1, backgroundColor: ChickIntelPalette.light1 },
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
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.green1,
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
  content: { padding: 20, gap: 10, paddingBottom: 30 },
  card: { padding: 16, backgroundColor: "rgba(255,255,255,0.94)" },
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
    backgroundColor: "rgba(49,118,103,0.12)",
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
    fontSize: 10,
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
    fontSize: 11,
    color: ChickIntelPalette.textMuted,
  },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  metric: {
    fontFamily: ChickFont.sans,
    fontSize: 11,
    color: ChickIntelPalette.gray1,
    backgroundColor: "rgba(244,248,247,0.8)",
    paddingHorizontal: 8,
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
