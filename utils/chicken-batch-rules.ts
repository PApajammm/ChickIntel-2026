export const MIN_CHICKEN_BATCH_AGE_WEEKS = 2;
export const SEXING_START_AGE_WEEKS = 9;
export const EGG_PRODUCTION_AGE_WEEKS = 9;

export function getCurrentBatchAgeDays(
  batch: { ageLabel: string; createdAt?: string },
  now = new Date(),
) {
  const match = batch.ageLabel
    .trim()
    .match(/(\d+(?:\.\d+)?)\s*(day|days|week|weeks)?/i);
  const amount = match ? Number.parseFloat(match[1]) : 0;
  const initialAgeDays = Number.isFinite(amount)
    ? /week/i.test(match?.[2] ?? "")
      ? Math.round(amount * 7)
      : Math.round(amount)
    : 0;

  if (!batch.createdAt) return initialAgeDays;

  const created = new Date(batch.createdAt);
  if (Number.isNaN(created.getTime())) return initialAgeDays;

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
  const elapsedDays = Math.max(
    0,
    Math.floor((currentDate.getTime() - createdDate.getTime()) / 86400000),
  );

  return initialAgeDays + elapsedDays;
}

export function isEggProductionReady(batch: {
  ageLabel: string;
  createdAt?: string;
}) {
  return getCurrentBatchAgeDays(batch) >= EGG_PRODUCTION_AGE_WEEKS * 7;
}
