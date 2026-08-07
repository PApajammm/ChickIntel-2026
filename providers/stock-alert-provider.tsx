import { BlurCard } from "@/components/ui/blur-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import { logError } from "@/utils/logger";
import {
    computeEffectiveInventoryItems,
    getStockSeverity,
    getStockSeverityMeta,
    type EffectiveInventoryItem,
    type StockSeverity,
} from "@/utils/stock-alerts";
import {
    fetchInventoryItems,
    type SupabaseInventoryItem,
} from "@/utils/supabase-inventory";
import {
    fetchScheduleTaskCompletions,
    fetchScheduleTasks,
    type SupabaseScheduleTask,
    type SupabaseScheduleTaskCompletion,
} from "@/utils/supabase-schedule";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type PropsWithChildren,
} from "react";
import {
    Animated,
    Easing,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Constants, { ExecutionEnvironment } from "expo-constants";

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as Record<string, unknown>).appOwnership === "expo";

let NotificationsModule: typeof import("expo-notifications") | null = null;

if (!isExpoGo) {
  try {
    NotificationsModule = require("expo-notifications");
    if (NotificationsModule?.setNotificationHandler) {
      NotificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
  } catch {
    NotificationsModule = null;
  }
}

type AlertSeverity = Exclude<StockSeverity, "normal"> | "depleted";

type GlobalNotification = {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  dedupeKey?: string;
  itemId?: string;
};

type StockAlertContextValue = {
  notify: (notification: Omit<GlobalNotification, "id">) => void;
};

const StockAlertContext = createContext<StockAlertContextValue | null>(null);
const ALERT_DURATION_MS = 5000;
const POLL_INTERVAL_MS = 30000;
const ZERO_STOCK_REMINDER_INTERVAL_MS = 20000;
const ZERO_STOCK_REMINDER_COUNT = 5;
const FADE_ANIMATION_MS = 220;

type ZeroReminderState = {
  intervalId: ReturnType<typeof setInterval> | null;
  shownCount: number;
  cycleCompleted: boolean;
};

export function StockAlertProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const { activeFarm } = useAuth();
  const [currentNotification, setCurrentNotification] =
    useState<GlobalNotification | null>(null);
  const currentNotificationRef = useRef<GlobalNotification | null>(null);
  const queueRef = useRef<GlobalNotification[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notifiedLevelsRef = useRef<Record<string, StockSeverity>>({});
  const zeroReminderStateRef = useRef<Record<string, ZeroReminderState>>({});
  const silencedAlertsRef = useRef<
    Record<string, { severity: AlertSeverity; qty: number }>
  >({});
  const itemQuantitiesRef = useRef<Record<string, number>>({});
  const mountedRef = useRef(true);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const bannerTranslateY = useRef(new Animated.Value(-10)).current;

  const clearZeroReminders = useCallback(
    (itemId: string, deleteState = false) => {
      const state = zeroReminderStateRef.current[itemId];
      if (!state) {
        return;
      }

      if (state.intervalId) {
        clearInterval(state.intervalId);
        state.intervalId = null;
      }

      if (deleteState) {
        delete zeroReminderStateRef.current[itemId];
      }
    },
    [],
  );

  useEffect(() => {
    currentNotificationRef.current = currentNotification;
  }, [currentNotification]);

  const animateBannerIn = useCallback(() => {
    bannerOpacity.setValue(0);
    bannerTranslateY.setValue(-10);
    Animated.parallel([
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: FADE_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(bannerTranslateY, {
        toValue: 0,
        duration: FADE_ANIMATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [bannerOpacity, bannerTranslateY]);

  const hideCurrentBanner = useCallback(
    (onHidden: () => void) => {
      Animated.parallel([
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: FADE_ANIMATION_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(bannerTranslateY, {
          toValue: -10,
          duration: FADE_ANIMATION_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => onHidden());
    },
    [bannerOpacity, bannerTranslateY],
  );

  const showNextNotification = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const next = queueRef.current.shift() ?? null;
    const applyNext = () => {
      currentNotificationRef.current = next;
      setCurrentNotification(next);

      if (!next) {
        return;
      }

      animateBannerIn();
      timeoutRef.current = setTimeout(() => {
        if (!mountedRef.current) {
          return;
        }
        showNextNotification();
      }, ALERT_DURATION_MS);
    };

    if (!currentNotificationRef.current) {
      applyNext();
      return;
    }

    hideCurrentBanner(applyNext);
  }, [animateBannerIn, hideCurrentBanner]);

  const dismissCurrentNotification = useCallback(() => {
    const current = currentNotificationRef.current;
    if (current && current.itemId) {
      const itemId = current.itemId;
      const currentQty = itemQuantitiesRef.current[itemId] ?? 0;

      // 1. Clear zero-stock reminder intervals and set cycle completed
      clearZeroReminders(itemId, false);
      const state = zeroReminderStateRef.current[itemId];
      if (state) {
        state.cycleCompleted = true;
      } else {
        zeroReminderStateRef.current[itemId] = {
          intervalId: null,
          shownCount: 0,
          cycleCompleted: true,
        };
      }

      // 2. Save silenced alert state
      silencedAlertsRef.current[itemId] = {
        severity: current.severity,
        qty: currentQty,
      };
    }
    showNextNotification();
  }, [showNextNotification, clearZeroReminders]);

  const notify = useCallback(
    (notification: Omit<GlobalNotification, "id">) => {
      const sanitizedTitle =
        typeof notification.title === "string" ? notification.title.trim() : "";
      const sanitizedMessage =
        typeof notification.message === "string"
          ? notification.message.trim()
          : "";

      if (!sanitizedTitle || !sanitizedMessage) {
        return;
      }

      const nextNotification: GlobalNotification = {
        ...notification,
        title: sanitizedTitle,
        message: sanitizedMessage,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      };
      const dedupeKey =
        nextNotification.dedupeKey ??
        `${nextNotification.title}:${nextNotification.message}`;

      const currentDedupeKey =
        currentNotificationRef.current?.dedupeKey ??
        (currentNotificationRef.current
          ? `${currentNotificationRef.current.title}:${currentNotificationRef.current.message}`
          : "");
      const isDuplicateCurrent = currentDedupeKey === dedupeKey;
      const isDuplicateQueued = queueRef.current.some(
        (queued) =>
          (queued.dedupeKey ?? `${queued.title}:${queued.message}`) ===
          dedupeKey,
      );

      if (isDuplicateCurrent || isDuplicateQueued) {
        return;
      }

      // Schedule real OS system notification (if supported by native runtime)
      try {
        if (NotificationsModule?.scheduleNotificationAsync) {
          void NotificationsModule.scheduleNotificationAsync({
            content: {
              title: sanitizedTitle,
              body: sanitizedMessage,
              sound: true,
            },
            trigger: null,
          }).catch(() => {});
        }
      } catch {
        // Fallback for Expo Go / Web mode
      }

      if (!currentNotificationRef.current) {
        currentNotificationRef.current = nextNotification;
        setCurrentNotification(nextNotification);
        animateBannerIn();
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          if (!mountedRef.current) {
            return;
          }
          showNextNotification();
        }, ALERT_DURATION_MS);
        return;
      }

      queueRef.current.push(nextNotification);
    },
    [animateBannerIn, showNextNotification],
  );

  useEffect(() => {
    mountedRef.current = true;

    async function requestNotificationPermissions() {
      try {
        if (typeof NotificationsModule?.getPermissionsAsync === "function") {
          const { status } = await NotificationsModule.getPermissionsAsync();
          if (
            status !== "granted" &&
            typeof NotificationsModule?.requestPermissionsAsync === "function"
          ) {
            await NotificationsModule.requestPermissionsAsync();
          }
        }
      } catch {
        // Fallback for Expo Go / Web mode where native module isn't loaded
      }
    }
    void requestNotificationPermissions();

    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      Object.values(zeroReminderStateRef.current).forEach((state) => {
        if (state.intervalId) {
          clearInterval(state.intervalId);
        }
      });
      zeroReminderStateRef.current = {};
      silencedAlertsRef.current = {};
      itemQuantitiesRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!activeFarm?.id) {
      notifiedLevelsRef.current = {};
      silencedAlertsRef.current = {};
      itemQuantitiesRef.current = {};
      Object.values(zeroReminderStateRef.current).forEach((state) => {
        if (state.intervalId) {
          clearInterval(state.intervalId);
        }
      });
      zeroReminderStateRef.current = {};
      return;
    }

    let cancelled = false;

    const scheduleZeroStockReminders = (item: EffectiveInventoryItem) => {
      const existingState = zeroReminderStateRef.current[item.id];

      if (existingState?.cycleCompleted) {
        return;
      }

      if (existingState) {
        return;
      }

      zeroReminderStateRef.current[item.id] = {
        intervalId: null,
        shownCount: 1,
        cycleCompleted: false,
      };

      const intervalId = setInterval(() => {
        const state = zeroReminderStateRef.current[item.id];

        if (!mountedRef.current || cancelled || !state) {
          return;
        }

        if (state.shownCount >= ZERO_STOCK_REMINDER_COUNT) {
          if (state.intervalId) {
            clearInterval(state.intervalId);
            state.intervalId = null;
          }
          state.cycleCompleted = true;
          return;
        }

        // Check if already silenced before triggering reminder
        const silenced = silencedAlertsRef.current[item.id];
        if (silenced && silenced.severity === "depleted") {
          if (state.intervalId) {
            clearInterval(state.intervalId);
            state.intervalId = null;
          }
          state.cycleCompleted = true;
          return;
        }

        notify({
          title: "Immediate refill required",
          message: `${item.name} is fully depleted at 0% remaining. Refill this supply immediately.`,
          severity: "depleted",
          itemId: item.id,
          dedupeKey: `depleted:${item.id}:${state.shownCount + 1}`,
        });

        state.shownCount += 1;

        if (state.shownCount >= ZERO_STOCK_REMINDER_COUNT) {
          if (state.intervalId) {
            clearInterval(state.intervalId);
            state.intervalId = null;
          }
          state.cycleCompleted = true;
        }
      }, ZERO_STOCK_REMINDER_INTERVAL_MS);

      zeroReminderStateRef.current[item.id].intervalId = intervalId;
    };

    const checkStockLevels = async () => {
      try {
        const [items, tasks, completions] = await Promise.all([
          fetchInventoryItems(activeFarm.id),
          fetchScheduleTasks(activeFarm.id),
          fetchScheduleTaskCompletions(activeFarm.id),
        ]);

        if (cancelled) {
          return;
        }

        const effectiveItems = computeEffectiveInventoryItems(
          items as SupabaseInventoryItem[],
          tasks as SupabaseScheduleTask[],
          new Date(),
          completions as SupabaseScheduleTaskCompletion[],
        );

        // Update tracked quantities and unsilence if stock increased
        effectiveItems.forEach((item) => {
          const silenced = silencedAlertsRef.current[item.id];
          if (silenced && item.remainingQty > silenced.qty) {
            delete silencedAlertsRef.current[item.id];
          }
          itemQuantitiesRef.current[item.id] = item.remainingQty;
        });

        const getSafeStatusPercent = (inventoryItem: EffectiveInventoryItem) =>
          Number.isFinite(inventoryItem.statusPercent)
            ? inventoryItem.statusPercent
            : 0;

        const depletedItems = effectiveItems.filter((item) => {
          const statusPercent = getSafeStatusPercent(item);
          return statusPercent <= 0;
        });
        const newlyDepleted = depletedItems.filter((item) => {
          const silenced = silencedAlertsRef.current[item.id];
          if (silenced && silenced.severity === "depleted") {
            return false;
          }
          const previousSeverity = notifiedLevelsRef.current[item.id];
          return previousSeverity !== "critical";
        });

        const newlyCritical = effectiveItems.filter((item) => {
          const statusPercent = getSafeStatusPercent(item);
          const severity = getStockSeverity(statusPercent);
          const silenced = silencedAlertsRef.current[item.id];
          if (silenced && silenced.severity === "critical") {
            return false;
          }
          const previousSeverity = notifiedLevelsRef.current[item.id];
          return (
            severity === "critical" &&
            statusPercent > 0 &&
            previousSeverity !== "critical"
          );
        });

        const newlyMedium = effectiveItems.filter((item) => {
          const statusPercent = getSafeStatusPercent(item);
          const severity = getStockSeverity(statusPercent);
          const silenced = silencedAlertsRef.current[item.id];
          if (silenced && silenced.severity === "medium") {
            return false;
          }
          const previousSeverity = notifiedLevelsRef.current[item.id];
          return (
            severity === "medium" &&
            previousSeverity !== "medium" &&
            previousSeverity !== "critical"
          );
        });

        effectiveItems.forEach((item) => {
          const statusPercent = getSafeStatusPercent(item);
          if (statusPercent <= 0) {
            const silenced = silencedAlertsRef.current[item.id];
            if (silenced && silenced.severity === "depleted") {
              clearZeroReminders(item.id, false);
              return;
            }
            scheduleZeroStockReminders(item);
          } else {
            clearZeroReminders(item.id, true);
          }
        });

        effectiveItems.forEach((item) => {
          notifiedLevelsRef.current[item.id] = getStockSeverity(
            getSafeStatusPercent(item),
          );
        });

        newlyDepleted.forEach((item) => {
          const itemName =
            typeof item.name === "string" && item.name.trim()
              ? item.name.trim()
              : "This inventory item";

          notify({
            title: "Immediate refill required",
            message: `${itemName} is fully depleted at 0% remaining. Refill this supply immediately.`,
            severity: "depleted",
            itemId: item.id,
            dedupeKey: `depleted-initial:${item.id}`,
          });
        });

        newlyCritical.forEach((item) => {
          const statusPercent = getSafeStatusPercent(item);
          const itemName =
            typeof item.name === "string" && item.name.trim()
              ? item.name.trim()
              : "This inventory item";

          notify({
            title: "Critical stock alert",
            message: `${itemName} is down to ${statusPercent}% remaining stock.`,
            severity: "critical",
            itemId: item.id,
            dedupeKey: `critical:${item.id}:${statusPercent}`,
          });
        });

        newlyMedium.forEach((item) => {
          const statusPercent = getSafeStatusPercent(item);
          const itemName =
            typeof item.name === "string" && item.name.trim()
              ? item.name.trim()
              : "This inventory item";

          notify({
            title: "Medium stock alert",
            message: `${itemName} is down to ${statusPercent}% remaining stock.`,
            severity: "medium",
            itemId: item.id,
            dedupeKey: `medium:${item.id}:${statusPercent}`,
          });
        });
      } catch (error) {
        logError("Global stock alert refresh failed", error, {
          farmId: activeFarm.id,
        });
      }
    };

    void checkStockLevels();
    const intervalId = setInterval(() => {
      void checkStockLevels();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [activeFarm?.id, notify, clearZeroReminders]);

  const notificationMeta = currentNotification
    ? currentNotification.severity === "depleted"
      ? {
          fillColor: "#B42318",
          softColor: "rgba(180, 35, 24, 0.18)",
          textColor: "#7A1212",
        }
      : getStockSeverityMeta(
          currentNotification.severity === "critical" ? 25 : 50,
        )
    : null;

  const value = useMemo<StockAlertContextValue>(
    () => ({
      notify,
    }),
    [notify],
  );

  return (
    <StockAlertContext.Provider value={value}>
      {children}
      {currentNotification ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.overlay,
            {
              top: insets.top + 12,
              opacity: bannerOpacity,
              transform: [{ translateY: bannerTranslateY }],
            },
          ]}
        >
          <BlurCard style={styles.bannerCard} borderRadius={22} intensity={22}>
            <Pressable style={styles.bannerSurface}>
              <View
                style={[
                  styles.bannerAccent,
                  {
                    backgroundColor:
                      notificationMeta?.fillColor ?? ChickIntelPalette.green1,
                  },
                ]}
              />
              <View
                style={[
                  styles.bannerIconWrap,
                  currentNotification.severity === "depleted"
                    ? styles.bannerIconWrapDepleted
                    : null,
                  {
                    backgroundColor:
                      notificationMeta?.softColor ?? "rgba(49, 118, 103, 0.12)",
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    currentNotification.severity === "depleted"
                      ? "alert-octagon"
                      : currentNotification.severity === "critical"
                        ? "alert-circle"
                        : "alert-outline"
                  }
                  size={currentNotification.severity === "depleted" ? 24 : 22}
                  color={
                    notificationMeta?.fillColor ?? ChickIntelPalette.green1
                  }
                />
              </View>
              <View style={styles.bannerBody}>
                {currentNotification.severity === "depleted" ? (
                  <View style={styles.urgentBadge}>
                    <Text style={styles.urgentBadgeText}>URGENT</Text>
                  </View>
                ) : null}
                <Text style={styles.bannerTitle}>
                  {currentNotification.title}
                </Text>
                <Text style={styles.bannerMessage}>
                  {currentNotification.message}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.bannerDismiss,
                  currentNotification.severity === "depleted"
                    ? styles.bannerDismissDepleted
                    : null,
                ]}
                onPress={dismissCurrentNotification}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={18}
                  color={ChickIntelPalette.gray1}
                />
              </TouchableOpacity>
            </Pressable>
          </BlurCard>
        </Animated.View>
      ) : null}
    </StockAlertContext.Provider>
  );
}

export function useStockAlert() {
  const context = useContext(StockAlertContext);

  if (!context) {
    throw new Error("useStockAlert must be used inside StockAlertProvider.");
  }

  return context;
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 1000,
  },
  bannerCard: {
    overflow: "hidden",
  },
  bannerSurface: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.82)",
  },
  bannerAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  bannerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  bannerIconWrapDepleted: {
    width: 44,
    height: 44,
    borderRadius: 16,
  },
  bannerBody: {
    flex: 1,
    paddingTop: 1,
  },
  urgentBadge: {
    alignSelf: "flex-start",
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(180, 35, 24, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(180, 35, 24, 0.2)",
  },
  urgentBadgeText: {
    fontFamily: ChickFont.sans,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: "800",
    letterSpacing: 0.65,
    color: "#B42318",
  },
  bannerTitle: {
    fontFamily: ChickFont.display,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  bannerMessage: {
    marginTop: 2,
    fontFamily: ChickFont.sans,
    fontSize: 13,
    lineHeight: 19,
    color: ChickIntelPalette.gray1,
  },
  bannerDismiss: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.56)",
  },
  bannerDismissDepleted: {
    backgroundColor: "rgba(180, 35, 24, 0.12)",
  },
});
