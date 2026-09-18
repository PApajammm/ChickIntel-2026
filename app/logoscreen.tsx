import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";

import ChickenLogo from "@/assets_imported/splash-chicken.svg";
import { AuthFrame, FarmButton } from "@/components/farm-auth";
import { useAuth } from "@/providers/auth-provider";
import { logStep } from "@/utils/logger";
import { moderateScale, scale, verticalScale } from "@/utils/responsive";

export default function LogoScreen() {
  const { initialized, session } = useAuth();

  useEffect(() => {
    if (initialized && session) {
      logStep("LogoScreen authenticated redirect", { target: "/(tabs)" });
      router.replace("/(tabs)");
    }
  }, [initialized, session]);

  return (
    <AuthFrame footerText={undefined}>
      <View style={styles.container}>
        <View style={styles.logoWrap}>
          <ChickenLogo width={scale(200)} height={verticalScale(240)} />
        </View>

        <View style={styles.buttonStack}>
          <FarmButton
            title="Log in"
            icon="account-outline"
            onPress={() => router.push("/loginscreen")}
            style={styles.button}
          />
          <FarmButton
            title="Guest Mode"
            icon="camera-outline"
            variant="secondary"
            onPress={() => router.push("/guest-mode")}
            style={styles.button}
          />
        </View>
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
    gap: 16,
  },
  logoWrap: {
    marginTop: -20,
    padding: moderateScale(12),
    borderRadius: 36,
    overflow: "visible",
    alignItems: "center",
  },
  buttonStack: {
    width: "100%",
    maxWidth: scale(360),
    gap: 12,
    marginTop: 12,
  },
  button: {
    width: "100%",
  },
});
