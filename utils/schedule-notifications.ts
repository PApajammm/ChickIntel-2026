import Constants, { ExecutionEnvironment } from "expo-constants";
import type { SupabaseScheduleTask } from "@/utils/supabase-schedule";
import {
  formatScheduleDateKey,
  scheduleTaskMatchesDate,
} from "@/utils/supabase-schedule";

const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  (Constants as Record<string, unknown>).appOwnership === "expo";

let NotificationsModule: typeof import("expo-notifications") | null = null;

if (!isExpoGo) {
  try {
    NotificationsModule = require("expo-notifications");
  } catch {
    NotificationsModule = null;
  }
}

const CHANNEL_ID = "schedule-task-alarms";
const LOOKAHEAD_DAYS = 90;

type ScheduledTaskNotification = {
  identifier: string;
  content: { data?: { taskId?: string } };
};

function buildOccurrenceDate(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const occurrence = new Date(date);
  occurrence.setHours(hours || 0, minutes || 0, 0, 0);
  return occurrence;
}

export async function requestScheduleNotificationPermissions() {
  if (!NotificationsModule) return false;

  try {
    if (NotificationsModule.setNotificationChannelAsync) {
      await NotificationsModule.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Schedule task alarms",
        importance: NotificationsModule.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 200, 300],
        sound: "default",
        bypassDnd: false,
        lockscreenVisibility:
          NotificationsModule.AndroidNotificationVisibility.PUBLIC,
      });
    }

    const current = await NotificationsModule.getPermissionsAsync();
    if (current.status === "granted") return true;

    const requested = await NotificationsModule.requestPermissionsAsync();
    return requested.status === "granted";
  } catch {
    return false;
  }
}

export async function scheduleTaskNotifications(task: SupabaseScheduleTask) {
  if (!NotificationsModule || !task.id) return;
  if (!(await requestScheduleNotificationPermissions())) return;

  try {
    const scheduled = (await NotificationsModule.getAllScheduledNotificationsAsync()) as unknown as ScheduledTaskNotification[];
    await Promise.all(
      scheduled
        .filter((entry) => entry.content.data?.taskId === task.id)
        .map((entry) => NotificationsModule?.cancelScheduledNotificationAsync(entry.identifier)),
    );

    const now = new Date();
    for (let offset = 0; offset < LOOKAHEAD_DAYS; offset += 1) {
      const date = new Date(now);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + offset);

      if (task.endDate && formatScheduleDateKey(date) > task.endDate) break;
      if (!scheduleTaskMatchesDate(task, date)) continue;

      const exactTime = buildOccurrenceDate(date, task.time);
      if (exactTime.getTime() <= now.getTime()) continue;

      const reminders = [
        {
          date: new Date(exactTime.getTime() - 15 * 60 * 1000),
          title: `Upcoming task: ${task.title}`,
          body: "This scheduled task starts in 15 minutes.",
          kind: "reminder",
        },
        {
          date: exactTime,
          title: `Task due now: ${task.title}`,
          body: "Your scheduled task is due now. Complete it with evidence.",
          kind: "alarm",
        },
      ];

      for (const reminder of reminders) {
        if (reminder.date.getTime() <= now.getTime()) continue;
        await NotificationsModule.scheduleNotificationAsync({
          content: {
            title: reminder.title,
            body: reminder.body,
            sound: "default",
            priority: reminder.kind === "alarm" ? "max" : "high",
            data: {
              taskId: task.id,
              occurrenceDate: formatScheduleDateKey(date),
              kind: reminder.kind,
            },
          },
          trigger: {
            type: "date",
            date: reminder.date,
            channelId: CHANNEL_ID,
          } as never,
        });
      }
    }
  } catch {
    // Notifications are supplemental; scheduling failure must not block Schedule.
  }
}

export async function cancelTaskNotifications(taskId: string) {
  if (!NotificationsModule || !taskId) return;

  try {
    const scheduled = (await NotificationsModule.getAllScheduledNotificationsAsync()) as unknown as ScheduledTaskNotification[];
    await Promise.all(
      scheduled
        .filter((entry) => entry.content.data?.taskId === taskId)
        .map((entry) => NotificationsModule?.cancelScheduledNotificationAsync(entry.identifier)),
    );
  } catch {
    // Ignore notification cleanup failures.
  }
}
