import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ComponentProps } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    PanResponder,
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
    size?: number;
    iconSize?: number;
    accessibilityLabel: string;
};

const DEFAULT_FAB_SIZE = scale(92);

export function PrimaryFab({
    iconName,
    onPress,
    bottom = verticalScale(16),
    centered,
    size = DEFAULT_FAB_SIZE,
    iconSize,
    accessibilityLabel,
}: PrimaryFabProps) {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const computedIconSize = iconSize ?? Math.round(size * 0.48);
    const computedBorderRadius = Math.round(size * 0.28);

    // Initial position: centered horizontally, at `bottom` distance from bottom edge
    const initialLeft = (screenWidth - size) / 2;
    const initialTop = centered
        ? (screenHeight - size) / 2
        : screenHeight - bottom - size;

    // Boundaries:
    // minTop: Middle of the vertical viewport (cannot overshoot higher than middle)
    const minTop = screenHeight / 2;
    const maxTop = screenHeight - size - verticalScale(10);
    const minLeft = scale(12);
    const maxLeft = screenWidth - size - scale(12);

    // Animated values for translation offset from initial position
    const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
    const currentOffset = useRef({ x: 0, y: 0 });
    const [isPressed, setIsPressed] = useState(false);

    // Keep bounds updated in ref for PanResponder callbacks
    const boundsRef = useRef({
        minDx: minLeft - initialLeft,
        maxDx: maxLeft - initialLeft,
        minDy: minTop - initialTop,
        maxDy: maxTop - initialTop,
    });

    useEffect(() => {
        boundsRef.current = {
            minDx: minLeft - initialLeft,
            maxDx: maxLeft - initialLeft,
            minDy: minTop - initialTop,
            maxDy: maxTop - initialTop,
        };
    }, [minLeft, maxLeft, minTop, maxTop, initialLeft, initialTop]);

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: (_, gestureState) =>
                    Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3,
                onPanResponderGrant: () => {
                    setIsPressed(true);
                    pan.setOffset({
                        x: currentOffset.current.x,
                        y: currentOffset.current.y,
                    });
                    pan.setValue({ x: 0, y: 0 });
                },
                onPanResponderMove: (_, gestureState) => {
                    const { minDx, maxDx, minDy, maxDy } = boundsRef.current;
                    const targetX = currentOffset.current.x + gestureState.dx;
                    const targetY = currentOffset.current.y + gestureState.dy;

                    const clampedX = Math.min(Math.max(targetX, minDx), maxDx);
                    const clampedY = Math.min(Math.max(targetY, minDy), maxDy);

                    pan.setValue({
                        x: clampedX - currentOffset.current.x,
                        y: clampedY - currentOffset.current.y,
                    });
                },
                onPanResponderRelease: (_, gestureState) => {
                    setIsPressed(false);
                    const isTap =
                        Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6;

                    if (isTap) {
                        pan.flattenOffset();
                        onPress();
                    } else {
                        const { minDx, maxDx, minDy, maxDy } = boundsRef.current;
                        const finalX = Math.min(
                            Math.max(currentOffset.current.x + gestureState.dx, minDx),
                            maxDx,
                        );
                        const finalY = Math.min(
                            Math.max(currentOffset.current.y + gestureState.dy, minDy),
                            maxDy,
                        );

                        currentOffset.current = { x: finalX, y: finalY };
                        pan.flattenOffset();
                        pan.setValue({ x: finalX, y: finalY });
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                            () => null,
                        );
                    }
                },
                onPanResponderTerminate: () => {
                    setIsPressed(false);
                    pan.flattenOffset();
                },
            }),
        [onPress, pan],
    );

    return (
        <Animated.View
            {...panResponder.panHandlers}
            style={[
                styles.fab,
                {
                    width: size,
                    height: size,
                    borderRadius: computedBorderRadius,
                    left: initialLeft,
                    top: initialTop,
                    transform: [
                        { translateX: pan.x },
                        { translateY: pan.y },
                        { scale: isPressed ? 0.95 : 1 },
                    ],
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
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    fab: {
        position: "absolute",
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
        zIndex: 99,
    },
});
