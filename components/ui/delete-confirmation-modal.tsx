import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import {
  moderateScale,
  responsiveFontSize,
  scale,
  verticalScale,
} from "@/utils/responsive";

export interface DeleteConfirmationModalProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  itemTitle?: string;
  itemSubtitle?: string;
  itemBadge?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  iconName?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Standard confirmation and delete modal matching the Logout Modal visual style.
 */
export function DeleteConfirmationModal({
  visible,
  title = "Delete Confirmation",
  subtitle,
  itemTitle,
  itemSubtitle,
  itemBadge,
  message = "Are you sure you want to delete this item? This action cannot be undone.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirmColor = "#923737",
  iconName = "trash-can-outline",
  isDeleting = false,
  onConfirm,
  onCancel,
}: DeleteConfirmationModalProps) {
  const { width } = useWindowDimensions();
  const maxW = Math.min(width - moderateScale(48), scale(360));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={isDeleting ? undefined : onCancel}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={isDeleting ? undefined : onCancel}
      >
        <Pressable
          style={[styles.modalCard, { maxWidth: maxW }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.modalTitle}>{title}</Text>

          {(itemTitle || itemBadge || itemSubtitle) && (
            <View style={styles.itemPreviewCard}>
              {itemBadge ? (
                <View style={styles.badgeRow}>
                  <View style={styles.badgePill}>
                    <Text style={styles.badgePillText}>{itemBadge}</Text>
                  </View>
                </View>
              ) : null}
              {itemTitle ? (
                <Text style={styles.itemTitleText} numberOfLines={2}>
                  {itemTitle}
                </Text>
              ) : null}
              {itemSubtitle ? (
                <Text style={styles.itemSubtitleText} numberOfLines={2}>
                  {itemSubtitle}
                </Text>
              ) : null}
            </View>
          )}

          <Text style={styles.messageText}>
            {subtitle || message}
          </Text>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={onCancel}
              disabled={isDeleting}
              activeOpacity={0.8}
            >
              <Text style={styles.modalCancelText} numberOfLines={1}>
                {cancelLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalDelete,
                { backgroundColor: confirmColor },
                isDeleting && styles.disabledBtn,
              ]}
              onPress={() => void onConfirm()}
              disabled={isDeleting}
              activeOpacity={0.88}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  {iconName ? (
                    <MaterialCommunityIcons
                      name={iconName}
                      size={moderateScale(16)}
                      color="#FFFFFF"
                    />
                  ) : null}
                  <Text style={styles.modalDeleteText} numberOfLines={1}>
                    {confirmLabel}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(31, 46, 43, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: moderateScale(24),
  },
  modalCard: {
    width: "100%",
    borderRadius: scale(16),
    padding: moderateScale(18),
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
    shadowColor: "#161E1A",
    shadowOpacity: 0.12,
    shadowRadius: scale(16),
    shadowOffset: { width: 0, height: verticalScale(6) },
    elevation: 8,
  },
  modalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    textAlign: "center",
    marginBottom: verticalScale(8),
  },
  itemPreviewCard: {
    borderWidth: 1,
    borderColor: ChickIntelPalette.gray2,
    borderRadius: 10,
    paddingHorizontal: moderateScale(12),
    paddingVertical: verticalScale(8),
    backgroundColor: ChickIntelPalette.lightGreen,
    gap: 2,
    marginVertical: verticalScale(6),
    alignItems: "center",
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  badgePill: {
    backgroundColor: ChickIntelPalette.green2,
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(2),
    borderRadius: 6,
  },
  badgePillText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  itemTitleText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(14),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    textAlign: "center",
  },
  itemSubtitleText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11.5),
    color: ChickIntelPalette.textMuted,
    lineHeight: 15,
    textAlign: "center",
  },
  messageText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    lineHeight: responsiveFontSize(20),
    fontWeight: "500",
    color: ChickIntelPalette.textMuted,
    textAlign: "center",
    marginBottom: verticalScale(16),
  },
  modalActions: {
    flexDirection: "row",
    gap: moderateScale(12),
    justifyContent: "center",
  },
  modalCancel: {
    flex: 1,
    minHeight: verticalScale(42),
    borderRadius: scale(10),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(16),
    backgroundColor: ChickIntelPalette.lightGreen,
    borderWidth: 1,
    borderColor: ChickIntelPalette.mediumGreen,
  },
  modalCancelText: {
    fontFamily: ChickFont.sans,
    color: ChickIntelPalette.gray1,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
  },
  modalDelete: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: verticalScale(42),
    borderRadius: scale(10),
    paddingHorizontal: moderateScale(16),
    backgroundColor: "#923737",
  },
  modalDeleteText: {
    fontFamily: ChickFont.sans,
    color: "#FFFFFF",
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
  },
  disabledBtn: {
    opacity: 0.65,
  },
});
