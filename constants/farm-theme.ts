export const FarmColors = {
    light: {
        background: "#F4F6F4",
        surface: "#FFFFFF",
        surfaceMuted: "#EDF2EE",
        surfaceStrong: "#E2E8E3",
        text: "#1F2E2B",
        textMuted: "#677C69",
        border: "#D2DBD4",
        primary: "#40534D",
        primarySoft: "#EDF2EE",
        secondary: "#677C69",
        secondarySoft: "#EDF2EE",
        accent: "#F7C090",
        accentSoft: "#FDF7F2",
        danger: "#C84B46",
        dangerSoft: "#FCEBEA",
        success: "#40534D",
        successSoft: "#EDF2EE",
        shadow: "rgba(31, 46, 43, 0.08)",
    },
    dark: {
        background: "#101614",
        surface: "#18221E",
        surfaceMuted: "#1F2B26",
        surfaceStrong: "#273530",
        text: "#F4F6F4",
        textMuted: "#96A69E",
        border: "#2C3B34",
        primary: "#4EA882",
        primarySoft: "#1B3026",
        secondary: "#E59450",
        secondarySoft: "#3B271A",
        accent: "#4EA882",
        accentSoft: "#1B3026",
        danger: "#E27B75",
        dangerSoft: "#3A1F20",
        success: "#5EB87D",
        successSoft: "#1B3322",
        shadow: "rgba(0, 0, 0, 0.32)",
    },
} as const;

export function getFarmColors(
    _colorScheme?: "light" | "dark" | null | undefined,
) {
    return FarmColors.light;
}
