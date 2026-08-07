import { ChickIntelPalette } from "@/constants/chickintel-palette";
import type { SupabaseInventoryItem } from "@/utils/supabase-inventory";
import {
    formatScheduleDateKey,
    scheduleTaskMatchesDate,
    type SupabaseScheduleTask,
    type SupabaseScheduleTaskCompletion,
} from "@/utils/supabase-schedule";

export type EffectiveInventoryItem = SupabaseInventoryItem & {
  baseQty: number;
  remainingQty: number;
  consumedQty: number;
};

export type StockSeverity = "normal" | "medium" | "critical";

export function normalizeInventoryLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function isTaskLinkedToInventoryItem(
  task: SupabaseScheduleTask,
  item: Pick<SupabaseInventoryItem, "id" | "name" | "type">,
) {
  if (task.feedInventoryItemId) {
    return task.feedInventoryItemId === item.id;
  }

  const itemType = item.type || "";
  if (itemType.trim().toLowerCase() === "equipment") {
    return false;
  }

  const taskInventoryName = task.feedInventoryItemName || task.title;
  const nameMatches =
    normalizeInventoryLabel(taskInventoryName) ===
    normalizeInventoryLabel(item.name);
  if (!nameMatches) {
    return false;
  }

  const getInventoryTypeFromTaskLabel = (label: string): string | null => {
    const normalized = label.trim().toLowerCase();
    if (normalized.includes("feed")) return "feeds";
    if (normalized.includes("vit")) return "vitamins";
    if (normalized.includes("med")) return "medication";
    return null;
  };

  const taskTypeFromCategory = getInventoryTypeFromTaskLabel(task.category);
  const taskTypeFromTitle = getInventoryTypeFromTaskLabel(task.title);
  const taskTypeFromFeedItemName = task.feedInventoryItemName
    ? getInventoryTypeFromTaskLabel(task.feedInventoryItemName)
    : null;

  const taskInferredType =
    taskTypeFromCategory || taskTypeFromTitle || taskTypeFromFeedItemName;

  if (taskInferredType) {
    return taskInferredType === itemType.trim().toLowerCase();
  }

  return true;
}

export function getStockSeverity(statusPercent: number): StockSeverity {
  if (statusPercent <= 25) {
    return "critical";
  }

  if (statusPercent <= 50) {
    return "medium";
  }

  return "normal";
}

export function getStockSeverityMeta(statusPercent: number) {
  const severity = getStockSeverity(statusPercent);

  if (severity === "critical") {
    return {
      severity,
      label: "Critical",
      fillColor: "#D64545",
      softColor: "rgba(214, 69, 69, 0.16)",
      textColor: "#A12626",
    };
  }

  if (severity === "medium") {
    return {
      severity,
      label: "Medium",
      fillColor: "#E0A100",
      softColor: "rgba(224, 161, 0, 0.16)",
      textColor: "#8A6200",
    };
  }

  return {
    severity,
    label: "Normal",
    fillColor: ChickIntelPalette.green1,
    softColor: "rgba(49, 118, 103, 0.12)",
    textColor: ChickIntelPalette.green1,
  };
}

export function computeEffectiveInventoryItems(
  items: Array<SupabaseInventoryItem & { baseQty?: number }>,
  scheduleTasks: SupabaseScheduleTask[],
  now: Date,
  completions: SupabaseScheduleTaskCompletion[] = [],
): EffectiveInventoryItem[] {
  return items.map((item) => {
    const relatedConsumableTasks = scheduleTasks.filter(
      (task) =>
        isTaskLinkedToInventoryItem(task, item) &&
        (task.feedDailyAmount ?? 0) > 0,
    );

    const currentQty = Number.isFinite(item.qty) ? item.qty : 0;
    const baseQty = Number.isFinite(item.baseQty) ? item.baseQty : currentQty;
    const safeBaseQty = Number.isFinite(baseQty) ? Number(baseQty) : currentQty;
    const completedDatesByTaskId = new Map<string, Set<string>>();

    completions.forEach((completion) => {
      const existing = completedDatesByTaskId.get(completion.taskId);
      if (existing) {
        existing.add(completion.completionDate);
      } else {
        completedDatesByTaskId.set(
          completion.taskId,
          new Set([completion.completionDate]),
        );
      }
    });

    if (relatedConsumableTasks.length === 0) {
      return {
        ...item,
        baseQty: safeBaseQty,
        remainingQty: currentQty,
        consumedQty: 0,
      };
    }

    const consumedQty = relatedConsumableTasks.reduce((total, task) => {
      const itemStartDate = new Date(item.deliveryDate || item.orderDate);
      itemStartDate.setHours(0, 0, 0, 0);
      const completedDates =
        completedDatesByTaskId.get(task.id) ?? new Set<string>();
      let dailyConsumption = 0;
      const cursor = new Date(itemStartDate);

      while (cursor.getTime() <= now.getTime()) {
        if (scheduleTaskMatchesDate(task, cursor)) {
          const occurrenceDateKey = formatScheduleDateKey(cursor);
          if (completedDates.has(occurrenceDateKey)) {
            dailyConsumption += task.feedDailyAmount ?? 0;
          }
        }
        cursor.setDate(cursor.getDate() + 1);
      }

      return total + dailyConsumption;
    }, 0);

    const remainingQty = Math.max(currentQty - consumedQty, 0);
    const derivedStatusPercent =
      safeBaseQty > 0
        ? Math.max(
            0,
            Math.min(100, Math.round((remainingQty / safeBaseQty) * 100)),
          )
        : 0;

    return {
      ...item,
      qty: remainingQty,
      statusPercent: derivedStatusPercent,
      baseQty: safeBaseQty,
      remainingQty,
      consumedQty,
    };
  });
}
