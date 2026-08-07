# Activity Logs — Full Implementation Plan

## Overview

Add a real (non-mock) Activity Logs tab to the Admin Console that monitors farmer actions across the system (inventory, batches, health scans, schedule completions, etc.). The current mock-up in `app/admin/dashboard.tsx` (tab `logs`) and `utils/activity-logs.ts` must be upgraded to pull real data from Supabase.

## Architecture Decision

**Recommended: Database Triggers** (automatic, server-side)

- Triggers fire on INSERT/UPDATE/DELETE of farmer-facing tables, writing raw audit rows into `admin_audit_logs`.
- Actor is identified via `auth.uid()` (the authenticated farmer who triggered the change).
- The client `fetchActivityLogs()` reads the table, joins `profiles` for display names, and maps `(action, table) → human-readable message`.

**Why triggers over client-side calls:**
- Captures every write without requiring edits to each `supabase-*.ts` mutation.
- Survives edge cases where a client call fails to log.
- Works with existing RLS and transaction semantics.

**Alternative (for admin-only actions):** A lightweight client-side `logActivity()` utility in `utils/activity-logger.ts` can be called explicitly after each admin mutation in `supabase-admin.ts` (createFarmer, updateBreed, etc.). This is optional — triggers cover these tables too.

## Database Changes

### 1. New table: `admin_audit_logs`

```sql
create table if not exists public.admin_audit_logs (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references public.profiles(id),
    action char(1) not null check (action in ('I','U','D')),  -- Insert / Update / Delete
    table_name text not null,
    record_id uuid,
    new_data jsonb,
    old_data jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_admin_audit_logs_actor on public.admin_audit_logs (actor_id);
create index if not exists idx_admin_audit_logs_table on public.admin_audit_logs (table_name);
create index if not exists idx_admin_audit_logs_created on public.admin_audit_logs (created_at desc);
```

### 2. Trigger function

A generic statement-level trigger function that captures ALL farmer-facing tables. Place in a new migration file `supabase/admin-activity-logs-setup.sql`:

```sql
create or replace function public.handle_audit_log()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' then
        insert into public.admin_audit_logs (
            actor_id, action, table_name, record_id, new_data, old_data
        ) values (
            auth.uid(),
            'I',
            tg_table_name,
            (NEW.id)::uuid,
            to_jsonb(NEW),
            null
        );
        return NEW;
    elsif tg_op = 'UPDATE' then
        insert into public.admin_audit_logs (
            actor_id, action, table_name, record_id, new_data, old_data
        ) values (
            auth.uid(),
            'U',
            tg_table_name,
            (NEW.id)::uuid,
            to_jsonb(NEW),
            to_jsonb(OLD)
        );
        return NEW;
    elsif tg_op = 'DELETE' then
        insert into public.admin_audit_logs (
            actor_id, action, table_name, record_id, new_data, old_data
        ) values (
            auth.uid(),
            'D',
            tg_table_name,
            (OLD.id)::uuid,
            null,
            to_jsonb(OLD)
        );
        return OLD;
    end if;
    return NULL;
end;
$$;
```

### 3. Triggers per table

```sql
-- Only tables with an `id` column (uuid primary key)
create trigger audit_inventory_items
    after insert or update or delete on public.inventory_items
    for each row execute function public.handle_audit_log();

create trigger audit_batches
    after insert or update or delete on public.batches
    for each row execute function public.handle_audit_log();

create trigger audit_egg_batches
    after insert or update or delete on public.egg_batches
    for each row execute function public.handle_audit_log();

create trigger audit_health_logs
    after insert or update or delete on public.health_logs
    for each row execute function public.handle_audit_log();

create trigger audit_health_monitoring
    after insert or update or delete on public.health_monitoring
    for each row execute function public.handle_audit_log();

create trigger audit_schedule_task_completions
    after insert or update or delete on public.schedule_task_completions
    for each row execute function public.handle_audit_log();

-- Admin-managed tables (profiles, breeds, inventory_categories)
create trigger audit_profiles
    after update on public.profiles
    for each row execute function public.handle_audit_log();

create trigger audit_breeds
    after insert or update or delete on public.breeds
    for each row execute function public.handle_audit_log();

create trigger audit_inventory_categories
    after insert or update or delete on public.inventory_categories
    for each row execute function public.handle_audit_log();
```

### 4. RLS policy for reading

Only admins should read audit logs:

```sql
alter table public.admin_audit_logs enable row level security;

create policy "audit_logs_select_admin"
on public.admin_audit_logs for select to authenticated
using (
    exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.is_admin = true
    )
);
```

**Note:** Trigger writes bypass RLS (they execute as the table owner), so the trigger function can always insert.

### Migration note: `(NEW.id)::uuid`

Not all tables use `uuid` for `id`. If any table uses a different PK type, the cast will fail. Tables to verify:
- `inventory_items.id` — uuid ✓
- `batches.id` — uuid ✓
- `egg_batches.id` — uuid ✓
- `health_logs.id` — uuid ✓
- `health_monitoring.id` — uuid ✓
- `schedule_task_completions.id` — uuid ✓
- `profiles.id` — uuid ✓
- `breeds.id` — uuid ✓
- `inventory_categories.id` — uuid ✓

## Table-to-Action Message Mapping

The client-side `fetchActivityLogs()` maps `(action, table_name) → message` and extracts a target name from `new_data`/`old_data`:

| Table | action | Message template | Target field |
|---|---|---|---|
| `inventory_items` | I | `{farmer}` added a new item to inventory: `{item_name}` | `new_data.item_name` |
| `inventory_items` | U | `{farmer}` updated inventory item: `{item_name}` | `new_data.item_name` |
| `inventory_items` | D | `{farmer}` deleted an inventory item: `{item_name}` | `old_data.item_name` |
| `batches` | I | `{farmer}` created a new chicken batch: `{batch_no}` | `new_data.batch_no` |
| `batches` | U | `{farmer}` updated batch: `{batch_no}` | `new_data.batch_no` |
| `egg_batches` | I | `{farmer}` created a new egg batch: `{batch_no}` | `new_data.batch_no` |
| `egg_batches` | U | `{farmer}` updated egg batch: `{batch_no}` | `new_data.batch_no` |
| `health_logs` | I | `{farmer}` recorded a health scan for `{cht_tag}` | `new_data.cht_tag` |
| `health_monitoring` | I | `{farmer}` started health monitoring for `{cht_tag}` | `new_data.cht_tag` |
| `schedule_task_completions` | I | `{farmer}` completed scheduled task: `{task_title}` | join `schedule_tasks.title` via `new_data.task_id` |
| `profiles` | U | `{admin}` updated farmer profile: `{display_name}` | `new_data.display_name` |
| `breeds` | I | `{admin}` added a new breed: `{name}` | `new_data.name` |
| `inventory_categories` | I | `{admin}` added a new item type: `{name}` | `new_data.name` |

**Icon mapping** (for the left badge in the UI):
- `inventory_items` → `package-variant` / green
- `batches` → `cow` / brown
- `egg_batches` → `egg` / orange
- `health_logs` → `stethoscope` / teal
- `health_monitoring` → `heart-pulse` / teal
- `schedule_task_completions` → `calendar-check` / secondary
- `profiles` → `account-edit` / gray
- `breeds` → `bird` / orange
- `inventory_categories` → `shape-outline` / gray

## Supabase Utility Updates

### `utils/supabase-admin.ts` — replace mock with real fetch

Replace the mock `fetchActivityLogs()` in `utils/activity-logs.ts` with a real Supabase query, OR move it into `supabase-admin.ts` (since it's admin-only). Recommended: keep `ActivityLogData` type in `activity-logs.ts` but update the fetch function:

```typescript
export type ActivityLogData = {
  id: string;
  farmerName: string;
  farmerEmail: string;
  avatar: string;
  action: string;
  target: string;
  targetType: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  timestamp: string;
  relativeTime: string;
};

const ACTION_LABEL: Record<string, string> = {
  I: "added",
  U: "updated",
  D: "deleted",
};

const TABLE_META: Record<string, { label: string; icon: string; iconColor: string; iconBg: string; targetField: string }> = {
  inventory_items: { label: "inventory", icon: "package-variant", iconColor: "#FFF", iconBg: "#317667", targetField: "item_name" },
  batches: { label: "chicken batch", icon: "cow", iconColor: "#FFF", iconBg: "#B76E3E", targetField: "batch_no" },
  egg_batches: { label: "egg batch", icon: "egg", iconColor: "#FFF", iconBg: "#B76E3E", targetField: "batch_no" },
  health_logs: { label: "health scan", icon: "stethoscope", iconColor: "#FFF", iconBg: "#2D6B73", targetField: "cht_tag" },
  health_monitoring: { label: "health monitoring", icon: "heart-pulse", iconColor: "#FFF", iconBg: "#2D6B73", targetField: "cht_tag" },
  schedule_task_completions: { label: "scheduled task", icon: "calendar-check", iconColor: "#FFF", iconBg: "#6C8B3D", targetField: "task_title" },
  profiles: { label: "farmer account", icon: "account-edit", iconColor: "#FFF", iconBg: "#9CA3AF", targetField: "display_name" },
  breeds: { label: "breed", icon: "bird", iconColor: "#FFF", iconBg: "#B76E3E", targetField: "name" },
  inventory_categories: { label: "item type", icon: "shape-outline", iconColor: "#FFF", iconBg: "#9CA3AF", targetField: "name" },
};

function getTargetFromData(data: any, meta: any, action: string): string {
  if (data == null) return "N/A";
  const field = meta.targetField;
  // Handle schedule_task_completions: join title from task_id
  if (field === "task_title") {
    return data.title ?? `Task ${data.task_id?.slice(0, 8)}`;
  }
  return data[field] ?? data[field === "name" ? "name" : field];
}

export async function fetchActivityLogs(): Promise<ActivityLogData[]> {
  // We need both audit_logs and profiles. Use a join via Supabase.
  // Since admin_audit_logs.actor_id → profiles.id is a foreign key with a join,
  // we can use .select('*, profiles(display_name, email)')
  const { data, error } = await supabase
    .from("admin_audit_logs")
    .select("id, actor_id, action, table_name, record_id, new_data, old_data, created_at, farmer:actor_id!inner(display_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  return (data || []).map((row: any) => {
    const meta = TABLE_META[row.table_name] || {
      label: row.table_name,
      icon: "file-table-alert-outline",
      iconColor: "#FFF",
      iconBg: "#6B7280",
      targetField: "name",
    };

    const sourceData = row.action === "D" ? row.old_data : row.new_data;
    const target = getTargetFromData(sourceData, meta, row.action);
    const farmerName = row.farmer?.display_name ?? row.farmer?.email?.split("@")[0] ?? "Unknown";
    const farmerEmail = row.farmer?.email ?? "";

    return {
      id: row.id,
      farmerName,
      farmerEmail,
      avatar: farmerName.split(" ").filter(Boolean).map((w: string) => w[0]).join("").substring(0, 2).toUpperCase() || "?",
      action: `${ACTION_LABEL[row.action] ?? row.action} ${meta.label}: ${target}`,
      target,
      targetType: meta.label,
      icon: meta.icon,
      iconColor: meta.iconColor,
      iconBg: meta.iconBg,
      timestamp: row.created_at,
      relativeTime: formatRelativeTime(row.created_at),
    };
  });
}
```

**Schedule task title resolution:** `schedule_task_completions` does not store the task title. To show the title, either:
- Join with `schedule_tasks` in the query: `.select("*, task:schedule_task_completions.task_id!inner(title)")` — Supabase supports nested joins via FK path.
- Or use an RPC function.

### `utils/activity-logs.ts` — update to use real data

Update the existing `filterActivityLogs()` and `getActivityLogStats()` functions to work with the real `ActivityLogData` shape (already compatible). If `fetchActivityLogs()` moves to `supabase-admin.ts`, update the import in `dashboard.tsx`.

## UI Integration (dashboard.tsx)

The mock-up already renders the Activity Logs tab. Changes needed:

1. **Data source:** Already importing `fetchActivityLogs`, `filterActivityLogs`, `getActivityLogStats` from `utils/activity-logs.ts`. Swap the mock `fetchActivityLogs` implementation for the real one (point #3 above). No dashboard code changes needed if the export signature stays the same.

2. **Refresh:** The existing `onRefresh={loadActivityLogs}` already works with the real fetch.

3. **Search:** `filterActivityLogs()` already searches across `farmerName`, `farmerEmail`, `action`, `target`, and `targetType`. Compatible with real data.

4. **Stats cards:** The summary cards (Total Events / Farmers / Today / This Week) already call `getActivityLogStats()`. Compatible.

5. **Empty state:** Already handles empty list. Compatible.

**Result:** Minimal UI changes — the mock-up is already designed for the real data shape. Just swap the data source.

## Data Flow

```
Farmer performs action in app
  → supabase client INSERT/UPDATE/DELETE on target table (e.g. inventory_items)
  → Postgres trigger fires (after each row)
  → trigger calls handle_audit_log()
  → handle_audit_log() reads auth.uid() = actor_id, writes to admin_audit_logs
  → Admin opens Activity Logs tab
  → fetchActivityLogs() queries admin_audit_logs joined with profiles
  → Client maps (action, table) → human-readable message + icon
  → FlatList renders formatted logs
```

## Security & RLS

- `admin_audit_logs` has RLS: SELECT only for `is_admin = true` users.
- Trigger writes bypass RLS (table-owner context) — no INSERT policy needed.
- `auth.uid()` in the trigger correctly identifies the farmer (not the trigger owner) because triggers execute in the session of the calling user.
- Admin mutations (e.g., `createFarmer`) also trigger the `profiles` trigger — the actor will be the admin's `auth.uid()`.
- Existing table-level RLS on farmer tables is unchanged.

## Risks & Edge Cases

| Risk | Mitigation |
|---|---|
| Trigger write fails on non-uuid PK tables | Verify all target tables have `id uuid PK`. Only enable triggers on verified tables. |
| `auth.uid()` returns NULL in trigger context | Ensure triggers are `AFTER` (not BEFORE) and the session is authenticated. The client always has an active session when performing mutations. |
| Audit table grows unbounded | Add a TTL or scheduled cleanup job (e.g., `DELETE FROM admin_audit_logs WHERE created_at < now() - interval '90 days'`). Out of scope for MVP. |
| Large JSON in `new_data`/`old_data` causes performance issues | Use indexes on `created_at`, `actor_id`, `table_name`. Consider partial columns if needed. |
| Schedule task title requires extra join | Handle in `fetchActivityLogs()` via nested Supabase select or a dedicated RPC function. |
| Admin actions trigger audit logs with admin as actor | This is desirable — admins can see their own actions too. Distinguish via `profiles.is_admin`. |
| Bulk operations bypass row-level triggers | If bulk writes are needed later, add statement-level triggers. Current codebase uses single-row writes. |

## Validation Plan

- [ ] Deploy migration to a dev Supabase project
- [ ] Login as a farmer, create an inventory item, verify `admin_audit_logs` row appears with correct `actor_id`, `action='I'`, `table_name='inventory_items'`
- [ ] Update/delete the same inventory item, verify `action='U'`/`'D'`
- [ ] Login as a second farmer, verify `actor_id` changes
- [ ] Login as admin, verify Activity Logs tab shows the entries with correct farmer names and messages
- [ ] Verify non-admin farmer cannot read `admin_audit_logs` (RLS blocks)
- [ ] Verify search filters work (search by farmer name, action, target)
- [ ] Verify refresh works (pull-to-refresh)
- [ ] Verify empty state shows when no logs match search
- [ ] Verify stats cards show correct counts
- [ ] Verify TypeScript compiles: `npx tsc --noEmit`
- [ ] Verify ESLint passes: `npx expo lint` on changed files

## Migration Path / Rollback

- Migration file: `supabase/admin-activity-logs-setup.sql`
- To roll back: `DROP TRIGGER IF EXISTS audit_* ON <table>; DROP FUNCTION IF EXISTS public.handle_audit_log(); DROP TABLE IF EXISTS public.admin_audit_logs;`
- The `ActivityLogData` type and `filterActivityLogs`/`getActivityLogStats` utilities are forward-compatible — they work with both mock and real data.

## Files to Create/Modify

| File | Action |
|---|---|
| `supabase/admin-activity-logs-setup.sql` | **Create** — table, trigger function, triggers, RLS policy |
| `utils/supabase-admin.ts` | **Modify** — add real `fetchActivityLogs()` (or move to `activity-logs.ts`) |
| `utils/activity-logs.ts` | **Modify** — replace mock `fetchActivityLogs()` with real fetch, keep type + filter + stats + helper functions |
| `app/admin/dashboard.tsx` | **No changes needed** — mock-up already uses the correct data shape |
| `app/admin/_layout.tsx` | **No changes needed** — dashboard already handles the `logs` tab |

## Out of Scope

- Real-time streaming (Supabase Realtime) of audit logs — current implementation uses pull-to-refresh
- Audit log cleanup/retention policy
- Export of audit logs to CSV/PDF
- Admin-level activity log filtering by action type (could be a future enhancement)
- Client-side logging utility for admin mutations (covered by triggers, but a dedicated `logActivity()` for richer admin-level context is a future enhancement)
