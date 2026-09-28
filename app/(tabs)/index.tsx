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
    TouchableOpacity,
    useWindowDimensions,
    View,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChickenKpiArt from "@/assets_imported/card-chicken.svg";
import ChicksKpiArt from "@/assets_imported/card-chicks.svg";
import EggsKpiArt from "@/assets_imported/card-eggs.svg";
import FeedsKpiArt from "@/assets_imported/card-feeds.svg";
import ScheduleIcon from "@/assets_imported/icon-calendar.svg";
import HealthIcon from "@/assets_imported/icon-health.svg";
import InventoryIcon from "@/assets_imported/icon-inventory.svg";
import JournalIcon from "@/assets_imported/icon-journal.svg";
import BatchProfileIcon from "@/assets_imported/icon-profile.svg";
import ReportsIcon from "@/assets_imported/icon-reports.svg";
import { HeartMonitorIcon } from "@/components/icons/heart-monitor-icon";
import { PrimaryFab } from "@/components/ui/primary-fab";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { getFarmColors } from "@/constants/farm-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/providers/auth-provider";
import {
    fetchHomeKpiSnapshot,
    formatBirdAdditionTrend,
    formatConsumptionTrend,
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
import { fetchFarmBatches } from "@/utils/supabase-batches";

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
    title: "Total Chickens",
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
    title: "Total Chicks",
    value: "0",
    trend: "+0% this week",
    period: "7 days",
    background: "primarySoft",
    Artwork: ChicksKpiArt,
  },
  {
    title: "Feeds Consumed",
    value: "0 kg",
    trend: "0% this week",
    period: "7 days",
    background: "accentSoft",
    Artwork: FeedsKpiArt,
  },
];

const quickActions: QuickActionData[] = [
  { title: "Batch Profile", Icon: BatchProfileIcon },
  { title: "Health", Icon: HealthIcon },
  { title: "Journal", Icon: JournalIcon },
  { title: "Health Monitoring", Icon: HeartMonitorIcon },
  { title: "Inventory", Icon: InventoryIcon },
  { title: "Schedule", Icon: ScheduleIcon },
  { title: "Reports", Icon: ReportsIcon },
];

const PERIOD_OPTIONS = ["7 days", "30 days", "12 months"] as const;



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
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());
}

function getGreetingTimeOfDay() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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

  /** Quick-action SVG icon artwork size for consistent 3x2 view (increased by 15%) */
  const QUICK_ACTION_ICON_SIZE = Math.round(rms(55));
  const [quickActionRowWidth, setQuickActionRowWidth] = useState(0);
  const [activeQuickActionIndex, setActiveQuickActionIndex] = useState(0);
  const quickActionScrollRef = useRef<ScrollView>(null);
  const row1Actions = useMemo(() => quickActions.slice(0, 3), []);
  const row2Actions = useMemo(() => quickActions.slice(3), []);

  const featureCardWidth = Math.min(width * 0.65, rs(252));
  const featureCardGap = rms(12);
  const snapInterval = featureCardWidth + featureCardGap;
  const sideInset = Math.max((width - featureCardWidth) / 2, rms(18));
  const scrollX = useRef(new Animated.Value(0)).current;

  const dynamicKpiCardWidth = useMemo(() => {
    if (width < 360) return Math.floor(width * 0.44);
    if (width < 430) return Math.floor(width * 0.42);
    return Math.min(Math.floor(width * 0.38), rs(190));
  }, [width, rs]);

  const dynamicKpiArtworkSize = useMemo(() => {
    return Math.min(rs(64), Math.floor(dynamicKpiCardWidth * 0.45));
  }, [rs, dynamicKpiCardWidth]);
  const [kpiCards, setKpiCards] = useState<KpiCardData[]>(initialKpiCards);
  const [featuredCards, setFeaturedCards] = useState<FeaturedBreedCard[]>(() =>
    getFeaturedBreedCards(),
  );
  const [flockCountsByBreed, setFlockCountsByBreed] = useState<
    Record<string, number>
  >({});
  const [selectedBreedForModal, setSelectedBreedForModal] =
    useState<FeaturedBreedCard | null>(null);
  const [todayLabel, setTodayLabel] = useState(formatTodayLabel);
  const [periodByTitle, setPeriodByTitle] = useState<Record<string, string>>({
    "Total Chickens": "30 days",
    "Collected Eggs": "7 days",
    "Total Chicks": "7 days",
    "Feeds Consumed": "7 days",
  });
  const [periodPickerFor, setPeriodPickerFor] = useState<string | null>(null);

  // KPI Carousel State & Smooth Back-and-Forth Animation (5 loops)
  const [activeKpiIndex, setActiveKpiIndex] = useState(0);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const kpiScrollRef = useRef<ScrollView>(null);
  const currentScrollXRef = useRef(0);
  const maxScrollXRef = useRef(0);
  const scrollWidthRef = useRef(0);
  const isUserInteractingRef = useRef(false);
  const userInteractionTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const directionRef = useRef<1 | -1>(1);
  const loopCountRef = useRef(0);
  const kpiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useFocusEffect(
    useCallback(() => {
      setIsScreenFocused(true);
      return () => {
        setIsScreenFocused(false);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, []),
  );

  const kpiStep = dynamicKpiCardWidth + moderateScale(12);

  const smoothScrollTo = useCallback((targetX: number, duration = 650) => {
    const clampedTarget = Math.max(
      0,
      Math.min(targetX, maxScrollXRef.current || targetX),
    );
    const startX = currentScrollXRef.current;
    const distance = clampedTarget - startX;
    if (Math.abs(distance) < 1) return;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const startTime = Date.now();
    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);
      const nextX = startX + distance * eased;

      kpiScrollRef.current?.scrollTo({ x: nextX, animated: false });

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (userInteractionTimeoutRef.current) {
        clearTimeout(userInteractionTimeoutRef.current);
      }
    };
  }, []);

  const handleKpiDotPress = (index: number) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setActiveKpiIndex(index);
    smoothScrollTo(index * kpiStep, 500);
  };

  const handleKpiScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    currentScrollXRef.current = offsetX;
    const index = Math.min(
      Math.max(Math.round(offsetX / kpiStep), 0),
      (kpiCards.length || 3) - 1,
    );
    if (index !== activeKpiIndex) {
      setActiveKpiIndex(index);
    }
  };

  const startKpiInteraction = () => {
    isUserInteractingRef.current = true;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
    }
  };

  const endKpiInteraction = () => {
    if (userInteractionTimeoutRef.current) {
      clearTimeout(userInteractionTimeoutRef.current);
    }
    userInteractionTimeoutRef.current = setTimeout(() => {
      isUserInteractingRef.current = false;
    }, 2500);
  };

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



  useFocusEffect(
    useCallback(() => {
      let active = true;
      const nextCards = getFeaturedBreedCards();
      setFeaturedCards(nextCards);
      logStep("Home featured cards refreshed", {
        source: "in_memory_recent_scans",
        cards: nextCards.length,
      });

      if (activeFarm?.id) {
        void fetchFarmBatches(activeFarm.id)
          .then((batches) => {
            if (!active) return;
            const counts: Record<string, number> = {};
            for (const batch of batches) {
              const bName = (batch.breed || "").trim().toLowerCase();
              const total = (batch.femaleCount || 0) + (batch.maleCount || 0);
              if (bName.includes("silkie")) {
                counts["Silkie"] = (counts["Silkie"] || 0) + total;
              } else if (
                bName.includes("rhode island") ||
                bName.includes("rir")
              ) {
                counts["Rhode Island Red"] =
                  (counts["Rhode Island Red"] || 0) + total;
              } else if (bName.includes("leghorn")) {
                counts["Leghorn"] = (counts["Leghorn"] || 0) + total;
              } else if (
                bName.includes("plymouth") ||
                bName.includes("barred")
              ) {
                counts["Plymouth Rock"] =
                  (counts["Plymouth Rock"] || 0) + total;
              } else if (bName.includes("australorp")) {
                counts["Australorp"] = (counts["Australorp"] || 0) + total;
              } else if (
                bName.includes("turken") ||
                bName.includes("naked neck")
              ) {
                counts["Turken"] = (counts["Turken"] || 0) + total;
              } else if (bName.includes("bielefelder")) {
                counts["Bielefelder"] = (counts["Bielefelder"] || 0) + total;
              } else if (bName.includes("orpington")) {
                counts["Black Orpington"] =
                  (counts["Black Orpington"] || 0) + total;
              } else if (bName.includes("sussex")) {
                counts["Sussex"] = (counts["Sussex"] || 0) + total;
              } else if (bName.includes("new hampshire")) {
                counts["New Hampshire"] =
                  (counts["New Hampshire"] || 0) + total;
              } else if (bName.includes("fayoumi")) {
                counts["Fayoumi"] = (counts["Fayoumi"] || 0) + total;
              } else if (bName.includes("buckeye")) {
                counts["Buckeye"] = (counts["Buckeye"] || 0) + total;
              } else if (batch.breed) {
                counts[batch.breed] = (counts[batch.breed] || 0) + total;
              }
            }
            setFlockCountsByBreed(counts);
          })
          .catch((err) => {
            logError("Failed to fetch farm batches for breed cards", err);
          });
      }

      return () => {
        active = false;
      };
    }, [activeFarm?.id]),
  );

  const fetchKpis = useCallback(async (): Promise<KpiCardData[]> => {
    if (!activeFarm?.id) {
      return initialKpiCards;
    }

    const snapshot = await fetchHomeKpiSnapshot(activeFarm.id);
    const chickensPeriod = (periodByTitle["Total Chickens"] ??
      "30 days") as HomeKpiPeriod;
    const eggsPeriod = (periodByTitle["Collected Eggs"] ??
      "7 days") as HomeKpiPeriod;
    const chicksPeriod = (periodByTitle["Total Chicks"] ??
      "7 days") as HomeKpiPeriod;
    const feedPeriod = (periodByTitle["Feeds Consumed"] ??
      "7 days") as HomeKpiPeriod;

    return [
      {
        ...initialKpiCards[0],
        value: String(snapshot.birdAdditionsByPeriod[chickensPeriod].current),
        period: chickensPeriod,
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
          snapshot.birdAdditionsByPeriod[chickensPeriod].current,
          snapshot.birdAdditionsByPeriod[chickensPeriod].previous,
        )} ${periodLabelFromPeriod(chickensPeriod)}`,
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
        value: String(snapshot.chickAdditionsByPeriod[chicksPeriod].current),
        period: chicksPeriod,
        valueByPeriod: Object.fromEntries(
          PERIOD_OPTIONS.map((period) => [
            period,
            String(snapshot.chickAdditionsByPeriod[period].current),
          ]),
        ) as Record<HomeKpiPeriod, string>,
        trendByPeriod: Object.fromEntries(
          PERIOD_OPTIONS.map((period) => [
            period,
            formatBirdAdditionTrend(
              snapshot.chickAdditionsByPeriod[period].current,
              snapshot.chickAdditionsByPeriod[period].previous,
            ),
          ]),
        ) as Record<HomeKpiPeriod, string>,
        trend: `${formatBirdAdditionTrend(
          snapshot.chickAdditionsByPeriod[chicksPeriod].current,
          snapshot.chickAdditionsByPeriod[chicksPeriod].previous,
        )} ${periodLabelFromPeriod(chicksPeriod)}`,
      },
      {
        ...initialKpiCards[3],
        value: `${snapshot.feedQtyByPeriod[feedPeriod].current} kg`,
        period: feedPeriod,
        valueByPeriod: Object.fromEntries(
          PERIOD_OPTIONS.map((period) => [
            period,
            `${snapshot.feedQtyByPeriod[period].current} kg`,
          ]),
        ) as Record<HomeKpiPeriod, string>,
        trendByPeriod: Object.fromEntries(
          PERIOD_OPTIONS.map((period) => [
            period,
            formatConsumptionTrend(
              snapshot.feedQtyByPeriod[period].current,
              snapshot.feedQtyByPeriod[period].previous,
            ),
          ]),
        ) as Record<HomeKpiPeriod, string>,
        trend: `${formatConsumptionTrend(
          snapshot.feedQtyByPeriod[feedPeriod].current,
          snapshot.feedQtyByPeriod[feedPeriod].previous,
        )} ${periodLabelFromPeriod(feedPeriod)}`,
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

    if (title === "Journal" || title === "Behavior Journal") {
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
    // fallback - try to infer days
    if (period.includes("day")) return "this period";
    return period;
  }

  const displayKpis = kpiCards.map((k) => {
    const period = periodByTitle[k.title] ?? k.period;
    if (k.title === "Feeds Consumed") {
      const trend = k.trendByPeriod?.[period as HomeKpiPeriod] ?? "0%";
      const rawValue = k.valueByPeriod?.[period as HomeKpiPeriod] ?? k.value;
      return {
        ...k,
        value: rawValue.replace(/^-/, ""),
        period,
        trend: `${trend} ${periodLabelFromPeriod(period)}`,
      };
    }

    if (k.title === "Total Chickens") {
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

    if (k.title === "Total Chicks") {
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

  const displayName = profile?.display_name?.trim() || "Farmer";
  const userInitials =
    displayName
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "CI";
  const roleLabel = profile?.is_admin ? "Admin" : "Farmer";
  const greeting = getGreetingTimeOfDay();

  return (
    <View style={[styles.screen, { backgroundColor: ChickIntelPalette.canvas }]}>
      <View style={[styles.headerPinned, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerProfileSection}>
            <View style={styles.avatarCircle}>
              <MaterialCommunityIcons
                name="account"
                size={22}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.headerTitleWrap}>
              <View style={styles.greetingRow}>
                <Text style={styles.greetingSub}>{greeting}</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{roleLabel}</Text>
                </View>
              </View>
              <Text style={styles.userNameText} numberOfLines={1}>
                {displayName}
              </Text>
            </View>
          </View>

          <View style={styles.dateChip}>
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={14}
              color="#FFFFFF"
            />
            <Text style={styles.dateChipText}>{todayLabel}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: 14,
            paddingBottom: insets.bottom + TAB_BAR_OFFSET + 15,
          },
        ]}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.kpiCarouselContainer}>
          <ScrollView
            ref={kpiScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.kpiRow}
            scrollEventThrottle={16}
            onScroll={handleKpiScroll}
            onLayout={(e) => {
              scrollWidthRef.current = e.nativeEvent.layout.width;
            }}
            onContentSizeChange={(w) => {
              maxScrollXRef.current = Math.max(0, w - scrollWidthRef.current);
            }}
            onTouchStart={startKpiInteraction}
            onScrollBeginDrag={startKpiInteraction}
            onScrollEndDrag={endKpiInteraction}
            onMomentumScrollEnd={endKpiInteraction}
          >
            {displayKpis.map((item) => {
              const Artwork = item.Artwork;
              return (
                <View
                  key={item.title}
                  style={[
                    styles.kpiCard,
                    {
                      width: dynamicKpiCardWidth,
                    },
                  ]}
                >
                  <View style={styles.kpiTopRow}>
                    <Text
                      style={styles.kpiLabelCompact}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      maxFontSizeMultiplier={1.2}
                    >
                      {item.title}
                    </Text>
                    <Pressable
                      onPress={() => setPeriodPickerFor(item.title)}
                      style={styles.periodChip}
                    >
                      <Text
                        style={styles.periodChipText}
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
                        color="#FFFFFF"
                      />
                    </Pressable>
                  </View>

                  <View
                    style={[
                      styles.kpiBody,
                      {
                        paddingRight: Math.floor(dynamicKpiArtworkSize * 0.45),
                      },
                    ]}
                  >
                    <Text
                      style={styles.kpiValue}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.6}
                      maxFontSizeMultiplier={1.25}
                    >
                      {item.value}
                    </Text>
                    <Text
                      style={styles.kpiTrend}
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
                </View>
              );
            })}
          </ScrollView>

          {/* Carousel Pagination Dots */}
          <View style={styles.kpiPaginationRow}>
            {displayKpis.map((item, index) => {
              const isActive = index === activeKpiIndex;
              return (
                <Pressable
                  key={item.title}
                  onPress={() => handleKpiDotPress(index)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Scroll to ${item.title}`}
                  style={[styles.kpiDot, isActive && styles.kpiDotActive]}
                />
              );
            })}
          </View>
        </View>

        <View
          style={styles.quickActionsCard}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - quickActionRowWidth) > 1) {
              setQuickActionRowWidth(w);
            }
          }}
        >
          {/* Row 1: Fixed 3 items */}
          <View style={styles.quickActionsRow1}>
            {row1Actions.map((item) => {
              const Icon = item.Icon;
              return (
                <Pressable
                  key={item.title}
                  onPress={() => handleQuickActionPress(item.title)}
                  style={({ pressed }) => [
                    styles.quickActionItem3Col,
                    { opacity: pressed ? 0.82 : 1 },
                  ]}
                  accessibilityLabel={item.title}
                >
                  <View style={styles.quickActionIconWrap}>
                    <Icon
                      width={QUICK_ACTION_ICON_SIZE}
                      height={QUICK_ACTION_ICON_SIZE}
                    />
                  </View>
                  <Text style={styles.quickActionLabel} numberOfLines={2}>
                    {item.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Row 2: Swipeable items (left-to-right) */}
          <View style={styles.quickActionsRow2Wrap}>
            <ScrollView
              ref={quickActionScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickActionsRow2Scroll}
              scrollEventThrottle={16}
              onScroll={(e) => {
                const offsetX = e.nativeEvent.contentOffset.x;
                const itemWidth =
                  quickActionRowWidth > 0
                    ? Math.floor(quickActionRowWidth / 3)
                    : Math.floor((width - rms(32) - 16) / 3);
                const maxPage = Math.max(0, row2Actions.length - 3);
                const index = Math.min(
                  Math.max(0, Math.round(offsetX / (itemWidth || 1))),
                  maxPage,
                );
                if (index !== activeQuickActionIndex) {
                  setActiveQuickActionIndex(index);
                }
              }}
            >
              {row2Actions.map((item) => {
                const Icon = item.Icon;
                const itemWidth =
                  quickActionRowWidth > 0
                    ? Math.floor(quickActionRowWidth / 3)
                    : Math.floor((width - rms(32) - 16) / 3);
                return (
                  <Pressable
                    key={item.title}
                    onPress={() => handleQuickActionPress(item.title)}
                    style={({ pressed }) => [
                      styles.quickActionItem3Col,
                      { width: itemWidth, opacity: pressed ? 0.82 : 1 },
                    ]}
                    accessibilityLabel={item.title}
                  >
                    <View style={styles.quickActionIconWrap}>
                      <Icon
                        width={QUICK_ACTION_ICON_SIZE}
                        height={QUICK_ACTION_ICON_SIZE}
                      />
                    </View>
                    <Text style={styles.quickActionLabel} numberOfLines={2}>
                      {item.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Pagination Dots for swipeable row */}
            {row2Actions.length > 3 ? (
              <View style={styles.quickActionPaginationRow}>
                {Array.from({
                  length: Math.max(1, row2Actions.length - 3 + 1),
                }).map((_, idx) => {
                  const isActive = idx === activeQuickActionIndex;
                  return (
                    <Pressable
                      key={idx}
                      onPress={() => {
                        const itemWidth =
                          quickActionRowWidth > 0
                            ? Math.floor(quickActionRowWidth / 3)
                            : Math.floor((width - rms(32) - 16) / 3);
                        setActiveQuickActionIndex(idx);
                        quickActionScrollRef.current?.scrollTo({
                          x: idx * itemWidth,
                          animated: true,
                        });
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Page ${idx + 1}`}
                      style={[
                        styles.kpiDot,
                        isActive && styles.kpiDotActive,
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>

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

            const flockCount = flockCountsByBreed[item.breedName] ?? 0;

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
                  <Pressable
                    style={styles.featureCardPressable}
                    onPress={() => setSelectedBreedForModal(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${item.breedName} breed details and farm statistics`}
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
                      <View style={styles.featureOverlayGradient} />
                    </Animated.View>

                    {/* Top Badges Bar: Live Flock Count (left) & Egg Yield (right) */}
                    <View style={styles.featureTopRow}>
                      <View
                        style={[
                          styles.flockBadge,
                          flockCount > 0
                            ? styles.flockBadgeActive
                            : styles.flockBadgeEmpty,
                        ]}
                      >
                        <View
                          style={[
                            styles.flockBadgeDot,
                            flockCount > 0
                              ? styles.flockBadgeDotActive
                              : styles.flockBadgeDotEmpty,
                          ]}
                        />
                        <Text style={styles.flockBadgeText}>
                          {flockCount > 0
                            ? `${flockCount} in Flock`
                            : "0 in Flock"}
                        </Text>
                      </View>

                      {item.eggProduction ? (
                        <View style={styles.eggYieldBadge}>
                          <MaterialCommunityIcons
                            name="egg-outline"
                            size={11}
                            color="#FEF08A"
                          />
                          <Text
                            style={styles.eggYieldBadgeText}
                            numberOfLines={1}
                          >
                            {item.eggProduction}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Bottom Information Card Overlay */}
                    <Animated.View
                      style={[styles.featureCopy, { opacity: contentOpacity }]}
                    >
                      <View style={styles.featureHeaderRow}>
                        <Text style={styles.featureTitle} numberOfLines={1}>
                          {item.breedName}
                        </Text>
                        <View style={styles.purposePill}>
                          <Text
                            style={styles.purposePillText}
                            numberOfLines={1}
                          >
                            {item.purpose ||
                              (item.isDefault ? "Default" : "Scanned")}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.featureTraitsLine} numberOfLines={1}>
                        {item.hardiness || item.traits.slice(0, 2).join(" | ")}
                      </Text>

                      <View style={styles.triviaBox}>
                        <Text style={styles.triviaText} numberOfLines={2}>
                          {item.dailyTrivia || item.detail}
                        </Text>
                      </View>

                      <View style={styles.tapHintRow}>
                        <Text style={styles.tapHintText}>
                          Tap for breed guide & specs
                        </Text>
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={12}
                          color="rgba(255, 255, 255, 0.75)"
                        />
                      </View>
                    </Animated.View>
                  </Pressable>
                </Animated.View>
              </Animated.View>
            );
          }}
        />
      </ScrollView>

      <PrimaryFab
        iconName="camera-outline"
        variant="green"
        draggable
        onPress={() => void openScannerWithPermission()}
        bottom={fabBottom}
        accessibilityLabel="Open scanner"
      />

      <Modal
        visible={selectedBreedForModal !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedBreedForModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalBackdropDismiss}
            onPress={() => setSelectedBreedForModal(null)}
            accessibilityLabel="Close breed details"
          />
          <View style={styles.breedModalCard}>
            <View style={styles.breedModalImageContainer}>
              {selectedBreedForModal && (
                <Image
                  source={selectedBreedForModal.image}
                  style={styles.breedModalImage}
                  contentFit="cover"
                />
              )}
              <TouchableOpacity
                style={styles.breedModalCloseBtn}
                onPress={() => setSelectedBreedForModal(null)}
                accessibilityLabel="Close breed modal"
              >
                <MaterialCommunityIcons name="close" size={20} color="#FFF" />
              </TouchableOpacity>

              <View style={styles.breedModalImageOverlay}>
                <Text style={styles.breedModalTitle}>
                  {selectedBreedForModal?.breedName}
                </Text>
                <Text style={styles.breedModalSubtitle}>
                  {selectedBreedForModal?.purpose} |{" "}
                  {selectedBreedForModal?.hardiness}
                </Text>
              </View>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.breedModalScroll}
              contentContainerStyle={styles.breedModalScrollContent}
            >
              {/* Farm Census Section */}
              <View style={styles.censusBanner}>
                <View style={styles.censusIconWrap}>
                  <MaterialCommunityIcons
                    name="counter"
                    size={22}
                    color="#2D6A4F"
                  />
                </View>
                <View style={styles.censusTextWrap}>
                  <Text style={styles.censusHeading}>
                    Live Farm Flock Count
                  </Text>
                  <Text style={styles.censusValue}>
                    {(selectedBreedForModal &&
                      flockCountsByBreed[selectedBreedForModal.breedName]) ||
                      0}{" "}
                    {((selectedBreedForModal &&
                      flockCountsByBreed[selectedBreedForModal.breedName]) ||
                      0) === 1
                      ? "Chicken Recorded in Batches"
                      : "Chickens Recorded in Batches"}
                  </Text>
                </View>
              </View>

              {/* Specs Grid */}
              <Text style={styles.modalSectionTitle}>Breed Specifications</Text>
              <View style={styles.specsGrid}>
                <View style={styles.specBox}>
                  <MaterialCommunityIcons
                    name="egg"
                    size={16}
                    color={ChickIntelPalette.accent}
                  />
                  <Text style={styles.specBoxLabel}>Egg Yield</Text>
                  <Text style={styles.specBoxValue} numberOfLines={1}>
                    {selectedBreedForModal?.eggProduction}
                  </Text>
                </View>

                <View style={styles.specBox}>
                  <MaterialCommunityIcons
                    name="palette-outline"
                    size={16}
                    color={ChickIntelPalette.mediumGreen}
                  />
                  <Text style={styles.specBoxLabel}>Egg Color</Text>
                  <Text style={styles.specBoxValue} numberOfLines={1}>
                    {selectedBreedForModal?.metadata?.eggColor ||
                      "Brown / Cream"}
                  </Text>
                </View>

                <View style={styles.specBox}>
                  <MaterialCommunityIcons
                    name="weight"
                    size={16}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.specBoxLabel}>Adult Weight</Text>
                  <Text style={styles.specBoxValue} numberOfLines={1}>
                    {selectedBreedForModal?.metadata?.weight || "5.0 - 8.0 lbs"}
                  </Text>
                </View>

                <View style={styles.specBox}>
                  <MaterialCommunityIcons
                    name="heart-pulse"
                    size={16}
                    color={ChickIntelPalette.mediumGreen}
                  />
                  <Text style={styles.specBoxLabel}>Temperament</Text>
                  <Text style={styles.specBoxValue} numberOfLines={1}>
                    {selectedBreedForModal?.metadata?.temperament?.split(
                      " ",
                    )[0] || "Docile"}
                  </Text>
                </View>
              </View>

              {/* Farmer Pro-Tip & Trivia */}
              <View style={styles.triviaSection}>
                <View style={styles.triviaHeaderRow}>
                  <MaterialCommunityIcons
                    name="lightbulb-on"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.triviaSectionTitle}>Farmer Pro-Tip</Text>
                </View>
                <Text style={styles.triviaSectionContent}>
                  {selectedBreedForModal?.dailyTrivia}
                </Text>
              </View>

              {/* Care & Nutrition Advice */}
              <View style={styles.infoCard}>
                <View style={styles.infoHeaderRow}>
                  <MaterialCommunityIcons
                    name="home-outline"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.infoCardTitle}>
                    Housing & Environment
                  </Text>
                </View>
                <Text style={styles.infoCardBody}>
                  {selectedBreedForModal?.metadata?.careAdvice ||
                    "Provide clean water, dry bedding, and sheltered roosting spaces."}
                </Text>
              </View>

              {/* Health & Scanner Watch-out */}
              <View style={styles.healthWatchCard}>
                <View style={styles.infoHeaderRow}>
                  <MaterialCommunityIcons
                    name="shield-alert-outline"
                    size={18}
                    color={ChickIntelPalette.gray1}
                  />
                  <Text style={styles.healthWatchTitle}>
                    Health Scanner Watch-Out
                  </Text>
                </View>
                <Text style={styles.healthWatchBody}>
                  {selectedBreedForModal?.metadata?.healthWatch ||
                    "Monitor regularly for parasites, respiratory signs, and plumage vigor."}
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.modalScannerBtn}
                  onPress={() => {
                    setSelectedBreedForModal(null);
                    void openScannerWithPermission();
                  }}
                >
                  <MaterialCommunityIcons
                    name="camera"
                    size={18}
                    color="#FFF"
                  />
                  <Text style={styles.modalScannerBtnText}>Scan Breed</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalBatchesBtn}
                  onPress={() => {
                    setSelectedBreedForModal(null);
                    router.push("/profiles");
                  }}
                >
                  <MaterialCommunityIcons
                    name="clipboard-list-outline"
                    size={18}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.modalBatchesBtnText}>Batches</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

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
    backgroundColor: ChickIntelPalette.canvas,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: moderateScale(18),
    gap: 14,
  },
  headerPinned: {
    paddingHorizontal: moderateScale(18),
    paddingBottom: verticalScale(4),
    backgroundColor: "transparent",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: verticalScale(8),
    gap: 12,
  },
  headerProfileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: moderateScale(10),
    flex: 1,
  },
  avatarCircle: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: moderateScale(20),
    backgroundColor: ChickIntelPalette.green1,
    borderWidth: 1.5,
    borderColor: "rgba(64, 83, 77, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerTitleWrap: {
    flex: 1,
    justifyContent: "center",
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  greetingSub: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "500",
    color: ChickIntelPalette.textMuted,
    letterSpacing: 0.1,
  },
  roleBadge: {
    backgroundColor: ChickIntelPalette.lightGreen,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: ChickIntelPalette.mediumGreen,
  },
  roleBadgeText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  userNameText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    lineHeight: 22,
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    letterSpacing: -0.3,
    marginTop: 1,
  },
  dateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: ChickIntelPalette.green1,
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(6),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(64, 83, 77, 0.4)",
    shadowColor: "#161E1A",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  dateChipText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  kpiCarouselContainer: {
    marginBottom: verticalScale(2),
  },
  kpiRow: {
    flexDirection: "row",
    gap: moderateScale(12),
    paddingHorizontal: moderateScale(4),
  },
  kpiPaginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: verticalScale(10),
  },
  kpiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(27, 73, 56, 0.18)",
  },
  kpiDotActive: {
    width: 18,
    borderRadius: 3,
    backgroundColor: ChickIntelPalette.green1,
  },
  kpiCard: {
    backgroundColor: ChickIntelPalette.green1,
    borderRadius: 14,
    minHeight: verticalScale(125),
    paddingHorizontal: moderateScale(12),
    paddingTop: verticalScale(10),
    paddingBottom: verticalScale(10),
    position: "relative",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(64, 83, 77, 0.4)",
    shadowColor: "#161E1A",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: verticalScale(2) },
    elevation: 3,
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
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    lineHeight: 16,
    color: "rgba(255, 255, 255, 0.9)",
  },
  /** Prominent KPI title styling */
  kpiLabelCompact: {
    fontFamily: ChickFont.sans,
    flex: 1,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    lineHeight: 16,
    color: "rgba(255, 255, 255, 0.9)",
  },
  periodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(3),
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    flexShrink: 0,
  },
  periodChipText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    letterSpacing: 0.15,
    color: "#FFFFFF",
  },
  kpiBody: {
    marginTop: verticalScale(6),
    gap: 2,
    justifyContent: "flex-start",
  },
  kpiValue: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(26),
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
    color: "#FFFFFF",
  },
  kpiTrend: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 2,
    color: ChickIntelPalette.accent,
  },
  kpiArtworkWrap: {
    position: "absolute",
    right: moderateScale(12),
    bottom: verticalScale(10),
    opacity: 0.95,
  },
  quickActionsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
    shadowColor: "#161E1A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: verticalScale(2) },
    elevation: 2,
    paddingVertical: verticalScale(14),
    paddingHorizontal: moderateScale(6),
    position: "relative",
    overflow: "hidden",
  },
  quickActionsRow1: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: verticalScale(8),
  },
  quickActionsRow2Wrap: {
    width: "100%",
  },
  quickActionsRow2Scroll: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  quickActionItem3Col: {
    width: "33.333%",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingVertical: verticalScale(2),
    paddingHorizontal: moderateScale(4),
  },
  quickActionPaginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: verticalScale(8),
  },
  quickActionIconWrap: {
    width: moderateScale(58),
    height: moderateScale(58),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: verticalScale(4),
  },
  quickActionLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    textAlign: "center",
    lineHeight: 14,
    minHeight: verticalScale(28),
  },
  carouselContent: {
    paddingTop: 2,
    paddingBottom: 6,
  },
  featureCardWrap: {
    borderRadius: 12,
  },
  featureCard: {
    height: verticalScale(215),
    borderRadius: 12,
    overflow: "hidden",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: scale(0), height: verticalScale(8) },
    elevation: 8,
    backgroundColor: "#1B2A1E",
  },
  featureCardPressable: {
    flex: 1,
    position: "relative",
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
    backgroundColor: "rgba(6, 14, 10, 0.78)",
  },
  featureTopRow: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  flockBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 999,
    gap: 5,
  },
  flockBadgeActive: {
    backgroundColor: ChickIntelPalette.green1,
    borderWidth: 1,
    borderColor: ChickIntelPalette.green2,
  },
  flockBadgeEmpty: {
    backgroundColor: "rgba(31, 46, 43, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  flockBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  flockBadgeDotActive: {
    backgroundColor: ChickIntelPalette.accent,
  },
  flockBadgeDotEmpty: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
  flockBadgeText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  eggYieldBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ChickIntelPalette.accent,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    gap: 3,
  },
  eggYieldBadgeText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(9.5),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  featureCopy: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: "rgba(31, 46, 43, 0.88)",
    borderRadius: 10,
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(7),
    borderWidth: 1,
    borderColor: "rgba(247, 192, 144, 0.25)",
    gap: 3,
  },
  featureHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featureTitle: {
    fontFamily: ChickFont.display,
    color: "#FFFFFF",
    fontSize: responsiveFontSize(15),
    fontWeight: "700",
    flexShrink: 1,
  },
  purposePill: {
    backgroundColor: ChickIntelPalette.green2,
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(1.5),
    borderRadius: 4,
  },
  purposePillText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(8.5),
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  featureTraitsLine: {
    fontFamily: ChickFont.sans,
    color: ChickIntelPalette.accent,
    fontSize: responsiveFontSize(10),
    fontWeight: "600",
  },
  triviaBox: {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 6,
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(3),
    marginTop: 1,
  },
  triviaText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(9.5),
    color: "rgba(255, 255, 255, 0.95)",
    lineHeight: 13,
    fontStyle: "italic",
  },
  tapHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 2,
    marginTop: 1,
  },
  tapHintText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(8.5),
    color: "rgba(255, 255, 255, 0.75)",
    fontWeight: "500",
  },

  // Breed Guide Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalBackdropDismiss: {
    ...StyleSheet.absoluteFillObject,
  },
  breedModalCard: {
    backgroundColor: "#FDFDFD",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "86%",
    maxHeight: "86%",
    overflow: "hidden",
  },
  breedModalScroll: {
    flex: 1,
  },
  breedModalScrollContent: {
    paddingBottom: verticalScale(30),
  },
  breedModalImageContainer: {
    height: verticalScale(160),
    width: "100%",
    position: "relative",
    zIndex: 10,
    elevation: 10,
  },
  breedModalImage: {
    width: "100%",
    height: "100%",
  },
  breedModalCloseBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderRadius: 999,
    padding: 6,
    zIndex: 10,
  },
  breedModalImageOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(10),
    backgroundColor: "rgba(10, 20, 14, 0.65)",
  },
  breedModalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  breedModalSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "#A7F3D0",
    fontWeight: "600",
  },
  censusBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ChickIntelPalette.lightGreen,
    marginHorizontal: moderateScale(16),
    marginTop: verticalScale(14),
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(10),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ChickIntelPalette.mediumGreen,
    gap: 12,
  },
  censusIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  censusTextWrap: {
    flex: 1,
  },
  censusHeading: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: ChickIntelPalette.green1,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  censusValue: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(14),
    color: ChickIntelPalette.green1,
    fontWeight: "700",
  },
  modalSectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    marginHorizontal: moderateScale(16),
    marginTop: verticalScale(14),
    marginBottom: verticalScale(6),
  },
  specsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: moderateScale(16),
    gap: 8,
  },
  specBox: {
    width: "48%",
    backgroundColor: ChickIntelPalette.lightGreen,
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(8),
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ChickIntelPalette.mediumGreen,
    gap: 2,
  },
  specBoxLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: ChickIntelPalette.textMuted,
    fontWeight: "500",
  },
  specBoxValue: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(12),
    color: ChickIntelPalette.gray1,
    fontWeight: "700",
  },
  triviaSection: {
    marginHorizontal: moderateScale(16),
    marginTop: verticalScale(12),
    backgroundColor: ChickIntelPalette.lightGreen,
    borderRadius: 10,
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: ChickIntelPalette.mediumGreen,
  },
  triviaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  triviaSectionTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  triviaSectionContent: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: ChickIntelPalette.gray1,
    lineHeight: 16,
  },
  infoCard: {
    marginHorizontal: moderateScale(16),
    marginTop: verticalScale(10),
    backgroundColor: ChickIntelPalette.lightGreen,
    borderRadius: 10,
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: ChickIntelPalette.mediumGreen,
  },
  infoHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  infoCardTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  infoCardBody: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: ChickIntelPalette.textMuted,
    lineHeight: 16,
  },
  healthWatchCard: {
    marginHorizontal: moderateScale(16),
    marginTop: verticalScale(10),
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: moderateScale(12),
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
  },
  healthWatchTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(12),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  healthWatchBody: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    color: ChickIntelPalette.textMuted,
    lineHeight: 16,
  },
  modalActionsRow: {
    flexDirection: "row",
    marginHorizontal: moderateScale(16),
    marginTop: verticalScale(16),
    gap: 10,
  },
  modalScannerBtn: {
    flex: 1.2,
    backgroundColor: ChickIntelPalette.green1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(12),
    borderRadius: 12,
    gap: 6,
  },
  modalScannerBtnText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: "#FFF",
  },
  modalBatchesBtn: {
    flex: 1,
    backgroundColor: ChickIntelPalette.lightGreen,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: verticalScale(12),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: ChickIntelPalette.mediumGreen,
    gap: 6,
  },
  modalBatchesBtnText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  periodModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(22, 30, 26, 0.45)",
    justifyContent: "center",
    padding: moderateScale(24),
  },
  periodModalCard: {
    borderRadius: 16,
    padding: moderateScale(16),
    backgroundColor: ChickIntelPalette.light1,
    borderWidth: 1,
    borderColor: ChickIntelPalette.mediumGreen,
  },
  periodModalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "700",
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
    borderRadius: 8,
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
    color: ChickIntelPalette.textMuted,
  },
});
