import { supabase } from "@/lib/supabase";

export const SCHEDULE_DAYS_OF_WEEK = [
    "SUN",
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI",
    "SAT",
] as const;

export type SupabaseScheduleTask = {
    id: string;
    title: string;
    time: string;
    category: string;
    repeat: string;
    customRepeatDays?: string[];
    startDate: string;
    endDate?: string | null;
    feedInventoryItemId?: string | null;
    feedInventoryItemName?: string | null;
    feedDailyAmount?: number | null;
    feedDailyUnit?: string | null;
};

type ScheduleTaskRow = {
    id: string;
    title: string;
    task_time: string;
    category: string;
    repeat_type: string;
    custom_repeat_days: string[] | null;
    start_date: string;
    end_date?: string | null;
    feed_inventory_item_id?: string | null;
    feed_inventory_item_name?: string | null;
    feed_daily_amount?: number | string | null;
    feed_daily_unit?: string | null;
};

type EncodedScheduleCategory = {
    category: string;
    endDate?: string | null;
    feedInventoryItemId?: string | null;
    feedInventoryItemName?: string | null;
    feedDailyAmount?: number | null;
    feedDailyUnit?: string | null;
};

const SCHEDULE_TASK_BASE_SELECT =
    "id, title, task_time, category, repeat_type, custom_repeat_days, start_date";
const SCHEDULE_TASK_FEED_SELECT = `${SCHEDULE_TASK_BASE_SELECT}, feed_inventory_item_id, feed_inventory_item_name, feed_daily_amount, feed_daily_unit`;
const SCHEDULE_CATEGORY_METADATA_PREFIX = "__schedule_meta__:";

function isMissingFeedScheduleColumnError(error: unknown) {
    const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string"
            ? error.message
            : "";

    return (
        message.includes("feed_inventory_item_id") ||
        message.includes("feed_inventory_item_name") ||
        message.includes("feed_daily_amount") ||
        message.includes("feed_daily_unit")
    );
}

function normalizeTimeValue(timeValue: string) {
    return timeValue.slice(0, 5);
}

function encodeScheduleCategoryValue(input: EncodedScheduleCategory) {
    return `${SCHEDULE_CATEGORY_METADATA_PREFIX}${encodeURIComponent(
        JSON.stringify(input),
    )}`;
}

function decodeScheduleCategoryValue(rawCategory: string): EncodedScheduleCategory {
    if (!rawCategory.startsWith(SCHEDULE_CATEGORY_METADATA_PREFIX)) {
        return { category: rawCategory };
    }

    try {
        const encodedValue = rawCategory.slice(
            SCHEDULE_CATEGORY_METADATA_PREFIX.length,
        );
        const parsed = JSON.parse(
            decodeURIComponent(encodedValue),
        ) as EncodedScheduleCategory;

        return {
            category: parsed.category || rawCategory,
            endDate: parsed.endDate ?? null,
            feedInventoryItemId: parsed.feedInventoryItemId ?? null,
            feedInventoryItemName: parsed.feedInventoryItemName ?? null,
            feedDailyAmount:
                parsed.feedDailyAmount === null ||
                parsed.feedDailyAmount === undefined
                    ? null
                    : Number(parsed.feedDailyAmount),
            feedDailyUnit: parsed.feedDailyUnit ?? null,
        };
    } catch {
        return { category: rawCategory };
    }
}

function buildOccurrenceDateTime(date: Date, timeValue: string) {
    const [hours, minutes] = timeValue.split(":").map(Number);
    const next = new Date(date);
    next.setHours(
        Number.isNaN(hours) ? 0 : hours,
        Number.isNaN(minutes) ? 0 : minutes,
        0,
        0,
    );
    return next;
}

export function parseScheduleDateKey(dateKey: string) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(year, month - 1, day);
}

export function formatScheduleDateKey(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function scheduleTaskMatchesDate(
    task: Pick<SupabaseScheduleTask, "startDate" | "endDate" | "repeat" | "customRepeatDays">,
    date: Date,
) {
    const targetKey = formatScheduleDateKey(date);

    // 1. Must NOT appear before start date
    if (targetKey < task.startDate) {
        return false;
    }

    // 2. Must NOT appear after end date
    if (task.endDate && targetKey > task.endDate) {
        return false;
    }

    if (task.repeat === "Never" || !task.repeat) {
        return targetKey === task.startDate;
    }

    const taskStartDate = parseScheduleDateKey(task.startDate);

    switch (task.repeat) {
        case "Daily":
            return true;
        case "Weekly":
            return date.getDay() === taskStartDate.getDay();
        case "Monthly":
            return date.getDate() === taskStartDate.getDate();
        case "Annually":
            return (
                date.getDate() === taskStartDate.getDate() &&
                date.getMonth() === taskStartDate.getMonth()
            );
        case "Custom":
            return (
                task.customRepeatDays?.includes(
                    SCHEDULE_DAYS_OF_WEEK[date.getDay()],
                ) ?? false
            );
        default:
            return true;
    }
}

export function countScheduleTaskOccurrencesThroughDate(
    task: Pick<SupabaseScheduleTask, "startDate" | "endDate" | "repeat" | "customRepeatDays">,
    endDate: Date,
) {
    const startDate = parseScheduleDateKey(task.startDate);
    const lastDate = new Date(endDate);

    startDate.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);

    if (lastDate.getTime() < startDate.getTime()) {
        return 0;
    }

    let count = 0;

    for (
        const cursor = new Date(startDate);
        cursor.getTime() <= lastDate.getTime();
        cursor.setDate(cursor.getDate() + 1)
    ) {
        if (scheduleTaskMatchesDate(task, cursor)) {
            count += 1;
        }
    }

    return count;
}

export function countScheduleTaskOccurrencesThroughDateTime(
    task: Pick<
        SupabaseScheduleTask,
        "startDate" | "endDate" | "repeat" | "customRepeatDays" | "time"
    >,
    endDateTime: Date,
) {
    const startDate = parseScheduleDateKey(task.startDate);
    const lastDate = new Date(endDateTime);

    startDate.setHours(0, 0, 0, 0);
    lastDate.setHours(0, 0, 0, 0);

    if (endDateTime.getTime() < buildOccurrenceDateTime(startDate, task.time).getTime()) {
        return 0;
    }

    let count = 0;

    for (
        const cursor = new Date(startDate);
        cursor.getTime() <= lastDate.getTime();
        cursor.setDate(cursor.getDate() + 1)
    ) {
        if (scheduleTaskMatchesDate(task, cursor)) {
            const occurrenceDateTime = buildOccurrenceDateTime(cursor, task.time);

            if (occurrenceDateTime.getTime() <= endDateTime.getTime()) {
                count += 1;
            }
        }
    }

    return count;
}

export function countScheduleTaskOccurrencesBetweenDateTime(
    task: Pick<
        SupabaseScheduleTask,
        "startDate" | "endDate" | "repeat" | "customRepeatDays" | "time"
    >,
    startDateTime: Date,
    endDateTime: Date,
) {
    const startBoundary = new Date(startDateTime.getTime() - 1);
    const throughEnd = countScheduleTaskOccurrencesThroughDateTime(task, endDateTime);
    const beforeStart = countScheduleTaskOccurrencesThroughDateTime(task, startBoundary);

    return Math.max(throughEnd - beforeStart, 0);
}


function mapScheduleTaskRow(row: ScheduleTaskRow): SupabaseScheduleTask {
    const decodedCategory = decodeScheduleCategoryValue(row.category);

    return {
        id: row.id,
        title: row.title,
        time: normalizeTimeValue(row.task_time),
        category: decodedCategory.category,
        repeat: row.repeat_type,
        customRepeatDays: row.custom_repeat_days ?? [],
        startDate: row.start_date,
        endDate: row.end_date ?? decodedCategory.endDate ?? null,
        feedInventoryItemId:
            row.feed_inventory_item_id ?? decodedCategory.feedInventoryItemId ?? null,
        feedInventoryItemName:
            row.feed_inventory_item_name ??
            decodedCategory.feedInventoryItemName ??
            null,
        feedDailyAmount:
            row.feed_daily_amount === null || row.feed_daily_amount === undefined
                ? decodedCategory.feedDailyAmount ?? null
                : Number(row.feed_daily_amount),
        feedDailyUnit: row.feed_daily_unit ?? decodedCategory.feedDailyUnit ?? null,
    };
}

export async function fetchScheduleTasks(farmId: string) {
    const { data, error } = await supabase
        .from("schedule_tasks")
        .select(SCHEDULE_TASK_FEED_SELECT)
        .eq("farm_id", farmId)
        .order("start_date", { ascending: true })
        .order("task_time", { ascending: true });

    if (error) {
        if (!isMissingFeedScheduleColumnError(error)) {
            throw error;
        }

        const fallback = await supabase
            .from("schedule_tasks")
            .select(SCHEDULE_TASK_BASE_SELECT)
            .eq("farm_id", farmId)
            .order("start_date", { ascending: true })
            .order("task_time", { ascending: true });

        if (fallback.error) throw fallback.error;

        return (fallback.data ?? []).map((row) =>
            mapScheduleTaskRow(row as ScheduleTaskRow),
        );
    }

    return (data ?? []).map((row) => mapScheduleTaskRow(row as ScheduleTaskRow));
}

function formatTaskTimePayload(timeValue: string) {
    const parts = timeValue.split(":");
    const h = String(parts[0] || "00").padStart(2, "0");
    const m = String(parts[1] || "00").padStart(2, "0");
    const s = String(parts[2] || "00").padStart(2, "0");
    return `${h}:${m}:${s}`;
}

export async function createScheduleTask(
    farmId: string,
    input: Omit<SupabaseScheduleTask, "id">,
) {
    const formattedTime = formatTaskTimePayload(input.time);

    const basePayload = {
        farm_id: farmId,
        title: input.title,
        task_time: formattedTime,
        category: encodeScheduleCategoryValue({
            category: input.category,
            endDate: input.endDate ?? null,
            feedInventoryItemId: input.feedInventoryItemId ?? null,
            feedInventoryItemName: input.feedInventoryItemName ?? null,
            feedDailyAmount: input.feedDailyAmount ?? null,
            feedDailyUnit: input.feedDailyUnit ?? null,
        }),
        repeat_type: input.repeat,
        custom_repeat_days:
            input.repeat === "Custom" ? input.customRepeatDays ?? [] : [],
        start_date: input.startDate,
    };

    const fullPayload = {
        ...basePayload,
        feed_inventory_item_id: input.feedInventoryItemId ?? null,
        feed_inventory_item_name: input.feedInventoryItemName ?? null,
        feed_daily_amount: input.feedDailyAmount ?? null,
        feed_daily_unit: input.feedDailyUnit ?? null,
    };

    const { data, error } = await supabase
        .from("schedule_tasks")
        .insert(fullPayload)
        .select(SCHEDULE_TASK_FEED_SELECT)
        .single();

    if (error) {
        // Fallback if optional feed columns or single returns fail
        const fallback = await supabase
            .from("schedule_tasks")
            .insert(basePayload)
            .select(SCHEDULE_TASK_BASE_SELECT)
            .single();

        if (fallback.error) throw fallback.error;

        return mapScheduleTaskRow(fallback.data as ScheduleTaskRow);
    }

    return mapScheduleTaskRow(data as ScheduleTaskRow);
}

export async function deleteScheduleTask(farmId: string, taskId: string) {
    const { error } = await supabase
        .from("schedule_tasks")
        .delete()
        .eq("farm_id", farmId)
        .eq("id", taskId);

    if (error) throw error;
}

export type ScheduleTaskCompletionStatus =
    | "Pending"
    | "Due Now"
    | "Completed On Time"
    | "Completed Late"
    | "Missed";

export type SupabaseScheduleTaskCompletion = {
    id: string;
    farmId: string;
    taskId: string;
    completionDate: string;
    completedAt: string;
    completionStatus: "Completed On Time" | "Completed Late";
};

export type ScheduleTaskStatusResult = {
    status: ScheduleTaskCompletionStatus;
    label: string;
    color: string;
    badgeBg: string;
    isCompleted: boolean;
    canMarkComplete: boolean;
};

export function computeTaskStatus(
    task: SupabaseScheduleTask,
    targetDateKey: string,
    completion?: SupabaseScheduleTaskCompletion | null,
    now: Date = new Date(),
): ScheduleTaskStatusResult {
    if (completion) {
        const isLate = completion.completionStatus === "Completed Late";
        return {
            status: completion.completionStatus,
            label: completion.completionStatus,
            color: isLate ? "#D06A3C" : "#2D8C74",
            badgeBg: isLate ? "rgba(208, 106, 60, 0.15)" : "rgba(45, 140, 116, 0.15)",
            isCompleted: true,
            canMarkComplete: false,
        };
    }

    const todayKey = formatScheduleDateKey(now);

    if (targetDateKey > todayKey) {
        return {
            status: "Pending",
            label: "Pending",
            color: "#7E8B8B",
            badgeBg: "rgba(126, 139, 139, 0.15)",
            isCompleted: false,
            canMarkComplete: true,
        };
    }

    if (targetDateKey < todayKey) {
        return {
            status: "Missed",
            label: "Missed",
            color: "#C34F5F",
            badgeBg: "rgba(195, 79, 95, 0.15)",
            isCompleted: false,
            canMarkComplete: true,
        };
    }

    const [hours, minutes] = (task.time || "00:00").split(":").map(Number);
    const scheduledTimeToday = new Date(now);
    scheduledTimeToday.setHours(
        Number.isNaN(hours) ? 0 : hours,
        Number.isNaN(minutes) ? 0 : minutes,
        0,
        0,
    );

    const graceWindowEnd = new Date(scheduledTimeToday.getTime() + 30 * 60 * 1000);

    if (now.getTime() < scheduledTimeToday.getTime()) {
        return {
            status: "Pending",
            label: "Pending",
            color: "#7E8B8B",
            badgeBg: "rgba(126, 139, 139, 0.15)",
            isCompleted: false,
            canMarkComplete: true,
        };
    }

    if (
        now.getTime() >= scheduledTimeToday.getTime() &&
        now.getTime() <= graceWindowEnd.getTime()
    ) {
        return {
            status: "Due Now",
            label: "Due Now",
            color: "#3A86C8",
            badgeBg: "rgba(58, 134, 200, 0.15)",
            isCompleted: false,
            canMarkComplete: true,
        };
    }

    return {
        status: "Missed",
        label: "Missed",
        color: "#C34F5F",
        badgeBg: "rgba(195, 79, 95, 0.15)",
        isCompleted: false,
        canMarkComplete: true,
    };
}

export async function fetchScheduleTaskCompletions(farmId: string) {
    const { data, error } = await supabase
        .from("schedule_task_completions")
        .select(
            "id, farm_id, task_id, completion_date, completed_at, completion_status",
        )
        .eq("farm_id", farmId);

    if (error) return [];

    return (data ?? []).map((row) => ({
        id: row.id,
        farmId: row.farm_id,
        taskId: row.task_id,
        completionDate: row.completion_date,
        completedAt: row.completed_at,
        completionStatus: row.completion_status,
    })) as SupabaseScheduleTaskCompletion[];
}

export async function completeScheduleTask(
    farmId: string,
    taskId: string,
    dateKey: string,
    taskTime: string,
) {
    const now = new Date();
    const [hours, minutes] = taskTime.split(":").map(Number);
    const targetDate = parseScheduleDateKey(dateKey);
    targetDate.setHours(
        Number.isNaN(hours) ? 0 : hours,
        Number.isNaN(minutes) ? 0 : minutes,
        0,
        0,
    );

    const graceWindowEnd = new Date(targetDate.getTime() + 30 * 60 * 1000);
    const completionStatus: "Completed On Time" | "Completed Late" =
        now.getTime() <= graceWindowEnd.getTime()
            ? "Completed On Time"
            : "Completed Late";

    const payload = {
        farm_id: farmId,
        task_id: taskId,
        completion_date: dateKey,
        completed_at: now.toISOString(),
        completion_status: completionStatus,
    };

    const { data, error } = await supabase
        .from("schedule_task_completions")
        .upsert(payload, { onConflict: "task_id, completion_date" })
        .select(
            "id, farm_id, task_id, completion_date, completed_at, completion_status",
        )
        .single();

    if (error) throw error;

    return {
        id: data.id,
        farmId: data.farm_id,
        taskId: data.task_id,
        completionDate: data.completion_date,
        completedAt: data.completed_at,
        completionStatus: data.completion_status,
    } as SupabaseScheduleTaskCompletion;
}
