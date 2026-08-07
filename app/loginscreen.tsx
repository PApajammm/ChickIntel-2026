import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { moderateScale, responsiveFontSize, scale } from "@/utils/responsive";

import ChickenLogo from "@/assets_imported/splash-chicken.svg";
import { AuthFrame, FarmButton, FarmInput } from "@/components/farm-auth";
import { useAuth } from "@/providers/auth-provider";
import { logStep } from "@/utils/logger";

export default function LoginScreen() {
    const insets = useSafeAreaInsets();
    const { configured, error, loading, session, signIn, clearError } = useAuth();
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
                    <View style={styles.container}>
                        <ChickenLogo
                            width={420}
                            height={420}
                            style={styles.chickenBg}
                        />

                        <View style={styles.formWrap}>
                            <FarmInput
                                label="Email"
                                value={email}
                                onChangeText={handleEmailChange}
                                placeholder="Email"
                                autoCapitalize="none"
                                keyboardType="email-address"
                                style={{ width: "100%" }}
                            />
                            <FarmInput
                                label="Password"
                                value={password}
                                onChangeText={handlePasswordChange}
                                placeholder={undefined}
                                secureTextEntry
                                hint=""
                                style={{ width: "100%" }}
                            />
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
        paddingTop: 28,
        paddingBottom: 72,
        justifyContent: "flex-end",
        gap: 20,
    },
    chickenBg: {
        position: "absolute",
        top: "20%",
        alignSelf: "center",
        opacity: 0.5,
        zIndex: 0,
    },
    formWrap: {
        width: "100%",
        maxWidth: scale(420),
        alignSelf: "center",
        paddingHorizontal: moderateScale(8),
        gap: 18,
        marginBottom: 48,
        zIndex: 1,
    },
    formStack: {
        gap: 16,
    },
    buttonStack: {
        gap: 12,
        marginTop: 8,
    },
    errorText: {
        color: "#A94A45",
        fontSize: responsiveFontSize(13),
        lineHeight: 18,
    },
});
