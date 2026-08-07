import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ChickFont } from "@/constants/chick-fonts";
import { moderateScale, responsiveFontSize, verticalScale } from "@/utils/responsive";
import { ChickIntelPalette } from "@/constants/chickintel-palette";

type JournalHeaderProps = {
  onArchivePress: () => void;
  archiveDisabled?: boolean;
  onOpenArchives: () => void;
  isSelecting?: boolean;
  onToggleSelecting?: () => void;
  selectedCount?: number;
};

/**
 * Title row with clean header icons and archive selection mode support.
 */
export function JournalHeader({
  onArchivePress,
  archiveDisabled,
  onOpenArchives,
  isSelecting = false,
  onToggleSelecting,
  selectedCount = 0,
}: JournalHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title} numberOfLines={2}>
        {isSelecting
          ? selectedCount > 0
            ? `${selectedCount} Selected`
            : "Select Logs to Archive"
          : "Behavior Journal"}
      </Text>
      <View style={styles.headerIcons}>
        {!isSelecting ? (
          <>
            <Pressable
              onPress={onOpenArchives}
              hitSlop={8}
              style={({ pressed }) => [
                styles.iconHit,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Open archives"
            >
              <MaterialCommunityIcons
                name="archive-outline"
                size={20}
                color={ChickIntelPalette.gray1}
              />
            </Pressable>
            <Pressable
              onPress={onToggleSelecting}
              hitSlop={12}
              style={({ pressed }) => [
                styles.iconHit,
                { opacity: pressed ? 0.65 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Select logs to archive"
            >
              <MaterialCommunityIcons
                name="checkbox-multiple-marked-outline"
                size={22}
                color={ChickIntelPalette.gray1}
              />
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              onPress={onArchivePress}
              disabled={archiveDisabled}
              hitSlop={12}
              style={({ pressed }) => [
                styles.archiveBtn,
                { opacity: archiveDisabled ? 0.4 : pressed ? 0.75 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Archive selected logs"
            >
              <MaterialCommunityIcons
                name="archive-arrow-down-outline"
                size={18}
                color="#FFF"
              />
              <Text style={styles.archiveBtnText}>Archive</Text>
            </Pressable>
            <Pressable
              onPress={onToggleSelecting}
              hitSlop={8}
              style={({ pressed }) => [
                styles.cancelBtn,
                { opacity: pressed ? 0.75 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cancel selection mode"
            >
              <Text style={styles.cancelBtnText}>Done</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginTop: verticalScale(10),
    marginBottom: verticalScale(8),
  },
  title: {
    flex: 1,
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(20),
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.55,
    color: ChickIntelPalette.gray1,
  },
  iconHit: {
    padding: moderateScale(4),
    marginTop: verticalScale(2),
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  archiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: ChickIntelPalette.green1,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(6),
    borderRadius: 8,
  },
  archiveBtnText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: "#FFF",
  },
  cancelBtn: {
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(6),
    borderRadius: 8,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
  },
  cancelBtnText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
});
