import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { BlurCard } from "@/components/ui/blur-card";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import {
    moderateScale,
    responsiveFontSize,
    scale,
    verticalScale,
} from "@/utils/responsive";

type HealthResultCardProps = {
  resultSeverity: boolean;
  diseaseName: string;
  resultSummary: string;
  resultDescription?: string;
  recommendationText: string;
  treatmentSteps?: string[];
  actionStatus: string;
  durationValue: string;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kvRow}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  );
}

/**
 * ChickIntel outcome card with compact result summary and palette-aligned metadata.
 */
export function HealthResultCard({
  resultSeverity,
  diseaseName,
  resultSummary,
  resultDescription,
  recommendationText,
  treatmentSteps,
  actionStatus,
  durationValue,
}: HealthResultCardProps) {
  const descriptionText = resultDescription?.trim();
  const treatmentItems =
    treatmentSteps && treatmentSteps.length > 0
      ? treatmentSteps
      : recommendationText.trim()
        ? [recommendationText]
        : [];

  const accentColor = resultSeverity ? "#EF4444" : ChickIntelPalette.green1;

  return (
    <BlurCard style={styles.card} borderRadius={16} intensity={20}>
      <View style={styles.inner}>
        {/* Header Badge Row */}
        <View style={styles.headerTopRow}>
          <View
            style={[
              styles.resultPill,
              resultSeverity ? styles.resultPillUrgent : styles.resultPillMild,
            ]}
          >
            <MaterialCommunityIcons
              name={
                resultSeverity ? "alert-circle-outline" : "shield-check-outline"
              }
              size={14}
              color={accentColor}
            />
            <Text style={[styles.resultTag, { color: accentColor }]}>
              {resultSeverity ? "Urgent Diagnosis" : "Assessment Result"}
            </Text>
          </View>

          {actionStatus ? (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>{actionStatus}</Text>
            </View>
          ) : null}
        </View>

        {/* Result Title */}
        <Text style={styles.resultBody}>{resultSummary || diseaseName}</Text>

        {/* Description */}
        {descriptionText ? (
          <View style={styles.descriptionBox}>
            <Text style={styles.sectionTag}>Overview</Text>
            <Text style={styles.sectionBody}>{descriptionText}</Text>
          </View>
        ) : null}

        {/* Treatment Steps */}
        {treatmentItems.length > 0 ? (
          <View style={styles.treatmentSection}>
            <View style={styles.sectionHeaderRow}>
              <MaterialCommunityIcons
                name="medical-bag"
                size={14}
                color={ChickIntelPalette.green1}
              />
              <Text style={styles.recTag}>Treatment Protocol</Text>
            </View>
            <View style={styles.treatmentList}>
              {treatmentItems.map((step, index) => (
                <View key={`${step}-${index}`} style={styles.treatmentRow}>
                  <View style={styles.bulletIconWrap}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={14}
                      color={ChickIntelPalette.green1}
                    />
                  </View>
                  <Text style={styles.recBody}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Key-Value Metadata Block */}
        <View style={styles.metaBlock}>
          <Row label="Disease" value={diseaseName} />
          {actionStatus ? <Row label="Status" value={actionStatus} /> : null}
          {durationValue ? (
            <Row label="Recovery Duration" value={durationValue} />
          ) : null}
        </View>
      </View>
    </BlurCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#317667",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(4) },
    elevation: 3,
    position: "relative",
  },
  inner: {
    paddingLeft: moderateScale(18),
    paddingRight: moderateScale(16),
    paddingVertical: verticalScale(14),
    gap: 10,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  resultPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(4),
    borderRadius: 8,
  },
  resultPillUrgent: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
  },
  resultPillMild: {
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
  },
  resultTag: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    letterSpacing: -0.1,
    textTransform: "uppercase",
  },
  statusBadge: {
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 8,
    backgroundColor: "rgba(244, 248, 247, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.14)",
  },
  statusBadgeText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  resultBody: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    lineHeight: 24,
    fontWeight: "800",
    letterSpacing: -0.4,
    color: ChickIntelPalette.gray1,
  },
  descriptionBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.14)",
    backgroundColor: "rgba(244, 248, 247, 0.7)",
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(10),
    gap: 4,
  },
  sectionTag: {
    fontFamily: ChickFont.display,
    color: ChickIntelPalette.green1,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  sectionBody: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 19,
    color: ChickIntelPalette.gray1,
  },
  treatmentSection: {
    gap: 6,
    paddingTop: verticalScale(4),
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  recTag: {
    fontFamily: ChickFont.display,
    color: ChickIntelPalette.green1,
    fontSize: responsiveFontSize(12),
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  treatmentList: {
    gap: 6,
  },
  treatmentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderRadius: 10,
    backgroundColor: "rgba(202, 227, 221, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.14)",
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(8),
  },
  bulletIconWrap: {
    marginTop: verticalScale(2),
  },
  recBody: {
    flex: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 18,
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  metaBlock: {
    marginTop: verticalScale(4),
    gap: 6,
    paddingTop: verticalScale(10),
    borderTopWidth: 1,
    borderTopColor: "rgba(49, 118, 103, 0.16)",
  },
  kvRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  kvLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "700",
    color: "#5A6060",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  kvValue: {
    flex: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    textAlign: "right",
    color: ChickIntelPalette.gray1,
  },
});
