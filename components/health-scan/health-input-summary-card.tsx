import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ChipList } from "@/components/ui/chip-list";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";
import {
    formatJournalDateTime,
    type JournalNote,
} from "@/services/health/supabase-health-journal";

type HealthInputSummaryCardProps = {
    photoUri: string;
    detectedIllness: string;
    detectionDescription?: string;
    capturedAt?: string;
    captureWidth?: number;
    captureHeight?: number;
    /** When set (e.g. on the result screen), lists chosen behaviors. */
    selectedLabels?: string[];
    additionalObservation?: string;
    noteSavedAt?: string;
    noteHistory?: JournalNote[];
    showKicker?: boolean;
    summaryLabel?: string;
};

function formatCapturedAt(capturedAt?: string) {
    if (!capturedAt) return null;

    const date = new Date(capturedAt);
    if (Number.isNaN(date.getTime())) return null;

    return date.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

/**
 * Mint-wash card: image-based detection copy (+ optional behavior summary).
 */
export function HealthInputSummaryCard({
    photoUri,
    detectedIllness,
    detectionDescription,
    capturedAt,
    captureWidth,
    captureHeight,
    selectedLabels,
    additionalObservation,
    noteSavedAt,
    noteHistory = [],
    showKicker = true,
    summaryLabel = "Behavior & Health Snapshot",
}: HealthInputSummaryCardProps) {
    const [imageFailed, setImageFailed] = useState(false);
    const capturedMeta = formatCapturedAt(capturedAt);
    const resolutionMeta =
        typeof captureWidth === "number" && typeof captureHeight === "number"
            ? `${captureWidth}x${captureHeight}`
            : null;
    const canShowImage = Boolean(photoUri) && !imageFailed;

    useEffect(() => {
        setImageFailed(false);
    }, [photoUri]);

    return (
        <View style={styles.card}>
            <View style={styles.inner}>
                <View style={styles.headerRow}>
                    <View style={styles.liveBadge}>
                        <MaterialCommunityIcons
                            name="camera-outline"
                            size={14}
                            color={ChickIntelPalette.accent}
                        />
                        <Text style={styles.liveBadgeText}>SCAN FRAME</Text>
                    </View>

                    {capturedMeta ? (
                        <View style={styles.timeMetaBadge}>
                            <MaterialCommunityIcons
                                name="clock-outline"
                                size={12}
                                color={ChickIntelPalette.accent}
                            />
                            <Text style={styles.timeMetaText}>
                                {capturedMeta}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.mediaRow}>
                    <View style={styles.thumbWrap}>
                        {canShowImage ? (
                            <Image
                                source={{ uri: photoUri }}
                                style={styles.thumb}
                                contentFit="cover"
                                onError={() => setImageFailed(true)}
                            />
                        ) : (
                            <View style={styles.placeholderWrap}>
                                <MaterialCommunityIcons
                                    name="bird"
                                    size={32}
                                    color="#FFFFFF"
                                />
                            </View>
                        )}
                    </View>

                    <View style={styles.copyStack}>
                        <Text style={styles.blockLabel}>{summaryLabel}</Text>
                        <Text style={styles.detailHeadline}>
                            {detectedIllness}
                        </Text>
                        {detectionDescription ? (
                            <Text style={styles.detailDescription}>
                                {detectionDescription}
                            </Text>
                        ) : null}
                        {resolutionMeta ? (
                            <View style={styles.resWrap}>
                                <MaterialCommunityIcons
                                    name="aspect-ratio"
                                    size={11}
                                    color={ChickIntelPalette.accent}
                                />
                                <Text style={styles.captureMeta}>
                                    Frame {resolutionMeta}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                {selectedLabels && selectedLabels.length > 0 ? (
                    <View style={styles.chipSection}>
                        <Text style={styles.subHeader}>Observed Behaviors</Text>
                        <ChipList labels={selectedLabels} compact variant="dark" />
                    </View>
                ) : null}

                {additionalObservation?.trim() || noteHistory.length > 0 ? (
                    <View style={styles.observationSection}>
                        <Text style={styles.subHeader}>
                            Notes & Observations
                        </Text>
                        {(noteHistory.length > 0
                            ? noteHistory
                            : [
                                  {
                                      text: additionalObservation?.trim() ?? "",
                                      savedAt: noteSavedAt,
                                  },
                              ]
                        ).map((note, index) => (
                            <View key={`${note.savedAt ?? "note"}-${index}`}>
                                <Text style={styles.observationText}>
                                    {'"'}
                                    {note.text}
                                    {'"'}
                                </Text>
                                {note.savedAt ? (
                                    <Text style={styles.observationTimestamp}>
                                        Saved{" "}
                                        {formatJournalDateTime(note.savedAt)}
                                    </Text>
                                ) : null}
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 14,
        overflow: "hidden",
        backgroundColor: ChickIntelPalette.green1,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.14)",
        shadowColor: "#161E1A",
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: verticalScale(2) },
        elevation: 3,
        position: "relative",
    },
    inner: {
        paddingLeft: moderateScale(16),
        paddingRight: moderateScale(16),
        paddingVertical: verticalScale(14),
        gap: 12,
    },
    headerRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    liveBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: moderateScale(8),
        paddingVertical: verticalScale(3),
        borderRadius: 8,
        backgroundColor: "rgba(255, 255, 255, 0.18)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.35)",
    },
    liveBadgeText: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(10.5),
        fontWeight: "800",
        color: "#FFFFFF",
        letterSpacing: 0.6,
        textTransform: "uppercase",
    },
    timeMetaBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: moderateScale(8),
        paddingVertical: verticalScale(3),
        borderRadius: 8,
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.22)",
    },
    timeMetaText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(11),
        fontWeight: "600",
        color: "rgba(255, 255, 255, 0.85)",
    },
    mediaRow: {
        flexDirection: "row",
        gap: 12,
        alignItems: "flex-start",
    },
    copyStack: {
        flex: 1,
        minWidth: scale(0),
        gap: 3,
    },
    blockLabel: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(10),
        fontWeight: "800",
        letterSpacing: 0.8,
        textTransform: "uppercase",
        color: ChickIntelPalette.accent,
    },
    thumbWrap: {
        width: scale(88),
        minWidth: scale(88),
        height: verticalScale(88),
        borderRadius: 14,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.2)",
        backgroundColor: "rgba(0, 0, 0, 0.2)",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 6,
        shadowOffset: { width: scale(0), height: verticalScale(2) },
    },
    placeholderWrap: {
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    thumb: {
        width: "100%",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.2)",
    },
    detailHeadline: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(17),
        lineHeight: 23,
        fontWeight: "800",
        letterSpacing: -0.2,
        color: "#FFFFFF",
    },
    detailDescription: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        lineHeight: 17,
        fontWeight: "500",
        color: "rgba(255, 255, 255, 0.85)",
    },
    resWrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: verticalScale(2),
    },
    captureMeta: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(10),
        fontWeight: "600",
        color: ChickIntelPalette.accent,
    },
    chipSection: {
        gap: 6,
        paddingTop: verticalScale(8),
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.16)",
    },
    observationSection: {
        gap: 4,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        padding: moderateScale(10),
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.14)",
    },
    subHeader: {
        fontFamily: ChickFont.display,
        fontSize: responsiveFontSize(11),
        lineHeight: 16,
        fontWeight: "800",
        letterSpacing: 0.6,
        color: ChickIntelPalette.accent,
        textTransform: "uppercase",
    },
    observationText: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(12),
        lineHeight: 18,
        fontWeight: "600",
        color: "#FFFFFF",
        fontStyle: "italic",
    },
    observationTimestamp: {
        fontFamily: ChickFont.sans,
        fontSize: responsiveFontSize(10),
        fontWeight: "600",
        color: "rgba(255, 255, 255, 0.6)",
    },
});
