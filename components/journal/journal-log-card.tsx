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
} from "@/utils/supabase-health-journal";
type JournalLogCardProps = {
  chtTag?: string;
  detectedIllness: string;
  actionStatus?: string;
  summaryDetails?: string;
  timestamp: string;
  behaviorLabels?: string[];
  additionalObservation?: string;
  noteValue?: string;
  noteSavedAt?: string;
  noteHistory?: JournalNote[];
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
  noteSavedAt,
  noteHistory = [],
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
    setModalNoteText("");
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
      setModalNoteText("");
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
            {/* Journal entry header */}
            <View style={styles.headerRow}>
              <View style={styles.headerTopRow}>
                <View style={styles.journalKickerRow}>
                  <MaterialCommunityIcons
                    name="book-open-page-variant-outline"
                    size={13}
                    color={ChickIntelPalette.green1}
                  />
                  <Text style={styles.journalKicker}>FIELD NOTE</Text>
                  {chtTag ? (
                    <Text style={styles.entryTag}>{chtTag}</Text>
                  ) : null}
                </View>

                {/* Health status leveled on the opposite side of FIELD NOTE */}
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

              <Text style={styles.dateLine} numberOfLines={1}>
                {timestamp}
              </Text>
            </View>

            {/* Journal subject and observation */}
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
                <Text style={styles.entryTitle} numberOfLines={2}>
                  {behaviorLabels && behaviorLabels.length > 0
                    ? "Observed Behaviors"
                    : "Chicken Observation"}
                </Text>

                <Text style={styles.contextLabel} numberOfLines={1}>
                  {detectedIllness
                    ? `Diagnosis: ${detectedIllness}`
                    : "Diagnosis: Not recorded"}
                </Text>

                {behaviorLabels && behaviorLabels.length > 0 ? (
                  <View style={styles.behaviorPreview}>
                    {behaviorLabels.slice(0, 2).map((label) => (
                      <View key={label} style={styles.behaviorChip}>
                        <Text style={styles.behaviorChipText} numberOfLines={1}>
                          {label}
                        </Text>
                      </View>
                    ))}
                    {behaviorLabels.length > 2 ? (
                      <View style={styles.behaviorMoreChip}>
                        <Text style={styles.behaviorMoreText}>
                          +{behaviorLabels.length - 2} more
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.journalNote}>
              <Text style={styles.journalNoteLabel}>OBSERVATION</Text>
              <Text style={styles.observationText} numberOfLines={3}>
                {additionalObservation?.trim()
                  ? `"${additionalObservation.trim()}"`
                  : "No observation written for this entry."}
              </Text>
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
                  <View>
                    {(noteHistory.length
                      ? noteHistory
                      : [{ text: currentNote.trim(), savedAt: noteSavedAt }]
                    ).map((note, index) => (
                      <View key={`${note.savedAt ?? "note"}-${index}`}>
                        <Text style={styles.notePreviewText} numberOfLines={1}>
                          <Text style={styles.notePrefix}>Note: </Text>
                          {note.text}
                        </Text>
                        {note.savedAt ? (
                          <Text style={styles.noteTimestamp}>
                            Saved {formatJournalDateTime(note.savedAt)}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
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
                {detectedIllness} | {timestamp}
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
    backgroundColor: "#FFFDF8",
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
    paddingBottom: verticalScale(10),
    marginBottom: verticalScale(12),
    gap: 3,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(49, 118, 103, 0.16)",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  journalHeading: {
    flex: 1,
    gap: 3,
  },
  journalKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 1,
  },
  journalKicker: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(10),
    fontWeight: "800",
    letterSpacing: 1,
    color: ChickIntelPalette.green1,
  },
  entryTag: {
    marginLeft: 3,
    paddingHorizontal: moderateScale(6),
    paddingVertical: verticalScale(2),
    borderRadius: 5,
    backgroundColor: "rgba(49, 118, 103, 0.1)",
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  leftTagWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    fontSize: responsiveFontSize(11.5),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    marginTop: verticalScale(1),
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(3),
    borderRadius: 8,
    borderWidth: 1,
    flexShrink: 0,
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
  entryTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(17),
    lineHeight: 23,
    fontWeight: "800",
    letterSpacing: -0.2,
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
  behaviorPreview: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 5,
    marginTop: verticalScale(6),
    minWidth: 0,
  },
  behaviorChip: {
    maxWidth: "100%",
    flexShrink: 1,
    paddingHorizontal: moderateScale(7),
    paddingVertical: verticalScale(4),
    borderRadius: 7,
    backgroundColor: "rgba(202, 227, 221, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(67, 139, 123, 0.2)",
  },
  behaviorChipText: {
    flexShrink: 1,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    lineHeight: 13,
    fontWeight: "700",
    color: ChickIntelPalette.green1,
  },
  behaviorMoreChip: {
    flexShrink: 0,
    paddingHorizontal: moderateScale(7),
    paddingVertical: verticalScale(4),
    borderRadius: 7,
    backgroundColor: "rgba(49, 118, 103, 0.1)",
  },
  behaviorMoreText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    lineHeight: 13,
    fontWeight: "800",
    color: ChickIntelPalette.textMuted,
  },
  observationBox: {
    marginTop: verticalScale(6),
    backgroundColor: "rgba(202, 227, 221, 0.25)",
    borderRadius: 8,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(4),
  },
  journalNote: {
    marginTop: verticalScale(12),
    paddingTop: verticalScale(9),
    paddingHorizontal: moderateScale(10),
    paddingBottom: verticalScale(10),
    backgroundColor: "rgba(255, 248, 229, 0.72)",
  },
  journalNoteLabel: {
    marginBottom: verticalScale(4),
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(10),
    fontWeight: "800",
    letterSpacing: 0.8,
    color: "#9A6B2F",
  },
  observationText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    lineHeight: 18,
    fontWeight: "600",
    color: "#554A3A",
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
  noteTimestamp: {
    marginTop: 2,
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    color: ChickIntelPalette.textMuted,
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
