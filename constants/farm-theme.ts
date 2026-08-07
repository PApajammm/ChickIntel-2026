export const FarmColors = {
    light: {
        background: "#F4F0E8",
        surface: "#FFFDF9",
        surfaceMuted: "#F0E9DD",
        surfaceStrong: "#E7DDCB",
        text: "#1B1B1B",
        textMuted: "#666159",
        border: "#DDD2C2",
        primary: "#6C8B3D",
        primarySoft: "#DDE8C8",
        secondary: "#B76E3E",
        secondarySoft: "#F7D9C3",
        accent: "#2D6B73",
        accentSoft: "#D5EEF0",
        danger: "#A94A45",
        dangerSoft: "#F5D9D7",
        success: "#3E7A43",
        successSoft: "#D9E9D9",
        shadow: "rgba(31, 31, 31, 0.12)",
    },
    dark: {
        background: "#0F1512",
        surface: "#17201B",
        surfaceMuted: "#1E2922",
        surfaceStrong: "#253229",
        text: "#F5F4EE",
        textMuted: "#AAB4A8",
        border: "#2F3A33",
        primary: "#A4C56E",
        primarySoft: "#24341A",
        secondary: "#D08A58",
        secondarySoft: "#382519",
        accent: "#67B3BA",
        accentSoft: "#173238",
        danger: "#E28B84",
        dangerSoft: "#3A1F20",
        success: "#76B980",
        successSoft: "#1B2D1E",
        shadow: "rgba(0, 0, 0, 0.28)",
    },
} as const;

export function getFarmColors(
    colorScheme: "light" | "dark" | null | undefined,
) {
    return FarmColors[colorScheme === "dark" ? "dark" : "light"];
}
