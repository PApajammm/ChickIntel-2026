import { Pressable, StyleSheet, Text } from "react-native";

import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { responsiveFontSize, scale, verticalScale } from "@/utils/responsive";

export type HealthFlowFooterVariant = "next" | "save";

type HealthFlowFooterButtonProps = {
    variant: HealthFlowFooterVariant;
    label?: string;
    onPress: () => void;
    disabled?: boolean;
};

/**
 * Primary CTA styled after the Save Egg Batch button that reads “Next” on the input step and “Save” on the outcome step.
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
                { opacity: disabled ? 0.45 : pressed ? 0.92 : 1 },
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
        height: verticalScale(52),
        borderRadius: 14,
        backgroundColor: ChickIntelPalette.green1,
        alignItems: "center",
        justifyContent: "center",
        marginTop: verticalScale(8),
        shadowColor: "#317667",
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: scale(0), height: verticalScale(5) },
        elevation: 3,
    },
    btnText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(14),
        fontWeight: "700",
        color: ChickIntelPalette.light1,
        letterSpacing: 0.25,
    },
});
