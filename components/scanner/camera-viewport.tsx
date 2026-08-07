import { CameraView, useCameraPermissions } from "expo-camera";
import { forwardRef, useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { ChickFont } from "@/constants/chick-fonts";
import { moderateScale, responsiveFontSize, verticalScale } from "@/utils/responsive";
import { ChickIntelPalette } from "@/constants/chickintel-palette";

type CameraViewportProps = {
    /** When false, shows placeholder instead of the live feed (e.g. simulator / web). */
    active?: boolean;
    /** Toggle continuous torch while scanning. */
    enableTorch?: boolean;
    /** Camera zoom from 0..1. */
    zoom?: number;
    /** Emits whether the native camera has finished mounting and can capture. */
    onReadyChange?: (ready: boolean) => void;
};

export type CameraViewportRef = InstanceType<typeof CameraView>;

/**
 * Full-screen camera preview. Falls back to a neutral surface when the feed is unavailable.
 */
export const CameraViewport = forwardRef<
    CameraViewportRef,
    CameraViewportProps
>(function CameraViewport(
    { active = true, enableTorch = false, zoom = 0, onReadyChange },
    ref,
) {
    const [permission, requestPermission] = useCameraPermissions();
    const didAutoRequest = useRef(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [mountError, setMountError] = useState<string | null>(null);
    const granted = permission?.granted === true;

    useEffect(() => {
        setCameraReady(false);
        setMountError(null);
        onReadyChange?.(false);
    }, [active, granted, onReadyChange]);

    useEffect(() => {
        if (Platform.OS === "web") return;
        if (!permission) return;
        if (permission.granted) return;
        if (!permission.canAskAgain) return;
        if (didAutoRequest.current) return;

        didAutoRequest.current = true;
        requestPermission().catch(() => null);
    }, [permission, requestPermission]);

    const showLiveCamera =
        active && Platform.OS !== "web" && granted && permission !== null;

    if (!showLiveCamera || mountError) {
        const canRequest =
            Platform.OS !== "web" &&
            permission &&
            !permission.granted &&
            permission.canAskAgain;

        return (
            <View style={styles.placeholder}>
                {!permission ? (
                    <Text style={styles.placeholderHint}>
                        Preparing camera permission...
                    </Text>
                ) : null}
                {canRequest ? (
                    <Pressable
                        onPress={() => requestPermission()}
                        style={({ pressed }) => [
                            styles.permissionBtn,
                            { opacity: pressed ? 0.88 : 1 },
                        ]}
                    >
                        <Text style={styles.permissionBtnText}>
                            Allow camera access
                        </Text>
                    </Pressable>
                ) : (
                    <Text style={styles.placeholderHint}>
                        {mountError
                            ? mountError
                            : Platform.OS === "web"
                              ? "Camera preview runs on a device build."
                              : "Camera access is needed to scan."}
                    </Text>
                )}
            </View>
        );
    }

    return (
        <View style={styles.fill}>
            <CameraView
                ref={ref}
                style={StyleSheet.absoluteFill}
                facing="back"
                mode="picture"
                animateShutter
                active={active}
                enableTorch={Platform.OS === "web" ? false : enableTorch}
                zoom={zoom}
                onCameraReady={() => {
                    setCameraReady(true);
                    onReadyChange?.(true);
                }}
                onMountError={(event) => {
                    const message =
                        event.message ||
                        "Unable to start the camera preview.";
                    setMountError(message);
                    setCameraReady(false);
                    onReadyChange?.(false);
                }}
            />
            {!cameraReady ? (
                <View style={styles.startingOverlay}>
                    <Text style={styles.startingText}>Starting camera...</Text>
                </View>
            ) : null}
        </View>
    );
});

const styles = StyleSheet.create({
    fill: {
        flex: 1,
        backgroundColor: "#000000",
    },
    startingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.28)",
    },
    startingText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(14),
        fontWeight: "600",
        color: "#FFFFFF",
        textAlign: "center",
    },
    placeholder: {
        flex: 1,
        backgroundColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        padding: moderateScale(24),
    },
    placeholderHint: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(14),
        fontWeight: "500",
        color: ChickIntelPalette.gray2,
        textAlign: "center",
    },
    permissionBtn: {
        paddingHorizontal: moderateScale(20),
        paddingVertical: verticalScale(12),
        borderRadius: 999,
        backgroundColor: ChickIntelPalette.green1,
    },
    permissionBtnText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(14),
        fontWeight: "600",
        color: "#FFFFFF",
    },
});
