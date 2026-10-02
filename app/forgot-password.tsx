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

export default function ForgotPasswordScreen() {
    const insets = useSafeAreaInsets();
    const { configured, error, loading, sendPasswordResetEmail, clearError } =
        useAuth();

    const [email, setEmail] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [resendNotice, setResendNotice] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (cooldown <= 0) return;
        const interval = setInterval(() => {
            setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [cooldown]);

    function handleEmailChange(text: string) {
        setEmail(text);
        if (localError) setLocalError(null);
        if (resendNotice) setResendNotice(null);
        if (error) clearError();
    }

    async function handleSendReset() {
        if (cooldown > 0) return;

        if (!email.trim()) {
            setLocalError("Please enter your registered email address.");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setLocalError("Please enter a valid email address.");
            return;
        }

        setLocalError(null);
        setResendNotice(null);
        if (error) clearError();
        logStep("ForgotPassword submit pressed", { email: email.trim() });

        const res = await sendPasswordResetEmail(email.trim());

        if (res.success) {
            setCooldown(20);
            if (isSubmitted) {
                setResendNotice("A fresh password reset link has been sent to your email!");
            } else {
                setIsSubmitted(true);
            }
        } else if (res.isRateLimited) {
            setCooldown((prev) => (prev > 0 ? prev : 30));
            setLocalError(res.error || null);
        } else if (res.error) {
            setLocalError(res.error);
        }
    }

    const displayedError = localError || error;

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
                            style={styles.backButton}
                            onPress={() => router.replace("/loginscreen")}
                            activeOpacity={0.7}
                            accessibilityRole="button"
                            accessibilityLabel="Go back to Login"
                        >
                            <MaterialCommunityIcons
                                name="arrow-left"
                                size={24}
                                color={ChickIntelPalette.gray1}
                            />
                        </TouchableOpacity>

                        <ChickenLogo
                            width={380}
                            height={380}
                            style={styles.chickenBg}
                        />

                        <View style={styles.formWrap}>
                            <View style={styles.headerWrap}>
                                <Text style={styles.title}>Forgot Password</Text>
                                <Text style={styles.subtitle}>
                                    Enter your registered email and we will send a secure password reset link to your inbox.
                                </Text>
                            </View>

                            {isSubmitted ? (
                                <View style={styles.successCard}>
                                    <View style={styles.iconCircle}>
                                        <MaterialCommunityIcons
                                            name="email-check-outline"
                                            size={38}
                                            color={ChickIntelPalette.green1}
                                        />
                                    </View>
                                    <Text style={styles.successTitle}>
                                        Reset Link Sent!
                                    </Text>
                                    <Text style={styles.successText}>
                                        We sent a password reset link to{" "}
                                        <Text style={styles.boldEmail}>{email.trim()}</Text>.
                                        {"\n\n"}
                                        Please check your inbox (and spam folder) and tap the link to set a new password.
                                    </Text>

                                    {cooldown > 0 ? (
                                        <View style={styles.cooldownBadge}>
                                            <MaterialCommunityIcons
                                                name="timer-sand"
                                                size={16}
                                                color={ChickIntelPalette.green1}
                                            />
                                            <Text style={styles.cooldownText}>
                                                Resend available in {cooldown}s
                                            </Text>
                                        </View>
                                    ) : null}

                                    {resendNotice && cooldown <= 0 ? (
                                        <View style={styles.resendSuccessBadge}>
                                            <MaterialCommunityIcons
                                                name="check-circle"
                                                size={16}
                                                color={ChickIntelPalette.green1}
                                            />
                                            <Text style={styles.resendSuccessText}>
                                                {resendNotice}
                                            </Text>
                                        </View>
                                    ) : null}

                                    {displayedError ? (
                                        <Text style={styles.errorText}>
                                            {displayedError}
                                        </Text>
                                    ) : null}

                                    <View style={styles.buttonStack}>
                                        <FarmButton
                                            title={
                                                loading
                                                    ? "Sending..."
                                                    : cooldown > 0
                                                      ? `Resend Link (${cooldown}s)`
                                                      : "Resend Link"
                                            }
                                            variant="secondary"
                                            onPress={handleSendReset}
                                            disabled={loading || cooldown > 0}
                                            style={{ width: "100%" }}
                                        />
                                        <FarmButton
                                            title="Use a Different Email"
                                            variant="secondary"
                                            onPress={() => {
                                                setIsSubmitted(false);
                                                setResendNotice(null);
                                                setLocalError(null);
                                                clearError();
                                            }}
                                            style={{ width: "100%" }}
                                        />
                                        <FarmButton
                                            title="Return to Login"
                                            onPress={() => router.replace("/loginscreen")}
                                            style={{ width: "100%" }}
                                        />
                                    </View>
                                </View>
                            ) : (
                                <>
                                    <FarmInput
                                        label="Registered Email"
                                        value={email}
                                        onChangeText={handleEmailChange}
                                        placeholder="Enter your registered email"
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        style={{ width: "100%" }}
                                    />

                                    {cooldown > 0 ? (
                                        <View style={styles.cooldownBadge}>
                                            <MaterialCommunityIcons
                                                name="timer-sand"
                                                size={16}
                                                color={ChickIntelPalette.green1}
                                            />
                                            <Text style={styles.cooldownText}>
                                                Please wait {cooldown}s before sending again
                                            </Text>
                                        </View>
                                    ) : null}

                                    {!configured ? (
                                        <Text style={styles.errorText}>
                                            Add your Supabase URL and anon key in `.env`
                                            before requesting a reset link.
                                        </Text>
                                    ) : null}
                                    {displayedError ? (
                                        <Text style={styles.errorText}>
                                            {displayedError}
                                        </Text>
                                    ) : null}

                                    <View style={styles.buttonStack}>
                                        <FarmButton
                                            title={
                                                loading
                                                    ? "Sending link..."
                                                    : cooldown > 0
                                                      ? `Send Reset Link (${cooldown}s)`
                                                      : "Send Reset Link"
                                            }
                                            onPress={handleSendReset}
                                            disabled={loading || cooldown > 0}
                                            style={{ width: "100%" }}
                                        />
                                        <FarmButton
                                            title="Back to Login"
                                            variant="secondary"
                                            onPress={() => router.replace("/loginscreen")}
                                            style={{ width: "100%" }}
                                        />
                                    </View>
                                </>
                            )}
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
    backButton: {
        position: "absolute",
        top: 24,
        left: moderateScale(20),
        width: scale(40),
        height: verticalScale(40),
        justifyContent: "center",
        alignItems: "center",
        zIndex: 3,
    },
    chickenBg: {
        position: "absolute",
        top: "10%",
        alignSelf: "center",
        opacity: 0.4,
        zIndex: 0,
    },
    formWrap: {
        width: "100%",
        maxWidth: scale(420),
        alignSelf: "center",
        paddingHorizontal: moderateScale(8),
        gap: 16,
        marginBottom: verticalScale(24),
        zIndex: 1,
    },
    headerWrap: {
        marginBottom: 4,
        gap: 4,
    },
    title: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(22),
        fontWeight: "800",
        color: ChickIntelPalette.gray1,
    },
    subtitle: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(13),
        color: ChickIntelPalette.textMuted,
        lineHeight: 18,
    },
    buttonStack: {
        gap: 10,
        marginTop: 6,
        width: "100%",
    },
    errorBox: {
        width: "100%",
        gap: 6,
    },
    errorText: {
        color: "#A94A45",
        fontSize: responsiveFontSize(13),
        lineHeight: 18,
        fontFamily: ChickFont.sans,
        fontWeight: "500",
    },
    successCard: {
        backgroundColor: "rgba(255, 255, 255, 0.95)",
        borderRadius: 18,
        padding: moderateScale(22),
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 2,
    },
    iconCircle: {
        width: scale(64),
        height: verticalScale(64),
        borderRadius: 32,
        backgroundColor: "rgba(64, 83, 77, 0.1)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 4,
    },
    successTitle: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(18),
        fontWeight: "700",
        color: ChickIntelPalette.gray1,
    },
    successText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(13),
        color: ChickIntelPalette.textMuted,
        textAlign: "center",
        lineHeight: 19,
    },
    boldEmail: {
        fontWeight: "700",
        color: ChickIntelPalette.gray1,
    },
    resendSuccessBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        backgroundColor: "rgba(64, 83, 77, 0.08)",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginVertical: 4,
    },
    resendSuccessText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(13),
        fontWeight: "600",
        color: ChickIntelPalette.green1,
    },
    cooldownBadge: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: "rgba(64, 83, 77, 0.08)",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginVertical: 4,
        alignSelf: "center",
        width: "100%",
    },
    cooldownText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(13),
        fontWeight: "600",
        color: ChickIntelPalette.green1,
    },
});
