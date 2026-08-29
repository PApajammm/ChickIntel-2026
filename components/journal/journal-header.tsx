import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { ChickFont } from "@/constants/chick-fonts";
import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";
import { ChickIntelPalette } from "@/constants/chickintel-palette";

type JournalHeaderProps = {
  onBackPress?: () => void;
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
  onBackPress,
  onArchivePress,
  archiveDisabled,
  onOpenArchives,
  isSelecting = false,
  onToggleSelecting,
  selectedCount = 0,
}: JournalHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.titleLeftRow}>
        {onBackPress ? (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBackPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color="#FFF"
            />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.title} numberOfLines={2}>
          {isSelecting
            ? selectedCount > 0
              ? `${selectedCount} Selected`
              : "Select Logs to Archive"
            : "Behavior Journal"}
        </Text>
      </View>
      <View style={styles.headerIcons}>
        {!isSelecting ? (
          <>
            <TouchableOpacity
              onPress={onOpenArchives}
              style={styles.headerButton}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Open archives"
            >
              <MaterialCommunityIcons
                name="archive-outline"
                size={22}
                color="#FFF"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onToggleSelecting}
              style={styles.headerButton}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Select logs to archive"
            >
              <MaterialCommunityIcons
                name="checkbox-multiple-marked-outline"
                size={22}
                color="#FFF"
              />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={onArchivePress}
              disabled={archiveDisabled}
              style={[
                styles.headerButton,
                archiveDisabled && styles.headerButtonDisabled,
              ]}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Archive selected logs"
            >
              <MaterialCommunityIcons
                name="archive-arrow-down-outline"
                size={22}
                color="#FFF"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onToggleSelecting}
              style={styles.headerButton}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <MaterialCommunityIcons
                name="check"
                size={22}
                color="#FFF"
              />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: verticalScale(10),
    marginBottom: verticalScale(8),
  },
  titleLeftRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backButton: {
    width: scale(42),
    height: verticalScale(42),
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.green1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.25)",
    shadowColor: "#317667",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(4) },
    elevation: 4,
    flexShrink: 0,
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
  headerButton: {
    width: scale(42),
    height: verticalScale(42),
    borderRadius: 14,
    backgroundColor: ChickIntelPalette.green1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.25)",
    shadowColor: "#317667",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: scale(0), height: verticalScale(4) },
    elevation: 4,
    flexShrink: 0,
  },
  headerButtonDisabled: {
    opacity: 0.4,
  },
});
