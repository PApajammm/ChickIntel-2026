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

### B. Status Indicators (Health & Alerts)
- **Normal / Healthy:** `#40534D` (Main Green) or `#677C69` (Secondary Green).
- **Warning / Attention:** `#F7C090` (Accent Peach) with `#1F2E2B` text.
- **Critical / Danger:** `#B91C1C` (used strictly for destructive confirm prompts like delete batch).

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

### D. Buttons & Action Elements
- **Primary Action Button:**
  - Background: `#40534D` (Main Green)
  - Text: `#FFFFFF` (Bold, Sans)
  - Radius: `12px`
- **Secondary Action Button / Outline:**
  - Background: `#EDF2EE` or `#FFFFFF`
  - Border: `1px solid #677C69`
  - Text: `#40534D` / `#677C69`
- **Active Filter / Segment Tab:**
  - Active: Background `#40534D`, Text `#FFFFFF`
  - Inactive: Background `#EDF2EE` or `#FFFFFF`, Text `#6B7F78`

### E. Modals & Dialogs
- **Backdrop:** `rgba(31, 46, 43, 0.45)` (Dark grey with soft blur/dim).
- **Modal Card / Bottom Sheet:** Solid `#FFFFFF`, rounded top corners `20px` to `24px` (for bottom sheets) or `18px` (for center dialogs).
- **Header:** Title in `#1F2E2B` (Display/Sans, bold), frameless close icon in `#1F2E2B`.
- **Dividers:** `1px solid #EDF2EE`.
- **Footer Buttons:**
  - Confirm / Save: Primary button in `#40534D`.
  - Cancel / Dismiss: Frameless text or light outline in `#677C69` / `#EDF2EE`.

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
