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

export function DeleteConfirmationModal({
  visible,
  title = "Delete Confirmation",
  subtitle = "This action cannot be undone.",
  itemTitle,
  itemSubtitle,
  itemBadge,
  message = "Are you sure you want to proceed with deletion?",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  confirmColor = "#DC2626",
  iconName = "trash-can-outline",
  isDeleting = false,
  onConfirm,
  onCancel,
}: DeleteConfirmationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={isDeleting ? undefined : onCancel}
        />
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderTitleRow}>
              <View style={styles.modalHeaderIconBadge}>
                <MaterialCommunityIcons
                  name={iconName}
                  size={moderateScale(20)}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.modalHeaderTexts}>
                <Text style={styles.modalTitle}>{title}</Text>
                {subtitle ? (
                  <Text style={styles.modalSubtitle}>{subtitle}</Text>
                ) : null}
              </View>
            </View>
          </View>

          <View style={styles.modalBody}>
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

            {message ? <Text style={styles.messageText}>{message}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={onCancel}
                disabled={isDeleting}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>{cancelLabel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalDelete,
                  { backgroundColor: confirmColor },
                  isDeleting && styles.disabledBtn,
                ]}
                onPress={() => void onConfirm()}
                disabled={isDeleting}
                activeOpacity={0.85}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name={iconName}
                      size={moderateScale(16)}
                      color="#FFFFFF"
                    />
                    <Text style={styles.modalDeleteText}>{confirmLabel}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.52)",
    justifyContent: "center",
    alignItems: "center",
    padding: moderateScale(20),
  },
  modalCard: {
    width: "100%",
    maxWidth: scale(420),
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: verticalScale(8) },
    elevation: 10,
  },
  modalHeader: {
    backgroundColor: ChickIntelPalette.green1,
    paddingHorizontal: moderateScale(18),
    paddingVertical: verticalScale(14),
  },
  modalHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  modalHeaderIconBadge: {
    width: scale(36),
    height: verticalScale(36),
    borderRadius: 18,
    backgroundColor: "rgba(220, 38, 38, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTexts: {
    flex: 1,
  },
  modalTitle: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(16),
    fontWeight: "800",
    color: "#FFFFFF",
  },
  modalSubtitle: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(11.5),
    color: "rgba(255, 255, 255, 0.85)",
    marginTop: 2,
  },
  modalBody: {
    padding: moderateScale(18),
    gap: 12,
  },
  itemPreviewCard: {
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.18)",
    borderRadius: 12,
    paddingHorizontal: moderateScale(14),
    paddingVertical: verticalScale(10),
    backgroundColor: "rgba(202, 227, 221, 0.25)",
    gap: 4,
  },
  badgeRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  badgePill: {
    backgroundColor: "rgba(22, 89, 76, 0.12)",
    paddingHorizontal: moderateScale(8),
    paddingVertical: verticalScale(2),
    borderRadius: 6,
  },
  badgePillText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(10),
    fontWeight: "700",
    color: ChickIntelPalette.green1,
    letterSpacing: 0.4,
  },
  itemTitleText: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(15),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
  },
  itemSubtitleText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(12),
    color: "#52615D",
    lineHeight: 16,
  },
  messageText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(13),
    lineHeight: 19,
    color: ChickIntelPalette.gray1,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  modalCancel: {
    paddingVertical: verticalScale(10),
    paddingHorizontal: moderateScale(16),
    borderRadius: 10,
    backgroundColor: "#F0F2F2",
    borderWidth: 1,
    borderColor: "rgba(49, 118, 103, 0.15)",
  },
  modalCancelText: {
    fontFamily: ChickFont.sans,
    color: ChickIntelPalette.gray1,
    fontSize: responsiveFontSize(13.5),
    fontWeight: "600",
  },
  modalDelete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: verticalScale(10),
    paddingHorizontal: moderateScale(18),
    borderRadius: 10,
    minWidth: scale(95),
    justifyContent: "center",
  },
  modalDeleteText: {
    fontFamily: ChickFont.sans,
    color: "#FFFFFF",
    fontSize: responsiveFontSize(13.5),
    fontWeight: "700",
  },
  disabledBtn: {
    opacity: 0.65,
  },
});
