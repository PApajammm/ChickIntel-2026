import { peekHistory } from "@/utils/nav-history";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { usePathname, useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChickFont } from "@/constants/chick-fonts";
import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { getFarmColors } from "@/constants/farm-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuth } from "@/providers/auth-provider";

type ChickTabBarProps = Omit<BottomTabBarProps, "state"> & {
  onLogoutPress: () => void;
};

export function ChickTabBar({ onLogoutPress, ..._rest }: ChickTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();
  const colorScheme = useColorScheme();
  const colors = getFarmColors(colorScheme);

  const isHomePath = pathname === "/" || pathname === "/(tabs)";
  const isScanner = pathname.includes("scanner");
  const isBreedScannerResult = pathname.includes("breed-scanner");
  const homeActive = pathname === "/" || isScanner || isBreedScannerResult;

  function goBack() {
    if (isHomePath) {
      return;
    }

    const history = peekHistory();
    if (history.length > 1) {
      const prev = history[history.length - 2];
      if (prev && prev !== pathname) {
        router.push(prev as Href);
        return;
      }
    }

    router.replace("/(tabs)");
  }

  function goHome() {
    if (!homeActive) {
      router.replace("/(tabs)");
    }
  }

  const inactiveColor = isScanner
    ? ChickIntelPalette.gray1
    : colors.textMuted;
  const activeColor = colors.primary;

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: isScanner
            ? "transparent"
            : colorScheme === "dark"
              ? colors.surface
              : ChickIntelPalette.light1,
          borderTopColor: isScanner
            ? "transparent"
            : colorScheme === "dark"
              ? colors.border
              : ChickIntelPalette.lightGreen,
          paddingBottom: Math.max(insets.bottom, 6),
        },
      ]}
    >
      <Pressable
        onPress={goHome}
        style={({ pressed }) => [styles.item, { opacity: pressed ? 0.85 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Home"
      >
        <MaterialCommunityIcons
          name="home-variant"
          size={28}
          color={homeActive ? activeColor : inactiveColor}
        />
        <Text
          style={[
            styles.label,
            { color: homeActive ? activeColor : inactiveColor },
          ]}
        >
          Home
        </Text>
      </Pressable>

      {profile?.is_admin && (
        <Pressable
          onPress={() => router.push("/admin/dashboard")}
          style={({ pressed }) => [styles.item, { opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="Admin"
        >
          <MaterialCommunityIcons
            name="cog"
            size={26}
            color={inactiveColor}
          />
          <Text style={[styles.label, { color: inactiveColor }]}>
            Admin
          </Text>
        </Pressable>
      )}

      <Pressable
        onPress={onLogoutPress}
        style={({ pressed }) => [styles.item, { opacity: pressed ? 0.85 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Logout"
      >
        <MaterialCommunityIcons
          name="power"
          size={26}
          color={inactiveColor}
        />
        <Text style={[styles.label, { color: inactiveColor }]}>
          Logout
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: verticalScale(6),
    paddingHorizontal: moderateScale(8),
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: scale(0), height: -2 },
    elevation: 10,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: verticalScale(3),
  },
  label: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
