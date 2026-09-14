import { supabase } from "@/lib/supabase";
import type { SupabaseScheduleTask } from "@/utils/supabase-schedule";

export type ScheduleHistoryItem = SupabaseScheduleTask & {
  historyId: string;
  deletedAt: string;
};

type ScheduleHistoryRow = {
  id: string;
  title: string;
  task_time: string;
  category: string;
  repeat_type: string;
  custom_repeat_days: string[] | null;
  start_date: string;
  end_date: string | null;
  feed_inventory_item_name: string | null;
  feed_daily_amount: number | string | null;
  feed_daily_unit: string | null;
  deleted_at: string;
};

function mapHistoryRow(row: ScheduleHistoryRow): ScheduleHistoryItem {
  return {
    historyId: row.id,
    id: row.id,
    title: row.title,
    time: row.task_time.slice(0, 5),
    category: row.category,
    repeat: row.repeat_type,
    customRepeatDays: row.custom_repeat_days ?? [],
    startDate: row.start_date,
    endDate: row.end_date,
    feedInventoryItemName: row.feed_inventory_item_name,
    feedDailyAmount:
      row.feed_daily_amount === null ? null : Number(row.feed_daily_amount),
    feedDailyUnit: row.feed_daily_unit,
    deletedAt: row.deleted_at,
  };
}

const HISTORY_COLUMNS =
  "id, title, task_time, category, repeat_type, custom_repeat_days, start_date, end_date, feed_inventory_item_name, feed_daily_amount, feed_daily_unit, deleted_at";

export async function recordDeletedScheduleTask(
  farmId: string,
  task: SupabaseScheduleTask,
) {
  const { error } = await supabase.from("schedule_task_history").insert({
    farm_id: farmId,
    title: task.title,
    task_time: task.time,
    category: task.category,
    repeat_type: task.repeat,
    custom_repeat_days: task.customRepeatDays ?? [],
    start_date: task.startDate,
    end_date: task.endDate ?? null,
    feed_inventory_item_name: task.feedInventoryItemName ?? null,
    feed_daily_amount: task.feedDailyAmount ?? null,
    feed_daily_unit: task.feedDailyUnit ?? null,
  });

  if (error) throw error;
}

export async function fetchDeletedScheduleTasks(farmId: string) {
  const { data, error } = await supabase
    .from("schedule_task_history")
    .select(HISTORY_COLUMNS)
    .eq("farm_id", farmId)
    .order("deleted_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapHistoryRow(row as ScheduleHistoryRow));
}
