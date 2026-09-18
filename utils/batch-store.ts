export type BatchItem = {
  id: string;
  createdAt?: string;
  breed: string;
  femaleCount: number;
  maleCount: number;
  ageLabel: string;
  isolatedCount: number;
  killedCount: number;
  colorName: string;
  colorHex: string;
  notes?: { id: string; text: string; createdAt: string }[];
};

function parseInitialAgeDays(ageLabel: string) {
  const match = ageLabel
    .trim()
    .match(/(\d+(?:\.\d+)?)\s*(day|days|week|weeks)?/i);
  if (!match) return 0;

  const amount = Number.parseFloat(match[1]);
  if (!Number.isFinite(amount)) return 0;

  return /week/i.test(match[2] ?? "")
    ? Math.round(amount * 7)
    : Math.round(amount);
}

function elapsedCalendarDays(createdAt: string, now = new Date()) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 0;

  const createdDate = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate(),
  );
  const currentDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );

  return Math.max(
    0,
    Math.floor((currentDate.getTime() - createdDate.getTime()) / 86400000),
  );
}

export function getCurrentBatchAgeLabel(
  batch: Pick<BatchItem, "ageLabel" | "createdAt">,
  now = new Date(),
) {
  if (!batch.createdAt) return batch.ageLabel;

  const currentAgeDays =
    parseInitialAgeDays(batch.ageLabel) +
    elapsedCalendarDays(batch.createdAt, now);
  return `${currentAgeDays} ${currentAgeDays === 1 ? "Day" : "Days"} old`;
}

/** Egg inventory batch (separate from live-chicken batches). */
export type EggBatchItem = {
  id: string;
  eggQty: number;
  batchNo: string;
  /** Secondary quantity (UI label: Egg Qty.). */
  lineNo: number;
  /** Age unit: matches chicken batch age pattern. */
  ageUnit: "Days old" | "Weeks old";
  hatchedQty: number;
  damagedQty: number;
  unhatchedQty: number;
  colorName?: string;
  colorHex?: string;
  origin: string;
  createdAt: string;
};

const initialBatches: BatchItem[] = [
  {
    id: "0014",
    breed: "Rhode Island Red",
    femaleCount: 26,
    maleCount: 5,
    ageLabel: "17 weeks",
    isolatedCount: 1,
    killedCount: 0,
    colorName: "Red",
    colorHex: "#D84A49",
  },
  {
    id: "0015",
    breed: "White Leghorn",
    femaleCount: 31,
    maleCount: 4,
    ageLabel: "12 weeks",
    isolatedCount: 0,
    killedCount: 1,
    colorName: "Blue",
    colorHex: "#4A86D8",
  },
  {
    id: "0016",
    breed: "Plymouth Rock",
    femaleCount: 22,
    maleCount: 6,
    ageLabel: "9 weeks",
    isolatedCount: 2,
    killedCount: 0,
    colorName: "Yellow",
    colorHex: "#E2B53C",
  },
  {
    id: "0017",
    breed: "Australorp",
    femaleCount: 18,
    maleCount: 3,
    ageLabel: "7 weeks",
    isolatedCount: 0,
    killedCount: 0,
    colorName: "Green",
    colorHex: "#3FA06E",
  },
];
const initialEggBatches: EggBatchItem[] = [];

const listeners = new Set<(items: BatchItem[]) => void>();
const eggListeners = new Set<(items: EggBatchItem[]) => void>();

export function getEggFertilityPercent(egg: {
  hatchedQty?: number;
  damagedQty?: number;
  unhatchedQty?: number;
}) {
  const hatchedQty = egg.hatchedQty ?? 0;
  const damagedQty = egg.damagedQty ?? 0;
  const unhatchedQty = egg.unhatchedQty ?? 0;
  const total = hatchedQty + damagedQty + unhatchedQty;

  if (total <= 0) {
    return null;
  }

  return Math.round((hatchedQty / total) * 100);
}

export function formatEggFertilityPercent(egg: {
  hatchedQty?: number;
  damagedQty?: number;
  unhatchedQty?: number;
}) {
  const value = getEggFertilityPercent(egg);
  return value === null ? "--" : `${value}%`;
}

const store = {
  batches: initialBatches,
  eggBatches: initialEggBatches,
  getBatches() {
    return store.batches.slice();
  },
  getEggBatches() {
    return store.eggBatches.slice();
  },
  addBatch(b: BatchItem) {
    store.batches = [b, ...store.batches];
    const items = store.getBatches();
    listeners.forEach((listener) => listener(items));
  },
  addEggBatch(b: EggBatchItem) {
    store.eggBatches = [b, ...store.eggBatches];
    const items = store.getEggBatches();
    eggListeners.forEach((listener) => listener(items));
  },
  updateEggBatch(updated: EggBatchItem) {
    store.eggBatches = store.eggBatches.map((b) =>
      b.id === updated.id ? updated : b,
    );
    const items = store.getEggBatches();
    eggListeners.forEach((listener) => listener(items));
  },
  removeEggBatch(id: string) {
    store.eggBatches = store.eggBatches.filter((b) => b.id !== id);
    const items = store.getEggBatches();
    eggListeners.forEach((listener) => listener(items));
  },
  updateBatch(updated: BatchItem) {
    store.batches = store.batches.map((b) =>
      b.id === updated.id ? updated : b,
    );
    const items = store.getBatches();
    listeners.forEach((listener) => listener(items));
  },
  removeBatch(id: string) {
    store.batches = store.batches.filter((b) => b.id !== id);
    const items = store.getBatches();
    listeners.forEach((listener) => listener(items));
  },
  subscribe(cb: (items: BatchItem[]) => void) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  subscribeEggBatches(cb: (items: EggBatchItem[]) => void) {
    eggListeners.add(cb);
    return () => eggListeners.delete(cb);
  },
};

export default store;
