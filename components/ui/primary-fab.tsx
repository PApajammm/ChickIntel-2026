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
    accessibilityLabel: string;
};

const FAB_SIZE = scale(60);

export function PrimaryFab({
    iconName,
    onPress,
    bottom,
    centered,
    accessibilityLabel,
}: PrimaryFabProps) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.fab,
                {
                    width: FAB_SIZE,
                    height: FAB_SIZE,
                    marginLeft: -FAB_SIZE / 2,
                    bottom,
                },
                centered && {
                    top: "50%",
                    marginTop: -FAB_SIZE / 2,
                },
                { opacity: pressed ? 0.88 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
        >
            <MaterialCommunityIcons
                name={iconName}
                size={scale(28)}
                color={ChickIntelPalette.green1}
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    fab: {
        position: "absolute",
        left: "50%",
        borderRadius: 999,
        backgroundColor: ChickIntelPalette.light1,
        borderWidth: 2,
        borderColor: ChickIntelPalette.green1,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#000000",
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: verticalScale(8) },
        elevation: 6,
        zIndex: 20,
    },
    fabCentered: {},
});
