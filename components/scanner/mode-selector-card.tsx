import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import {
    moderateScale,
    responsiveFontSize,
    verticalScale,
} from "@/utils/responsive";

export type ScannerMode = "health" | "breed";

type ModeSelectorCardProps = {
  mode: ScannerMode;
  onModeChange: (mode: ScannerMode) => void;
};

function TabToggle({
  mode,
  onModeChange,
}: {
  mode: ScannerMode;
  onModeChange: (mode: ScannerMode) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Pressable
        onPress={() => onModeChange("health")}
        style={({ pressed }) => [
          styles.toggleBtn,
          mode === "health" ? styles.toggleActive : styles.toggleInactive,
          { opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <MaterialCommunityIcons
          name="heart-pulse"
          size={16}
          color={
            mode === "health"
              ? ChickIntelPalette.light1
              : ChickIntelPalette.green1
          }
        />
        <View style={styles.toggleCopy}>
          <Text
            style={
              mode === "health"
                ? styles.toggleLabelActive
                : styles.toggleLabelInactive
            }
          >
            Health
          </Text>
          <Text style={styles.toggleHint}>Symptom scan</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => onModeChange("breed")}
        style={({ pressed }) => [
          styles.toggleBtn,
          mode === "breed" ? styles.toggleActive : styles.toggleInactive,
          { opacity: pressed ? 0.92 : 1 },
        ]}
      >
        <MaterialCommunityIcons
          name="dna"
          size={16}
          color={
            mode === "breed"
              ? ChickIntelPalette.light1
              : ChickIntelPalette.green1
          }
        />
        <View style={styles.toggleCopy}>
          <Text
            style={
              mode === "breed"
                ? styles.toggleLabelActive
                : styles.toggleLabelInactive
            }
          >
            Breed
          </Text>
          <Text style={styles.toggleHint}>Identity scan</Text>
        </View>
      </Pressable>
    </View>
  );
}

/**
 * Floating card for choosing the scanner's AI mode before capture.
 */
export function ModeSelectorCard({
  mode,
  onModeChange,
}: ModeSelectorCardProps) {
  return (
    <View style={styles.card}>
      <TabToggle mode={mode} onModeChange={onModeChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: "stretch",
  },
  toggleRow: {
    flexDirection: "row",
    borderRadius: 14,
    padding: moderateScale(3),
    gap: 6,
    backgroundColor: "rgba(237, 242, 238, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(210, 219, 212, 0.6)",
  },
  toggleBtn: {
    flex: 1,
    minHeight: verticalScale(46),
    paddingVertical: verticalScale(7),
    paddingHorizontal: moderateScale(8),
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  toggleActive: {
    backgroundColor: ChickIntelPalette.green1,
    borderWidth: 1,
    borderColor: ChickIntelPalette.green1,
  },
  toggleInactive: {
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(210, 219, 212, 0.4)",
  },
  toggleCopy: {
    alignItems: "flex-start",
    gap: 1,
  },
  toggleLabelActive: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  toggleLabelInactive: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  toggleHint: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(9),
    lineHeight: 11,
    fontWeight: "600",
    color: ChickIntelPalette.textMuted,
    opacity: 0.8,
  },
});
