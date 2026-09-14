import { supabase } from "@/lib/supabase";

export type ScheduleOccurrenceExclusion = {
  taskId: string;
  occurrenceDate: string;
};

export async function fetchScheduleOccurrenceExclusions(farmId: string) {
  const { data, error } = await supabase
    .from("schedule_task_occurrence_exclusions")
    .select("task_id, occurrence_date")
    .eq("farm_id", farmId);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    taskId: row.task_id as string,
    occurrenceDate: row.occurrence_date as string,
  }));
}

export async function excludeScheduleTaskOccurrence(
  farmId: string,
  taskId: string,
  occurrenceDate: string,
) {
  const { error } = await supabase
    .from("schedule_task_occurrence_exclusions")
    .insert({
      farm_id: farmId,
      task_id: taskId,
      occurrence_date: occurrenceDate,
    });

  if (error) throw error;
}
