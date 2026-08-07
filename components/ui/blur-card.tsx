import { BlurView } from "expo-blur";
import { PropsWithChildren } from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useColorScheme } from "@/hooks/use-color-scheme";
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
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
          borderColor,
          backgroundColor: transparent
            ? "transparent"
            : ChickIntelPalette.light1,
          shadowOpacity: transparent ? 0 : 0.08,
          elevation: transparent ? 0 : 3,
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
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  inner: {
    flex: 1,
    zIndex: 1,
  },
});
