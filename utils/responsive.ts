import { Dimensions, PixelRatio, useWindowDimensions } from "react-native";

export const BASE_DEVICE_WIDTH = 390;
export const BASE_DEVICE_HEIGHT = 844;

const { width: initialWidth, height: initialHeight } = Dimensions.get("window");

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const roundToNearestPixel = (value: number) =>
  PixelRatio.roundToNearestPixel(value);

export function getResponsiveScale(width: number = initialWidth) {
  return clamp(width / BASE_DEVICE_WIDTH, 0.82, 1.15);
}

export function getResponsiveVerticalScale(height: number = initialHeight) {
  return clamp(height / BASE_DEVICE_HEIGHT, 0.82, 1.15);
}

export function scale(size: number, width: number = initialWidth) {
  return roundToNearestPixel(size * getResponsiveScale(width));
}

export function verticalScale(size: number, height: number = initialHeight) {
  return roundToNearestPixel(size * getResponsiveVerticalScale(height));
}

export function moderateScale(
  size: number,
  factor = 0.45,
  width: number = initialWidth,
) {
  return roundToNearestPixel(size + (scale(size, width) - size) * factor);
}

export function responsiveFontSize(size: number, width: number = initialWidth) {
  return clamp(moderateScale(size, 0.38, width), size * 0.88, size * 1.14);
}

export function responsiveWidth(percentage: number, width: number = initialWidth) {
  return roundToNearestPixel((width * clamp(percentage, 0, 100)) / 100);
}

export function responsiveHeight(percentage: number, height: number = initialHeight) {
  return roundToNearestPixel((height * clamp(percentage, 0, 100)) / 100);
}

export function scaleValue(value: number, width: number) {
  return Math.max(10, Math.round(value * getResponsiveScale(width)));
}

/** Returns true if the current screen width is considered a small phone (< 360 dp). */
export function isSmallPhoneWidth(width: number = initialWidth) {
  return width < 360;
}

/** Returns true if the current screen width is considered a large phone (>= 430 dp). */
export function isLargePhoneWidth(width: number = initialWidth) {
  return width >= 430;
}

export function useResponsiveScale() {
  const { width } = useWindowDimensions();
  return getResponsiveScale(width);
}

export function useResponsiveMetrics() {
  const { width, height } = useWindowDimensions();
  const isSmallPhone = width < 360;
  const isLargePhone = width >= 430;

  return {
    width,
    height,
    isSmallPhone,
    isLargePhone,
    scale: (size: number) => scale(size, width),
    verticalScale: (size: number) => verticalScale(size, height),
    moderateScale: (size: number, factor?: number) =>
      moderateScale(size, factor, width),
    responsiveFontSize: (size: number) => responsiveFontSize(size, width),
  };
}

/**
 * Extended layout metrics hook — adds common computed layout values
 * that are re-used across multiple screens.
 */
export function useResponsiveLayout() {
  const metrics = useResponsiveMetrics();
  const { width, height, scale: s, verticalScale: vs, moderateScale: ms, responsiveFontSize: rfs } = metrics;

  return {
    ...metrics,
    // Screen fractions
    screenWidth: width,
    screenHeight: height,
    // Horizontal padding used consistently across screen containers
    screenPaddingH: ms(18),
    // Standard card gap
    cardGap: ms(12),
    // Standard section gap
    sectionGap: vs(16),
    // Helpers (shorthand aliases)
    s,
    vs,
    ms,
    rfs,
  };
}
