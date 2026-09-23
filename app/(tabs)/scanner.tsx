import {
    moderateScale,
    responsiveFontSize,
    scale as rscale,
    verticalScale,
} from "@/utils/responsive";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
    CameraViewport,
    type CameraViewportRef,
} from "@/components/scanner/camera-viewport";
import {
    ModeSelectorCard,
    type ScannerMode,
} from "@/components/scanner/mode-selector-card";
import { ScannerShutter } from "@/components/scanner/scanner-shutter";
import { ViewfinderOverlay } from "@/components/scanner/viewfinder-overlay";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { DEFAULT_IMAGE_BASED_DETECTION } from "@/constants/health-scan-behaviors";
import {
    SUPPORTED_BREEDS,
    SUPPORTED_DISEASES,
} from "@/constants/supported-scan-categories";
import { useAuth } from "@/providers/auth-provider";
import {
    assessHealthCapture,
    buildHealthCaptureGuidance,
} from "@/utils/health-capture-quality";
import { logError, logStep } from "@/utils/logger";
import {
    inferSexFromImage,
    resolveSexDetails,
} from "@/utils/sexing-image-inference";

import {
    optimizePhotoForInference
} from "@/utils/image-crop-helper";

/** Keep controls near the bottom edge, just clear of the tab bar. */
const CONTROLS_CLEARANCE_ABOVE_TAB = 0;
const MAX_SCAN_ZOOM = 0.7;

type GuestScannerMode = ScannerMode | "sex";

const MODE_COPY: Record<
  GuestScannerMode,
  {
    title: string;
    subtitle: string;
    captureTip: string;
  }
> = {
  health: {
    title: "Scan your chicken",
    subtitle:
      "Frame the head, eyes, comb, posture, or affected feet clearly for an accurate symptom scan.",
    captureTip:
      "Use bright light and keep the affected area centered inside the guide before capture.",
  },
  breed: {
    title: "Scan your chicken",
    subtitle:
      "Frame the chicken inside the guide for a clean breed or health read.",
    captureTip:
      "Keep the full body visible and avoid heavy shadows before capture.",
  },
  sex: {
    title: "Sex your chicken",
    subtitle: "Frame the chicken clearly for a cock or hen classification.",
    captureTip: "Keep the full chicken visible and centered before capture.",
  },
};

export default function ScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    monitoringId?: string;
    chtTag?: string;
    initialMode?: string;
  }>();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { guestMode, session } = useAuth();
  const cameraRef = useRef<CameraViewportRef>(null);
  const isGuestExperience = guestMode && !session;

  const [mode, setMode] = useState<GuestScannerMode>("health");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [isAnalyzingSex, setIsAnalyzingSex] = useState(false);
  const [supportedInfoVisible, setSupportedInfoVisible] = useState(false);

  const monitoringId =
    typeof params.monitoringId === "string" ? params.monitoringId : "";
  const chtTag = typeof params.chtTag === "string" ? params.chtTag : "";
  const isMonitoringRescan = Boolean(monitoringId);

  useEffect(() => {
    if (params.initialMode === "health" || isMonitoringRescan) {
      setMode("health");
    } else if (params.initialMode === "breed" || params.initialMode === "sex") {
      setMode(params.initialMode);
    }
  }, [isMonitoringRescan, params.initialMode]);

  const isNarrowScreen = width < 360;
  const isCompactScreen = height < 720 || isNarrowScreen;
  const viewfinderSize = isCompactScreen
    ? Math.min(width - 64, height * 0.28, 250)
    : Math.min(width - 48, height * 0.35, 320);

  const modeCopy = isMonitoringRescan
    ? {
        title: `Re-scan ${chtTag || "chicken"}`,
        subtitle:
          "Take a new photo to update this chicken's health record. Previous scans are kept.",
        captureTip:
          "Use bright light and keep the chicken centered inside the guide before capture.",
      }
    : MODE_COPY[mode];

  function handleBack() {
    if (isGuestExperience) {
      router.replace("/guest-mode");
      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }

  function openHealthFlow(photoUri: string, width?: number, height?: number) {
    const capturedAt = new Date().toISOString();
    const healthPathname = "/(tabs)/scanned-health";

    router.push({
      pathname: healthPathname,
      params: {
        photoUri,
        detectedIllness: DEFAULT_IMAGE_BASED_DETECTION,
        capturedAt,
        captureWidth:
          typeof width === "number" ? String(Math.round(width)) : undefined,
        captureHeight:
          typeof height === "number" ? String(Math.round(height)) : undefined,
        monitoringId: monitoringId || undefined,
        chtTag: chtTag || undefined,
      },
    } as unknown as Parameters<typeof router.push>[0]);
  }

  useEffect(() => {
    try {
      logStep("ScannerScreen mounted", { screen: "tabs/scanner" });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!isFocused) {
      setTorchEnabled(false);
      setCameraReady(false);
    }
  }, [isFocused]);

  async function handleCapture() {
    if (!cameraReady) {
      Alert.alert(
        "Camera starting",
        "Please wait until the camera preview is ready.",
      );
      return;
    }

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // ignore
    }

    const cam = cameraRef.current;
    if (!cam) {
      try {
        logStep("Scanner capture skipped", {
          reason: "no_camera_ref",
          mode,
        });
      } catch {
        // ignore
      }
      return;
    }

    try {
      const rawPhoto = await cam.takePictureAsync({
        quality: 0.88,
        skipProcessing: Platform.OS === "ios",
      });

      if (mode === "sex") {
        setIsAnalyzingSex(true);
      }

      // Preserve full photo clarity and aspect ratio for inference across head, feet, and full-body symptoms
      const photo = await optimizePhotoForInference({
        photoUri: rawPhoto.uri,
        photoWidth: rawPhoto.width,
        photoHeight: rawPhoto.height,
        maxDimension: 1024,
        quality: 0.88,
      });

      try {
        logStep("Scanner capture complete", {
          mode,
          uri: photo.uri,
          croppedWidth: photo.width,
          croppedHeight: photo.height,
        });
      } catch {
        // ignore
      }

      if (mode === "health") {
        const assessment = assessHealthCapture(photo);

        try {
          logStep("Health capture assessed", {
            width: assessment.width,
            height: assessment.height,
            issues: assessment.issues,
          });
        } catch {
          // ignore
        }

        if (!assessment.isAcceptable) {
          Alert.alert("Retake photo?", buildHealthCaptureGuidance(assessment), [
            {
              text: "Retake",
              style: "cancel",
            },
            {
              text: "Use anyway",
              onPress: () =>
                openHealthFlow(photo.uri, photo.width, photo.height),
            },
          ]);
          return;
        }

        openHealthFlow(photo.uri, photo.width, photo.height);
      } else if (mode === "breed") {
        router.push({
          pathname: "/(tabs)/breed-result",
          params: {
            photoUri: photo.uri,
            initialMode: "breed",
          },
        } as any);
      } else if (mode === "sex") {
        const inference = await inferSexFromImage(photo.uri);
        const details = resolveSexDetails(inference);
        if (details.sex === "male" || details.sex === "female") {
          Alert.alert(
            "Sex detected",
            `This chicken appears to be ${details.sex}.`,
          );
        } else {
          Alert.alert(
            "Sex not detected",
            "Try another angle with the chicken clearly centered.",
          );
        }
      }
    } catch (e) {
      try {
        logError("Scanner capture failed", e);
      } catch {
        // ignore
      }
    } finally {
      setIsAnalyzingSex(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <CameraViewport
        ref={cameraRef}
        active={isFocused}
        enableTorch={torchEnabled}
        zoom={zoomLevel}
        onReadyChange={setCameraReady}
      />

      {isAnalyzingSex ? (
        <View style={styles.analysisOverlay} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={ChickIntelPalette.light1} />
          <Text style={styles.analysisTitle}>Analyzing image...</Text>
          <Text style={styles.analysisSubtitle}>
            Checking whether the chicken is male or female.
          </Text>
        </View>
      ) : null}

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topRow, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.titleStack}>
            <Text style={styles.instruction}>{modeCopy.title}</Text>
            <Text
              style={styles.subInstruction}
              numberOfLines={isCompactScreen ? 1 : 2}
            >
              {modeCopy.subtitle}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setTorchEnabled((prev) => !prev)}
            style={[
              styles.flashToggle,
              torchEnabled && styles.flashToggleActive,
            ]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              torchEnabled ? "Turn flash off" : "Turn flash on"
            }
          >
            <MaterialCommunityIcons
              name={torchEnabled ? "flash" : "flash-off"}
              size={22}
              color={torchEnabled ? "#FFF" : ChickIntelPalette.gray1}
            />
          </TouchableOpacity>
          {mode !== "sex" ? (
            <TouchableOpacity
              onPress={() => setSupportedInfoVisible(true)}
              style={styles.infoButton}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`View supported ${mode === "health" ? "diseases" : "breeds"}`}
            >
              <MaterialCommunityIcons
                name="information-outline"
                size={22}
                color={ChickIntelPalette.gray1}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        <View
          pointerEvents="box-none"
          style={[
            styles.viewfinderRegion,
            isGuestExperience && styles.viewfinderRegionGuest,
            isCompactScreen && { gap: 6 },
          ]}
        >
          <ViewfinderOverlay size={viewfinderSize} />
          {mode === "sex" ? (
            <View
              style={[
                styles.captureTipCard,
                isCompactScreen && styles.captureTipCardCompact,
                isNarrowScreen && styles.captureTipCardNarrow,
              ]}
            >
              <View style={styles.supportedCardHeadingRow}>
                <MaterialCommunityIcons
                  name="gender-male-female"
                  size={15}
                  color={ChickIntelPalette.green1}
                />
                <Text style={styles.supportedCardHeading}>
                  SUPPORTED SEX CATEGORIES
                </Text>
              </View>
              <Text style={styles.supportedCardCategories}>Male / Female</Text>
              <Text style={styles.supportedCardNote}>
                Camera Sexing detects chickens 9 weeks old and above.
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.bottomColumn,
            {
              paddingBottom: CONTROLS_CLEARANCE_ABOVE_TAB,
            },
            isCompactScreen && { gap: 4 },
          ]}
        >
          {!isMonitoringRescan && !isGuestExperience && mode !== "sex" ? (
            <View style={styles.cardWrap}>
              <ModeSelectorCard mode={mode} onModeChange={setMode} />
            </View>
          ) : null}
          <View style={styles.zoomWrap}>
            <View style={styles.zoomRailWrap}>
              <MaterialCommunityIcons
                name="magnify-minus-outline"
                size={16}
                color={ChickIntelPalette.gray2}
              />
              <Slider
                style={styles.zoomSlider}
                minimumValue={0}
                maximumValue={MAX_SCAN_ZOOM}
                value={zoomLevel}
                step={0.01}
                onValueChange={setZoomLevel}
                minimumTrackTintColor={ChickIntelPalette.green1}
                maximumTrackTintColor="rgba(67, 139, 123, 0.18)"
                thumbTintColor={ChickIntelPalette.green2}
                accessibilityLabel="Scanner zoom"
                accessibilityRole="adjustable"
              />
              <MaterialCommunityIcons
                name="magnify-plus-outline"
                size={16}
                color={ChickIntelPalette.gray2}
              />
            </View>
            <Text style={styles.zoomValue}>
              {Math.max(1, 1 + zoomLevel * 2).toFixed(1)}x
            </Text>
          </View>
          <ScannerShutter
            onPress={handleCapture}
            disabled={!cameraReady || isAnalyzingSex}
          />
        </View>
      </View>

      <Modal
        visible={supportedInfoVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSupportedInfoVisible(false)}
      >
        <Pressable
          style={styles.infoBackdrop}
          onPress={() => setSupportedInfoVisible(false)}
        >
          <Pressable
            style={styles.infoCard}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.infoHeader}>
              <Text style={styles.infoTitle}>
                {mode === "health"
                  ? "Supported diseases"
                  : mode === "breed"
                    ? "Supported breeds"
                    : "Supported sex categories"}
              </Text>
              <TouchableOpacity
                onPress={() => setSupportedInfoVisible(false)}
                accessibilityLabel="Close supported list"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color={ChickIntelPalette.gray1}
                />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.infoList}
              contentContainerStyle={styles.infoListContent}
              showsVerticalScrollIndicator
              nestedScrollEnabled
            >
              {(mode === "health"
                ? SUPPORTED_DISEASES
                : mode === "breed"
                  ? SUPPORTED_BREEDS
                  : (["Male", "Female"] as const)
              ).map((item) => (
                <View key={item} style={styles.infoListItem}>
                  <View style={styles.infoListBullet} />
                  <Text style={styles.infoListText}>{item}</Text>
                </View>
              ))}
            </ScrollView>
            <Text style={styles.infoNote}>
              {mode === "sex"
                ? "Camera Sexing detects chickens 9 weeks old and above."
                : "Only these supported categories are detected."}
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  analysisOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(28),
    backgroundColor: "rgba(0, 0, 0, 0.78)",
  },
  analysisTitle: {
    marginTop: verticalScale(16),
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(22),
    fontWeight: "800",
    color: ChickIntelPalette.light1,
    textAlign: "center",
  },
  analysisSubtitle: {
    marginTop: verticalScale(8),
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 19,
    color: ChickIntelPalette.textMuted,
    textAlign: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topRow: {
    paddingHorizontal: moderateScale(18),
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  backButton: {
    width: rscale(42),
    height: verticalScale(42),
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.green1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    flexShrink: 0,
  },
  titleStack: {
    flex: 1,
    gap: 4,
  },
  instructionRow: {
    paddingHorizontal: moderateScale(18),
  },
  instruction: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(20),
    fontWeight: "800",
    letterSpacing: -0.4,
    color: ChickIntelPalette.light1,
    lineHeight: 30,
    textAlign: "left",
    textShadowColor: ChickIntelPalette.green1,
    textShadowOffset: { width: rscale(0), height: verticalScale(0) },
    textShadowRadius: 10,
  },
  subInstruction: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 18,
    color: ChickIntelPalette.textMuted,
    opacity: 0.92,
    maxWidth: rscale(260),
  },
  flashToggle: {
    width: rscale(42),
    height: verticalScale(42),
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.25)",
    shadowColor: "#317667",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: verticalScale(4) },
    elevation: 4,
    flexShrink: 0,
  },
  flashToggleActive: {
    backgroundColor: ChickIntelPalette.green1,
  },
  infoButton: {
    width: rscale(42),
    height: verticalScale(42),
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.25)",
  },
  infoBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    padding: moderateScale(20),
  },
  infoCard: {
    backgroundColor: ChickIntelPalette.light1,
    borderRadius: 16,
    padding: moderateScale(18),
    gap: 12,
    maxHeight: "72%",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  infoTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  infoList: {
    flexGrow: 0,
    maxHeight: verticalScale(300),
  },
  infoListContent: {
    gap: 8,
  },
  infoListItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoListBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ChickIntelPalette.green1,
  },
  infoListText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(15),
    lineHeight: 22,
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    flex: 1,
  },
  infoNote: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 17,
    color: ChickIntelPalette.textMuted,
  },
  supportedCardHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  supportedCardHeading: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: ChickIntelPalette.green1,
  },
  supportedCardCategories: {
    marginTop: 4,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    lineHeight: 19,
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  supportedCardNote: {
    marginTop: 3,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 15,
    fontWeight: "600",
    color: "#44504D",
  },
  viewfinderRegion: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 0,
    gap: 14,
  },
  viewfinderRegionGuest: {
    justifyContent: "center",
    paddingBottom: 0,
  },
  captureTipCard: {
    width: "80%",
    maxWidth: rscale(320),
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(10),
    borderRadius: 14,
    backgroundColor: "rgba(254, 254, 254, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.34)",
  },
  captureTipCardCompact: {
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(6),
  },
  captureTipCardNarrow: {
    width: "92%",
  },
  supportedCardCategoriesNarrow: {
    fontSize: responsiveFontSize(13),
    lineHeight: 18,
  },
  captureTipLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 0.35,
    textTransform: "uppercase",
    color: ChickIntelPalette.green1,
    marginBottom: 2,
  },
  captureTipText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 17,
    fontWeight: "500",
    color: ChickIntelPalette.gray1,
    textAlign: "center",
  },
  bottomColumn: {
    paddingHorizontal: moderateScale(18),
    gap: 6,
    alignItems: "center",
  },
  cardWrap: {
    alignSelf: "stretch",
    marginBottom: 2,
  },
  zoomWrap: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 4,
  },
  zoomValue: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
    marginTop: 1,
    textAlign: "center",
  },
  zoomRailWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "50%",
  },
  zoomSlider: {
    flex: 1,
    height: verticalScale(28),
  },
  glowTop: {
    position: "absolute",
    top: -70,
    right: -50,
    width: rscale(180),
    height: rscale(180),
    borderRadius: rscale(180),
    backgroundColor: "rgba(49, 118, 103, 0.16)",
  },
  glowBottom: {
    position: "absolute",
    left: -60,
    bottom: 120,
    width: rscale(160),
    height: rscale(160),
    borderRadius: rscale(160),
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
});
