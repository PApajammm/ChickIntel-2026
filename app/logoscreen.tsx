import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import ChickenLogo from "@/assets_imported/splash-chicken.svg";
import { AuthFrame } from "@/components/farm-auth";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import { logStep } from "@/utils/logger";
import { moderateScale, scale, verticalScale } from "@/utils/responsive";

export default function LogoScreen() {
    const { initialized, session } = useAuth();

    useFocusEffect(
        useCallback(() => {
            if (!initialized) return;

            logStep("LogoScreen mounted", { screen: "logoscreen" });

            const timer = setTimeout(() => {
                const target = session ? "/(tabs)" : "/loginscreen";
                logStep("LogoScreen auto-navigate", { target });
                router.replace(target);
            }, 4000);

            return () => clearTimeout(timer);
        }, [initialized, session])
    );

    return (
        <AuthFrame footerText={undefined}>
            <View style={styles.container}>
                <View style={styles.logoWrap}>
                    <ChickenLogo width={scale(200)} height={verticalScale(240)} />
                </View>

                <Pressable
                    style={({ pressed }) => [
                        styles.infoButton,
                        pressed && styles.infoButtonPressed,
                    ]}
                    onPress={() => router.push("/developers")}
                    hitSlop={16}
                >
                    <MaterialCommunityIcons
                        name="information-outline"
                        size={42}
                        color={ChickIntelPalette.gray1}
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
        paddingBottom: 60,
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
    infoButton: {
        position: "absolute",
        bottom: verticalScale(36),
        alignItems: "center",
        justifyContent: "center",
        padding: moderateScale(8),
    },
    infoButtonPressed: {
        opacity: 0.6,
        transform: [{ scale: 0.92 }],
    },
});
