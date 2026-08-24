import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import ChickenKpiArt from "@/assets_imported/card-chicken.svg";
import EggsKpiArt from "@/assets_imported/card-eggs.svg";
import FeedsKpiArt from "@/assets_imported/card-feeds.svg";
import ScheduleIcon from "@/assets_imported/icon-calendar.svg";
import HealthIcon from "@/assets_imported/icon-health.svg";
import InventoryIcon from "@/assets_imported/icon-inventory.svg";
import JournalIcon from "@/assets_imported/icon-journal.svg";
import BatchProfileIcon from "@/assets_imported/icon-profile.svg";
import ReportsIcon from "@/assets_imported/icon-reports.svg";
import { HeartMonitorIcon } from "@/components/icons/heart-monitor-icon";
import { BlurCard } from "@/components/ui/blur-card";
import { PrimaryFab } from "@/components/ui/primary-fab";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { getFarmColors } from "@/constants/farm-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/providers/auth-provider";
import {
  fetchHomeKpiSnapshot,
  formatBirdAdditionTrend,
  formatKpiTrend,
  type HomeKpiPeriod,
} from "@/utils/home-kpis";
import { logError, logStep } from "@/utils/logger";
import {
  getFeaturedBreedCards,
  type FeaturedBreedCard,
} from "@/utils/recent-breed-scans";
import {
  moderateScale,
  responsiveFontSize,
  scale,
  useResponsiveMetrics,
  verticalScale,
} from "@/utils/responsive";

type KpiCardData = {
  title: string;
  value: string;
  trend: string;
  period: string;
  background: "primarySoft" | "accentSoft";
  Artwork: ComponentType<{ width?: number; height?: number }>;
  trendByPeriod?: Record<HomeKpiPeriod, string>;
  valueByPeriod?: Record<HomeKpiPeriod, string>;
};

type QuickActionData = {
  title: string;
  Icon: ComponentType<{ width?: number; height?: number }>;
};

const initialKpiCards: KpiCardData[] = [
  {
    title: "Total Birds",
    value: "0",
    trend: "+0% this month",
    period: "30 days",
    background: "primarySoft",
    Artwork: ChickenKpiArt,
  },
  {
    title: "Collected Eggs",
    value: "0",
    trend: "+0% this week",
    period: "7 days",
    background: "accentSoft",
    Artwork: EggsKpiArt,
  },
  {
    title: "Feeds Consumed",
    value: "0",
    trend: "+0% this week",
    period: "7 days",
    background: "primarySoft",
    Artwork: FeedsKpiArt,
  },
];

const quickActions: QuickActionData[] = [
  { title: "Batch Profile", Icon: BatchProfileIcon },
  { title: "Health", Icon: HealthIcon },
  { title: "Behavior Journal", Icon: JournalIcon },
  { title: "Health Monitoring", Icon: HeartMonitorIcon },
  { title: "Inventory", Icon: InventoryIcon },
  { title: "Schedule", Icon: ScheduleIcon },
  { title: "Reports", Icon: ReportsIcon },
];

const PERIOD_OPTIONS = ["7 days", "30 days", "12 months"] as const;

const walkingChickenGif = require("../../assets/images/Chicken walkinggif-clean.gif");

/** Space reserved for custom tab bar + FAB clearance */
const TAB_BAR_OFFSET = 55;
/** Place FAB this many pixels above the top of the bottom tab bar */
const FAB_OFFSET_FROM_TAB_TOP = 50;

function hexToRgba(hex: string, alpha = 1) {
  const h = hex.replace("#", "");
  const bigint =
    h.length === 3
      ? h
        .split("")
        .map((c) => c + c)
        .join("")
      : h;

  const n = parseInt(bigint, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function withAlpha(color: string, alpha: number) {
  if (color.startsWith("#")) return hexToRgba(color, alpha);
  return color;
}

function formatTodayLabel() {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = getFarmColors(colorScheme);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { activeFarm, profile } = useAuth();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const { width } = useWindowDimensions();
  const { scale: rs, moderateScale: rms } = useResponsiveMetrics();

  /** Quick-action SVG size: ~1.8× previous 34px icon size, scaled */
  const QUICK_ACTION_ICON_SIZE = Math.round(rms(45) * 1.8);

  const featureCardWidth = Math.min(width * 0.56, rs(228));
  const featureCardGap = rms(10);
  const snapInterval = featureCardWidth + featureCardGap;
  const sideInset = Math.max((width - featureCardWidth) / 2, rms(18));
  const scrollX = useRef(new Animated.Value(0)).current;
  // Walking range: 40% of screen width so the chicken stays on screen on all sizes
  const walkRange = Math.round(width * 0.4);
  const walkingX = useRef(new Animated.Value(Math.round(width * 0.15))).current;
  const [isFacingRight, setIsFacingRight] = useState(true);
  const [isQuickActionsExpanded, setIsQuickActionsExpanded] = useState(false);
  const roleAnim = useRef(new Animated.Value(1)).current;
  const roleColor = useMemo(() => {
    return roleAnim.interpolate({
      inputRange: [0.7, 1],
      outputRange: ["#317667", "#1B4A40"],
    });
  }, [roleAnim]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(roleAnim, {
          toValue: 0.7,
          duration: 1500,
          useNativeDriver: false,
        }),
        Animated.timing(roleAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: false,
        }),
      ]),
      { iterations: 5 }
    ).start();
  }, [roleAnim]);

  const dynamicKpiCardWidth = useMemo(() => {
    if (width < 360) return Math.floor(width * 0.5);
    if (width < 430) return Math.floor(width * 0.48);
    return Math.min(Math.floor(width * 0.44), rs(240));
  }, [width, rs]);

  const dynamicKpiArtworkSize = useMemo(() => {
    return Math.min(rs(110), Math.floor(dynamicKpiCardWidth * 0.5));
  }, [rs, dynamicKpiCardWidth]);
  const [kpiCards, setKpiCards] = useState<KpiCardData[]>(initialKpiCards);
  const [featuredCards, setFeaturedCards] = useState<FeaturedBreedCard[]>(() =>
    getFeaturedBreedCards(),
  );
  const [todayLabel, setTodayLabel] = useState(formatTodayLabel);
  const [periodByTitle, setPeriodByTitle] = useState<Record<string, string>>({
    "Total Birds": "30 days",
    "Collected Eggs": "7 days",
    "Feeds Consumed": "7 days",
  });
  const [periodPickerFor, setPeriodPickerFor] = useState<string | null>(null);

  useEffect(() => {
    logStep("HomeScreen mounted", { screen: "tabs/index" });
  }, []);

  const openScannerWithPermission = useCallback(async () => {
    if (Platform.OS !== "web" && !cameraPermission?.granted) {
      try {
        const nextPermission = await requestCameraPermission();
        if (!nextPermission.granted) {
          logStep("Scanner access attempted without permission", {
            source: "home_fab_or_quick_action",
            canAskAgain: nextPermission.canAskAgain,
          });
          Alert.alert(
            "Camera access needed",
            nextPermission.canAskAgain
              ? "Allow camera access to use the scanner."
              : "Camera access is blocked. Enable it in your device settings to use the scanner.",
          );
          return;
        }
      } catch (e) {
        logError("Camera permission request failed", e);
        Alert.alert(
          "Camera error",
          "Unable to request camera access right now.",
        );
        return;
      }
    }

    router.push("/(tabs)/scanner");
  }, [cameraPermission?.granted, requestCameraPermission, router]);

  useEffect(() => {
    setTodayLabel(formatTodayLabel());
    const id = setInterval(() => setTodayLabel(formatTodayLabel()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runCycle = () => {
      if (cancelled) return;

      Animated.timing(walkingX, {
        toValue: walkRange,
        duration: 2500,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || cancelled) return;
        setIsFacingRight(false);

        Animated.timing(walkingX, {
          toValue: -walkRange,
          duration: 2500,
          easing: Easing.linear,
          useNativeDriver: true,
        }).start(({ finished: finishedBack }) => {
          if (!finishedBack || cancelled) return;
          setIsFacingRight(true);
          runCycle();
        });
      });
    };

    runCycle();
    return () => {
      cancelled = true;
    };
  }, [walkingX, walkRange]);

  const walkingScaleX = isFacingRight ? 1 : -1;

  useFocusEffect(
    useCallback(() => {
      const nextCards = getFeaturedBreedCards();
      setFeaturedCards(nextCards);
      logStep("Home featured cards refreshed", {
        source: "in_memory_recent_scans",
        cards: nextCards.length,
      });
    }, []),
  );

  const fetchKpis = useCallback(async (): Promise<KpiCardData[]> => {
    if (!activeFarm?.id) {
      return initialKpiCards;
    }

    const snapshot = await fetchHomeKpiSnapshot(activeFarm.id);
    const birdsPeriod = (periodByTitle["Total Birds"] ??
      "30 days") as HomeKpiPeriod;
    const eggsPeriod = (periodByTitle["Collected Eggs"] ??
      "7 days") as HomeKpiPeriod;
    const feedPeriod = (periodByTitle["Feeds Consumed"] ??
      "7 days") as HomeKpiPeriod;

    return [
      {
        ...initialKpiCards[0],
        value: String(snapshot.birdAdditionsByPeriod[birdsPeriod].current),
        period: birdsPeriod,
        valueByPeriod: Object.fromEntries(
          PERIOD_OPTIONS.map((period) => [
            period,
            String(snapshot.birdAdditionsByPeriod[period].current),
          ]),
        ) as Record<HomeKpiPeriod, string>,
        trendByPeriod: Object.fromEntries(
          PERIOD_OPTIONS.map((period) => [
            period,
            formatBirdAdditionTrend(
              snapshot.birdAdditionsByPeriod[period].current,
              snapshot.birdAdditionsByPeriod[period].previous,
            ),
          ]),
        ) as Record<HomeKpiPeriod, string>,
        trend: `${formatBirdAdditionTrend(
          snapshot.birdAdditionsByPeriod[birdsPeriod].current,
          snapshot.birdAdditionsByPeriod[birdsPeriod].previous,
        )} ${periodLabelFromPeriod(birdsPeriod)}`,
      },
      {
        ...initialKpiCards[1],
        value: String(snapshot.collectedEggsByPeriod[eggsPeriod].current),
        period: eggsPeriod,
        valueByPeriod: Object.fromEntries(
          PERIOD_OPTIONS.map((period) => [
            period,
            String(snapshot.collectedEggsByPeriod[period].current),
          ]),
        ) as Record<HomeKpiPeriod, string>,
        trendByPeriod: Object.fromEntries(
          PERIOD_OPTIONS.map((period) => [
            period,
            formatKpiTrend(
              snapshot.collectedEggsByPeriod[period].current,
              snapshot.collectedEggsByPeriod[period].previous,
            ),
          ]),
        ) as Record<HomeKpiPeriod, string>,
        trend: `${formatKpiTrend(
          snapshot.collectedEggsByPeriod[eggsPeriod].current,
          snapshot.collectedEggsByPeriod[eggsPeriod].previous,
        )} ${periodLabelFromPeriod(eggsPeriod)}`,
      },
      {
        ...initialKpiCards[2],
        value: String(snapshot.feedQtyByPeriod[feedPeriod].current),
        period: feedPeriod,
        valueByPeriod: Object.fromEntries(
          PERIOD_OPTIONS.map((period) => [
            period,
            String(snapshot.feedQtyByPeriod[period].current),
          ]),
        ) as Record<HomeKpiPeriod, string>,
        trendByPeriod: Object.fromEntries(
          PERIOD_OPTIONS.map((period) => [
            period,
            formatKpiTrend(
              snapshot.feedQtyByPeriod[period].current,
              snapshot.feedQtyByPeriod[period].previous,
            ),
          ]),
        ) as Record<HomeKpiPeriod, string>,
        trend: `${formatKpiTrend(
          snapshot.feedQtyByPeriod[feedPeriod].current,
          snapshot.feedQtyByPeriod[feedPeriod].previous,
        )} kg ${periodLabelFromPeriod(feedPeriod)}`,
      },
    ];
  }, [activeFarm?.id, periodByTitle]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void (async () => {
        try {
          logStep("HomeScreen KPI fetch start");

          const next = await fetchKpis();
          if (!active) return;

          setKpiCards(next);
          logStep("HomeScreen KPI fetch complete", {
            kpis: next.map((k) => ({
              title: k.title,
              value: k.value,
              trend: k.trend,
            })),
          });
        } catch (e) {
          if (!active) return;
          logError("HomeScreen KPI fetch failed", e);
          setKpiCards(initialKpiCards);
        }
      })();

      return () => {
        active = false;
      };
    }, [fetchKpis]),
  );

  const handleQuickActionPress = (title: string) => {
    if (title === "Batch Profile") {
      router.push("/(tabs)/profiles");
      return;
    }

    if (title === "Health") {
      void openScannerWithPermission();
      return;
    }

    if (title === "Behavior Journal") {
      router.push("/(tabs)/journal" as import("expo-router").Href);
      return;
    }

    if (title === "Health Monitoring") {
      router.push("/(tabs)/health-monitoring" as import("expo-router").Href);
      return;
    }

    if (title === "Reports") {
      router.push("/(tabs)/reports" as import("expo-router").Href);
      return;
    }

    if (title === "Inventory") {
      router.push("/(tabs)/inventory" as import("expo-router").Href);
      return;
    }

    if (title === "Schedule") {
      router.push("/(tabs)/schedule" as import("expo-router").Href);
      return;
    }

    logStep("Home quick action tapped", { action: title });
  };

  function periodLabelFromPeriod(period: string) {
    if (period.includes("7")) return "this week";
    if (period.includes("30")) return "this month";
    if (period.includes("12")) return "this year";
    // fallback — try to infer days
    if (period.includes("day")) return "this period";
    return period;
  }

  const displayKpis = kpiCards.map((k) => {
    const period = periodByTitle[k.title] ?? k.period;
    if (k.title === "Feeds Consumed") {
      const rawTrend = k.trendByPeriod?.[period as HomeKpiPeriod] ?? "+0%";
      const cleanTrend = rawTrend.replace(/^-/, "+");
      return {
        ...k,
        value: k.valueByPeriod?.[period as HomeKpiPeriod] ?? k.value,
        period,
        trend: `${cleanTrend} kg ${periodLabelFromPeriod(period)}`,
      };
    }

    if (k.title === "Total Birds") {
      const rawTrend = k.trendByPeriod?.[period as HomeKpiPeriod] ?? "+0%";
      const cleanTrend = rawTrend.replace(/^-/, "+");
      return {
        ...k,
        value: k.valueByPeriod?.[period as HomeKpiPeriod] ?? k.value,
        period,
        trend: `${cleanTrend} ${periodLabelFromPeriod(period)}`,
      };
    }

    if (k.title === "Collected Eggs") {
      const rawTrend = k.trendByPeriod?.[period as HomeKpiPeriod] ?? "+0%";
      const cleanTrend = rawTrend.replace(/^-/, "+");
      return {
        ...k,
        value: k.valueByPeriod?.[period as HomeKpiPeriod] ?? k.value,
        period,
        trend: `${cleanTrend} ${periodLabelFromPeriod(period)}`,
      };
    }

    const rawPrefix = k.trend?.split(" ")[0] ?? k.trend ?? "";
    const prefix = rawPrefix.replace(/^-/, "+");
    const suffix = periodLabelFromPeriod(period);
    const trend = prefix ? `${prefix} ${suffix}` : k.trend;

    return {
      ...k,
      period,
      trend,
    };
  });

  function applyPeriodChoice(choice: (typeof PERIOD_OPTIONS)[number]) {
    const kpiTitle = periodPickerFor;
    if (!kpiTitle) return;
    setPeriodByTitle((prev) => ({
      ...prev,
      [kpiTitle]: choice,
    }));
    setPeriodPickerFor(null);
    logStep("KPI period selected", {
      kpi: kpiTitle,
      period: choice,
    });
  }

  const fabBottom =
    insets.bottom + TAB_BAR_OFFSET - 2 - FAB_OFFSET_FROM_TAB_TOP;

  const displayName = profile?.display_name?.trim() || "there";
  const roleLabel = profile?.is_admin ? "Admin Owner" : `Farmer ${displayName}`;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <BackgroundGradient
        width="110%"
        height="110%"
        preserveAspectRatio="xMidYMid slice"
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ scale: 1.08 }, { translateY: -14 }] },
        ]}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + TAB_BAR_OFFSET + 98,
          },
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.greeting, { color: colors.text }]}>
              Welcome!
            </Text>
            <Animated.Text
              style={[
                styles.userRoleText,
                {
                  color: roleColor,
                  opacity: roleAnim,
                  textShadowColor: "rgba(49, 118, 103, 0.5)",
                  textShadowOffset: { width: 0, height: 0 },
                  textShadowRadius: 8,
                }
              ]}
            >
              {roleLabel}
            </Animated.Text>
          </View>
          <Text style={[styles.headerDateLive, { color: colors.textMuted }]}>
            {todayLabel}
          </Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.kpiRow}
        >
          {displayKpis.map((item) => {
            const Artwork = item.Artwork;
            return (
              <BlurCard
                key={item.title}
                style={[
                  styles.kpiCard,
                  {
                    width: dynamicKpiCardWidth,
                    borderColor: withAlpha(colors.border, 0.25),
                  },
                ]}
                borderRadius={10}
                intensity={18}
              >
                <View
                  style={[
                    styles.kpiTint,
                    {
                      backgroundColor: withAlpha(colors[item.background], 0.22),
                    },
                  ]}
                  pointerEvents="none"
                />

                <View style={styles.kpiTopRow}>
                  <Text
                    style={[
                      styles.kpiLabelCompact,
                      { color: colors.textMuted },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    maxFontSizeMultiplier={1.2}
                  >
                    {item.title}
                  </Text>
                  <Pressable
                    onPress={() => setPeriodPickerFor(item.title)}
                    style={[
                      styles.periodChip,
                      {
                        backgroundColor: withAlpha(colors.surface, 0.38),
                        borderColor: withAlpha(colors.border, 0.3),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodChipText,
                        { color: colors.textMuted },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      maxFontSizeMultiplier={1.2}
                    >
                      {item.period}
                    </Text>
                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={14}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>

                <View
                  style={[
                    styles.kpiBody,
                    { paddingRight: Math.floor(dynamicKpiArtworkSize * 0.45) },
                  ]}
                >
                  <Text
                    style={[styles.kpiValue, { color: colors.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                    maxFontSizeMultiplier={1.25}
                  >
                    {item.value}
                  </Text>
                  <Text
                    style={[styles.kpiTrend, { color: colors.textMuted }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    maxFontSizeMultiplier={1.2}
                  >
                    {item.trend}
                  </Text>
                </View>

                <View style={styles.kpiArtworkWrap} pointerEvents="none">
                  <Artwork
                    width={dynamicKpiArtworkSize}
                    height={dynamicKpiArtworkSize}
                  />
                </View>
              </BlurCard>
            );
          })}
        </ScrollView>

        <BlurCard
          style={[
            styles.quickActionsCard,
            {
              borderColor: withAlpha(ChickIntelPalette.green2, 0.33),
            },
          ]}
          borderRadius={10}
          intensity={18}
        >
          <View style={styles.quickActionsHeader}>
            <Pressable
              style={styles.viewAllBtn}
              onPress={() => setIsQuickActionsExpanded(!isQuickActionsExpanded)}
              accessibilityLabel={isQuickActionsExpanded ? "View Less" : "View All"}
            >
              <Text style={styles.viewAllText}>
                {isQuickActionsExpanded ? "View Less" : "View All"}
              </Text>
              <MaterialCommunityIcons
                name={isQuickActionsExpanded ? "arrow-down-circle-outline" : "arrow-right-circle-outline"}
                size={22}
                color={ChickIntelPalette.green1}
              />
            </Pressable>
          </View>
          <View style={styles.walkingGifWrap}>
            <Animated.View style={{ transform: [{ translateX: walkingX }] }}>
              <Animated.View
                style={{
                  transform: [{ scaleX: walkingScaleX }],
                }}
              >
                <Image
                  source={walkingChickenGif}
                  style={styles.walkingGif}
                  contentFit="contain"
                />
              </Animated.View>
            </Animated.View>
          </View>
          <View
            style={[
              styles.quickActionsTint,
              {
                backgroundColor: withAlpha(ChickIntelPalette.mediumGreen, 0.2),
              },
            ]}
            pointerEvents="none"
          />
          <View style={styles.quickActionsGrid}>
            {(isQuickActionsExpanded ? quickActions : quickActions.slice(0, 6)).map((item) => {
              const Icon = item.Icon;
              return (
                <Pressable
                  key={item.title}
                  onPress={() => handleQuickActionPress(item.title)}
                  style={({ pressed }) => [
                    styles.quickActionIconOnly,
                    { opacity: pressed ? 0.88 : 1 },
                  ]}
                  accessibilityLabel={item.title}
                >
                  <View style={{ alignItems: "center" }}>
                    <View style={{ alignItems: "center" }}>
                      <Icon
                        width={
                          item.title === "Health Monitoring"
                            ? QUICK_ACTION_ICON_SIZE - 10
                            : QUICK_ACTION_ICON_SIZE
                        }
                        height={
                          item.title === "Health Monitoring"
                            ? QUICK_ACTION_ICON_SIZE - 20
                            : QUICK_ACTION_ICON_SIZE
                        }
                      />
                    </View>
                    {item.title === "Health Monitoring" && (
                      <Text
                        style={{
                          marginTop: 2,
                          fontFamily: ChickFont.sans,
                          fontSize: responsiveFontSize(11),
                          fontWeight: "700",
                          color: ChickIntelPalette.green1,
                          textAlign: "center",
                          lineHeight: 13,
                        }}
                      >
                        Health{"\n"}Monitoring
                      </Text>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </BlurCard>

        <Animated.FlatList
          horizontal
          data={featuredCards}
          keyExtractor={(item) => item.id}
          initialScrollIndex={Math.min(1, featuredCards.length - 1)}
          getItemLayout={(_, index) => ({
            length: snapInterval,
            offset: snapInterval * index,
            index,
          })}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={snapInterval}
          snapToAlignment="center"
          contentContainerStyle={[
            styles.carouselContent,
            { paddingHorizontal: sideInset },
          ]}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          renderItem={({ item, index }) => {
            const inputRange = [
              (index - 1) * snapInterval,
              index * snapInterval,
              (index + 1) * snapInterval,
            ];
            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.88, 1, 0.88],
              extrapolate: "clamp",
            });
            const translateY = scrollX.interpolate({
              inputRange,
              outputRange: [9, 0, 9],
              extrapolate: "clamp",
            });
            const shadowOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.14, 0.26, 0.14],
              extrapolate: "clamp",
            });
            const imageScale = scrollX.interpolate({
              inputRange,
              outputRange: [0.96, 1.03, 0.96],
              extrapolate: "clamp",
            });
            const contentOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.74, 1, 0.74],
              extrapolate: "clamp",
            });
            const glowOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.16, 0.3, 0.16],
              extrapolate: "clamp",
            });

            return (
              <Animated.View
                style={[
                  styles.featureCardWrap,
                  {
                    width: featureCardWidth,
                    marginRight:
                      index === featuredCards.length - 1 ? 0 : featureCardGap,
                    transform: [{ scale }, { translateY }],
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.featureCard,
                    {
                      shadowColor: colors.shadow,
                      shadowOpacity,
                    },
                  ]}
                >
                  <Animated.View
                    style={[
                      styles.featureImageShell,
                      {
                        transform: [{ scale: imageScale }],
                      },
                    ]}
                  >
                    <Image
                      source={item.image}
                      style={styles.featureImage}
                      contentFit="cover"
                    />
                  </Animated.View>
                  <Animated.View
                    style={[styles.featureCopy, { opacity: contentOpacity }]}
                  >
                    <Text style={styles.featureEyebrow}>
                      {item.isDefault ? "Default Breed" : "Recent Scan"}
                    </Text>
                    <Text style={styles.featureTitle} numberOfLines={1}>
                      {item.breedName}
                    </Text>
                    <Text style={styles.featureDetail} numberOfLines={2}>
                      {item.detail}
                    </Text>
                  </Animated.View>
                </Animated.View>
              </Animated.View>
            );
          }}
        />
      </ScrollView>

      <PrimaryFab
        iconName="camera-outline"
        onPress={() => void openScannerWithPermission()}
        bottom={fabBottom}
        accessibilityLabel="Open scanner"
      />

      <Modal
        visible={periodPickerFor !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPeriodPickerFor(null)}
      >
        <Pressable
          style={styles.periodModalBackdrop}
          onPress={() => setPeriodPickerFor(null)}
        >
          <Pressable
            style={[
              styles.periodModalCard,
              {
                backgroundColor: colors.surface,
                borderColor: withAlpha(colors.border, 0.4),
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.periodModalTitle, { color: colors.text }]}>
              Reporting period
            </Text>
            {PERIOD_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => applyPeriodChoice(opt)}
                style={({ pressed }) => [
                  styles.periodOption,
                  {
                    opacity: pressed ? 0.85 : 1,
                    backgroundColor:
                      periodPickerFor && periodByTitle[periodPickerFor] === opt
                        ? withAlpha(colors.primary, 0.2)
                        : "transparent",
                  },
                ]}
              >
                <Text style={[styles.periodOptionText, { color: colors.text }]}>
                  {opt}
                </Text>
                {periodPickerFor && periodByTitle[periodPickerFor] === opt ? (
                  <MaterialCommunityIcons
                    name="check"
                    size={20}
                    color={colors.primary}
                  />
                ) : null}
              </Pressable>
            ))}
            <Pressable
              onPress={() => setPeriodPickerFor(null)}
              style={styles.periodModalCancel}
            >
              <Text
                style={[
                  styles.periodModalCancelText,
                  { color: colors.textMuted },
                ]}
              >
                Close
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.light1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: moderateScale(18),
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 16,
    gap: 12,
  },
  headerTitleWrap: {
    flex: 1,
  },
  greeting: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    lineHeight: 28,
    fontWeight: "600",
    letterSpacing: -0.65,
  },
  userRoleText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(19),
    lineHeight: 20,
    fontWeight: "700",
    color: ChickIntelPalette.green1,
    marginTop: 3,
  },
  /** Real-time date — neutral Gray 2 from ChickIntel palette */
  headerDateLive: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 40,
    fontWeight: "400",
    textAlign: "right",
    maxWidth: "58%",
    color: "#FFFFFF",
  },
  kpiRow: {
    flexDirection: "row",
    gap: moderateScale(12),
    paddingHorizontal: moderateScale(4),
  },
  kpiCard: {
    minHeight: verticalScale(170),
    paddingHorizontal: moderateScale(14),
    paddingTop: verticalScale(14),
    paddingBottom: verticalScale(12),
    overflow: "hidden",
  },
  kpiTint: {
    ...StyleSheet.absoluteFillObject,
  },
  kpiTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
  },
  kpiLabel: {
    fontFamily: ChickFont.sans,
    flex: 1,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    lineHeight: 18,
  },
  /** Prominent KPI title styling */
  kpiLabelCompact: {
    fontFamily: ChickFont.sans,
    flex: 1,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    lineHeight: 18,
  },
  periodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(4),
    borderWidth: 1,
    borderColor: "transparent",
    flexShrink: 0,
  },
  periodChipText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    letterSpacing: 0.15,
  },
  kpiBody: {
    marginTop: verticalScale(8),
    gap: 2,
    justifyContent: "flex-start",
  },
  kpiValue: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(34),
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -1,
  },
  kpiTrend: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 2,
  },
  kpiArtworkWrap: {
    position: "absolute",
    right: 2,
    bottom: -2,
    opacity: 0.95,
  },
  quickActionsCard: {
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(12),
    paddingHorizontal: moderateScale(12),
    position: "relative",
    overflow: "hidden",
  },
  quickActionsHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: verticalScale(8),
    paddingRight: moderateScale(8),
    zIndex: 10,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  viewAllText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(16),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  walkingGifWrap: {
    position: "absolute",
    bottom: 1,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    pointerEvents: "none",
  },
  walkingGif: {
    width: scale(76),
    height: verticalScale(46),
  },
  quickActionsTint: {
    ...StyleSheet.absoluteFillObject,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    paddingVertical: verticalScale(8),
  },
  quickActionIconOnly: {
    width: "33.33%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(12),
  },
  quickActionLabel: {
    marginTop: 0,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "600",
    color: ChickIntelPalette.green1,
    textAlign: "center",
    lineHeight: 12,
  },
  carouselContent: {
    paddingTop: 2,
    paddingBottom: 6,
  },
  featureCardWrap: {
    borderRadius: 10,
  },
  featureCard: {
    height: verticalScale(175),
    borderRadius: 10,
    overflow: "hidden",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: scale(0), height: verticalScale(8) },
    elevation: 8,
    backgroundColor: "#1B2A1E",
  },
  featureImageShell: {
    ...StyleSheet.absoluteFillObject,
  },
  featureImage: {
    width: "100%",
    height: "100%",
  },
  featureOverlayGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },
  featureEyebrow: {
    fontFamily: ChickFont.sans,
    color: "#FFFFFF",
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    opacity: 0.9,
  },
  featureCopy: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    gap: 2,
  },
  featureTitle: {
    fontFamily: ChickFont.display,
    color: "#FFFFFF",
    fontSize: responsiveFontSize(18),
    lineHeight: 22,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  featureDetail: {
    fontFamily: ChickFont.sans,
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: responsiveFontSize(12),
    lineHeight: 16,
    fontWeight: "500",
  },
  periodModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(51, 51, 51, 0.4)",
    justifyContent: "center",
    padding: moderateScale(24),
  },
  periodModalCard: {
    borderRadius: 16,
    padding: moderateScale(16),
    backgroundColor: ChickIntelPalette.light1,
    borderWidth: 1,
    borderColor: ChickIntelPalette.lightGreen,
  },
  periodModalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "600",
    letterSpacing: -0.15,
    color: ChickIntelPalette.gray1,
    marginBottom: 12,
  },
  periodOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: verticalScale(12),
    paddingHorizontal: moderateScale(12),
    borderRadius: 5,
  },
  periodOptionText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    fontWeight: "600",
    color: ChickIntelPalette.green1,
  },
  periodModalCancel: {
    marginTop: 8,
    alignItems: "center",
    paddingVertical: verticalScale(10),
  },
  periodModalCancelText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: ChickIntelPalette.gray2,
  },
});
