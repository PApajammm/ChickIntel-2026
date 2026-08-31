import { supabase } from "@/lib/supabase";
import { getEggMetricWindow } from "@/utils/egg-metric-windows";
import { isTaskLinkedToInventoryItem } from "@/utils/stock-alerts";
import {
  fetchScheduleTaskCompletions,
  fetchScheduleTasks,
  formatScheduleDateKey,
  scheduleTaskMatchesDate,
  type SupabaseScheduleTask,
  type SupabaseScheduleTaskCompletion,
} from "@/utils/supabase-schedule";

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
  id: string;
  item_type: string;
  item_name?: string | null;
  qty: number;
  purchased_date?: string | null;
  delivered_date?: string | null;
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

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

    const activeInRow = clampToNonNegative(
      totalBirds - isolatedCount - killedCount,
    );
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
    normalized.includes("medicine") ||
    normalized.includes("vaccin") ||
    normalized.includes("antibiotic") ||
    normalized.includes("supplement")
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

  const length = overview === "Monthly" ? 30 : 7;
  return Array.from({ length }, (_, index) => {
    const date = startOfDay(addDays(now, -(length - 1 - index)));
    return {
      key: localDateKey(date),
      label: formatBarLabel(date, overview),
      total: 0,
    };
  });
}

type ConsumedItemRecord = {
  itemId: string;
  name: string;
  type: string;
  amount: number;
  dateKey: string;
  date: Date;
};

function buildSupplySnapshot(
  inventoryRows: InventoryReportRow[],
  tasks: SupabaseScheduleTask[],
  completions: SupabaseScheduleTaskCompletion[],
  overview: ReportOverview,
  supplyType: ReportSupplyType,
  windowStart: Date,
  now: Date,
) {
  const isTargetSupply = supplyType === "Feeds" ? isFeedInventory : isVitaminOrMedInventory;

  // Filter inventory items matching the supply type
  const targetInventory = inventoryRows.filter((row) => isTargetSupply(row.item_type));

  // Map completions to fast lookup: taskId -> Set of completed occurrence dates
  const completionsByTaskId = new Map<string, Set<string>>();
  completions.forEach((c) => {
    const set = completionsByTaskId.get(c.taskId) ?? new Set<string>();
    set.add(c.completionDate);
    completionsByTaskId.set(c.taskId, set);
  });

  const consumptionRecords: ConsumedItemRecord[] = [];

  // 1. Calculate consumption from completed tasks linked to inventory items
  targetInventory.forEach((item) => {
    const linkedTasks = tasks.filter(
      (task) =>
        isTaskLinkedToInventoryItem(task, { id: item.id, name: item.item_name || "", type: item.item_type }) &&
        (task.feedDailyAmount ?? 0) > 0,
    );

    const itemStartDate = new Date(
      item.delivered_date || item.purchased_date || item.created_at,
    );
    itemStartDate.setHours(0, 0, 0, 0);

    linkedTasks.forEach((task) => {
      const taskAmount = Number(task.feedDailyAmount ?? 0);
      if (taskAmount <= 0) return;

      const completedDates = completionsByTaskId.get(task.id);
      if (!completedDates || completedDates.size === 0) return;

      // Check occurrences within the active report timeframe window
      const cursor = new Date(Math.max(itemStartDate.getTime(), windowStart.getTime()));
      cursor.setHours(0, 0, 0, 0);

      while (cursor.getTime() <= now.getTime()) {
        const dateKey = formatScheduleDateKey(cursor);
        if (completedDates.has(dateKey) && scheduleTaskMatchesDate(task, cursor)) {
          consumptionRecords.push({
            itemId: item.id,
            name: item.item_name || item.item_type || "Supply Item",
            type: item.item_type,
            amount: taskAmount,
            dateKey: dateKey,
            date: new Date(cursor),
          });
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    });
  });

  // 2. Also check completed tasks that have feedDailyAmount and matching category even if not tied to a specific inventory ID
  tasks.forEach((task) => {
    const taskAmount = Number(task.feedDailyAmount ?? 0);
    if (taskAmount <= 0) return;

    const taskCategoryOrName = `${task.category || ""} ${task.feedInventoryItemName || ""} ${task.title || ""}`;
    const matchesCategory = isTargetSupply(taskCategoryOrName);
    if (!matchesCategory) return;

    // Avoid double counting if already linked to a known target inventory item
    const alreadyLinked = targetInventory.some((item) =>
      isTaskLinkedToInventoryItem(task, { id: item.id, name: item.item_name || "", type: item.item_type }),
    );
    if (alreadyLinked) return;

    const completedDates = completionsByTaskId.get(task.id);
    if (!completedDates || completedDates.size === 0) return;

    const cursor = new Date(windowStart);
    cursor.setHours(0, 0, 0, 0);

    while (cursor.getTime() <= now.getTime()) {
      const dateKey = formatScheduleDateKey(cursor);
      if (completedDates.has(dateKey) && scheduleTaskMatchesDate(task, cursor)) {
        consumptionRecords.push({
          itemId: task.id,
          name: task.feedInventoryItemName || task.title,
          type: supplyType === "Feeds" ? "Feeds" : "Vitamins & Meds",
          amount: taskAmount,
          dateKey: dateKey,
          date: new Date(cursor),
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  // Build time buckets for the trend bar chart
  const buckets = buildTimeBuckets(overview, now);
  const bucketIndex = new Map(
    buckets.map((bucket, index) => [bucket.key, index]),
  );

  consumptionRecords.forEach((record) => {
    const key =
      overview === "Annually"
        ? `${record.date.getFullYear()}-${record.date.getMonth() + 1}`
        : record.dateKey;
    const index = bucketIndex.get(key);

    if (index !== undefined) {
      buckets[index].total += record.amount;
    }
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

  const totalConsumed = bars.reduce((sum, bar) => sum + bar.value, 0);
  const peakBar = bars.find((bar) => bar.highlight);
  const analyticsText =
    totalConsumed === 0
      ? `No ${supplyType.toLowerCase()} consumption was recorded from schedule tasks for ${formatOverviewWindow(overview)}.`
      : `${supplyType} consumption totaled ${totalConsumed.toFixed(2)} units across completed schedule tasks for ${formatOverviewWindow(overview)}. Peak usage period was ${peakBar?.label ?? "N/A"} with ${peakBar?.value.toFixed(2) ?? "0.00"} units consumed.`;

  let slices: ReportDonutSlice[] | undefined;
  let totalSlices: number | undefined;

  if (supplyType === "Vitamins & Meds") {
    let vitaminsCount = 0;
    let medsCount = 0;
    let vaccinesCount = 0;

    consumptionRecords.forEach((record) => {
      const typeStr = (record.type ?? "").toLowerCase();
      const nameStr = (record.name ?? "").toLowerCase();
      const combined = `${typeStr} ${nameStr}`;
      const qty = Number(record.amount ?? 0);

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
        count: Number(vitaminsCount.toFixed(2)),
        color: DONUT_COLORS[0],
        displayPercent: toDisplayPercent(vitaminsCount, totalSlices),
      },
      {
        label: "medications & treatments",
        count: Number(medsCount.toFixed(2)),
        color: DONUT_COLORS[1],
        displayPercent: toDisplayPercent(medsCount, totalSlices),
      },
      {
        label: "vaccines & prevention",
        count: Number(vaccinesCount.toFixed(2)),
        color: DONUT_COLORS[2],
        displayPercent: toDisplayPercent(vaccinesCount, totalSlices),
      },
    ];
  } else if (supplyType === "Feeds") {
    const feedTotals = new Map<string, number>();

    consumptionRecords.forEach((record) => {
      const label = record.name?.trim() || "Feed Supply";
      feedTotals.set(label, (feedTotals.get(label) ?? 0) + Number(record.amount ?? 0));
    });

    const rankedFeeds = [...feedTotals.entries()]
      .sort(([, leftTotal], [, rightTotal]) => rightTotal - leftTotal)
      .slice(0, 5);
    const displayedTotal = rankedFeeds.reduce((sum, [, count]) => sum + count, 0);
    const allFeedsTotal = consumptionRecords.reduce(
      (sum, r) => sum + Number(r.amount ?? 0),
      0,
    );
    const remainder = allFeedsTotal - displayedTotal;

    slices = rankedFeeds.length
      ? rankedFeeds.map(([label, count], index) => ({
          label,
          count: Number(count.toFixed(2)),
          color: DONUT_COLORS[index % DONUT_COLORS.length],
          displayPercent: toDisplayPercent(count, allFeedsTotal),
        }))
      : [
          {
            label: "No feed consumption",
            count: 0,
            color: DONUT_COLORS[0],
            displayPercent: "0%",
          },
        ];

    if (remainder > 0) {
      slices.push({
        label: "Other feeds",
        count: Number(remainder.toFixed(2)),
        color: DONUT_COLORS[slices.length % DONUT_COLORS.length],
        displayPercent: toDisplayPercent(remainder, allFeedsTotal),
      });
    }

    totalSlices = Number(allFeedsTotal.toFixed(2));
  }

  return {
    title: `${supplyType} Consumption Activity`,
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
  const windowStart = getProductionWindowStart(
    input.overview,
    now,
  );
  const reportStart = windowStart.toISOString();

  const [
    { data: eggRows, error: eggError },
    { data: batchRows, error: batchError },
    { data: inventoryRows, error: inventoryError },
    tasks,
    completions,
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
      .select("id, item_type, item_name, qty, purchased_date, delivered_date, created_at")
      .eq("farm_id", input.farmId),
    fetchScheduleTasks(input.farmId).catch(() => [] as SupabaseScheduleTask[]),
    fetchScheduleTaskCompletions(input.farmId).catch(() => [] as SupabaseScheduleTaskCompletion[]),
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
            isWithinWindow(row.created_at, windowStart, now),
          ),
          input.overview,
        )
      : buildChickenProductionSnapshot(
          ((batchRows ?? []) as BatchReportRow[]).filter((row) =>
            isWithinWindow(row.created_at, windowStart, now),
          ),
          input.overview,
          (deceasedRows ?? []) as { batch_no?: string | null }[],
        );

  const supply = buildSupplySnapshot(
    (inventoryRows ?? []) as InventoryReportRow[],
    tasks,
    completions,
    input.overview,
    input.supplyType,
    windowStart,
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
