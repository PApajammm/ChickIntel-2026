import { ChickIntelPalette } from "@/constants/chickintel-palette";
import type { SupabaseInventoryItem } from "@/utils/supabase-inventory";
import {
  formatScheduleDateKey,
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
  const normTask = normalizeInventoryLabel(taskInventoryName);
  const normItem = normalizeInventoryLabel(item.name);
  const nameMatches =
    normTask === normItem ||
    (normTask.length >= 3 &&
      normItem.length >= 3 &&
      (normTask.includes(normItem) || normItem.includes(normTask)));
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

export type ExpirationStatus = "expired" | "expiring-soon" | "fresh" | "none";

export interface ExpirationMeta {
  status: ExpirationStatus;
  daysRemaining: number | null;
  label: string;
  badgeLabel: string;
  fillColor: string;
  softColor: string;
  textColor: string;
  borderColor: string;
  iconName:
    | "alert-circle"
    | "clock-alert-outline"
    | "check-circle-outline"
    | "calendar-outline";
  isExpired: boolean;
  isExpiringSoon: boolean;
}

export function getExpirationStatus(
  expirationDate?: Date | string | null,
  referenceDate: Date = new Date(),
  warningDaysThreshold: number = 7,
): ExpirationMeta {
  if (!expirationDate) {
    return {
      status: "none",
      daysRemaining: null,
      label: "No Expiration Date",
      badgeLabel: "No Expiry",
      fillColor: "rgba(0, 0, 0, 0.4)",
      softColor: "rgba(0, 0, 0, 0.05)",
      textColor: "rgba(51, 51, 51, 0.7)",
      borderColor: "transparent",
      iconName: "calendar-outline",
      isExpired: false,
      isExpiringSoon: false,
    };
  }

  const expDate = new Date(expirationDate);
  if (Number.isNaN(expDate.getTime())) {
    return {
      status: "none",
      daysRemaining: null,
      label: "Invalid Date",
      badgeLabel: "Invalid",
      fillColor: "rgba(0, 0, 0, 0.4)",
      softColor: "rgba(0, 0, 0, 0.05)",
      textColor: "rgba(51, 51, 51, 0.7)",
      borderColor: "transparent",
      iconName: "calendar-outline",
      isExpired: false,
      isExpiringSoon: false,
    };
  }

  // Normalize times to midnight for calendar day comparison
  const refMidnight = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  const expMidnight = new Date(
    expDate.getFullYear(),
    expDate.getMonth(),
    expDate.getDate(),
  );
  const diffTime = expMidnight.getTime() - refMidnight.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    const agoText = absDays === 1 ? "1 day ago" : `${absDays} days ago`;
    return {
      status: "expired",
      daysRemaining: diffDays,
      label: `Expired (${agoText})`,
      badgeLabel: `Expired ${absDays === 1 ? "1d ago" : `${absDays}d ago`}`,
      fillColor: "#DC2626", // bold danger red
      softColor: "rgba(220, 38, 38, 0.12)",
      textColor: "#B91C1C",
      borderColor: "rgba(220, 38, 38, 0.35)",
      iconName: "alert-circle",
      isExpired: true,
      isExpiringSoon: false,
    };
  }

  if (diffDays === 0) {
    return {
      status: "expired",
      daysRemaining: 0,
      label: "Expires Today!",
      badgeLabel: "Expires Today",
      fillColor: "#DC2626",
      softColor: "rgba(220, 38, 38, 0.14)",
      textColor: "#B91C1C",
      borderColor: "rgba(220, 38, 38, 0.4)",
      iconName: "alert-circle",
      isExpired: true,
      isExpiringSoon: false,
    };
  }

  if (diffDays <= warningDaysThreshold) {
    const inText = diffDays === 1 ? "Tomorrow" : `in ${diffDays} days`;
    return {
      status: "expiring-soon",
      daysRemaining: diffDays,
      label: `Expiring ${inText}`,
      badgeLabel: `Exp: ${inText}`,
      fillColor: "#D97706", // warm warning amber
      softColor: "rgba(217, 119, 6, 0.14)",
      textColor: "#B45309",
      borderColor: "rgba(217, 119, 6, 0.35)",
      iconName: "clock-alert-outline",
      isExpired: false,
      isExpiringSoon: true,
    };
  }

  return {
    status: "fresh",
    daysRemaining: diffDays,
    label: "Fresh & Usable",
    badgeLabel: "Valid",
    fillColor: "#059669", // fresh emerald green
    softColor: "rgba(5, 150, 105, 0.1)",
    textColor: "#047857",
    borderColor: "rgba(5, 150, 105, 0.22)",
    iconName: "check-circle-outline",
    isExpired: false,
    isExpiringSoon: false,
  };
}

export function computeEffectiveInventoryItems(
  items: (SupabaseInventoryItem & { baseQty?: number })[],
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

    const storedQty = Number.isFinite(item.qty) ? item.qty : 0;
    const restockCreditQty = Number.isFinite(item.restockCreditQty)
      ? item.restockCreditQty
      : 0;
    const currentQty = storedQty + restockCreditQty;
    const baseQty = Number.isFinite(item.baseQty)
      ? item.baseQty
      : Number.isFinite(item.totalQty)
        ? item.totalQty
        : storedQty;
    const safeBaseQty = Number.isFinite(baseQty) ? Number(baseQty) : storedQty;
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
      const completedDates =
        completedDatesByTaskId.get(task.id) ?? new Set<string>();
      if (completedDates.size === 0) return total;

      const rawItemDate = item.deliveryDate || item.orderDate;
      const itemStartDateKey =
        rawItemDate instanceof Date
          ? formatScheduleDateKey(rawItemDate)
          : rawItemDate
            ? formatScheduleDateKey(new Date(rawItemDate))
            : "";

      let taskConsumption = 0;
      completedDates.forEach((compDateKey) => {
        if (!itemStartDateKey || compDateKey >= itemStartDateKey) {
          taskConsumption += task.feedDailyAmount ?? 0;
        }
      });

      return total + taskConsumption;
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
