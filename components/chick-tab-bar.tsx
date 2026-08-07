import { peekHistory } from "@/utils/nav-history";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { usePathname, useRouter, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChickFont } from "@/constants/chick-fonts";
import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";

type ChickTabBarProps = Omit<BottomTabBarProps, "state"> & {
  onLogoutPress: () => void;
};

export function ChickTabBar({ onLogoutPress, ..._rest }: ChickTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { profile } = useAuth();

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
      // Previous path in history should be the second-to-last entry.
      const prev = history[history.length - 2];
      if (prev && prev !== pathname) {
        router.push(prev as Href);
        return;
      }
    }

    // Fallback to home when no useful back path exists.
    router.replace("/(tabs)");
  }

  function goHome() {
    if (!homeActive) {
      router.replace("/(tabs)");
    }
  }

  return (
    <View
      style={[
        styles.wrap,
        isScanner && styles.wrapScanner,
        {
          paddingBottom: Math.max(insets.bottom, 6),
          borderTopColor: isScanner
            ? "transparent"
            : ChickIntelPalette.lightGreen,
        },
      ]}
    >
      <Pressable
        onPress={goBack}
        style={({ pressed }) => [styles.item, { opacity: pressed ? 0.75 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <MaterialCommunityIcons
          name="arrow-left"
          size={26}
          color={isScanner ? ChickIntelPalette.gray1 : ChickIntelPalette.gray2}
        />
        <Text
          style={[styles.label, isScanner ? styles.labelOnScanner : undefined]}
        >
          Back
        </Text>
      </Pressable>

      <Pressable
        onPress={goHome}
        style={({ pressed }) => [styles.item, { opacity: pressed ? 0.85 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Home"
      >
        <MaterialCommunityIcons
          name="home-variant"
          size={28}
          color={
            homeActive
              ? ChickIntelPalette.green1
              : isScanner
                ? ChickIntelPalette.gray1
                : ChickIntelPalette.gray2
          }
        />
        <Text
          style={[styles.label, homeActive ? styles.labelActive : undefined]}
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
            color={isScanner ? ChickIntelPalette.gray1 : ChickIntelPalette.gray2}
          />
          <Text
            style={[styles.label, isScanner ? styles.labelOnScanner : undefined]}
          >
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
          color={isScanner ? ChickIntelPalette.gray1 : ChickIntelPalette.gray2}
        />
        <Text
          style={[styles.label, isScanner ? styles.labelOnScanner : undefined]}
        >
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
    backgroundColor: ChickIntelPalette.light1,
    borderTopWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: scale(0), height: -2 },
    elevation: 10,
  },
  wrapScanner: {
    backgroundColor: "transparent",
    borderTopWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
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
    color: ChickIntelPalette.gray2,
  },
  labelActive: {
    color: ChickIntelPalette.green1,
  },
  labelOnScanner: {
    color: ChickIntelPalette.gray1,
  },
});
