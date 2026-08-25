import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ReactNode, useState } from "react";
import {
    Pressable,
    StyleProp,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View,
    ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import BackgroundGradient from "@/assets_imported/background-gradient.svg";
import { ChickFont } from "@/constants/chick-fonts";
import { moderateScale, responsiveFontSize, verticalScale } from "@/utils/responsive";
import { getFarmColors } from "@/constants/farm-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

type AuthFrameProps = {
    children: ReactNode;
    footerText?: string;
};

export function AuthFrame({ children, footerText }: AuthFrameProps) {
    const colorScheme = useColorScheme();
    const colors = getFarmColors(colorScheme);

    return (
        <View style={[styles.screen, { backgroundColor: colors.background }]}>
            <BackgroundGradient
                width="100%"
                height="100%"
                preserveAspectRatio="xMidYMid slice"
                style={styles.background}
            />
            <View
                style={[
                    styles.overlay,
                    {
                        backgroundColor: "rgba(244, 240, 232, 0.72)",
                    },
                ]}
            />
            <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>
            {footerText ? (
                <View style={styles.footerWrap}>
                    <Text style={[styles.footerText, { color: colors.text }]}>
                        {footerText}
                    </Text>
                </View>
            ) : null}
        </View>
    );
}

type FarmInputProps = TextInputProps & {
    label: string;
    hint?: string;
};

export function FarmInput({ label, hint, style, ...props }: FarmInputProps) {
    const colorScheme = useColorScheme();
    const colors = getFarmColors(colorScheme);
    const [visible, setVisible] = useState(!props.secureTextEntry);
    const placeholder = (props.placeholder as string) || label;

    function hexToRgba(hex: string, alpha = 1) {
        const h = hex.replace("#", "");
        const bigint = parseInt(
            h.length === 3
                ? h
                      .split("")
                      .map((c) => c + c)
                      .join("")
                : h,
            16,
        );
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    return (
        <View style={styles.fieldWrap}>
            <View style={styles.fieldInputWrap}>
                <TextInput
                    placeholderTextColor={hexToRgba(colors.text, 0.5)}
                    style={[
                        styles.fieldInput,
                        {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            color: colors.text,
                        },
                        style,
                    ]}
                    placeholder={placeholder}
                    {...props}
                    secureTextEntry={props.secureTextEntry ? !visible : false}
                />
                {props.secureTextEntry ? (
                    <Pressable
                        onPress={() => setVisible((v) => !v)}
                        style={styles.inputIconPress}
                    >
                        <MaterialCommunityIcons
                            name={visible ? "eye-off" : "eye"}
                            size={20}
                            color={colors.textMuted}
                        />
                    </Pressable>
                ) : null}
            </View>
            {hint ? (
                <Text style={[styles.fieldHint, { color: colors.textMuted }]}>
                    {hint}
                </Text>
            ) : null}
        </View>
    );
}

type FarmButtonProps = {
    title: string;
    onPress?: () => void;
    variant?: "primary" | "secondary";
    icon?: string;
    style?: StyleProp<ViewStyle>;
    disabled?: boolean;
};

export function FarmButton({
    title,
    onPress,
    variant = "primary",
    icon,
    style,
    disabled = false,
}: FarmButtonProps) {
    const colorScheme = useColorScheme();
    const colors = getFarmColors(colorScheme);
    const isPrimary = variant === "primary";

    return (
        <Pressable
            onPress={disabled ? undefined : onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.button,
                {
                    backgroundColor: disabled
                        ? "#9E9E9E"
                        : isPrimary
                          ? "#317667"
                          : colors.surface,
                    borderColor: disabled
                        ? "#9E9E9E"
                        : isPrimary
                          ? "#317667"
                          : colors.border,
                    opacity: disabled ? 0.6 : pressed ? 0.92 : 1,
                    shadowColor: colors.shadow,
                    shadowOpacity: disabled ? 0 : isPrimary ? 0.18 : 0.06,
                    shadowRadius: isPrimary ? 10 : 4,
                    shadowOffset: isPrimary
                        ? { width: 0, height: 6 }
                        : { width: 0, height: 2 },
                    elevation: disabled ? 0 : isPrimary ? 4 : 1,
                },
                style,
            ]}
        >
            {icon ? (
                <MaterialCommunityIcons
                    name={icon as never}
                    size={18}
                    color={disabled ? "#FFFFFF" : isPrimary ? "#FFFFFF" : colors.primary}
                    style={styles.buttonIcon}
                />
            ) : null}
            <Text
                style={[
                    styles.buttonText,
                    { color: disabled ? "#FFFFFF" : isPrimary ? "#FFFFFF" : colors.primary },
                ]}
            >
                {title}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    background: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.98,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
    },
    safeArea: {
        flex: 1,
    },
    footerWrap: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 16,
        alignItems: "center",
        paddingHorizontal: moderateScale(20),
    },
    footerText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        fontWeight: "600",
        letterSpacing: 0.45,
        textAlign: "center",
        textTransform: "uppercase",
    },
    fieldWrap: {
        gap: 8,
    },
    fieldLabel: {
        fontSize: responsiveFontSize(13),
        fontWeight: "800",
    },
    fieldInput: {
        fontFamily: ChickFont.sans,
        borderWidth: 1,
        borderRadius: 15,
        paddingHorizontal: moderateScale(18),
        paddingVertical: verticalScale(12),
        height: verticalScale(56),
        fontSize: responsiveFontSize(16),
        fontWeight: "500",
    },
    fieldInputWrap: {
        position: "relative",
    },
    inputIcon: {
        position: "absolute",
        right: 14,
        top: "50%",
        transform: [{ translateY: -10 }],
    },
    inputIconPress: {
        position: "absolute",
        right: 8,
        top: "50%",
        transform: [{ translateY: -12 }],
        padding: moderateScale(8),
        borderRadius: 18,
    },
    fieldHint: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        lineHeight: 17,
        fontWeight: "500",
    },
    button: {
        minHeight: verticalScale(56),
        borderRadius: 15,
        borderWidth: 1,
        paddingHorizontal: moderateScale(18),
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
    },
    buttonText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(16),
        fontWeight: "600",
        letterSpacing: 0.2,
    },
    buttonIcon: {
        marginRight: moderateScale(10),
    },
});
