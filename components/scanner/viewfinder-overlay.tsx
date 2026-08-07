import { StyleSheet, View } from "react-native";

import { ChickIntelPalette } from "@/constants/chickintel-palette";

const BRACKET = ChickIntelPalette.green2;

type ViewfinderOverlayProps = {
    size: number;
};

/**
 * Four L-shaped corner brackets marking the ideal framing area for detection.
 */
export function ViewfinderOverlay({ size }: ViewfinderOverlayProps) {
    const arm = Math.max(22, Math.round(size * 0.09));
    const thick = 3;

    return (
        <View
            pointerEvents="box-none"
            style={[styles.wrap, { width: size, height: size }]}
        >
            <View
                style={[
                    styles.corner,
                    styles.topLeft,
                    {
                        width: arm,
                        height: arm,
                        borderTopWidth: thick,
                        borderLeftWidth: thick,
                        borderColor: BRACKET,
                    },
                ]}
            />
            <View
                style={[
                    styles.corner,
                    styles.topRight,
                    {
                        width: arm,
                        height: arm,
                        borderTopWidth: thick,
                        borderRightWidth: thick,
                        borderColor: BRACKET,
                    },
                ]}
            />
            <View
                style={[
                    styles.corner,
                    styles.bottomLeft,
                    {
                        width: arm,
                        height: arm,
                        borderBottomWidth: thick,
                        borderLeftWidth: thick,
                        borderColor: BRACKET,
                    },
                ]}
            />
            <View
                style={[
                    styles.corner,
                    styles.bottomRight,
                    {
                        width: arm,
                        height: arm,
                        borderBottomWidth: thick,
                        borderRightWidth: thick,
                        borderColor: BRACKET,
                    },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: "relative",
    },
    corner: {
        position: "absolute",
        borderRadius: 3,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderBottomWidth: 0,
        borderRightWidth: 0,
    },
    topRight: {
        top: 0,
        right: 0,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderTopWidth: 0,
        borderRightWidth: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderTopWidth: 0,
        borderLeftWidth: 0,
    },
});
