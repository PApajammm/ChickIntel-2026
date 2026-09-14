import BackgroundGradient from "@/assets_imported/background-gradient.svg";
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

function formatDate(value: Date) {
  return Number.isNaN(value.getTime())
    ? "Date unavailable"
    : value.toLocaleDateString();
}

export default function InventoryHistoryScreen() {
  const router = useRouter();
  const { activeFarm } = useAuth();
  const [items, setItems] = useState<InventoryHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
            onPress={() => router.replace("/(tabs)/inventory" as any)}
            accessibilityRole="button"
            accessibilityLabel="Back to inventory"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
          </Pressable>
          <Text style={styles.title}>Inventory History</Text>
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
            <Text style={styles.empty}>No deleted inventory items yet.</Text>
          ) : null}
          {items.map((item) => (
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
                  <Text style={styles.badgeText}>DELETED ITEM</Text>
                </View>
                <Text style={styles.deleted}>
                  Deleted {formatDate(new Date(item.deletedAt))}
                </Text>
              </View>
              <Text style={styles.itemTitle}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.type} | {item.unit}
              </Text>
              <View style={styles.metrics}>
                <Text style={styles.metric}>Quantity: {item.qty}</Text>
                <Text style={styles.metric}>Total: {item.totalQty}</Text>
                <Text style={styles.metric}>
                  Purchased: {formatDate(item.orderDate)}
                </Text>
                {item.expirationDate ? (
                  <Text style={styles.metric}>
                    Expires: {formatDate(item.expirationDate)}
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
  screen: { flex: 1, backgroundColor: ChickIntelPalette.light1 },
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
  content: { padding: 20, gap: 10, paddingBottom: 30 },
  card: { padding: 16, backgroundColor: "rgba(255,255,255,0.94)" },
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
    backgroundColor: "rgba(49,118,103,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontFamily: ChickFont.display,
    fontSize: 11,
    fontWeight: "800",
    color: ChickIntelPalette.green1,
  },
  deleted: {
    flex: 1,
    textAlign: "right",
    fontFamily: ChickFont.sans,
    fontSize: 10,
    color: ChickIntelPalette.gray2,
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
    color: ChickIntelPalette.gray2,
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
  empty: {
    textAlign: "center",
    paddingVertical: 20,
    fontFamily: ChickFont.sans,
    fontSize: 14,
    color: ChickIntelPalette.gray2,
  },
});
