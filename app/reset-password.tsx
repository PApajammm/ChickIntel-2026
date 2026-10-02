import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
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

export default function ResetPasswordScreen() {
    const insets = useSafeAreaInsets();
    const { configured, error, loading, resetPassword, clearError } = useAuth();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    function handlePasswordChange(text: string) {
        setPassword(text);
        if (localError) setLocalError(null);
        if (error) clearError();
    }

    function handleConfirmPasswordChange(text: string) {
        setConfirmPassword(text);
        if (localError) setLocalError(null);
        if (error) clearError();
    }

    async function handleResetPassword() {
        if (!password) {
            setLocalError("Please enter your new password.");
            return;
        }

        if (password.length < 6) {
            setLocalError("Password must be at least 6 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setLocalError("Passwords do not match.");
            return;
        }

        setLocalError(null);
        if (error) clearError();
        logStep("ResetPassword submit pressed");

        const res = await resetPassword(password);

        if (res.success) {
            setIsSuccess(true);
        } else if (res.error) {
            setLocalError(res.error);
        }
    }

    const displayedError = localError ?? error;

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
                                <Text style={styles.title}>Create New Password</Text>
                                <Text style={styles.subtitle}>
                                    Please enter and confirm your new password below.
                                </Text>
                            </View>

                            {isSuccess ? (
                                <View style={styles.successCard}>
                                    <View style={styles.iconCircle}>
                                        <MaterialCommunityIcons
                                            name="shield-check-outline"
                                            size={40}
                                            color={ChickIntelPalette.green1}
                                        />
                                    </View>
                                    <Text style={styles.successTitle}>
                                        Password Changed!
                                    </Text>
                                    <Text style={styles.successText}>
                                        Your password has been successfully updated. You can now log in using your new credentials.
                                    </Text>
                                    <View style={styles.buttonStack}>
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
                                        label="New Password"
                                        value={password}
                                        onChangeText={handlePasswordChange}
                                        placeholder="New Password (min. 6 chars)"
                                        secureTextEntry
                                        style={{ width: "100%" }}
                                    />

                                    <FarmInput
                                        label="Confirm New Password"
                                        value={confirmPassword}
                                        onChangeText={handleConfirmPasswordChange}
                                        placeholder="Confirm New Password"
                                        secureTextEntry
                                        style={{ width: "100%" }}
                                    />

                                    {!configured ? (
                                        <Text style={styles.errorText}>
                                            Add your Supabase URL and anon key in `.env`
                                            before updating password.
                                        </Text>
                                    ) : null}
                                    {displayedError ? (
                                        <Text style={styles.errorText}>
                                            {displayedError}
                                        </Text>
                                    ) : null}

                                    <View style={styles.buttonStack}>
                                        <FarmButton
                                            title={loading ? "Updating Password..." : "Update Password"}
                                            onPress={handleResetPassword}
                                            disabled={loading}
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
});
