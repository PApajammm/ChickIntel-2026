import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet } from "react-native";

import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { scale, verticalScale } from "@/utils/responsive";

type PrimaryFabProps = {
    iconName: ComponentProps<typeof MaterialCommunityIcons>["name"];
    onPress: () => void;
    bottom?: number;
    centered?: boolean;
    size?: number;
    iconSize?: number;
    accessibilityLabel: string;
};

const DEFAULT_FAB_SIZE = scale(92);

export function PrimaryFab({
    iconName,
    onPress,
    bottom,
    centered,
    size = DEFAULT_FAB_SIZE,
    iconSize,
    accessibilityLabel,
}: PrimaryFabProps) {
    const computedIconSize = iconSize ?? Math.round(size * 0.48);
    const computedBorderRadius = Math.round(size * 0.28);

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.fab,
                {
                    width: size,
                    height: size,
                    borderRadius: computedBorderRadius,
                    marginLeft: -size / 2,
                    bottom,
                },
                centered && {
                    top: "50%",
                    marginTop: -size / 2,
                },
                {
                    opacity: pressed ? 0.82 : 1,
                    transform: [{ scale: pressed ? 0.95 : 1 }],
                },
            ]}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
        >
            <MaterialCommunityIcons
                name={iconName}
                size={computedIconSize}
                color="#FFFFFF"
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    fab: {
        position: "absolute",
        left: "50%",
        backgroundColor: ChickIntelPalette.green1,
        borderWidth: 1.5,
        borderColor: "rgba(49, 118, 103, 0.25)",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#317667",
        shadowOpacity: 0.32,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: verticalScale(5) },
        elevation: 8,
        zIndex: 20,
    },
});
