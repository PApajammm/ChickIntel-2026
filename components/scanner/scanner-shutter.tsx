import { Pressable, StyleSheet, View } from "react-native";

import { ChickIntelPalette } from "@/constants/chickintel-palette";

type ScannerShutterProps = {
    onPress: () => void;
    disabled?: boolean;
};

const OUTER = 78;
const RING_WHITE = 4;
const CORE = 52;

/**
 * Large mint capture control with white + outer mint rings.
 */
export function ScannerShutter({ onPress, disabled }: ScannerShutterProps) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.hit,
                { opacity: disabled ? 0.45 : pressed ? 0.9 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Capture scan"
        >
            <View style={styles.outerRing}>
                <View style={styles.whiteRing}>
                    <View style={styles.core} />
                </View>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    hit: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 8,
    },
    outerRing: {
        width: OUTER,
        height: OUTER,
        borderRadius: OUTER / 2,
        borderWidth: 3,
        borderColor: ChickIntelPalette.mediumGreen,
        alignItems: "center",
        justifyContent: "center",
    },
    whiteRing: {
        width: OUTER - 10,
        height: OUTER - 10,
        borderRadius: (OUTER - 10) / 2,
        borderWidth: RING_WHITE,
        borderColor: "#FFFFFF",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
    },
    core: {
        width: CORE,
        height: CORE,
        borderRadius: CORE / 2,
        backgroundColor: ChickIntelPalette.green2,
    },
});
