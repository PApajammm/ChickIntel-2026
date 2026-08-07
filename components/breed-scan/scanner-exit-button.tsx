import { Pressable, StyleSheet, Text } from "react-native";

import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { HealthTypography } from "@/constants/health-typography";

type ScannerExitButtonProps = {
    onPress: () => void;
    label?: string;
    accessibilityLabel?: string;
};

/**
 * Charcoal pill used to leave scanner utility flows (e.g. back to dashboard).
 */
export function ScannerExitButton({
    onPress,
    label = "Back to home",
    accessibilityLabel = "Back to home",
}: ScannerExitButtonProps) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.btn,
                { opacity: pressed ? 0.9 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
        >
            <Text style={styles.btnText}>{label}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    btn: {
        alignSelf: "center",
        minWidth: "72%",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 15,
        paddingHorizontal: 28,
        borderRadius: 999,
        backgroundColor: "rgba(21, 26, 34, 0.96)",
        borderWidth: 1,
        borderColor: ChickIntelPalette.green2,
        marginTop: 8,
    },
    btnText: {
        ...HealthTypography.bodyMedium,
        fontSize: 16,
        fontWeight: "600",
        color: ChickIntelPalette.light1,
        letterSpacing: 0.25,
    },
});
