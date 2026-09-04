import { BlurView } from "expo-blur";
import { PropsWithChildren } from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useResponsiveScale } from "@/utils/responsive";

type BlurCardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  /**
   * iOS/Android only. Web falls back to a translucent surface.
   * Typical range: 12–32 for subtle blur.
   */
  intensity?: number;
  borderRadius?: number;
  transparent?: boolean;
}>;

export function BlurCard({
  children,
  style,
  intensity = 18,
  borderRadius = 16,
  transparent = false,
}: BlurCardProps) {
  const isDark = false;
  const responsiveScale = useResponsiveScale();

  const borderColor = isDark
    ? "rgba(255,255,255,0.18)"
    : "rgba(67, 139, 123, 0.22)";
  const overlay = transparent
    ? "transparent"
    : isDark
      ? "rgba(22, 32, 28, 0.52)"
      : "rgba(255,255,255,0.40)";

  return (
    <View
      style={[
        styles.wrap,
        {
          borderRadius: Math.max(
            10,
            Math.round(borderRadius * responsiveScale),
          ),
          backgroundColor: transparent
            ? "transparent"
            : ChickIntelPalette.light1,
        },
        style,
      ]}
    >
      {transparent ? null : Platform.OS === "web" ? (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]}
          pointerEvents="none"
        />
      ) : (
        <BlurView
          intensity={intensity}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {transparent ? null : (
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]}
          pointerEvents="none"
        />
      )}
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderWidth: 0,
    overflow: "hidden",
  },
  inner: {
    zIndex: 1,
  },
});
