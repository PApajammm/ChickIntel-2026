import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import {
    Alert,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ChickenLogo from "@/assets_imported/splash-chicken.svg";
import { AuthFrame, FarmButton } from "@/components/farm-auth";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";

export default function GuestModeScreen() {
  const insets = useSafeAreaInsets();
  const { enterGuestMode, exitGuestMode } = useAuth();
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  async function openScanner(initialMode: "health" | "breed" | "sex") {
    if (Platform.OS !== "web" && !cameraPermission?.granted) {
      try {
        const nextPermission = await requestCameraPermission();
        if (!nextPermission.granted) {
          Alert.alert(
            "Camera access needed",
            "Camera access is needed to scan.",
          );
          return;
        }
      } catch {
        Alert.alert(
          "Camera error",
          "Unable to request camera access right now.",
        );
        return;
      }
    }

    enterGuestMode();
    router.replace({
      pathname: "/(tabs)/scanner",
      params: { initialMode },
    });
  }

  return (
    <AuthFrame>
      <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            exitGuestMode();
            router.replace("/logoscreen");
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={ChickIntelPalette.gray1}
          />
        </TouchableOpacity>
        <ChickenLogo width={scale(150)} height={verticalScale(180)} />
        <View style={styles.headingWrap}>
          <Text style={styles.title}>Guest Mode</Text>
        </View>
        <View style={styles.buttonStack}>
          <FarmButton
            title="Health Scanner"
            onPress={() => openScanner("health")}
            style={styles.button}
          />
          <FarmButton
            title="Breed Identifier"
            onPress={() => openScanner("breed")}
            style={styles.button}
          />
          <FarmButton
            title="Sex Identifier"
            onPress={() => openScanner("sex")}
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
    alignItems: "center",
    paddingHorizontal: moderateScale(22),
    paddingBottom: verticalScale(48),
    justifyContent: "center",
  },
  headingWrap: {
    alignItems: "center",
    gap: 6,
    marginTop: verticalScale(8),
    marginBottom: verticalScale(22),
  },
  title: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(26),
    fontWeight: "800",
    color: ChickIntelPalette.gray1,
  },
  subtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    color: ChickIntelPalette.textMuted,
    textAlign: "center",
  },
  buttonStack: {
    width: "100%",
    maxWidth: scale(380),
    gap: 12,
  },
  button: {
    width: "100%",
  },
  backButton: {
    position: "absolute",
    top: 24,
    left: moderateScale(22),
    width: scale(40),
    height: verticalScale(40),
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
});
