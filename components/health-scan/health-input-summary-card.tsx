import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BlurCard } from "@/components/ui/blur-card";
import { ChipList } from "@/components/ui/chip-list";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";

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
  showKicker?: boolean;
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
  showKicker = true,
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
    <BlurCard style={styles.card} borderRadius={10} intensity={20}>
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={styles.liveBadge}>
            <MaterialCommunityIcons
              name="camera-outline"
              size={13}
              color={ChickIntelPalette.green1}
            />
            <Text style={styles.liveBadgeText}>Scan Frame</Text>
          </View>

          {capturedMeta ? (
            <View style={styles.timeMetaBadge}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={12}
                color={ChickIntelPalette.gray2}
              />
              <Text style={styles.timeMetaText}>{capturedMeta}</Text>
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
                  color={ChickIntelPalette.green1}
                />
              </View>
            )}
          </View>

          <View style={styles.copyStack}>
            <Text style={styles.blockLabel}>AI Diagnostic Detection</Text>
            <Text style={styles.detailHeadline}>{detectedIllness}</Text>
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
                  color="rgba(51, 51, 51, 0.6)"
                />
                <Text style={styles.captureMeta}>Frame {resolutionMeta}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {selectedLabels && selectedLabels.length > 0 ? (
          <View style={styles.chipSection}>
            <Text style={styles.subHeader}>Observed Behaviors</Text>
            <ChipList labels={selectedLabels} compact />
          </View>
        ) : null}

        {additionalObservation?.trim() ? (
          <View style={styles.observationSection}>
            <Text style={styles.subHeader}>Notes & Observations</Text>
            <Text style={styles.observationText}>
              {'"'}
              {additionalObservation.trim()}
              {'"'}
            </Text>
          </View>
        ) : null}
      </View>
    </BlurCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    position: "relative",
  },
  inner: {
    paddingLeft: moderateScale(18),
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
    gap: 4,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 8,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
  },
  liveBadgeText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
    letterSpacing: -0.1,
  },
  timeMetaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 8,
    backgroundColor: "rgba(244, 248, 247, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.14)",
  },
  timeMetaText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: "#5A6262",
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
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: "#5A6262",
  },
  thumbWrap: {
    width: scale(96),
    minWidth: scale(96),
    height: verticalScale(96),
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.28)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: scale(0), height: verticalScale(2) },
  },
  placeholderWrap: {
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(49, 118, 103, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: {
    width: "100%",
    height: "100%",
    backgroundColor: ChickIntelPalette.lightGreen,
  },
  detailHeadline: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(15),
    lineHeight: 20,
    fontWeight: "800",
    letterSpacing: -0.2,
    color: ChickIntelPalette.gray1,
  },
  detailDescription: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 17,
    fontWeight: "500",
    color: "#5A6262",
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
    color: ChickIntelPalette.green1,
  },
  chipSection: {
    gap: 6,
    paddingTop: verticalScale(4),
    borderTopWidth: 1,
    borderTopColor: "rgba(49, 118, 103, 0.12)",
  },
  observationSection: {
    gap: 4,
  },
  subHeader: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(12),
    lineHeight: 18,
    fontWeight: "800",
    letterSpacing: -0.1,
    color: ChickIntelPalette.gray1,
    textTransform: "uppercase",
  },
  observationText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 18,
    fontWeight: "500",
    color: "#5A6262",
    fontStyle: "italic",
  },
});
