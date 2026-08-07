/**
 * Temporary store until the Journal screen persists entries.
 * Safe to replace with API / SQLite later.
 */

export type HealthJournalSavedScan = {
    id: string;
    savedAt: string;
    photoUri: string;
    detectedIllness: string;
    behaviorIds: string[];
    resultSummary: string;
    recommendationText: string;
    actionStatus: string;
    durationValue: string;
};

const entries: HealthJournalSavedScan[] = [];

export function appendHealthJournalEntry(
    entry: Omit<HealthJournalSavedScan, "id" | "savedAt">,
) {
    const row: HealthJournalSavedScan = {
        ...entry,
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        savedAt: new Date().toISOString(),
    };
    entries.unshift(row);
    return row;
}

export function getHealthJournalEntries(): HealthJournalSavedScan[] {
    return [...entries];
}

export function getHealthJournalEntryById(
    id: string,
): HealthJournalSavedScan | undefined {
    return entries.find((e) => e.id === id);
}

export function removeHealthJournalEntries(ids: string[]) {
    const idSet = new Set(ids);
    for (let i = entries.length - 1; i >= 0; i--) {
        if (idSet.has(entries[i]!.id)) entries.splice(i, 1);
    }
}

/** YYYY/MM/DD in local time */
export function formatJournalDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
}

/** YYYY/MM/DD h:mm AM/PM in local time */
export function formatJournalDateTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";

    const date = formatJournalDate(iso);
    const hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const suffix = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;

    return `${date} • ${displayHours}:${minutes} ${suffix}`;
}
