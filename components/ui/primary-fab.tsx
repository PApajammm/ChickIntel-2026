import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useRef } from "react";
import {
    Animated,
    PanResponder,
    Pressable,
    StyleSheet,
    useWindowDimensions,
} from "react-native";

import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { scale, verticalScale } from "@/utils/responsive";

type PrimaryFabProps = {
    iconName: ComponentProps<typeof MaterialCommunityIcons>["name"];
    onPress: () => void;
    bottom?: number;
    centered?: boolean;
    variant?: "default" | "green";
    draggable?: boolean;
    accessibilityLabel: string;
};

const FAB_SIZE = scale(60);

export function PrimaryFab({
    iconName,
    onPress,
    bottom = 50,
    centered,
    variant = "default",
    draggable = false,
    accessibilityLabel,
}: PrimaryFabProps) {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isGreen = variant === "green";

    const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const currentPosRef = useRef({ x: 0, y: 0 });

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (_, gesture) =>
                Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
            onPanResponderGrant: () => {
                pan.setOffset({
                    x: currentPosRef.current.x,
                    y: currentPosRef.current.y,
                });
                pan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: (_, gesture) => {
                const initialTop = windowHeight - bottom - FAB_SIZE;
                const minAllowedTop = windowHeight * 0.5; // Do not go beyond the half of vertical viewpoint
                const maxAllowedTop = windowHeight - FAB_SIZE - 20;

                const maxUpwardDrag = minAllowedTop - initialTop;
                const maxDownwardDrag = maxAllowedTop - initialTop;

                const minX = -windowWidth / 2 + FAB_SIZE / 2 + 16;
                const maxX = windowWidth / 2 - FAB_SIZE / 2 - 16;

                const targetX = Math.min(
                    maxX,
                    Math.max(minX, currentPosRef.current.x + gesture.dx),
                );
                const targetY = Math.min(
                    maxDownwardDrag,
                    Math.max(maxUpwardDrag, currentPosRef.current.y + gesture.dy),
                );

                pan.setValue({
                    x: targetX - currentPosRef.current.x,
                    y: targetY - currentPosRef.current.y,
                });
            },
            onPanResponderRelease: (_, gesture) => {
                pan.flattenOffset();
                const initialTop = windowHeight - bottom - FAB_SIZE;
                const minAllowedTop = windowHeight * 0.5;
                const maxAllowedTop = windowHeight - FAB_SIZE - 20;

                const maxUpwardDrag = minAllowedTop - initialTop;
                const maxDownwardDrag = maxAllowedTop - initialTop;

                const minX = -windowWidth / 2 + FAB_SIZE / 2 + 16;
                const maxX = windowWidth / 2 - FAB_SIZE / 2 - 16;

                const finalX = Math.min(
                    maxX,
                    Math.max(minX, currentPosRef.current.x + gesture.dx),
                );
                const finalY = Math.min(
                    maxDownwardDrag,
                    Math.max(maxUpwardDrag, currentPosRef.current.y + gesture.dy),
                );

                currentPosRef.current = { x: finalX, y: finalY };
                pan.setValue({ x: finalX, y: finalY });

                // Detect tap vs drag
                if (Math.hypot(gesture.dx, gesture.dy) < 6) {
                    onPress();
                }
            },
        }),
    ).current;

    if (draggable) {
        return (
            <Animated.View
                {...panResponder.panHandlers}
                style={[
                    styles.fab,
                    isGreen ? styles.fabGreen : styles.fabDefault,
                    {
                        width: FAB_SIZE,
                        height: FAB_SIZE,
                        marginLeft: -FAB_SIZE / 2,
                        bottom,
                        transform: pan.getTranslateTransform(),
                    },
                ]}
                accessibilityRole="button"
                accessibilityLabel={accessibilityLabel}
            >
                <MaterialCommunityIcons
                    name={iconName}
                    size={scale(28)}
                    color={isGreen ? "#FFFFFF" : ChickIntelPalette.green1}
                />
            </Animated.View>
        );
    }

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.fab,
                isGreen ? styles.fabGreen : styles.fabDefault,
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
                color={isGreen ? "#FFFFFF" : ChickIntelPalette.green1}
            />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    fab: {
        position: "absolute",
        left: "50%",
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        elevation: 8,
        zIndex: 20,
    },
    fabDefault: {
        backgroundColor: ChickIntelPalette.light1,
        borderWidth: 2,
        borderColor: ChickIntelPalette.green1,
        shadowColor: "#000000",
        shadowOpacity: 0.18,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: verticalScale(8) },
    },
    fabGreen: {
        backgroundColor: ChickIntelPalette.green1,
        borderWidth: 2,
        borderColor: "rgba(255, 255, 255, 0.4)",
        shadowColor: "#317667",
        shadowOpacity: 0.38,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: verticalScale(6) },
    },
});
