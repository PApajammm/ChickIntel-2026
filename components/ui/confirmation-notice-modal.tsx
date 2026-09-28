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

export interface ConfirmationNoticeModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  iconName?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * Standard confirmation, retake, and notice modal matching the Logout Modal visual style.
 * Logged as `final-confirmation-notice-style`.
 */
export function ConfirmationNoticeModal({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmColor,
  isDestructive = false,
  isLoading = false,
  iconName,
  onConfirm,
  onCancel,
}: ConfirmationNoticeModalProps) {
  const { width } = useWindowDimensions();
  const maxW = Math.min(width - moderateScale(48), scale(360));

  const resolvedConfirmBg =
    confirmColor ||
    (isDestructive ? "#923737" : ChickIntelPalette.green1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={isLoading ? undefined : onCancel}
    >
      <Pressable
        style={styles.backdrop}
        onPress={isLoading ? undefined : onCancel}
      >
        <Pressable
          style={[styles.card, { maxWidth: maxW }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.row}>
            <TouchableOpacity
              onPress={onCancel}
              disabled={isLoading}
              style={[styles.btn, styles.btnSecondary]}
              activeOpacity={0.8}
            >
              <Text style={styles.btnSecondaryText} numberOfLines={1}>
                {cancelLabel}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void onConfirm()}
              disabled={isLoading}
              style={[
                styles.btn,
                { backgroundColor: resolvedConfirmBg },
                isLoading && styles.disabledBtn,
              ]}
              activeOpacity={0.88}
            >
              {isLoading ? (
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
                  <Text style={styles.btnPrimaryText} numberOfLines={1}>
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(31, 46, 43, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: moderateScale(24),
  },
  card: {
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
  title: {
    fontFamily: ChickFont.display,
    fontSize: responsiveFontSize(18),
    fontWeight: "700",
    color: ChickIntelPalette.gray1,
    textAlign: "center",
    marginBottom: verticalScale(8),
  },
  message: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    lineHeight: responsiveFontSize(20),
    fontWeight: "500",
    color: ChickIntelPalette.textMuted,
    textAlign: "center",
    marginBottom: verticalScale(16),
  },
  row: {
    flexDirection: "row",
    gap: moderateScale(12),
    justifyContent: "center",
  },
  btn: {
    flex: 1,
    minHeight: verticalScale(42),
    borderRadius: scale(10),
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: moderateScale(16),
  },
  btnSecondary: {
    backgroundColor: ChickIntelPalette.lightGreen,
    borderWidth: 1,
    borderColor: ChickIntelPalette.mediumGreen,
  },
  btnSecondaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },
  btnPrimaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: "#FFFFFF",
  },
  disabledBtn: {
    opacity: 0.65,
  },
});
