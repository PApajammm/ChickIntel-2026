import BackgroundGradient from "@/assets_imported/background-gradient.svg";
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
    : date.toLocaleDateString();
}

export default function ScheduleHistoryScreen() {
  const router = useRouter();
  const { activeFarm } = useAuth();
  const [items, setItems] = useState<ScheduleHistoryItem[]>([]);
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
            onPress={() => router.replace("/(tabs)/schedule" as any)}
            accessibilityRole="button"
            accessibilityLabel="Back to schedule"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
          </Pressable>
          <Text style={styles.title}>Schedule History</Text>
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
            <Text style={styles.empty}>No deleted schedule tasks yet.</Text>
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
                  <Text style={styles.badgeText}>DELETED TASK</Text>
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
                <Text style={styles.metric}>Time: {item.time}</Text>
                <Text style={styles.metric}>Category: {item.category}</Text>
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
    color: ChickIntelPalette.textMuted,
  },
});
