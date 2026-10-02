import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
    Alert,
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

export default function RegisterScreen() {
    const insets = useSafeAreaInsets();
    const { initialEmail } = useLocalSearchParams<{ initialEmail?: string }>();
    const { configured, error, loading, registerFarmer, clearError } = useAuth();

    const [displayName, setDisplayName] = useState("");
    const [email, setEmail] = useState(initialEmail || "");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    function handleNameChange(text: string) {
        setDisplayName(text);
        if (localError) setLocalError(null);
        if (error) clearError();
    }

    function handleEmailChange(text: string) {
        setEmail(text);
        if (localError) setLocalError(null);
        if (error) clearError();
    }

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

    async function handleRegister() {
        if (!displayName.trim()) {
            setLocalError("Please enter your full name.");
            return;
        }

        if (!email.trim()) {
            setLocalError("Please enter your email address.");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            setLocalError("Please enter a valid email address.");
            return;
        }

        if (!password) {
            setLocalError("Please enter a password.");
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
        logStep("RegisterScreen submit pressed", { email: email.trim(), name: displayName.trim() });

        const res = await registerFarmer(email.trim(), password, displayName.trim());

        if (res.success) {
            if (res.needsEmailVerification) {
                setSuccessMessage(
                    "Account created successfully! Please check your email to verify your account before logging in."
                );
            } else {
                Alert.alert("Registration Successful", "Welcome to ChickIntel!", [
                    {
                        text: "Get Started",
                        onPress: () => router.replace("/(tabs)"),
                    },
                ]);
            }
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
                                <Text style={styles.title}>Farmer Registration</Text>
                                <Text style={styles.subtitle}>
                                    Create your account to manage your farm and flocks
                                </Text>
                            </View>

                            {successMessage ? (
                                <View style={styles.successCard}>
                                    <MaterialCommunityIcons
                                        name="check-circle"
                                        size={32}
                                        color={ChickIntelPalette.green1}
                                        style={styles.successIcon}
                                    />
                                    <Text style={styles.successText}>{successMessage}</Text>
                                    <FarmButton
                                        title="Back to Login"
                                        onPress={() => router.replace("/loginscreen")}
                                        style={{ width: "100%", marginTop: 8 }}
                                    />
                                </View>
                            ) : (
                                <>
                                    <FarmInput
                                        label="Full Name"
                                        value={displayName}
                                        onChangeText={handleNameChange}
                                        placeholder="Full Name (e.g., Juan Dela Cruz)"
                                        autoCapitalize="words"
                                        style={{ width: "100%" }}
                                    />

                                    <FarmInput
                                        label="Email"
                                        value={email}
                                        onChangeText={handleEmailChange}
                                        placeholder="Email address"
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        style={{ width: "100%" }}
                                    />

                                    <FarmInput
                                        label="Password"
                                        value={password}
                                        onChangeText={handlePasswordChange}
                                        placeholder="Password (min. 6 characters)"
                                        secureTextEntry
                                        style={{ width: "100%" }}
                                    />

                                    <FarmInput
                                        label="Confirm Password"
                                        value={confirmPassword}
                                        onChangeText={handleConfirmPasswordChange}
                                        placeholder="Confirm Password"
                                        secureTextEntry
                                        style={{ width: "100%" }}
                                    />

                                    {!configured ? (
                                        <Text style={styles.errorText}>
                                            Add your Supabase URL and anon key in `.env`
                                            before registering.
                                        </Text>
                                    ) : null}
                                    {displayedError ? (
                                        <Text style={styles.errorText}>
                                            {displayedError}
                                        </Text>
                                    ) : null}

                                    <View style={styles.buttonStack}>
                                        <FarmButton
                                            title={loading ? "Creating Account..." : "Create Farmer Account"}
                                            onPress={handleRegister}
                                            disabled={loading}
                                            style={{ width: "100%" }}
                                        />
                                        <FarmButton
                                            title="Already have an account? Log in"
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
        paddingBottom: verticalScale(36),
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
        top: "8%",
        alignSelf: "center",
        opacity: 0.35,
        zIndex: 0,
    },
    formWrap: {
        width: "100%",
        maxWidth: scale(420),
        alignSelf: "center",
        paddingHorizontal: moderateScale(8),
        gap: 14,
        marginBottom: verticalScale(16),
        zIndex: 1,
    },
    headerWrap: {
        marginBottom: 6,
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
    },
    errorText: {
        color: "#A94A45",
        fontSize: responsiveFontSize(13),
        lineHeight: 18,
        fontFamily: ChickFont.sans,
        fontWeight: "500",
    },
    successCard: {
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        borderRadius: 16,
        padding: moderateScale(20),
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: ChickIntelPalette.mediumGreen,
    },
    successIcon: {
        marginBottom: 4,
    },
    successText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(14),
        color: ChickIntelPalette.gray1,
        textAlign: "center",
        lineHeight: 20,
    },
});
