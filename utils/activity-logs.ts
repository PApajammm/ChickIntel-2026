import { supabase } from "@/lib/supabase";

export type ActivityLogEventType = "created" | "updated" | "deleted";
export type ActivityLogFilter = "all" | ActivityLogEventType;

export type ActivityLogData = {
  id: string;
  farmerName: string;
  farmerEmail: string;
  avatar: string;
  action: string;
  eventType: ActivityLogEventType;
  target: string;
  targetType: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  timestamp: string;
  relativeTime: string;
  details?: string;
};

const ACTION_LABEL: Record<string, string> = {
  I: "created",
  U: "updated",
  D: "deleted",
};

const TABLE_META: Record<
  string,
  {
    label: string;
    icon: string;
    iconColor: string;
    iconBg: string;
    targetField: string;
  }
> = {
  inventory_items: {
    label: "inventory",
    icon: "package-variant",
    iconColor: "#FFF",
    iconBg: "#317667",
    targetField: "item_name",
  },
  batches: {
    label: "chicken batch",
    icon: "cow",
    iconColor: "#FFF",
    iconBg: "#B76E3E",
    targetField: "batch_no",
  },
  egg_batches: {
    label: "egg batch",
    icon: "egg",
    iconColor: "#FFF",
    iconBg: "#B76E3E",
    targetField: "batch_no",
  },
  health_logs: {
    label: "health scan",
    icon: "stethoscope",
    iconColor: "#FFF",
    iconBg: "#2D6B73",
    targetField: "cht_tag",
  },
  health_monitoring: {
    label: "health monitoring",
    icon: "heart-pulse",
    iconColor: "#FFF",
    iconBg: "#2D6B73",
    targetField: "cht_tag",
  },
  schedule_task_completions: {
    label: "scheduled task",
    icon: "calendar-check",
    iconColor: "#FFF",
    iconBg: "#6C8B3D",
    targetField: "task_title",
  },
  profiles: {
    label: "farmer account",
    icon: "account-edit",
    iconColor: "#FFF",
    iconBg: "#9CA3AF",
    targetField: "display_name",
  },
  breeds: {
    label: "breed",
    icon: "bird",
    iconColor: "#FFF",
    iconBg: "#B76E3E",
    targetField: "name",
  },
  inventory_categories: {
    label: "item type",
    icon: "shape-outline",
    iconColor: "#FFF",
    iconBg: "#9CA3AF",
    targetField: "name",
  },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTargetFromData(
  data: any,
  meta: any,
  action: string,
  taskTitles: Record<string, string>,
): string {
  if (data == null) return "N/A";
  const field = meta.targetField;
  if (field === "task_title") {
    const taskId = data.task_id;
    return taskTitles[taskId] || `Task ${taskId?.slice(0, 8)}`;
  }
  return data[field] ?? "N/A";
}

function describeChange(oldData: any, newData: any, tableName: string): string {
  const parts: string[] = [];
  const source = newData || oldData || {};

  if (tableName === "batches") {
    const changes: string[] = [];
    const fields = [
      { key: "female_count", label: "females" },
      { key: "male_count", label: "males" },
      { key: "age_label", label: "age" },
      { key: "isolated_count", label: "isolated" },
      { key: "killed_count", label: "killed" },
      { key: "batch_no", label: "batch no" },
      { key: "breed_name", label: "breed" },
    ];
    for (const f of fields) {
      const oldVal = oldData?.[f.key];
      const newVal = newData?.[f.key];
      if (oldVal !== undefined && newVal !== undefined && oldVal !== newVal) {
        changes.push(`${f.label} ${oldVal} → ${newVal}`);
      }
    }
    if (changes.length > 0) {
      return changes.slice(0, 3).join(", ");
    }
  }

  if (tableName === "egg_batches") {
    const changes: string[] = [];
    const fields = [
      { key: "egg_qty", label: "eggs" },
      { key: "line_no", label: "line" },
      { key: "hatched_qty", label: "hatched" },
      { key: "damaged_qty", label: "damaged" },
      { key: "unhatched_qty", label: "unhatched" },
    ];
    for (const f of fields) {
      const oldVal = oldData?.[f.key];
      const newVal = newData?.[f.key];
      if (oldVal !== undefined && newVal !== undefined && oldVal !== newVal) {
        changes.push(`${f.label} ${oldVal} → ${newVal}`);
      }
    }
    if (changes.length > 0) {
      return changes.slice(0, 3).join(", ");
    }
  }

  if (tableName === "inventory_items") {
    const changes: string[] = [];
    const qtyOld = oldData?.qty;
    const qtyNew = newData?.qty;
    const unit = newData?.unit || oldData?.unit || "";
    if (qtyOld !== undefined && qtyNew !== undefined && qtyOld !== qtyNew) {
      changes.push(
        `qty ${qtyOld}${unit ? " " + unit : ""} → ${qtyNew}${unit ? " " + unit : ""}`,
      );
    }
    const statusOld = oldData?.status_percent;
    const statusNew = newData?.status_percent;
    if (
      statusOld !== undefined &&
      statusNew !== undefined &&
      statusOld !== statusNew
    ) {
      changes.push(`status ${statusOld}% → ${statusNew}%`);
    }
    const priceOld = oldData?.price;
    const priceNew = newData?.price;
    if (
      priceOld !== undefined &&
      priceNew !== undefined &&
      priceOld !== priceNew
    ) {
      changes.push(`price ${priceOld} → ${priceNew}`);
    }
    if (changes.length > 0) {
      return changes.slice(0, 2).join(", ");
    }
  }

  if (tableName === "health_logs") {
    const changes: string[] = [];
    const illnessOld = oldData?.detected_illness;
    const illnessNew = newData?.detected_illness;
    if (
      illnessOld !== undefined &&
      illnessNew !== undefined &&
      illnessOld !== illnessNew
    ) {
      changes.push(`illness ${illnessOld} → ${illnessNew}`);
    }
    const statusOld = oldData?.action_status;
    const statusNew = newData?.action_status;
    if (
      statusOld !== undefined &&
      statusNew !== undefined &&
      statusOld !== statusNew
    ) {
      changes.push(`status ${statusOld || "none"} → ${statusNew || "none"}`);
    }
    const durOld = oldData?.duration_value;
    const durNew = newData?.duration_value;
    if (durOld !== undefined && durNew !== undefined && durOld !== durNew) {
      changes.push(`duration ${durOld || "none"} → ${durNew || "none"}`);
    }
    if (changes.length > 0) {
      return changes.slice(0, 2).join(", ");
    }
  }

  if (tableName === "health_monitoring") {
    const changes: string[] = [];
    const statusOld = oldData?.monitoring_status;
    const statusNew = newData?.monitoring_status;
    if (
      statusOld !== undefined &&
      statusNew !== undefined &&
      statusOld !== statusNew
    ) {
      changes.push(`status ${statusOld} → ${statusNew}`);
    }
    const tagOld = oldData?.cht_tag;
    const tagNew = newData?.cht_tag;
    if (tagOld !== undefined && tagNew !== undefined && tagOld !== tagNew) {
      changes.push(`tag ${tagOld} → ${tagNew}`);
    }
    if (changes.length > 0) {
      return changes.slice(0, 2).join(", ");
    }
  }

  if (tableName === "schedule_task_completions") {
    const changes: string[] = [];
    const statusOld = oldData?.completion_status;
    const statusNew = newData?.completion_status;
    if (
      statusOld !== undefined &&
      statusNew !== undefined &&
      statusOld !== statusNew
    ) {
      changes.push(`status ${statusOld} → ${statusNew}`);
    }
    if (changes.length > 0) {
      return changes.slice(0, 2).join(", ");
    }
  }

  if (tableName === "profiles") {
    const changes: string[] = [];
    const nameOld = oldData?.display_name;
    const nameNew = newData?.display_name;
    if (nameOld !== undefined && nameNew !== undefined && nameOld !== nameNew) {
      changes.push(`name ${nameOld} → ${nameNew}`);
    }
    const activeOld = oldData?.is_active;
    const activeNew = newData?.is_active;
    if (
      activeOld !== undefined &&
      activeNew !== undefined &&
      activeOld !== activeNew
    ) {
      changes.push(`active ${activeOld} → ${activeNew}`);
    }
    if (changes.length > 0) {
      return changes.slice(0, 2).join(", ");
    }
  }

  if (tableName === "breeds") {
    const changes: string[] = [];
    const nameOld = oldData?.name;
    const nameNew = newData?.name;
    if (nameOld !== undefined && nameNew !== undefined && nameOld !== nameNew) {
      changes.push(`name ${nameOld} → ${nameNew}`);
    }
    const activeOld = oldData?.is_active;
    const activeNew = newData?.is_active;
    if (
      activeOld !== undefined &&
      activeNew !== undefined &&
      activeOld !== activeNew
    ) {
      changes.push(`active ${activeOld} → ${activeNew}`);
    }
    if (changes.length > 0) {
      return changes.slice(0, 2).join(", ");
    }
  }

  if (tableName === "inventory_categories") {
    const changes: string[] = [];
    const nameOld = oldData?.name;
    const nameNew = newData?.name;
    if (nameOld !== undefined && nameNew !== undefined && nameOld !== nameNew) {
      changes.push(`name ${nameOld} → ${nameNew}`);
    }
    const activeOld = oldData?.is_active;
    const activeNew = newData?.is_active;
    if (
      activeOld !== undefined &&
      activeNew !== undefined &&
      activeOld !== activeNew
    ) {
      changes.push(`active ${activeOld} → ${activeNew}`);
    }
    if (changes.length > 0) {
      return changes.slice(0, 2).join(", ");
    }
  }

  return "";
}

export async function fetchActivityLogs(
  limit = 40,
): Promise<ActivityLogData[]> {
  const { data, error } = await supabase
    .from("admin_audit_logs")
    .select(
      "id, actor_id, action, table_name, record_id, new_data, old_data, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (
      error.code === "42P01" ||
      error.message?.includes("does not exist") ||
      error.message?.includes("relation")
    ) {
      console.warn(
        "[ActivityLogs] admin_audit_logs table not yet deployed:",
        error.message,
      );
      return [];
    }
    throw error;
  }

  const rows = (data || []) as any[];

  // Collect unique actor IDs and profile record IDs to resolve names
  const allUserIds = [
    ...new Set(
      rows
        .flatMap((r) => [
          r.actor_id,
          r.table_name === "profiles" ? r.record_id : null,
        ])
        .filter(Boolean),
    ),
  ] as string[];

  // Build a map of user_id -> profile info
  const actorMap: Record<
    string,
    { display_name: string | null; email: string | null }
  > = {};

  if (allUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", allUserIds);

    for (const p of profiles || []) {
      actorMap[p.id] = { display_name: p.display_name, email: p.email };
    }
  }

  const scheduleRows = rows.filter(
    (r) => r.table_name === "schedule_task_completions",
  );
  const taskIds = [
    ...new Set(
      scheduleRows.flatMap((r: any) => {
        const source = r.action === "D" ? r.old_data : r.new_data;
        return source?.task_id ? [source.task_id] : [];
      }),
    ),
  ] as string[];

  const taskTitles: Record<string, string> = {};
  if (taskIds.length > 0) {
    const { data: tasks } = await supabase
      .from("schedule_tasks")
      .select("id, title")
      .in("id", taskIds);
    for (const t of tasks || []) {
      taskTitles[t.id] = t.title;
    }
  }

  return rows.map((row) => {
    const meta = TABLE_META[row.table_name] || {
      label: row.table_name,
      icon: "file-table-alert-outline",
      iconColor: "#FFF",
      iconBg: "#6B7280",
      targetField: "name",
    };

    const sourceData = row.action === "D" ? row.old_data : row.new_data;
    let target = getTargetFromData(sourceData, meta, row.action, taskTitles);

    const actorProfile =
      actorMap[row.actor_id] ||
      (row.table_name === "profiles" ? actorMap[row.record_id] : {}) ||
      {};

    let farmerName =
      actorProfile.display_name ||
      actorProfile.email?.split("@")[0] ||
      sourceData?.display_name ||
      sourceData?.email?.split("@")[0] ||
      "";

    if (!farmerName || farmerName === "N/A") {
      farmerName = "Farmer Account";
    }

    const farmerEmail =
      actorProfile.email ||
      (row.table_name === "profiles" ? sourceData?.email : "") ||
      "";

    const details = describeChange(row.old_data, row.new_data, row.table_name);

    const eventType =
      row.action === "I"
        ? "created"
        : row.action === "D"
          ? "deleted"
          : "updated";

    let action = "";
    let icon = meta.icon;
    let iconBg = meta.iconBg;

    if (row.table_name === "profiles") {
      const isLogin =
        sourceData?.event === "login" ||
        (!details && (row.action === "U" || row.action === "I"));

      if (isLogin) {
        action = "logged in to account";
        icon = "login";
        iconBg = "#2563EB";
        target = farmerEmail || farmerName;
      } else if (row.action === "I") {
        action = "created farmer account";
        icon = "account-plus";
        iconBg = "#10B981";
        target = farmerEmail || farmerName;
      } else if (row.action === "D") {
        action = "deleted farmer account";
        icon = "account-remove";
        iconBg = "#EF4444";
        target = farmerEmail || farmerName;
      } else {
        action = "updated farmer account";
        icon = "account-edit";
        iconBg = "#8B5CF6";
        target = farmerEmail || farmerName;
      }
    } else {
      action = `${ACTION_LABEL[row.action] ?? eventType} ${meta.label}: ${target}`;
    }

    return {
      id: row.id,
      farmerName,
      farmerEmail,
      avatar: getInitials(farmerName),
      action,
      eventType,
      target,
      targetType: meta.label,
      icon,
      iconColor: meta.iconColor,
      iconBg,
      timestamp: row.created_at,
      relativeTime: timeAgo(row.created_at),
      details,
    };
  });
}

export function filterActivityLogs(
  logs: ActivityLogData[],
  query: string,
  actionFilter: ActivityLogFilter = "all",
): ActivityLogData[] {
  const filteredByType =
    actionFilter === "all"
      ? logs
      : logs.filter((log) => log.eventType === actionFilter);

  if (!query) return filteredByType;

  const q = query.toLowerCase();
  return filteredByType.filter(
    (log) =>
      log.farmerName.toLowerCase().includes(q) ||
      log.farmerEmail.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.target.toLowerCase().includes(q) ||
      log.targetType.toLowerCase().includes(q) ||
      (log.details && log.details.toLowerCase().includes(q)),
  );
}

export function getActivityLogStats(logs: ActivityLogData[]) {
  const uniqueFarmers = new Set(logs.map((l) => l.farmerName)).size;
  const today = logs.filter(
    (l) => new Date(l.timestamp).toDateString() === new Date().toDateString(),
  ).length;
  const thisWeek = logs.filter(
    (l) =>
      Date.now() - new Date(l.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000,
  ).length;
  const created = logs.filter((l) => l.eventType === "created").length;
  const updated = logs.filter((l) => l.eventType === "updated").length;
  const deleted = logs.filter((l) => l.eventType === "deleted").length;
  return {
    total: logs.length,
    uniqueFarmers,
    today,
    thisWeek,
    created,
    updated,
    deleted,
  };
}
