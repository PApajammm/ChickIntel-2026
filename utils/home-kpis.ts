import { supabase } from "@/lib/supabase";
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

function startOfDay(date: Date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
}

function shiftDate(date: Date, amount: number, unit: "days" | "months") {
    const next = new Date(date);
    if (unit === "months") {
        next.setMonth(next.getMonth() + amount);
        return next;
    }

    next.setDate(next.getDate() + amount);
    return next;
}

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

function isWithinWindow(
    value: Date,
    startInclusive: Date,
    endExclusive: Date,
) {
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
        return feedInventoryItemNames.has(normalizeLabel(task.feedInventoryItemName));
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

    const throughEnd = countScheduleTaskOccurrencesThroughDateTime(task, endBoundary);
    const beforeStart = countScheduleTaskOccurrencesThroughDateTime(task, startBoundary);

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
        scheduleTasks,
    ] = await Promise.all([
        supabase
            .from("batches")
            .select("female_count, male_count, created_at")
            .eq("farm_id", farmId),
        supabase
            .from("egg_batches")
            .select("egg_qty, created_at")
            .eq("farm_id", farmId),
        supabase
            .from("inventory_items")
            .select("id, item_type, item_name, qty, created_at")
            .eq("farm_id", farmId),
        fetchScheduleTasks(farmId),
    ]);

    if (batchError) throw batchError;
    if (eggError) throw eggError;
    if (inventoryError) throw inventoryError;

    const batches = (batchRows ?? []) as BatchKpiRow[];
    const eggs = (eggRows ?? []) as EggKpiRow[];
    const inventory = (inventoryRows ?? []) as InventoryKpiRow[];

    const totalBirds = batches.reduce(
        (sum, batch) => sum + Number(batch.female_count) + Number(batch.male_count),
        0,
    );

    const birdEvents = batches.map((batch) => ({
        createdAt: batch.created_at,
        value: Number(batch.female_count) + Number(batch.male_count),
    }));

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
            PERIODS.map((period) => [period, sumWindowValues(eggEvents, period)]),
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
    return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}
