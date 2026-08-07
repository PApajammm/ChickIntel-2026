import { Pressable, StyleSheet, Text } from "react-native";

import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { responsiveFontSize, verticalScale } from "@/utils/responsive";
import { HealthTypography } from "@/constants/health-typography";

export type HealthFlowFooterVariant = "next" | "save";

type HealthFlowFooterButtonProps = {
    variant: HealthFlowFooterVariant;
    label?: string;
    onPress: () => void;
    disabled?: boolean;
};

/**
 * Primary CTA that reads “Next” on the input step and “Save” on the outcome step.
 */
export function HealthFlowFooterButton({
    variant,
    label,
    onPress,
    disabled,
}: HealthFlowFooterButtonProps) {
    const resolvedLabel =
        label ?? (variant === "next" ? "Next" : "Save");
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.btn,
                { opacity: disabled ? 0.45 : pressed ? 0.9 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={resolvedLabel}
        >
            <Text style={styles.btnText}>{resolvedLabel}</Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    btn: {
        alignSelf: "stretch",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: verticalScale(15),
        borderRadius: 999,
        backgroundColor: ChickIntelPalette.gray1,
        marginTop: verticalScale(8),
    },
    btnText: {
        ...HealthTypography.bodyMedium,
        fontSize: responsiveFontSize(16),
        fontWeight: "600",
        color: "#FFFFFF",
        letterSpacing: 0.25,
    },
});
