import { StyleSheet } from "react-native";
import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";
import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";

/**
 * ChickIntel 2026 - Final Default Button Style
 * Single source of truth for standard primary, secondary, and destructive button styling
 * derived from the official Logout modal button specification.
 */
export const FinalDefaultButtonStyles = StyleSheet.create({
  // Base button container geometry
  btnBase: {
    minHeight: verticalScale(42),
    borderRadius: scale(10),
    paddingHorizontal: moderateScale(16),
    alignItems: "center",
    justifyContent: "center",
  },

  // Primary Button (Green CTA: Save, Confirm, Ok, Log in, Submit)
  btnPrimary: {
    minHeight: verticalScale(42),
    borderRadius: scale(10),
    paddingHorizontal: moderateScale(16),
    backgroundColor: ChickIntelPalette.green1,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Secondary Button (Cancel, Dismiss, Back, Outline)
  btnSecondary: {
    minHeight: verticalScale(42),
    borderRadius: scale(10),
    paddingHorizontal: moderateScale(16),
    backgroundColor: ChickIntelPalette.lightGreen,
    borderWidth: 1,
    borderColor: ChickIntelPalette.mediumGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  btnSecondaryText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: ChickIntelPalette.gray1,
  },

  // Destructive Button (Delete Confirmation)
  btnDestructive: {
    minHeight: verticalScale(42),
    borderRadius: scale(10),
    paddingHorizontal: moderateScale(16),
    backgroundColor: "#923737",
    alignItems: "center",
    justifyContent: "center",
  },
  btnDestructiveText: {
    fontFamily: ChickFont.sans,
    fontSize: responsiveFontSize(14),
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Modal Action Row Layout
  modalActionRow: {
    flexDirection: "row",
    gap: moderateScale(12),
    justifyContent: "center",
    marginTop: verticalScale(12),
  },
  modalActionBtn: {
    flex: 1,
    minHeight: verticalScale(42),
    borderRadius: scale(10),
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(16),
  },
});
