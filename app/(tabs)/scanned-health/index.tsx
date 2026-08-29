import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { BehaviorChecklist } from "@/components/health-scan/behavior-checklist";
import { HealthFlowFooterButton } from "@/components/health-scan/health-flow-footer-button";
import { HealthInputSummaryCard } from "@/components/health-scan/health-input-summary-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { DEFAULT_IMAGE_BASED_DETECTION } from "@/constants/health-scan-behaviors";
import { HealthTypography } from "@/constants/health-typography";
import { useBehaviors } from "@/hooks/use-behaviors";
import { logStep } from "@/utils/logger";

const TAB_BAR_OFFSET = 55;

export default function ScannedHealthInputScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    photoUri?: string;
    detectedIllness?: string;
    capturedAt?: string;
    captureWidth?: string;
    captureHeight?: string;
    monitoringId?: string;
    chtTag?: string;
  }>();

  const photoUri = useMemo(() => {
    const u = params.photoUri;
    return typeof u === "string" ? u : "";
  }, [params.photoUri]);

  const detectedIllness =
    typeof params.detectedIllness === "string" && params.detectedIllness
      ? params.detectedIllness
      : DEFAULT_IMAGE_BASED_DETECTION;
  const capturedAt =
    typeof params.capturedAt === "string" ? params.capturedAt : undefined;
  const captureWidth =
    typeof params.captureWidth === "string"
      ? Number.parseInt(params.captureWidth, 10)
      : undefined;
  const captureHeight =
    typeof params.captureHeight === "string"
      ? Number.parseInt(params.captureHeight, 10)
      : undefined;
  const monitoringId =
    typeof params.monitoringId === "string" ? params.monitoringId : "";
  const chtTag = typeof params.chtTag === "string" ? params.chtTag : "";
  const isMonitoringRescan = Boolean(monitoringId);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState("all");
  const [additionalObservation, setAdditionalObservation] = useState("");
  const {
    behaviors: behaviorItems,
    categories,
    loading: behaviorsLoading,
  } = useBehaviors();

  const filteredBehaviors = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return behaviorItems.filter((item) => {
      const matchesCategory =
        activeCategoryId === "all" || item.categoryId === activeCategoryId;
      const matchesSearch =
        !normalizedSearch ||
        item.label.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategoryId, searchQuery, behaviorItems]);

  useEffect(() => {
    if (!photoUri) {
      router.replace("/(tabs)");
    }
  }, [photoUri, router]);

  useEffect(() => {
    logStep("ScannedHealthInput mounted", { hasPhoto: !!photoUri });
  }, [photoUri]);

  // Reset selections and observations when a new photo/scan is provided
  useEffect(() => {
    setSelected(() => new Set());
    setSearchQuery("");
    setActiveCategoryId("all");
    setAdditionalObservation("");
  }, [photoUri]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function goNext() {
    router.push({
      pathname: "/(tabs)/scanned-health/result",
      params: {
        photoUri,
        detectedIllness,
        capturedAt,
        captureWidth:
          typeof captureWidth === "number" ? String(captureWidth) : undefined,
        captureHeight:
          typeof captureHeight === "number" ? String(captureHeight) : undefined,
        behaviors: JSON.stringify([...selected]),
        additionalObservation: additionalObservation.trim() || undefined,
        monitoringId: monitoringId || undefined,
        chtTag: chtTag || undefined,
      },
    });
  }

  if (!photoUri) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + TAB_BAR_OFFSET}
    >
      <View style={styles.screen}>
        <BackgroundGradient
          width="110%"
          height="110%"
          preserveAspectRatio="xMidYMid slice"
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ scale: 1.08 }, { translateY: -14 }] },
          ]}
        />
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <StatusBar style="dark" />
          
          {/* Pinned Top Header */}
          <View style={styles.fixedHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/(tabs)")
              }
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={22}
                color="#FFF"
              />
            </TouchableOpacity>
            <Text style={styles.pageTitle}>
              {isMonitoringRescan ? "Update Health Scan" : "Scanned Health"}
            </Text>
          </View>
          <Text style={styles.pageSubtitle}>
            {isMonitoringRescan
              ? `Confirm behaviors for ${chtTag || "this chicken"}. The same monitoring record will be updated.`
              : "Confirm what you're seeing before generating the result."}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: 8, paddingBottom: insets.bottom + TAB_BAR_OFFSET + 28 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <HealthInputSummaryCard
            photoUri={photoUri}
            detectedIllness={detectedIllness}
            capturedAt={capturedAt}
            captureWidth={captureWidth}
            captureHeight={captureHeight}
          />

          <View style={styles.gap} />

          <BehaviorChecklist
            items={filteredBehaviors}
            categories={categories}
            searchQuery={searchQuery}
            activeCategoryId={activeCategoryId}
            additionalObservation={additionalObservation}
            loading={behaviorsLoading}
            selectedIds={selected}
            onSearchChange={setSearchQuery}
            onCategoryChange={setActiveCategoryId}
            onObservationChange={setAdditionalObservation}
            onToggle={toggle}
          />

          <HealthFlowFooterButton variant="next" onPress={goNext} />
        </ScrollView>
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ChickIntelPalette.light1,
  },
  safeArea: {
    flex: 1,
  },
  fixedHeader: {
    paddingHorizontal: moderateScale(16),
    paddingTop: 8,
  },
  scroll: {
    paddingHorizontal: moderateScale(16),
    gap: 8,
  },
  pageTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.55,
    color: ChickIntelPalette.gray1,
    marginBottom: 2,
  },
  pageSubtitle: {
    ...HealthTypography.meta,
    marginBottom: 12,
    color: "#5E6665",
  },
  backButton: {
    width: scale(42),
    height: verticalScale(42),
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.green1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.25)",
    shadowColor: "#317667",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(4) },
    elevation: 4,
    flexShrink: 0,
  },
  gap: {
    height: verticalScale(4),
  },
});
