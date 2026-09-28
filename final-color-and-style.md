# ChickIntel 2026 — Final Color Palette & Style System

> **MANDATORY SYSTEM DIRECTIVE FOR ALL AGENTS & DEVELOPERS:**
> This document represents the **single source of truth** for all visual styles, color tokens, typography, component geometry, headers, buttons, cards, and modals across the entire ChickIntel application.
> **DO NOT** introduce arbitrary colors, Tailwind palettes, or multi-colored gradients. Every UI element recolored or built must strictly adhere to the tokens and rules defined below.

---

## 1. The Core 4-Color Palette (+ Strict Neutrals)

ChickIntel uses a radical, minimalist, modern-agricultural color system with **zero background gradients**.

| Token Name | Hex Code | Purpose & Usage Rules |
| :--- | :--- | :--- |
| **Main Base / Dark Grey** | `#1F2E2B` | **Headings, Primary Text, Frameless Header Icons.** Primary high-contrast slate-charcoal. Used for screen titles, KPI numbers, and navigation icons. |
| **Main Green** | `#40534D` | **Primary Brand & CTAs.** Main action buttons (Save, Submit, Start Scan), active segment tabs, primary quick-action icons, primary status badges. |
| **Secondary Green** | `#677C69` | **Secondary Accents & Active Sub-filters.** Secondary buttons, filter pills, secondary icon highlights, muted borders and active sub-states. |
| **Accent Orange / Peach** | `#F7C090` | **Warm Accent & Highlight.** Egg production badges, harvest callouts, warm notification dots, alert highlights. |

### Supporting Strict Neutrals & Surfaces

| Token Name | Hex Code | Purpose & Usage Rules |
| :--- | :--- | :--- |
| **Canvas Background** | `#F4F6F4` | **Solid Screen Background.** Solid neutral agricultural canvas. Strictly **NO gradients**. |
| **Surface (Cards/Modals)**| `#FFFFFF` | **Card & Modal Surfaces.** Pure white containers, bottom sheets, dialogue cards. |
| **Light Tint / Pill BG** | `#EDF2EE` | **Chip & Pill Backgrounds.** Light sage-tinted background for pills, active chips, and subtle badge backgrounds. |
| **Border / Divider** | `#D2DBD4` | **Dividers & Outlines.** Subtle, clean borders for cards, inputs, and list separators. |
| **Muted Body Text** | `#6B7F78` | **Subtitles & Timestamps.** Secondary descriptive text, metadata labels, captions. |

---

## 2. Exceptions & Specific Elements

### A. Batch Identification Chips
- **Flock & Egg Batch Colors:** Dynamic `colorHex` values assigned to batches (e.g., Red, Blue, Amber, Emerald, Violet) are **preserved exclusively** on batch indicator dots and small batch identification chips to allow farmers to quickly distinguish physical pens/batches.
- These colors must **never leak** into page backgrounds, headers, or global button styling.

### B. Status Indicators & Chips (Health & Alerts)
- **Recovered:**
  - Background: `#EDF2EE` (`ChickIntelPalette.lightGreen`) or `rgba(64, 83, 77, 0.12)`
  - Text & Accent: `#40534D` (`ChickIntelPalette.green1`)
  - Border: `rgba(64, 83, 77, 0.25)`
- **Deceased / Dead:**
  - Background: `rgba(146, 55, 55, 0.10)`
  - Text & Accent: `#923737` (or `#B91C1C` alert tone)
  - Border: `rgba(146, 55, 55, 0.25)`
- **Isolated / Isolation:**
  - Background: `rgba(247, 192, 144, 0.25)` (`ChickIntelPalette.accent` tint)
  - Text & Accent: `#1F2E2B` (`ChickIntelPalette.gray1`)
  - Border: `rgba(247, 192, 144, 0.6)`
- **Monitoring / Monitored / Active:**
  - Background: `#EDF2EE` (`ChickIntelPalette.lightGreen`)
  - Text: `#1F2E2B` (`ChickIntelPalette.gray1`)
  - Accent / Border: `#677C69` (`ChickIntelPalette.mediumGreen`)

---

## 3. Component Styling Standards

### A. Header Action Buttons (Batch Profile, History, Subpages)
- **Frameless & Sleek:** All header buttons (Back arrow, History, Analytics, Printer, Trash, Filter, Close) must be **transparent and frameless** (no colored square/circle background containers).
- **Icon Color:** Strictly `#1F2E2B` (Dark Grey) with `size: 22` to `24`.
- **Touch Target:** Minimum `40x40px` hit area with `justifyContent: 'center', alignItems: 'center'`.

### B. Mobile Header Design (Homepage / Dashboard)
- **Layout:** Sleek native mobile header with a farmer/flock avatar icon, dynamic greeting stack (*"Good morning / afternoon / evening, {Name}"*), and a compact calendar/date pill.
- **Date Pill:** Compact pill badge with white surface `#FFFFFF`, border `#D2DBD4`, and `#1F2E2B` / `#677C69` typography.

### C. Cards & Containers
- **Background:** `#FFFFFF` (Solid White).
- **Border Radius:** `14px` (Standard Card) to `18px` (Hero / Featured Card).
- **Border:** `1px solid #EDF2EE` or `#D2DBD4`.
- **Shadow:** Minimal, clean mobile elevation (`shadowColor: "#161E1A"`, `shadowOpacity: 0.04`, `shadowRadius: 8`, `elevation: 2`).

### D. Final Default Button Style (Based on Logout Button Style)
All primary, secondary, dialog, modal, and confirmation action buttons across the entire system must strictly implement this uniform geometry, font styling, and color mapping:

- **Primary Button (Save, Submit, OK, Confirm, Log in):**
  - Container: `minHeight: 42px` (or `44px`), `borderRadius: 10px` (or `12px`), `paddingHorizontal: 16px`, `backgroundColor: #40534D` (`ChickIntelPalette.green1`), `alignItems: "center"`, `justifyContent: "center"`.
  - Typography: `fontFamily: ChickFont.sans`, `fontSize: 14px`, `fontWeight: "600"`, `color: "#FFFFFF"`.
- **Secondary Button (Cancel, Back, Dismiss):**
  - Container: `minHeight: 42px`, `borderRadius: 10px`, `paddingHorizontal: 16px`, `backgroundColor: #EDF2EE` (`ChickIntelPalette.lightGreen`), `borderWidth: 1px`, `borderColor: #677C69` (`ChickIntelPalette.mediumGreen`), `alignItems: "center"`, `justifyContent: "center"`.
  - Typography: `fontFamily: ChickFont.sans`, `fontSize: 14px`, `fontWeight: "600"`, `color: #1F2E2B` (`ChickIntelPalette.gray1`).
- **Destructive Button (Delete Confirm):**
  - Container: `minHeight: 42px`, `borderRadius: 10px`, `paddingHorizontal: 16px`, `backgroundColor: #923737` (or `#B91C1C`), `alignItems: "center"`, `justifyContent: "center"`.
  - Typography: `fontFamily: ChickFont.sans`, `fontSize: 14px`, `fontWeight: "600"`, `color: "#FFFFFF"`.

### E. Modals & Dialogs (Delete, Confirmation, Logout)
- **Backdrop:** `rgba(31, 46, 43, 0.45)` (Dark grey with soft dim).
- **Modal Card / Bottom Sheet:** Solid `#FFFFFF`, rounded corners `16px` to `20px`, border `1px solid #D2DBD4`, shadow elevation `8`.
- **Header:** Title in `#1F2E2B` (Display/Sans, `700`/`800`, `18px`), message in `#6B7F78` (`14px`).
- **Action Buttons:** Standard 2-column or row button stack matching the **Final Default Button Style** (Secondary Cancel on left, Primary/Destructive Confirm on right with `gap: 12px`).

### F. Final Confirmation & Notice Modal Style (`final-confirmattion-notice-style`)
All confirmation dialogs, delete confirmation modals, camera retake prompts, and status notices across the app must strictly follow the **Logout Modal** visual design:
- **Backdrop:** `rgba(31, 46, 43, 0.45)` with centered layout and `padding: 24px`.
- **Card Surface:** Pure white `#FFFFFF`, `borderRadius: 16px`, `borderWidth: 1px`, `borderColor: #D2DBD4`, `maxWidth: 360px`, `padding: 18px to 20px`, shadow elevation `8`.
- **Typography:**
  - **Title:** `ChickFont.display`, `fontSize: 18px`, `fontWeight: "700"`, `color: #1F2E2B`, `textAlign: "center"`, `marginBottom: 8px`.
  - **Message / Body:** `ChickFont.sans`, `fontSize: 14px`, `lineHeight: 20px`, `fontWeight: "500"`, `color: #6B7F78`, `textAlign: "center"`, `marginBottom: 16px`.
- **Button Row:** `flexDirection: "row"`, `gap: 12px`, `justifyContent: "center"`.
  - **Cancel / Dismiss Button (Left):** `backgroundColor: #EDF2EE`, `borderWidth: 1px`, `borderColor: #677C69`, `borderRadius: 10px`, `minHeight: 42px`, text `color: #1F2E2B`, `fontWeight: "600"`, `fontSize: 14px`.
  - **Confirm / Action Button (Right):**
    - Standard / Retake / Done: `backgroundColor: #40534D` (`ChickIntelPalette.green1`), `borderRadius: 10px`, `minHeight: 42px`, text `color: "#FFFFFF"`, `fontWeight: "600"`, `fontSize: 14px`.
    - Delete / Destructive: `backgroundColor: #923737`, `borderRadius: 10px`, `minHeight: 42px`, text `color: "#FFFFFF"`, `fontWeight: "600"`, `fontSize: 14px`.

### G. Final Dual Button Style (`final-dual-button-style`)
For side-by-side or dual operational action buttons (such as "Deceased" vs. "Recovered" in Health Monitoring or primary/secondary bottom pairs, directly matching the Logout dialog buttons):
- **Layout & Geometry:**
  - `flexDirection: "row"`, `gap: 8px` to `12px`.
  - Each button: `flex: 1`, `minHeight: 42px`, `borderRadius: 10px`, `alignItems: "center"`, `justifyContent: "center"`, `paddingHorizontal: 12px`.
  - **No icons inside dual buttons** — clean, modern typography only.
  - **No red color** — use consistent primary green and secondary sage palette.
- **Secondary / Left CTA (e.g. "Deceased" / "Cancel"):**
  - Container: `backgroundColor: #EDF2EE` (`ChickIntelPalette.lightGreen`), `borderWidth: 1px`, `borderColor: #677C69` (`ChickIntelPalette.mediumGreen`).
  - Typography: `fontFamily: ChickFont.sans`, `fontSize: 13.5px`, `fontWeight: "600"`, `color: #1F2E2B` (`ChickIntelPalette.gray1`), `textAlign: "center"`.
- **Primary / Right CTA (e.g. "Recovered" / "Ok"):**
  - Container: `backgroundColor: #40534D` (`ChickIntelPalette.green1`).
  - Typography: `fontFamily: ChickFont.sans`, `fontSize: 13.5px`, `fontWeight: "600"`, `color: "#FFFFFF"`, `textAlign: "center"`.

---

## 4. Typography Standards

- **Display Headings & KPI Values:** `ChickFont.display` (Serif / Playfair) or `ChickFont.sans` (Bold 700/800) in `#1F2E2B`.
- **Section Titles & Subheadings:** `ChickFont.sans` (SemiBold 600 / Bold 700) in `#1F2E2B` or `#40534D`.
- **Body & Captions:** `ChickFont.sans` (Regular 400 / Medium 500) in `#1F2E2B` or `#6B7F78`.

---

## 5. Summary Palette Reference Table

```ts
export const ChickIntelPalette = {
  // 4 Core Brand Colors
  gray1: "#1F2E2B",        // Main Base / Charcoal Slate (Headings, primary text, frameless icons)
  green1: "#40534D",       // Main Green (Primary CTAs, active tabs, SVG quick actions)
  mediumGreen: "#677C69",  // Secondary Green (Sub-filters, secondary pills, accents)
  accent: "#F7C090",       // Accent Peach (Egg yield badge, highlights)

  // Canvas & Surfaces
  canvas: "#F4F6F4",       // Solid screen canvas background (NO GRADIENTS)
  surface: "#FFFFFF",      // Card, modal, sheet surfaces
  lightGreen: "#EDF2EE",   // Soft pill backgrounds & active tints
  gray2: "#D2DBD4",        // Dividers, card borders, input strokes
  textMuted: "#6B7F78",    // Muted text, timestamps, captions
};
```
