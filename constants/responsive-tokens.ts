import { moderateScale, responsiveFontSize, scale, verticalScale } from "@/utils/responsive";

/**
 * Responsive Spacing Tokens
 * Automatically scales padding, margin, and gap values across screen sizes.
 */
export const ResponsiveSpacing = {
  xs: moderateScale(4),
  sm: moderateScale(8),
  md: moderateScale(12),
  lg: moderateScale(16),
  xl: moderateScale(20),
  xxl: moderateScale(24),
  screenPaddingHorizontal: moderateScale(18),
  sectionGapVertical: verticalScale(16),
  cardGap: moderateScale(12),
} as const;

/**
 * Responsive Border Radius Tokens
 */
export const ResponsiveRadius = {
  xs: scale(4),
  sm: scale(6),
  md: scale(10),
  lg: scale(14),
  xl: scale(20),
  full: 9999,
} as const;

/**
 * Responsive Icon Sizes
 */
export const ResponsiveIconSize = {
  xs: scale(14),
  sm: scale(18),
  md: scale(22),
  lg: scale(28),
  xl: scale(36),
} as const;

/**
 * Responsive Font Sizes
 */
export const ResponsiveFontSize = {
  caption: responsiveFontSize(11),
  bodySm: responsiveFontSize(13),
  body: responsiveFontSize(14),
  bodyLg: responsiveFontSize(16),
  titleSm: responsiveFontSize(18),
  title: responsiveFontSize(20),
  titleLg: responsiveFontSize(24),
  display: responsiveFontSize(32),
} as const;
