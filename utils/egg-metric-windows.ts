export type EggMetricPeriod = "7 days" | "30 days" | "12 months";

export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function shiftDate(date: Date, amount: number, unit: "days" | "months") {
  const next = new Date(date);
  if (unit === "months") {
    next.setMonth(next.getMonth() + amount);
  } else {
    next.setDate(next.getDate() + amount);
  }
  return next;
}

export function getEggMetricWindow(period: EggMetricPeriod, now = new Date()) {
  const dayCount = period === "30 days" ? 30 : 7;
  const currentStart =
    period === "12 months"
      ? startOfDay(shiftDate(now, -12, "months"))
      : startOfDay(shiftDate(now, -(dayCount - 1), "days"));

  return {
    currentStart,
    currentEnd: now,
  };
}
