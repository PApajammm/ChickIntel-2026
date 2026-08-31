import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo, useEffect, useRef, useState } from "react";
import {
    Animated,
    Easing,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

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
type JournalLogCardProps = {
  chtTag?: string;
  detectedIllness: string;
  actionStatus?: string;
  summaryDetails?: string;
  timestamp: string;
  behaviorLabels?: string[];
  additionalObservation?: string;
  noteValue?: string;
  photoUri?: string;
  onNoteSave?: (value: string) => Promise<void> | void;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  hideCheckbox?: boolean;
  index?: number;
};

function getStatusTheme(status?: string, illness?: string) {
  const normStatus = (status ?? "").toLowerCase().trim();

  // 1. Recovered -> GREEN
  if (normStatus === "recovered") {
    return {
      accentColor: "#10B981",
      badgeBg: "rgba(16, 185, 129, 0.12)",
      badgeText: "#059669",
      badgeBorder: "rgba(16, 185, 129, 0.25)",
      label: "Recovered",
    };
  }

  // 2. Dead / Deceased -> RED
  if (normStatus === "deceased" || normStatus === "dead") {
    return {
      accentColor: "#EF4444",
      badgeBg: "rgba(239, 68, 68, 0.12)",
      badgeText: "#DC2626",
      badgeBorder: "rgba(239, 68, 68, 0.25)",
      label: "Deceased",
    };
  }

  // 3. Isolated / Monitored / Active / In Treatment -> YELLOW (AMBER)
  let displayLabel = status?.trim();
  if (!displayLabel || displayLabel.toLowerCase() === "unknown") {
    displayLabel = "Monitored";
  }

  return {
    accentColor: "#F59E0B",
    badgeBg: "rgba(245, 158, 11, 0.12)",
    badgeText: "#D97706",
    badgeBorder: "rgba(245, 158, 11, 0.25)",
    label: displayLabel,
  };
}

/**
 * Premium glassmorphic log card with status accent bar, glossy tag pills, photo thumbnail, pencil note modal, and 60 FPS transitions.
 */
export const JournalLogCard = memo(function JournalLogCard({
  chtTag,
  detectedIllness,
  actionStatus,
  timestamp,
  behaviorLabels,
  additionalObservation,
  noteValue = "",
  photoUri,
  onNoteSave,
  selected,
  onToggleSelect,
  onOpen,
  hideCheckbox = false,
  index = 0,
}: JournalLogCardProps) {
  const [currentNote, setCurrentNote] = useState(noteValue);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalNoteText, setModalNoteText] = useState(noteValue);
  const [isSaving, setIsSaving] = useState(false);
  const animatedOpacity = useRef(new Animated.Value(0.85)).current;
  const animatedTranslateY = useRef(new Animated.Value(8)).current;
  const animatedScale = useRef(new Animated.Value(0.99)).current;

  const theme = getStatusTheme(actionStatus, detectedIllness);

  useEffect(() => {
    setCurrentNote(noteValue);
    setModalNoteText(noteValue);
  }, [noteValue]);

  useEffect(() => {
    const delay = Math.min(index * 25, 120);

    Animated.parallel([
      Animated.timing(animatedOpacity, {
        toValue: 1,
        duration: 200,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(animatedTranslateY, {
        toValue: 0,
        duration: 200,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(animatedScale, {
        toValue: 1,
        duration: 200,
        delay,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [animatedOpacity, animatedScale, animatedTranslateY, index]);

  const handleOpenNoteModal = () => {
    setModalNoteText(currentNote);
    setModalVisible(true);
  };

  const handleSaveNote = async () => {
    const trimmed = modalNoteText.trim();
    setIsSaving(true);
    try {
      if (onNoteSave) {
        await onNoteSave(trimmed);
      }
      setCurrentNote(trimmed);
      setModalVisible(false);
    } catch {
      // best-effort
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Animated.View
        style={{
          opacity: animatedOpacity,
          transform: [
            { translateY: animatedTranslateY },
            { scale: animatedScale },
          ],
        }}
      >
        <BlurCard
          style={[styles.card, selected ? styles.cardSelected : null]}
          borderRadius={10}
          intensity={20}
        >
          <Pressable
            onPress={onOpen}
            style={({ pressed }) => [
              styles.bodyPress,
              { opacity: pressed ? 0.92 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityHint="Open full scan result"
          >
            {/* Header Row: CHT Tag + Status Pill */}
            <View style={styles.headerRow}>
              <View style={styles.leftTagWrap}>
                {chtTag ? (
                  <View style={styles.chtPillBadge}>
                    <MaterialCommunityIcons
                      name="tag-outline"
                      size={12}
                      color={ChickIntelPalette.green1}
                    />
                    <Text style={styles.chtBadgeText}>{chtTag}</Text>
                  </View>
                ) : null}
                <View style={styles.timeWrap}>
                  <MaterialCommunityIcons
                    name="clock-outline"
                    size={12}
                    color={ChickIntelPalette.gray2}
                  />
                  <Text style={styles.dateLine} numberOfLines={1}>
                    {timestamp}
                  </Text>
                </View>
              </View>

              {/* Health Status Pill */}
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: theme.badgeBg,
                    borderColor: theme.badgeBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: theme.accentColor },
                  ]}
                />
                <Text
                  style={[styles.statusPillText, { color: theme.badgeText }]}
                >
                  {theme.label}
                </Text>
              </View>
            </View>

            {/* Main Content Layout */}
            <View style={styles.cardContentRow}>
              <View style={styles.thumbWrapper}>
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.cardThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.cardThumbPlaceholder}>
                    <MaterialCommunityIcons
                      name="bird"
                      size={28}
                      color={ChickIntelPalette.green1}
                    />
                  </View>
                )}
              </View>

              <View
                style={[
                  styles.cardTextContent,
                  !hideCheckbox && styles.cardTextContentSelecting,
                ]}
              >
                <Text style={styles.diseaseTitle} numberOfLines={2}>
                  {behaviorLabels && behaviorLabels.length > 0
                    ? behaviorLabels.slice(0, 2).join(" • ")
                    : additionalObservation?.trim()
                      ? "Chicken behaviour note"
                      : "Behaviour check"}
                </Text>

                <Text style={styles.contextLabel} numberOfLines={1}>
                  {detectedIllness
                    ? `Health context: ${detectedIllness}`
                    : "Health context: Not recorded"}
                </Text>

                {behaviorLabels && behaviorLabels.length > 0 ? (
                  <View style={styles.chipSection}>
                    <ChipList labels={behaviorLabels} compact />
                  </View>
                ) : null}

                {additionalObservation ? (
                  <View style={styles.observationBox}>
                    <Text style={styles.observationText} numberOfLines={2}>
                      {'"'}
                      {additionalObservation}
                      {'"'}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>

          {/* Interactive Note Action Pill */}
          <View style={styles.noteActionBar}>
            <TouchableOpacity
              style={styles.notePressRow}
              onPress={handleOpenNoteModal}
              activeOpacity={0.75}
            >
              <View style={styles.noteIconBadge}>
                <MaterialCommunityIcons
                  name="pencil-outline"
                  size={14}
                  color={ChickIntelPalette.green1}
                />
              </View>

              <View style={styles.noteTextWrap}>
                {currentNote.trim() ? (
                  <Text style={styles.notePreviewText} numberOfLines={1}>
                    <Text style={styles.notePrefix}>Note: </Text>
                    {currentNote.trim()}
                  </Text>
                ) : (
                  <Text style={styles.addNotePlaceholder}>
                    Add chicken observation note...
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Selection Checkbox */}
          {!hideCheckbox ? (
            <Pressable
              onPress={onToggleSelect}
              hitSlop={10}
              style={({ pressed }) => [
                styles.checkHit,
                { opacity: pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
            >
              <View
                style={[
                  styles.checkBox,
                  selected ? styles.checkBoxOn : styles.checkBoxOff,
                ]}
              >
                {selected ? (
                  <MaterialCommunityIcons
                    name="check"
                    size={14}
                    color="#FFFFFF"
                  />
                ) : null}
              </View>
            </Pressable>
          ) : null}
        </BlurCard>
      </Animated.View>

      {/* Modal for adding/editing chicken note */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setModalVisible(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <View style={styles.modalHeaderIconBadge}>
                  <MaterialCommunityIcons
                    name="pencil-outline"
                    size={20}
                    color="#FFFFFF"
                  />
                </View>
                <Text style={styles.modalTitle}>Chicken Notes</Text>
              </View>
              <Text style={styles.modalSubtitle} numberOfLines={1}>
                {detectedIllness} • {timestamp}
              </Text>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                value={modalNoteText}
                onChangeText={setModalNoteText}
                placeholder="Write specific notes, symptoms, or instructions for this chicken..."
                placeholderTextColor={ChickIntelPalette.gray2}
                multiline
                numberOfLines={4}
                style={styles.modalTextInput}
                textAlignVertical="top"
                autoFocus
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modalSaveBtn,
                    isSaving ? { opacity: 0.6 } : null,
                  ]}
                  onPress={handleSaveNote}
                  disabled={isSaving}
                >
                  <Text style={styles.modalSaveText}>
                    {isSaving ? "Saving..." : "Save Note"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  card: {
    position: "relative",
    paddingLeft: moderateScale(16),
    paddingRight: moderateScale(16),
    paddingTop: verticalScale(14),
    paddingBottom: verticalScale(12),
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderRadius: 10,
    overflow: "hidden",
  },
  cardSelected: {
    backgroundColor: "#FFFFFF",
  },
  bodyPress: {
    paddingLeft: moderateScale(2),
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: verticalScale(12),
    gap: 8,
  },
  leftTagWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  chtPillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
  },
  chtBadgeText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(12),
    fontWeight: "800",
    color: ChickIntelPalette.green1,
    letterSpacing: -0.2,
  },
  timeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dateLine: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "600",
    color: ChickIntelPalette.gray2,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 8,
    borderWidth: 1,
  },
  statusDot: {
    width: scale(6),
    height: verticalScale(6),
    borderRadius: 3,
  },
  statusPillText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  cardContentRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  thumbWrapper: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: scale(0), height: verticalScale(2) },
  },
  cardThumb: {
    width: scale(72),
    height: verticalScale(72),
    borderRadius: 14,
    backgroundColor: "rgba(49, 118, 103, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
  },
  cardThumbPlaceholder: {
    width: scale(72),
    height: verticalScale(72),
    borderRadius: 14,
    backgroundColor: "rgba(49, 118, 103, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTextContent: {
    flex: 1,
  },
  cardTextContentSelecting: {
    paddingRight: moderateScale(28),
  },
  diseaseTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    lineHeight: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
    color: ChickIntelPalette.gray1,
    marginBottom: verticalScale(4),
  },
  contextLabel: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: verticalScale(2),
  },
  chipSection: {
    marginTop: verticalScale(4),
  },
  observationBox: {
    marginTop: verticalScale(6),
    backgroundColor: "rgba(202, 227, 221, 0.25)",
    borderRadius: 8,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(4),
  },
  observationText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11),
    lineHeight: 16,
    fontWeight: "500",
    color: "#4A5252",
    fontStyle: "italic",
  },
  noteActionBar: {
    marginTop: verticalScale(10),
    paddingTop: verticalScale(8),
    borderTopWidth: 1,
    borderTopColor: "rgba(49, 118, 103, 0.12)",
  },
  notePressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(244, 248, 247, 0.85)",
    borderRadius: 10,
    paddingHorizontal: moderateScale(10),
    paddingVertical: verticalScale(6),
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.15)",
  },
  noteIconBadge: {
    width: scale(24),
    height: verticalScale(24),
    borderRadius: 12,
    backgroundColor: "rgba(49, 118, 103, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  noteTextWrap: {
    flex: 1,
  },
  notePreviewText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 16,
    color: ChickIntelPalette.gray1,
  },
  notePrefix: {
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  addNotePlaceholder: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    fontWeight: "600",
    color: ChickIntelPalette.green1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(20),
  },
  modalCard: {
    width: "100%",
    maxWidth: scale(400),
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: scale(0), height: verticalScale(6) },
    elevation: 8,
  },
  modalHeader: {
    backgroundColor: ChickIntelPalette.green1,
    paddingHorizontal: moderateScale(18),
    paddingVertical: verticalScale(14),
  },
  modalHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalHeaderIconBadge: {
    width: scale(32),
    height: verticalScale(32),
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(17),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: verticalScale(4),
  },
  modalBody: {
    padding: moderateScale(18),
    gap: 14,
  },
  modalTextInput: {
    minHeight: verticalScale(100),
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.22)",
    borderRadius: 12,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(10),
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    lineHeight: 20,
    color: ChickIntelPalette.gray1,
    backgroundColor: "#F9FAFA",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: moderateScale(16),
    paddingVertical: verticalScale(10),
    borderRadius: 10,
    backgroundColor: "#F0F2F2",
  },
  modalCancelText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  modalSaveBtn: {
    paddingHorizontal: moderateScale(18),
    paddingVertical: verticalScale(10),
    borderRadius: 10,
    backgroundColor: ChickIntelPalette.green1,
  },
  modalSaveText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: "#FFFFFF",
  },
  checkHit: {
    position: "absolute",
    top: verticalScale(25),
    right: moderateScale(0),
  },
  checkBox: {
    width: scale(22),
    height: verticalScale(22),
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxOn: {
    backgroundColor: ChickIntelPalette.green1,
    borderWidth: 1.5,
    borderColor: ChickIntelPalette.green1,
  },
  checkBoxOff: {
    borderWidth: 1.5,
    borderColor: "rgba(49, 118, 103, 0.35)",
    backgroundColor: "#FFFFFF",
  },
});
