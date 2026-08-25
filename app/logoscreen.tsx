import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import ChickenLogo from "@/assets_imported/splash-chicken.svg";
import { AuthFrame } from "@/components/farm-auth";
import { ChickFont } from "@/constants/chick-fonts";
import { useAuth } from "@/providers/auth-provider";
import { logStep } from "@/utils/logger";
import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";

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
                    onPress={() => router.push("/developers")}
                    style={styles.infoButton}
                >
                    <MaterialCommunityIcons name="information-outline" size={24} color="#2b2b2b" />
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
        bottom: 40,
        alignItems: "center",
        justifyContent: "center",
        padding: 8,
    },

});
