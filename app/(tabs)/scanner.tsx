import { MaterialCommunityIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useIsFocused } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { moderateScale, responsiveFontSize, scale as rscale, verticalScale } from "@/utils/responsive";

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
    assessHealthCapture,
    buildHealthCaptureGuidance,
} from "@/utils/health-capture-quality";
import { logError, logStep } from "@/utils/logger";

import { cropPhotoToViewfinder } from "@/utils/image-crop-helper";

/** Keep controls near the bottom edge, just clear of the tab bar. */
const CONTROLS_CLEARANCE_ABOVE_TAB = 0;
const MAX_SCAN_ZOOM = 0.7;

const MODE_COPY: Record<
    ScannerMode,
    {
        title: string;
        subtitle: string;
        captureTip: string;
    }
> = {
    health: {
        title: "Scan your chicken",
        subtitle:
            "Frame the head, eyes, comb, beak, and feathers clearly for a cleaner symptom scan.",
        captureTip:
            "Use bright light and keep the bird centered inside the guide before capture.",
    },
    breed: {
        title: "Scan your chicken",
        subtitle:
            "Frame the bird inside the guide for a clean breed or health read.",
        captureTip:
            "Keep the full body visible and avoid heavy shadows before capture.",
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
    const cameraRef = useRef<CameraViewportRef>(null);

    const [mode, setMode] = useState<ScannerMode>("health");
    const [torchEnabled, setTorchEnabled] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(0);
    const [cameraReady, setCameraReady] = useState(false);

    const monitoringId =
        typeof params.monitoringId === "string" ? params.monitoringId : "";
    const chtTag = typeof params.chtTag === "string" ? params.chtTag : "";
    const isMonitoringRescan = Boolean(monitoringId);

    useEffect(() => {
        if (params.initialMode === "health" || isMonitoringRescan) {
            setMode("health");
        }
    }, [isMonitoringRescan, params.initialMode]);

    const isCompactScreen = height < 720;
    const viewfinderSize = isCompactScreen
        ? Math.min(width - 64, height * 0.28, 250)
        : Math.min(width - 48, height * 0.35, 320);

    const modeCopy = isMonitoringRescan
        ? {
              title: `Re-scan ${chtTag || "chicken"}`,
              subtitle:
                  "Take a new photo to update this chicken's health record. Previous scans are kept.",
              captureTip:
                  "Use bright light and keep the bird centered inside the guide before capture.",
          }
        : MODE_COPY[mode];

    function openHealthFlow(photoUri: string, width?: number, height?: number) {
        const capturedAt = new Date().toISOString();

        router.push({
            pathname: "/(tabs)/scanned-health",
            params: {
                photoUri,
                detectedIllness: DEFAULT_IMAGE_BASED_DETECTION,
                capturedAt,
                captureWidth:
                    typeof width === "number" ? String(Math.round(width)) : undefined,
                captureHeight:
                    typeof height === "number"
                        ? String(Math.round(height))
                        : undefined,
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

            const photo = await cropPhotoToViewfinder({
                photoUri: rawPhoto.uri,
                photoWidth: rawPhoto.width,
                photoHeight: rawPhoto.height,
                viewfinderSize,
                screenWidth: width,
                screenHeight: width * 1.5,
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
                    Alert.alert(
                        "Retake photo?",
                        buildHealthCaptureGuidance(assessment),
                        [
                            {
                                text: "Retake",
                                style: "cancel",
                            },
                            {
                                text: "Use anyway",
                                onPress: () =>
                                    openHealthFlow(
                                        photo.uri,
                                        photo.width,
                                        photo.height,
                                    ),
                            },
                        ],
                    );
                    return;
                }

                openHealthFlow(photo.uri, photo.width, photo.height);
            } else if (mode === "breed") {
                router.push({
                    pathname: "/(tabs)/breed-result",
                    params: {
                        photoUri: photo.uri,
                    },
                } as any);
            }
        } catch (e) {
            try {
                logError("Scanner capture failed", e);
            } catch {
                // ignore
            }
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

            <View style={styles.overlay} pointerEvents="box-none">
                <View style={[styles.topRow, { paddingTop: insets.top + 10 }]}>
                    <View style={styles.titleStack}>
                        <Text style={styles.instruction}>{modeCopy.title}</Text>
                        <Text style={styles.subInstruction} numberOfLines={isCompactScreen ? 1 : 2}>
                            {modeCopy.subtitle}
                        </Text>
                    </View>
                    <Pressable
                        onPress={() => setTorchEnabled((prev) => !prev)}
                        style={({ pressed }) => [
                            styles.flashToggle,
                            { opacity: pressed ? 0.86 : 1 },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={
                            torchEnabled ? "Turn flash off" : "Turn flash on"
                        }
                    >
                        <MaterialCommunityIcons
                            name={torchEnabled ? "flash" : "flash-off"}
                            size={18}
                            color={
                                torchEnabled
                                    ? ChickIntelPalette.green1
                                    : ChickIntelPalette.gray2
                            }
                        />
                        <Text
                            style={[
                                styles.flashToggleText,
                                torchEnabled && styles.flashToggleTextActive,
                            ]}
                        >
                            {torchEnabled ? "Flash On" : "Flash Off"}
                        </Text>
                    </Pressable>
                </View>

                <View pointerEvents="box-none" style={[styles.viewfinderRegion, isCompactScreen && { gap: 6 }]}>
                    <ViewfinderOverlay size={viewfinderSize} />
                    <View style={[styles.captureTipCard, isCompactScreen && styles.captureTipCardCompact]}>
                        <Text style={styles.captureTipLabel}>Capture tip</Text>
                        <Text style={styles.captureTipText} numberOfLines={2}>
                            {modeCopy.captureTip}
                        </Text>
                    </View>
                </View>

                <View
                    style={[
                        styles.bottomColumn,
                        {
                            paddingBottom:
                                insets.bottom + CONTROLS_CLEARANCE_ABOVE_TAB,
                        },
                        isCompactScreen && { gap: 4 },
                    ]}
                >
                    {!isMonitoringRescan ? (
                        <View style={styles.cardWrap}>
                            <ModeSelectorCard
                                mode={mode}
                                onModeChange={setMode}
                            />
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
                        disabled={!cameraReady}
                    />
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: ChickIntelPalette.green1,
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
        color: ChickIntelPalette.gray2,
        opacity: 0.92,
        maxWidth: rscale(260),
    },
    flashToggle: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        paddingHorizontal: moderateScale(14),
        paddingVertical: verticalScale(8),
        backgroundColor: "rgba(202, 227, 221, 0.92)",
        borderWidth: 1,
        borderColor: ChickIntelPalette.green2,
    },
    flashToggleText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        fontWeight: "600",
        color: ChickIntelPalette.gray1,
    },
    flashToggleTextActive: {
        color: ChickIntelPalette.green1,
    },
    viewfinderRegion: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
    },
    captureTipCard: {
        width: "80%",
        maxWidth: rscale(320),
        paddingHorizontal: moderateScale(14),
        paddingVertical: verticalScale(10),
        borderRadius: 14,
        backgroundColor: "rgba(254, 254, 254, 0.9)",
        borderWidth: 1,
        borderColor: "rgba(67, 139, 123, 0.22)",
    },
    captureTipCardCompact: {
        paddingHorizontal: moderateScale(10),
        paddingVertical: verticalScale(6),
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
