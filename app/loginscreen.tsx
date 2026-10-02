import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";

import ChickenLogo from "@/assets_imported/splash-chicken.svg";
import { AuthFrame, FarmButton, FarmInput } from "@/components/farm-auth";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { useAuth } from "@/providers/auth-provider";
import { logStep } from "@/utils/logger";

export default function LoginScreen() {
    const insets = useSafeAreaInsets();
    const {
        configured,
        error,
        loading,
        session,
        signIn,
        clearError,
    } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitError, setSubmitError] = useState<string | null>(null);

    useEffect(() => {
        if (session) {
            router.replace("/(tabs)");
        }
    }, [session]);

    function handleEmailChange(text: string) {
        setEmail(text);
        if (submitError) setSubmitError(null);
        if (error) clearError();
    }

    function handlePasswordChange(text: string) {
        setPassword(text);
        if (submitError) setSubmitError(null);
        if (error) clearError();
    }

    async function handleLogin() {
        if (!email.trim() || !password) {
            setSubmitError("Please enter both email and password.");
            return;
        }

        setSubmitError(null);
        if (error) clearError();
        logStep("LoginScreen submit pressed", { email: email.trim() });

        const result = await signIn(email.trim(), password);
        if (result.success) {
            router.replace("/(tabs)");
        } else if (result.error) {
            setSubmitError(result.error);
        }
    }

    const displayedError = submitError ?? error;

    return (
        <AuthFrame>
            <KeyboardAvoidingView
                style={styles.keyboardArea}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={insets.top}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
                        <TouchableOpacity
                            style={styles.infoButton}
                            onPress={() => router.push("/developers")}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel="About ChickIntel"
                        >
                            <MaterialCommunityIcons
                                name="information-outline"
                                size={26}
                                color={ChickIntelPalette.gray1}
                            />
                        </TouchableOpacity>

                        <ChickenLogo
                            width={380}
                            height={380}
                            style={styles.chickenBg}
                        />

                        <View style={styles.formWrap}>
                            <FarmInput
                                label="Email"
                                value={email}
                                onChangeText={handleEmailChange}
                                placeholder="Email address"
                                autoCapitalize="none"
                                keyboardType="email-address"
                                style={{ width: "100%" }}
                            />
                            <View style={styles.passwordFieldWrap}>
                                <FarmInput
                                    label="Password"
                                    value={password}
                                    onChangeText={handlePasswordChange}
                                    placeholder="Password"
                                    secureTextEntry
                                    hint=""
                                    style={{ width: "100%" }}
                                />
                                <TouchableOpacity
                                    onPress={() => router.push("/forgot-password")}
                                    style={styles.forgotPasswordTouch}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                    accessibilityLabel="Forgot Password"
                                >
                                    <Text style={styles.forgotPasswordText}>
                                        Forgot Password?
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {!configured ? (
                                <Text style={styles.errorText}>
                                    Add your Supabase URL and anon key in `.env`
                                    before signing in.
                                </Text>
                            ) : null}
                            {displayedError ? (
                                <Text style={styles.errorText}>
                                    {displayedError}
                                </Text>
                            ) : null}

                            <View style={styles.buttonStack}>
                                <FarmButton
                                    title={loading ? "Signing in..." : "Log in"}
                                    onPress={handleLogin}
                                    disabled={loading}
                                    style={{ width: "100%" }}
                                />
                                <FarmButton
                                    title="Register as Farmer"
                                    variant="secondary"
                                    icon="account-plus-outline"
                                    onPress={() => router.push("/register")}
                                    style={{ width: "100%" }}
                                />
                                <FarmButton
                                    title="Guest Mode"
                                    variant="secondary"
                                    icon="incognito"
                                    onPress={() => router.push("/guest-mode")}
                                    style={{ width: "100%" }}
                                />
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </AuthFrame>
    );
}

const styles = StyleSheet.create({
    keyboardArea: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: moderateScale(20),
        paddingBottom: verticalScale(40),
        justifyContent: "flex-end",
        gap: 16,
    },
    chickenBg: {
        position: "absolute",
        top: "10%",
        alignSelf: "center",
        opacity: 0.45,
        zIndex: 0,
    },
    formWrap: {
        width: "100%",
        maxWidth: scale(420),
        alignSelf: "center",
        paddingHorizontal: moderateScale(8),
        gap: 14,
        marginBottom: verticalScale(20),
        zIndex: 1,
    },
    passwordFieldWrap: {
        width: "100%",
        gap: 6,
    },
    forgotPasswordTouch: {
        alignSelf: "flex-end",
        paddingVertical: 4,
        paddingHorizontal: 2,
    },
    forgotPasswordText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(13),
        fontWeight: "600",
        color: ChickIntelPalette.green1,
    },
    infoButton: {
        position: "absolute",
        top: 24,
        right: moderateScale(20),
        width: scale(44),
        height: verticalScale(44),
        justifyContent: "center",
        alignItems: "center",
        zIndex: 3,
    },
    buttonStack: {
        gap: 10,
        marginTop: 6,
    },
    errorText: {
        color: "#A94A45",
        fontSize: responsiveFontSize(13),
        lineHeight: 18,
        fontFamily: ChickFont.sans,
        fontWeight: "500",
    },
});
