import { supabase } from "@/lib/supabase";
import { getEggMetricWindow } from "@/utils/egg-metric-windows";

export type ReportOverview = "Weekly" | "Monthly" | "Annually";
export type ReportProductionType = "Eggs" | "Chickens";
export type ReportSupplyType = "Vitamins & Meds" | "Feeds";

export type ReportDonutSlice = {
  label: string;
  count: number;
  color: string;
  displayPercent: string;
};

export type ReportBarPoint = {
  key: string;
  label: string;
  value: number;
  highlight?: boolean;
};

export type FarmReportSnapshot = {
  production: {
    title: string;
    total: number;
    slices: ReportDonutSlice[];
    analyticsText: string;
  };
  supply: {
    title: string;
    bars: ReportBarPoint[];
    maxY: number;
    slices?: ReportDonutSlice[];
    totalSlices?: number;
    analyticsText: string;
  };
};

export type EggFertilityReportSnapshot = {
  title: string;
  totalOutcomes: number;
  totalEggs: number;
  fertileCount: number;
  unhatchedCount: number;
  damagedCount: number;
  fertilityRate: number;
  productionRate: number;
  slices: ReportDonutSlice[];
  analyticsText: string;
};

type EggBatchReportRow = {
  egg_qty: number;
  hatched_qty: number;
  damaged_qty: number;
  unhatched_qty: number;
  color_name?: string | null;
  origin?: string | null;
  batch_no: string;
  created_at: string;
};

type BatchReportRow = {
  batch_no?: string | null;
  female_count: number;
  male_count: number;
  isolated_count: number;
  killed_count: number;
  created_at: string;
};

type InventoryReportRow = {
  item_type: string;
  item_name?: string | null;
  qty: number;
  created_at: string;
};

const DONUT_COLORS = ["#323330", "#438b7b", "#9cd5c9"];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + amount);
  const maxDays = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0,
  ).getDate();
  next.setDate(Math.min(day, maxDays));
  return next;
}

function startOfMonth(date: Date) {
  const next = new Date(date);
  next.setDate(1);
  next.setHours(0, 0, 0, 0);
  return next;
}

function clampToNonNegative(value: number) {
  return value > 0 ? value : 0;
}

function toDisplayPercent(value: number, total: number) {
  if (total <= 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function toNiceAxisMax(maxValue: number) {
  if (maxValue <= 0) return 10;
  if (maxValue <= 10) return 10;
  return Math.ceil(maxValue / 10) * 10;
}

function formatOverviewWindow(overview: ReportOverview) {
  if (overview === "Weekly") return "the last 7 days";
  if (overview === "Monthly") return "the last 30 days";
  return "the last 12 months";
}

function getProductionWindowStart(overview: ReportOverview, now: Date) {
  const period =
    overview === "Weekly"
      ? "7 days"
      : overview === "Monthly"
        ? "30 days"
        : "12 months";
  return getEggMetricWindow(period, now).currentStart;
}

function isWithinWindow(
  dateValue: string,
  startInclusive: Date,
  endInclusive: Date,
) {
  const value = new Date(dateValue);
  return value >= startInclusive && value <= endInclusive;
}

function buildEggProductionSnapshot(
  rows: EggBatchReportRow[],
  overview: ReportOverview,
) {
  const hatched = rows.reduce((sum, row) => sum + Number(row.hatched_qty), 0);
  const unhatched = rows.reduce(
    (sum, row) => sum + Number(row.unhatched_qty),
    0,
  );
  const damaged = rows.reduce((sum, row) => sum + Number(row.damaged_qty), 0);
  const total = hatched + unhatched + damaged;

  const slices: ReportDonutSlice[] = [
    {
      label: "hatched",
      count: hatched,
      color: DONUT_COLORS[0],
      displayPercent: toDisplayPercent(hatched, total),
    },
    {
      label: "unhatched",
      count: unhatched,
      color: DONUT_COLORS[1],
      displayPercent: toDisplayPercent(unhatched, total),
    },
    {
      label: "damaged",
      count: damaged,
      color: DONUT_COLORS[2],
      displayPercent: toDisplayPercent(damaged, total),
    },
  ];

  const analyticsText =
    total === 0
      ? `No egg production records were found for ${formatOverviewWindow(overview)}.`
      : `For ${formatOverviewWindow(overview)}, ${slices[0].displayPercent} of recorded egg outcomes hatched, ${slices[1].displayPercent} remained unhatched, and ${slices[2].displayPercent} were marked damaged.`;

  return {
    title: "Egg Production Overview",
    total,
    slices,
    analyticsText,
  };
}

function normalizeScopeValue(value: string) {
  return value.trim().toLowerCase();
}

function rowMatchesEggScope(
  row: EggBatchReportRow,
  scope?: { colorName?: string; originBatchNo?: string },
) {
  if (!scope) {
    return true;
  }

  return (
    normalizeScopeValue(row.color_name ?? "") ===
      normalizeScopeValue(scope.colorName ?? "") &&
    normalizeScopeValue(row.origin ?? "") ===
      normalizeScopeValue(scope.originBatchNo ?? "")
  );
}

function buildEggFertilitySnapshot(
  rows: EggBatchReportRow[],
  overview: ReportOverview,
) {
  const fertileCount = rows.reduce(
    (sum, row) => sum + Number(row.hatched_qty),
    0,
  );
  const unhatchedCount = rows.reduce(
    (sum, row) => sum + Number(row.unhatched_qty),
    0,
  );
  const damagedCount = rows.reduce(
    (sum, row) => sum + Number(row.damaged_qty),
    0,
  );
  const totalEggs = rows.reduce((sum, row) => sum + Number(row.egg_qty), 0);
  const totalOutcomes = fertileCount + unhatchedCount + damagedCount;
  const fertilityRate =
    totalEggs > 0 ? Math.round((fertileCount / totalEggs) * 100) : 0;
  const productionRate =
    totalOutcomes > 0 ? Math.round((fertileCount / totalOutcomes) * 100) : 0;

  const slices: ReportDonutSlice[] = [
    {
      label: "fertile",
      count: fertileCount,
      color: DONUT_COLORS[0],
      displayPercent: toDisplayPercent(fertileCount, totalOutcomes),
    },
    {
      label: "unhatched",
      count: unhatchedCount,
      color: DONUT_COLORS[1],
      displayPercent: toDisplayPercent(unhatchedCount, totalOutcomes),
    },
    {
      label: "damaged",
      count: damagedCount,
      color: DONUT_COLORS[2],
      displayPercent: toDisplayPercent(damagedCount, totalOutcomes),
    },
  ];

  const analyticsText =
    totalEggs === 0
      ? `No egg fertility records were found for ${formatOverviewWindow(overview)}.`
      : `For ${formatOverviewWindow(overview)}, fertility rate reached ${fertilityRate}% from ${fertileCount} fertile eggs out of ${totalEggs} recorded eggs. Production rate across recorded outcomes was ${productionRate}%, with ${unhatchedCount} unhatched and ${damagedCount} damaged eggs.`;

  return {
    title: "Egg Fertility Rate Overview",
    totalOutcomes,
    totalEggs,
    fertileCount,
    unhatchedCount,
    damagedCount,
    fertilityRate,
    productionRate,
    slices,
    analyticsText,
  } satisfies EggFertilityReportSnapshot;
}

function buildChickenProductionSnapshot(
  rows: BatchReportRow[],
  overview: ReportOverview,
  deceasedRows: { batch_no?: string | null }[] = [],
) {
  const deceasedCountByBatch = new Map<string, number>();
  deceasedRows.forEach((row) => {
    if (row.batch_no) {
      const key = row.batch_no.trim();
      deceasedCountByBatch.set(key, (deceasedCountByBatch.get(key) ?? 0) + 1);
    }
  });

  let active = 0;
  let isolated = 0;
  let lost = 0;

  rows.forEach((row) => {
    const totalBirds = Number(row.female_count) + Number(row.male_count);
    const isolatedCount = Number(row.isolated_count);
    const batchKilled = Number(row.killed_count);
    const monitoringDeceased = row.batch_no
      ? (deceasedCountByBatch.get(row.batch_no.trim()) ?? 0)
      : 0;
    const killedCount = Math.max(batchKilled, monitoringDeceased);

    const activeInRow = clampToNonNegative(totalBirds - isolatedCount - killedCount);
    active += activeInRow;
    isolated += isolatedCount;
    lost += killedCount;
  });

  const total = active + isolated + lost;

  const slices: ReportDonutSlice[] = [
    {
      label: "active",
      count: active,
      color: DONUT_COLORS[0],
      displayPercent: toDisplayPercent(active, total),
    },
    {
      label: "isolated",
      count: isolated,
      color: DONUT_COLORS[1],
      displayPercent: toDisplayPercent(isolated, total),
    },
    {
      label: "lost",
      count: lost,
      color: DONUT_COLORS[2],
      displayPercent: toDisplayPercent(lost, total),
    },
  ];

  const analyticsText =
    total === 0
      ? `No chicken batch records were found for ${formatOverviewWindow(overview)}.`
      : `For ${formatOverviewWindow(overview)}, ${slices[0].displayPercent} of recorded birds remained active, while ${slices[1].displayPercent} were isolated and ${slices[2].displayPercent} were lost.`;

  return {
    title: "Chicken Batch Overview",
    total,
    slices,
    analyticsText,
  };
}

function isFeedInventory(itemType: string) {
  return itemType.trim().toLowerCase().includes("feed");
}

function isVitaminOrMedInventory(itemType: string) {
  const normalized = itemType.trim().toLowerCase();
  return (
    normalized.includes("vitamin") ||
    normalized.includes("med") ||
    normalized.includes("medicine")
  );
}

function formatBarLabel(date: Date, overview: ReportOverview) {
  if (overview === "Weekly") {
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  }

  if (overview === "Monthly") {
    return new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
}

function buildTimeBuckets(overview: ReportOverview, now: Date) {
  if (overview === "Annually") {
    return Array.from({ length: 12 }, (_, index) => {
      const date = startOfDay(addMonths(now, -(11 - index)));
      return {
        key: `${date.getFullYear()}-${date.getMonth() + 1}`,
        label: formatBarLabel(date, overview),
        total: 0,
      };
    });
  }

  const length =
    overview === "Monthly"
      ? new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      : 7;
  return Array.from({ length }, (_, index) => {
    const date = startOfDay(addDays(now, -(length - 1 - index)));
    return {
      key: date.toISOString().slice(0, 10),
      label: formatBarLabel(date, overview),
      total: 0,
    };
  });
}

function buildSupplySnapshot(
  rows: InventoryReportRow[],
  overview: ReportOverview,
  supplyType: ReportSupplyType,
  now: Date,
) {
  const filteredRows = rows.filter((row) =>
    supplyType === "Feeds"
      ? isFeedInventory(row.item_type)
      : isVitaminOrMedInventory(row.item_type),
  );
  const buckets = buildTimeBuckets(overview, now);
  const bucketIndex = new Map(
    buckets.map((bucket, index) => [bucket.key, index]),
  );

  filteredRows.forEach((row) => {
    const createdAt = new Date(row.created_at);
    const key =
      overview === "Annually"
        ? `${createdAt.getFullYear()}-${createdAt.getMonth() + 1}`
        : createdAt.toISOString().slice(0, 10);
    const index = bucketIndex.get(key);

    if (index === undefined) {
      return;
    }

    buckets[index].total += Number(row.qty);
  });

  const highestValue = buckets.reduce(
    (maxValue, bucket) => Math.max(maxValue, bucket.total),
    0,
  );

  const bars = buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: Number(bucket.total.toFixed(2)),
    highlight: bucket.total === highestValue && highestValue > 0,
  }));

  const total = bars.reduce((sum, bar) => sum + bar.value, 0);
  const peakBar = bars.find((bar) => bar.highlight);
  const analyticsText =
    total === 0
      ? `No ${supplyType.toLowerCase()} inventory additions were recorded for ${formatOverviewWindow(overview)}.`
      : `${supplyType} inventory additions totaled ${total.toFixed(2)} units for ${formatOverviewWindow(overview)}. The highest recorded day or month was ${peakBar?.label ?? "N/A"} at ${peakBar?.value.toFixed(2) ?? "0.00"} units.`;

  let slices: ReportDonutSlice[] | undefined;
  let totalSlices: number | undefined;

  if (supplyType === "Vitamins & Meds") {
    let vitaminsCount = 0;
    let medsCount = 0;
    let vaccinesCount = 0;

    filteredRows.forEach((row) => {
      const typeStr = (row.item_type ?? "").toLowerCase();
      const nameStr = (row.item_name ?? "").toLowerCase();
      const combined = `${typeStr} ${nameStr}`;
      const qty = Number(row.qty ?? 0);

      if (
        combined.includes("vitamin") ||
        combined.includes("supplement") ||
        combined.includes("booster") ||
        combined.includes("electrolyte") ||
        combined.includes("calcium") ||
        combined.includes("mineral")
      ) {
        vitaminsCount += qty;
      } else if (
        combined.includes("med") ||
        combined.includes("medicine") ||
        combined.includes("antibiotic") ||
        combined.includes("treatment") ||
        combined.includes("dewormer") ||
        combined.includes("antiseptic")
      ) {
        medsCount += qty;
      } else {
        vaccinesCount += qty;
      }
    });

    totalSlices = vitaminsCount + medsCount + vaccinesCount;

    slices = [
      {
        label: "vitamins & supplements",
        count: vitaminsCount,
        color: DONUT_COLORS[0],
        displayPercent: toDisplayPercent(vitaminsCount, totalSlices),
      },
      {
        label: "medications & treatments",
        count: medsCount,
        color: DONUT_COLORS[1],
        displayPercent: toDisplayPercent(medsCount, totalSlices),
      },
      {
        label: "vaccines & prevention",
        count: vaccinesCount,
        color: DONUT_COLORS[2],
        displayPercent: toDisplayPercent(vaccinesCount, totalSlices),
      },
    ];
  } else if (supplyType === "Feeds") {
    let layerCount = 0;
    let growerCount = 0;
    let pelletCount = 0;

    filteredRows.forEach((row) => {
      const typeStr = (row.item_type ?? "").toLowerCase();
      const nameStr = (row.item_name ?? "").toLowerCase();
      const combined = `${typeStr} ${nameStr}`;
      const qty = Number(row.qty ?? 0);

      if (
        combined.includes("layer") ||
        combined.includes("mash") ||
        combined.includes("egg") ||
        combined.includes("production")
      ) {
        layerCount += qty;
      } else if (
        combined.includes("grower") ||
        combined.includes("starter") ||
        combined.includes("chick") ||
        combined.includes("brooder") ||
        combined.includes("developer")
      ) {
        growerCount += qty;
      } else {
        pelletCount += qty;
      }
    });

    totalSlices = layerCount + growerCount + pelletCount;

    slices = [
      {
        label: "layer & production feeds",
        count: layerCount,
        color: DONUT_COLORS[0],
        displayPercent: toDisplayPercent(layerCount, totalSlices),
      },
      {
        label: "grower & starter feeds",
        count: growerCount,
        color: DONUT_COLORS[1],
        displayPercent: toDisplayPercent(growerCount, totalSlices),
      },
      {
        label: "pellets & finisher feeds",
        count: pelletCount,
        color: DONUT_COLORS[2],
        displayPercent: toDisplayPercent(pelletCount, totalSlices),
      },
    ];
  }

  return {
    title: `${supplyType} Inventory Activity`,
    bars,
    maxY: toNiceAxisMax(highestValue),
    slices,
    totalSlices,
    analyticsText,
  };
}

export async function fetchFarmReportSnapshot(input: {
  farmId: string;
  overview: ReportOverview;
  productionType: ReportProductionType;
  supplyType: ReportSupplyType;
}) {
  const now = new Date();
  const reportStart = getProductionWindowStart(
    input.overview,
    now,
  ).toISOString();

  const [
    { data: eggRows, error: eggError },
    { data: batchRows, error: batchError },
    { data: inventoryRows, error: inventoryError },
    { data: deceasedRows },
  ] = await Promise.all([
    supabase
      .from("egg_batches")
      .select(
        "egg_qty, hatched_qty, damaged_qty, unhatched_qty, color_name, origin, batch_no, created_at",
      )
      .eq("farm_id", input.farmId)
      .gte("created_at", reportStart),
    supabase
      .from("batches")
      .select(
        "batch_no, female_count, male_count, isolated_count, killed_count, created_at",
      )
      .eq("farm_id", input.farmId),
    supabase
      .from("inventory_items")
      .select("item_type, item_name, qty, created_at")
      .eq("farm_id", input.farmId)
      .gte("created_at", reportStart),
    supabase
      .from("health_monitoring")
      .select("batch_no, monitoring_status")
      .eq("farm_id", input.farmId)
      .eq("monitoring_status", "Deceased"),
  ]);

  if (eggError) throw eggError;
  if (batchError) throw batchError;
  if (inventoryError) throw inventoryError;

  const production =
    input.productionType === "Eggs"
      ? buildEggProductionSnapshot(
          ((eggRows ?? []) as EggBatchReportRow[]).filter((row) =>
            isWithinWindow(row.created_at, new Date(reportStart), now),
          ),
          input.overview,
        )
      : buildChickenProductionSnapshot(
          ((batchRows ?? []) as BatchReportRow[]).filter((row) =>
            isWithinWindow(row.created_at, new Date(reportStart), now),
          ),
          input.overview,
          (deceasedRows ?? []) as { batch_no?: string | null }[],
        );

  const supply = buildSupplySnapshot(
    ((inventoryRows ?? []) as InventoryReportRow[]).filter((row) =>
      isWithinWindow(row.created_at, new Date(reportStart), now),
    ),
    input.overview,
    input.supplyType,
    now,
  );

  return { production, supply } satisfies FarmReportSnapshot;
}

export async function fetchEggFertilityReportSnapshot(input: {
  farmId: string;
  overview: ReportOverview;
  scope?: { colorName?: string; originBatchNo?: string };
}) {
  const now = new Date();
  const reportStart = getProductionWindowStart(
    input.overview,
    now,
  ).toISOString();

  const { data, error } = await supabase
    .from("egg_batches")
    .select(
      "egg_qty, hatched_qty, damaged_qty, unhatched_qty, color_name, origin, batch_no, created_at",
    )
    .eq("farm_id", input.farmId)
    .gte("created_at", reportStart);

  if (error) throw error;

  const rows = ((data ?? []) as EggBatchReportRow[]).filter(
    (row) =>
      isWithinWindow(row.created_at, new Date(reportStart), now) &&
      rowMatchesEggScope(row, input.scope),
  );

  return buildEggFertilitySnapshot(rows, input.overview);
}
