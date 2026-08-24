# Implementation Plan - Inventory Expiration UI & Alert System

## Goal Description
Enhance the ChickIntel Inventory screen by introducing a clear, eye-catching, and intuitive expiration status management and UI system. When an inventory item is expired or nearing expiration:
1. It visually highlights the item in the table with distinct status badges, warning callouts, and subtle row styling (e.g. Expired / Expiring Soon).
2. It displays a summary banner at the top of the Inventory screen when expired items or items expiring soon exist, with quick-action chips to quickly identify, restock, or discard expired supplies.
3. If an item is expired, it provides explicit cues so farm operators immediately know not to use contaminated/expired feed or medication on their flock.

---

## Proposed Changes

### [MODIFY] [stock-alerts.ts](file:///c:/Users/Ralph%20Zaimon/Desktop/ChickIntel-2026/utils/stock-alerts.ts)
- Add expiration calculation helper `getExpirationStatus(expirationDate?: Date | string | null)` returning:
  - `status`: `'expired' | 'expiring-soon' | 'fresh' | 'none'`
  - `daysLeft`: number of days until expiration (or negative if already expired)
  - `label`: e.g., "Expired (3d ago)", "Expired Today", "Expires in 2 days", "Valid"
  - `badgeColor`, `badgeBg`, `textColor`, `icon`
- Support threshold customization (default: $\le 7$ days is "expiring soon", $\le 0$ days is "expired").

### [MODIFY] [inventory.tsx](file:///c:/Users/Ralph%20Zaimon/Desktop/ChickIntel-2026/app/(tabs)/inventory.tsx)
- Compute overall expiration summary:
  - Count of total expired items.
  - Count of items expiring within 7 days.
- Add an **Expiration Alert Banner** at the top of the inventory screen when there are expired or expiring items.
  - Styled with modern glassmorphism matching the ChickIntel aesthetic.
  - Shows warning icon, count of expired feeds/meds, and a quick filter / view toggle if desired.
- In each table row for items with expiration dates:
  - If **Expired**: Display a high-visibility badge (Red alert badge: `⚠️ Expired (X days ago)` or `⚠️ Expired`), row highlight tint, and an expiration warning tooltip/tag.
  - If **Expiring Soon**: Display an amber warning badge (`⏳ Exp. in X days`).
  - Normal: Keep standard clean tag (`Exp: MM/DD/YYYY`).
- In the Edit/Action view:
  - Add explicit note or action if updating stock of an expired item (so users can easily update expiration date upon restock).

---

## Verification Plan

### Automated / Code Quality
- TypeScript check (`npx tsc --noEmit`) to ensure type safety.

### Manual Verification
- Test inventory items with:
  1. Past expiration date $\rightarrow$ verify Red badge "Expired (X days ago)", alert card appears at top.
  2. Date within next 7 days $\rightarrow$ verify Amber badge "Expires in X days".
  3. Future date $> 7$ days $\rightarrow$ verify standard clean tag.
  4. Non-perishable items (e.g., Equipment) $\rightarrow$ verify no expiration badge rendered.
