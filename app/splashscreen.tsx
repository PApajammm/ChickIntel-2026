import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import ChickenLogo from "@/assets_imported/splash-chicken.svg";
import { AuthFrame } from "@/components/farm-auth";
import { moderateScale, scale, verticalScale } from "@/utils/responsive";

const SPLASH_DURATION_MS = 3500;

export default function SplashScreen() {
  const { destination } = useLocalSearchParams<{ destination?: string }>();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextRoute = destination === "home" ? "/(tabs)" : "/logoscreen";

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      router.replace(nextRoute);
    }, SPLASH_DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [nextRoute]);

  function openAboutScreen() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    router.push("/developers");
  }

  return (
    <AuthFrame footerText={undefined}>
      <View style={styles.container}>
        <View style={styles.logoWrap}>
          <ChickenLogo width={scale(200)} height={verticalScale(240)} />
        </View>
        <Pressable
          onPress={openAboutScreen}
          style={({ pressed }) => [
            styles.aboutButton,
            { opacity: pressed ? 0.78 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="About ChickIntel"
        >
          <MaterialCommunityIcons
            name="information-outline"
            size={46}
            color="#333333"
          />
        </Pressable>
      </View>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: moderateScale(22),
    paddingTop: 28,
    paddingBottom: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    marginTop: -20,
    padding: moderateScale(12),
    borderRadius: 46,
    overflow: "visible",
    alignItems: "center",
  },
  aboutButton: {
    position: "absolute",
    bottom: verticalScale(12),
    alignSelf: "center",
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
  },
});
