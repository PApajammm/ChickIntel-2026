import { Platform } from "react-native";

/**
 * Stable font families used across the app.
 * System fonts avoid Expo Go failures when bundled font registration changes.
 */
export const ChickFont = {
    sans: Platform.select({
        ios: "System",
        android: "sans-serif",
        default: "System",
    }),
    sansItalic: Platform.select({
        ios: "System",
        android: "sans-serif",
        default: "System",
    }),
    display: Platform.select({
        ios: "System",
        android: "sans-serif-medium",
        default: "System",
    }),
    displayItalic: Platform.select({
        ios: "System",
        android: "sans-serif-medium",
        default: "System",
    }),
} as const;
