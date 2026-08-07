import { ChickFont } from "@/constants/chick-fonts";
import { ChickIntelPalette } from "@/constants/chickintel-palette";

/**
 * Minimal, modern type scale for the Health module (scanner follow-up + journal).
 * Values align with ChickIntelPalette — no extra colors.
 */
export const HealthTypography = {
    /** Large screen titles */
    screenTitle: {
        fontFamily: ChickFont.display,
        fontSize: 26,
        lineHeight: 30,
        fontWeight: "600" as const,
        letterSpacing: -0.55,
        color: ChickIntelPalette.gray1,
    },
    /** Eyebrow / section kicker */
    overline: {
        fontFamily: ChickFont.sans,
        fontSize: 11,
        lineHeight: 14,
        fontWeight: "600" as const,
        letterSpacing: 0.75,
        textTransform: "uppercase" as const,
        color: ChickIntelPalette.green1,
    },
    /** Card section title (sentence case) */
    sectionTitle: {
        fontFamily: ChickFont.display,
        fontSize: 15,
        lineHeight: 20,
        fontWeight: "600" as const,
        letterSpacing: -0.12,
        color: ChickIntelPalette.gray1,
    },
    /** Body — primary reading */
    body: {
        fontFamily: ChickFont.sans,
        fontSize: 15,
        lineHeight: 22,
        fontWeight: "400" as const,
        letterSpacing: 0,
        color: ChickIntelPalette.gray1,
    },
    bodyMedium: {
        fontFamily: ChickFont.sans,
        fontSize: 15,
        lineHeight: 22,
        fontWeight: "500" as const,
        letterSpacing: 0,
        color: ChickIntelPalette.gray1,
    },
    /** Metadata / helper */
    meta: {
        fontFamily: ChickFont.sans,
        fontSize: 13,
        lineHeight: 19,
        fontWeight: "400" as const,
        letterSpacing: 0,
        color: "#6F7373",
    },
    metaMedium: {
        fontFamily: ChickFont.sans,
        fontSize: 13,
        lineHeight: 19,
        fontWeight: "500" as const,
        letterSpacing: 0,
        color: "#6F7373",
    },
    /** Small caps–style labels inside cards */
    cardLabel: {
        fontFamily: ChickFont.sans,
        fontSize: 11,
        lineHeight: 13,
        fontWeight: "600" as const,
        letterSpacing: 0.55,
        textTransform: "uppercase" as const,
        color: "#5C6464",
    },
    /** Chip / compact */
    caption: {
        fontFamily: ChickFont.sans,
        fontSize: 12,
        lineHeight: 16,
        fontWeight: "600" as const,
        letterSpacing: 0,
        color: ChickIntelPalette.gray1,
    },
} as const;

/** Shared app bar title (Profile, Inventory, Schedule, Reports, Add batch, etc.) — same scale as Health module. */
export const appScreenTitle = HealthTypography.screenTitle;
