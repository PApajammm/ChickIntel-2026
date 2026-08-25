import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ReactNode } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    type ImageSourcePropType,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChickFont } from "@/constants/chick-fonts";
import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";
import type { ToneName } from "@/constants/farm-demo";
import { getFarmColors } from "@/constants/farm-theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

const toneBackgrounds: Record<ToneName, { light: string; dark: string }> = {
    forest: { light: "#DCE8C7", dark: "#22301B" },
    amber: { light: "#F7DCC0", dark: "#382519" },
    teal: { light: "#D7EEF0", dark: "#183238" },
    rose: { light: "#F4DADB", dark: "#391E21" },
    slate: { light: "#E6E0D7", dark: "#273029" },
};

const toneText: Record<ToneName, { light: string; dark: string }> = {
    forest: { light: "#4F6B25", dark: "#B8D58B" },
    amber: { light: "#8B571D", dark: "#F0C18B" },
    teal: { light: "#1C6C73", dark: "#86D2D8" },
    rose: { light: "#8D5154", dark: "#E8A4A7" },
    slate: { light: "#5B5F5A", dark: "#C4CAC2" },
};

type ScreenFrameProps = {
    children: ReactNode;
    contentStyle?: object;
};

export function ScreenFrame({ children, contentStyle }: ScreenFrameProps) {
    const colorScheme = useColorScheme();
    const colors = getFarmColors(colorScheme);
    const insets = useSafeAreaInsets();

    return (
        <ScrollView
            style={[styles.screen, { backgroundColor: colors.background }]}
            contentContainerStyle={[
                {
                    paddingTop: insets.top + 18,
                    paddingBottom: insets.bottom + 28,
                    paddingHorizontal: 18,
                },
                contentStyle,
            ]}
            showsVerticalScrollIndicator={false}
        >
            {children}
        </ScrollView>
    );
}

type SectionHeaderProps = {
    eyebrow: string;
    title: string;
    description?: string;
};

export function SectionHeader({
    eyebrow,
    title,
    description,
}: SectionHeaderProps) {
    const colorScheme = useColorScheme();
    const colors = getFarmColors(colorScheme);

    return (
        <View style={styles.sectionHeader}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>
                {eyebrow}
            </Text>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {title}
            </Text>
            {description ? (
                <Text
                    style={[
                        styles.sectionDescription,
                        { color: colors.textMuted },
                    ]}
                >
                    {description}
                </Text>
            ) : null}
        </View>
    );
}

type MetricCardProps = {
    icon: string;
    label: string;
    value: string;
    detail: string;
    tone: ToneName;
};

export function MetricCard({
    icon,
    label,
    value,
    detail,
    tone,
}: MetricCardProps) {
    const colorScheme = useColorScheme();
    const colors = getFarmColors(colorScheme);

    return (
        <View
            style={[
                styles.metricCard,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    shadowColor: colors.shadow,
                },
            ]}
        >
            <View
                style={[
                    styles.metricIcon,
                    {
                        backgroundColor:
                            toneBackgrounds[tone]["light"],
                    },
                ]}
            >
                <MaterialCommunityIcons
                    name={icon as never}
                    size={20}
                    color={
                        toneText[tone]["light"]
                    }
                />
            </View>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                {label}
            </Text>
            <Text style={[styles.metricValue, { color: colors.text }]}>
                {value}
            </Text>
            <Text style={[styles.metricDetail, { color: colors.textMuted }]}>
                {detail}
            </Text>
        </View>
    );
}

type ActionCardProps = {
    icon: string;
    title: string;
    description: string;
    tone: ToneName;
    onPress?: () => void;
};

export function ActionCard({
    icon,
    title,
    description,
    tone,
    onPress,
}: ActionCardProps) {
    const colorScheme = useColorScheme();
    const colors = getFarmColors(colorScheme);

    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.actionCard,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.92 : 1,
                },
            ]}
        >
            <View
                style={[
                    styles.actionIcon,
                    {
                        backgroundColor:
                            toneBackgrounds[tone]["light"],
                    },
                ]}
            >
                <MaterialCommunityIcons
                    name={icon as never}
                    size={22}
                    color={
                        toneText[tone]["light"]
                    }
                />
            </View>
            <Text style={[styles.actionTitle, { color: colors.text }]}>
                {title}
            </Text>
            <Text
                style={[styles.actionDescription, { color: colors.textMuted }]}
            >
                {description}
            </Text>
        </Pressable>
    );
}

type StatusPillProps = {
    label: string;
    tone: ToneName;
};

export function StatusPill({ label, tone }: StatusPillProps) {
    const colorScheme = useColorScheme();

    return (
        <View
            style={[
                styles.statusPill,
                {
                    backgroundColor:
                        toneBackgrounds[tone]["light"],
                },
            ]}
        >
            <Text
                style={[
                    styles.statusPillText,
                    {
                        color: toneText[tone]["light"],
                    },
                ]}
            >
                {label}
            </Text>
        </View>
    );
}

type ListRowProps = {
    icon: string;
    title: string;
    detail: string;
    trailing: string;
    tone: ToneName;
};

export function ListRow({ icon, title, detail, trailing, tone }: ListRowProps) {
    const colorScheme = useColorScheme();
    const colors = getFarmColors(colorScheme);

    return (
        <View style={[styles.listRow, { borderBottomColor: colors.border }]}>
            <View
                style={[
                    styles.listRowIcon,
                    {
                        backgroundColor:
                            toneBackgrounds[tone]["light"],
                    },
                ]}
            >
                <MaterialCommunityIcons
                    name={icon as never}
                    size={18}
                    color={
                        toneText[tone]["light"]
                    }
                />
            </View>
            <View style={styles.listRowBody}>
                <Text style={[styles.listRowTitle, { color: colors.text }]}>
                    {title}
                </Text>
                <Text
                    style={[styles.listRowDetail, { color: colors.textMuted }]}
                >
                    {detail}
                </Text>
            </View>
            <Text style={[styles.listRowTrailing, { color: colors.textMuted }]}>
                {trailing}
            </Text>
        </View>
    );
}

type PhotoCardProps = {
    image: ImageSourcePropType;
    title: string;
    detail: string;
    tone: ToneName;
};

export function PhotoCard({ image, title, detail, tone }: PhotoCardProps) {
    const colorScheme = useColorScheme();
    const colors = getFarmColors(colorScheme);

    return (
        <View
            style={[
                styles.photoCard,
                {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    shadowColor: colors.shadow,
                },
            ]}
        >
            <Image source={image} style={styles.photo} contentFit="cover" />
            <View style={styles.photoOverlay} />
            <View style={styles.photoCopy}>
                <StatusPill label={title} tone={tone} />
                <Text style={styles.photoDetail}>{detail}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    sectionHeader: {
        marginTop: verticalScale(22),
        marginBottom: verticalScale(14),
        gap: 4,
    },
    eyebrow: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        fontWeight: "600",
        letterSpacing: 0.75,
        textTransform: "uppercase",
    },
    sectionTitle: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(12),
        fontWeight: "600",
        letterSpacing: -0.35,
    },
    sectionDescription: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(14),
        lineHeight: 21,
        fontWeight: "400",
        letterSpacing: 0,
    },
    metricCard: {
        flex: 1,
        minWidth: "46%",
        borderRadius: 24,
        borderWidth: 1,
        padding: moderateScale(16),
        gap: 8,
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: scale(0), height: verticalScale(8) },
        elevation: 4,
    },
    metricIcon: {
        width: scale(38),
        height: verticalScale(38),
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    metricLabel: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(13),
        fontWeight: "600",
    },
    metricValue: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(15),
        fontWeight: "600",
        letterSpacing: -0.65,
    },
    metricDetail: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        lineHeight: 18,
        fontWeight: "400",
    },
    actionCard: {
        flex: 1,
        minWidth: "46%",
        borderRadius: 22,
        borderWidth: 1,
        padding: moderateScale(16),
        gap: 10,
        shadowOpacity: 0.1,
        shadowRadius: 16,
        shadowOffset: { width: scale(0), height: verticalScale(6) },
        elevation: 3,
    },
    actionIcon: {
        width: scale(42),
        height: verticalScale(42),
        borderRadius: 14,
        alignItems: "center",
        justifyContent: "center",
    },
    actionTitle: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(16),
        fontWeight: "600",
        letterSpacing: -0.15,
    },
    actionDescription: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(13),
        lineHeight: 19,
        fontWeight: "400",
    },
    statusPill: {
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: moderateScale(12),
        paddingVertical: verticalScale(6),
    },
    statusPillText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        fontWeight: "600",
    },
    listRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: verticalScale(14),
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    listRowIcon: {
        width: scale(36),
        height: verticalScale(36),
        borderRadius: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    listRowBody: {
        flex: 1,
        gap: 3,
    },
    listRowTitle: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(15),
        fontWeight: "600",
        letterSpacing: -0.08,
    },
    listRowDetail: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(13),
        lineHeight: 19,
        fontWeight: "400",
    },
    listRowTrailing: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        fontWeight: "600",
    },
    photoCard: {
        borderRadius: 28,
        borderWidth: 1,
        overflow: "hidden",
        shadowOpacity: 0.16,
        shadowRadius: 20,
        shadowOffset: { width: scale(0), height: verticalScale(10) },
        elevation: 5,
    },
    photo: {
        width: "100%",
        height: verticalScale(210),
    },
    photoOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0, 0, 0, 0.18)",
    },
    photoCopy: {
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 16,
        gap: 8,
    },
    photoDetail: {
        fontFamily: ChickFont.sans,
        color: "#FFFFFF",
        fontSize: responsiveFontSize(14),
        lineHeight: 20,
        fontWeight: "500",
        letterSpacing: 0,
        textShadowColor: "rgba(0,0,0,0.22)",
        textShadowOffset: { width: scale(0), height: verticalScale(1) },
        textShadowRadius: 6,
    },
});
