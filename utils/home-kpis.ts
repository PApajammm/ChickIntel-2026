import { supabase } from "@/lib/supabase";
import {
    getEggMetricWindow,
    shiftDate,
    startOfDay,
} from "@/utils/egg-metric-windows";
import {
    countScheduleTaskOccurrencesThroughDateTime,
    fetchScheduleTasks,
    type SupabaseScheduleTask,
} from "@/utils/supabase-schedule";

export type HomeKpiPeriod = "7 days" | "30 days" | "12 months";

type BatchKpiRow = {
  female_count: number;
  male_count: number;
  created_at: string;
};

type EggKpiRow = {
  egg_qty: number;
  created_at: string;
};

type InventoryKpiRow = {
  id: string;
  item_type: string;
  item_name: string;
  qty: number;
  created_at: string;
};

type WindowMetric = {
  current: number;
  previous: number;
};

export type HomeKpiSnapshot = {
  totalBirds: number;
  birdAdditionsByPeriod: Record<HomeKpiPeriod, WindowMetric>;
  collectedEggsByPeriod: Record<HomeKpiPeriod, WindowMetric>;
  feedQtyByPeriod: Record<HomeKpiPeriod, WindowMetric>;
};

const PERIODS: HomeKpiPeriod[] = ["7 days", "30 days", "12 months"];

function getWindowStarts(period: HomeKpiPeriod, now = new Date()) {
  const currentEnd = now;

  if (period === "12 months") {
    const currentStart = startOfDay(shiftDate(now, -12, "months"));
    const previousStart = startOfDay(shiftDate(currentStart, -12, "months"));
    return { currentStart, currentEnd, previousStart };
  }

  const dayCount = period === "30 days" ? 30 : 7;
  const currentStart = startOfDay(shiftDate(now, -(dayCount - 1), "days"));
  const previousStart = startOfDay(shiftDate(currentStart, -dayCount, "days"));
  return { currentStart, currentEnd, previousStart };
}

function isWithinWindow(value: Date, startInclusive: Date, endExclusive: Date) {
  return value >= startInclusive && value < endExclusive;
}

function sumWindowValues(
  timestamps: { createdAt: string; value: number }[],
  period: HomeKpiPeriod,
) {
  const { currentStart, currentEnd, previousStart } = getWindowStarts(period);

  return timestamps.reduce<WindowMetric>(
    (accumulator, row) => {
      const createdAt = new Date(row.createdAt);

      if (isWithinWindow(createdAt, currentStart, currentEnd)) {
        accumulator.current += row.value;
      } else if (isWithinWindow(createdAt, previousStart, currentStart)) {
        accumulator.previous += row.value;
      }

      return accumulator;
    },
    { current: 0, previous: 0 },
  );
}

function sumEggValues(
  timestamps: { createdAt: string; value: number }[],
  period: HomeKpiPeriod,
) {
  const { currentStart, currentEnd } = getEggMetricWindow(period);
  const previousStart =
    period === "12 months"
      ? startOfDay(shiftDate(currentStart, -12, "months"))
      : startOfDay(
          shiftDate(currentStart, period === "30 days" ? -30 : -7, "days"),
        );

  return timestamps.reduce<WindowMetric>(
    (accumulator, row) => {
      const createdAt = new Date(row.createdAt);
      if (createdAt >= currentStart && createdAt < currentEnd) {
        accumulator.current += row.value;
      } else if (createdAt >= previousStart && createdAt < currentStart) {
        accumulator.previous += row.value;
      }
      return accumulator;
    },
    { current: 0, previous: 0 },
  );
}

function isFeedCategory(itemType: string) {
  return itemType.trim().toLowerCase().includes("feed");
}

function normalizeLabel(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isFeedScheduleTask(
  task: SupabaseScheduleTask,
  feedInventoryItemIds: Set<string>,
  feedInventoryItemNames: Set<string>,
) {
  if (task.feedInventoryItemId) {
    return feedInventoryItemIds.has(task.feedInventoryItemId);
  }

  if (task.feedInventoryItemName) {
    return feedInventoryItemNames.has(
      normalizeLabel(task.feedInventoryItemName),
    );
  }

  return false;
}

function countScheduleTaskOccurrencesWithinWindow(
  task: Pick<
    SupabaseScheduleTask,
    "startDate" | "repeat" | "customRepeatDays" | "time"
  >,
  startInclusive: Date,
  endExclusive: Date,
) {
  const endBoundary = new Date(endExclusive.getTime() - 1);
  const startBoundary = new Date(startInclusive.getTime() - 1);

  if (endBoundary.getTime() < startInclusive.getTime()) {
    return 0;
  }

  const throughEnd = countScheduleTaskOccurrencesThroughDateTime(
    task,
    endBoundary,
  );
  const beforeStart = countScheduleTaskOccurrencesThroughDateTime(
    task,
    startBoundary,
  );

  return Math.max(throughEnd - beforeStart, 0);
}

function sumScheduledTaskValues(
  tasks: SupabaseScheduleTask[],
  period: HomeKpiPeriod,
) {
  const { currentStart, currentEnd, previousStart } = getWindowStarts(period);

  return tasks.reduce<WindowMetric>(
    (accumulator, task) => {
      const amountPerOccurrence = task.feedDailyAmount ?? 0;

      if (amountPerOccurrence <= 0) {
        return accumulator;
      }

      accumulator.current +=
        countScheduleTaskOccurrencesWithinWindow(
          task,
          currentStart,
          currentEnd,
        ) * amountPerOccurrence;
      accumulator.previous +=
        countScheduleTaskOccurrencesWithinWindow(
          task,
          previousStart,
          currentStart,
        ) * amountPerOccurrence;

      return accumulator;
    },
    { current: 0, previous: 0 },
  );
}

export async function fetchHomeKpiSnapshot(
  farmId: string,
): Promise<HomeKpiSnapshot> {
  const [
    { data: batchRows, error: batchError },
    { data: eggRows, error: eggError },
    { data: inventoryRows, error: inventoryError },
    { data: deceasedRows },
    scheduleTasks,
  ] = await Promise.all([
    supabase
      .from("batches")
      .select("batch_no, female_count, male_count, isolated_count, killed_count, created_at")
      .eq("farm_id", farmId),
    supabase
      .from("egg_batches")
      .select("egg_qty, created_at")
      .eq("farm_id", farmId),
    supabase
      .from("inventory_items")
      .select("id, item_type, item_name, qty, created_at")
      .eq("farm_id", farmId),
    supabase
      .from("health_monitoring")
      .select("batch_no, monitoring_status")
      .eq("farm_id", farmId)
      .eq("monitoring_status", "Deceased"),
    fetchScheduleTasks(farmId),
  ]);

  if (batchError) throw batchError;
  if (eggError) throw eggError;
  if (inventoryError) throw inventoryError;

  const batches = (batchRows ?? []) as (BatchKpiRow & {
    batch_no?: string;
    isolated_count?: number;
    killed_count?: number;
  })[];
  const eggs = (eggRows ?? []) as EggKpiRow[];
  const inventory = (inventoryRows ?? []) as InventoryKpiRow[];

  const deceasedCountByBatch = new Map<string, number>();
  (deceasedRows ?? []).forEach((row: { batch_no?: string | null }) => {
    if (row.batch_no) {
      const key = row.batch_no.trim();
      deceasedCountByBatch.set(key, (deceasedCountByBatch.get(key) ?? 0) + 1);
    }
  });

  const totalBirds = batches.reduce((sum, batch) => {
    const female = Number(batch.female_count ?? 0);
    const male = Number(batch.male_count ?? 0);
    const isolated = Number(batch.isolated_count ?? 0);
    const batchKilled = Number(batch.killed_count ?? 0);
    const monitoringDeceased = batch.batch_no
      ? (deceasedCountByBatch.get(batch.batch_no.trim()) ?? 0)
      : 0;
    const killed = Math.max(batchKilled, monitoringDeceased);
    const activeInBatch = Math.max(0, female + male - killed - isolated);
    return sum + activeInBatch;
  }, 0);

  const birdEvents = batches.map((batch) => {
    const female = Number(batch.female_count ?? 0);
    const male = Number(batch.male_count ?? 0);
    const isolated = Number(batch.isolated_count ?? 0);
    const batchKilled = Number(batch.killed_count ?? 0);
    const monitoringDeceased = batch.batch_no
      ? (deceasedCountByBatch.get(batch.batch_no.trim()) ?? 0)
      : 0;
    const killed = Math.max(batchKilled, monitoringDeceased);
    const activeInBatch = Math.max(0, female + male - killed - isolated);

    return {
      createdAt: batch.created_at,
      value: activeInBatch,
    };
  });

  const eggEvents = eggs.map((egg) => ({
    createdAt: egg.created_at,
    value: Number(egg.egg_qty),
  }));

  const feedInventoryItemIds = new Set(
    inventory
      .filter((item) => isFeedCategory(item.item_type))
      .map((item) => item.id),
  );
  const feedInventoryItemNames = new Set(
    inventory
      .filter((item) => isFeedCategory(item.item_type))
      .map((item) => normalizeLabel(item.item_name)),
  );
  const feedScheduleTasks = scheduleTasks.filter((task) =>
    isFeedScheduleTask(task, feedInventoryItemIds, feedInventoryItemNames),
  );

  return {
    totalBirds,
    birdAdditionsByPeriod: Object.fromEntries(
      PERIODS.map((period) => [period, sumWindowValues(birdEvents, period)]),
    ) as Record<HomeKpiPeriod, WindowMetric>,
    collectedEggsByPeriod: Object.fromEntries(
      PERIODS.map((period) => [period, sumEggValues(eggEvents, period)]),
    ) as Record<HomeKpiPeriod, WindowMetric>,
    feedQtyByPeriod: Object.fromEntries(
      PERIODS.map((period) => [
        period,
        sumScheduledTaskValues(feedScheduleTasks, period),
      ]),
    ) as Record<HomeKpiPeriod, WindowMetric>,
  };
}

export function formatKpiTrend(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) return "+0%";
    return "+100%";
  }

  const change = ((current - previous) / previous) * 100;
  const rounded = Math.round(change);
  if (rounded === 0) return "+0%";

  const boundedMagnitude = Math.min(Math.max(Math.abs(rounded), 1), 100);
  return `+${boundedMagnitude}%`;
}

export function formatBirdAdditionTrend(current: number, previous: number) {
  if (current === previous) return "+0%";
  if (previous === 0) {
    return current === 0 ? "+0%" : "+100%";
  }

  const rounded = Math.round(((current - previous) / previous) * 100);
  const magnitude = Math.min(Math.max(Math.abs(rounded), 1), 100);
  return `+${magnitude}%`;
}
