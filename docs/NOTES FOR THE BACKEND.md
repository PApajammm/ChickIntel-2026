# Notes for the Backend Developer

This file is now a current-state backend handoff, not just an initial proposal.

The backend is already partially implemented using Supabase schema, Row Level Security, and direct client queries from the app. Use this file together with [BACKEND_IMPLEMENTATION_CHECKLIST.md](C:/Users/Ralph%20Zaimon/Downloads/ChickInteL2026/ChickInteL2026/BACKEND_IMPLEMENTATION_CHECKLIST.md) as the source of truth for what exists and what still needs work.

## Current Backend Stack

- Supabase Auth for login/session management
- Supabase Postgres tables under `supabase/*.sql`
- Row Level Security on farm-scoped tables
- Direct app-to-Supabase access through helper files in `utils/`

## Implemented Database Areas

### Auth / ownership

- `profiles`
- `farms`
- `farm_members`
- trigger from `auth.users` to `profiles`
- `create_farm_for_owner(...)`

### Farm operations

- `batches`
- `egg_batches`
- `inventory_items`
- `health_logs`
- `scan_records`
- `schedule_tasks`

### Lookup tables

- `breeds`
- `feed_types`
- `inventory_categories`
- `symptoms`
- `medications`
- `vitamins`

## Implemented App Query Layers

- `utils/supabase-batches.ts`
- `utils/supabase-egg-batches.ts`
- `utils/supabase-inventory.ts`
- `utils/supabase-health-journal.ts`
- `utils/supabase-schedule.ts`
- `utils/supabase-lookups.ts`
- `utils/supabase-symptoms.ts`
- `utils/home-kpis.ts`

## What Is Already Working End-To-End

- Login and session bootstrap
- Active farm loading from memberships
- Chicken batch CRUD
- Egg batch CRUD
- Inventory CRUD
- Health journal save/load/delete
- Schedule create/load/delete
- Lookup-driven dropdowns for breeds, categories, symptoms, medications, vitamins
- Home dashboard KPIs for:
  - `Total Birds`
  - `Collected Eggs`
  - `Feeds Consumed`

## Important Current Limitations

- There is no standalone `chickens` table yet.
- There is no separate `egg_collection` table yet.
- There is no separate `feed_consumption` table yet.
- The `Feeds Consumed` KPI currently uses feed-category inventory quantities because real consumption events do not exist yet.
- Reports are still frontend mock data.
- Scanner inference is still placeholder logic; only health scan archive storage is wired.
- There is no app signup/reset-password UI flow yet.

## Current SQL Files

- `supabase/auth-farm-setup.sql`
- `supabase/farm-data-setup.sql`
- `supabase/health-logs-setup.sql`
- `supabase/master-data-setup.sql`
- `supabase/schedule-setup.sql`

## Current Priority Gaps

1. Add true feed consumption records if KPI/reporting should represent actual usage instead of inventory quantity.
2. Add reporting queries/views for the `Reports` screen.
3. Add real backend inference or API integration for breed and health scanning.
4. Add missing account-management flows such as signup and password reset if required in-app.
5. Add standalone `chickens` and `egg_collection` tables if the product needs individual bird tracking and per-collection egg records.

## Suggested Next Backend Work

### High priority

- `feed_consumption` table plus helper/query layer
- report aggregation queries or SQL views
- scanner backend integration

### Medium priority

- `chickens` table
- `egg_collection` table
- schedule task update/complete workflow
- pagination for large journal/task/history lists

### Lower priority

- separate REST API layer if you want to stop querying Supabase directly from the client
- realtime subscriptions for dashboard widgets

## Summary

The backend is no longer just a plan. The project already has a real Supabase-backed data layer for auth, ownership, batches, egg batches, inventory, health logs, schedule tasks, lookup tables, and home KPIs. The main unfinished areas are reports, real scanner intelligence, feed consumption tracking, and some missing domain tables that were part of the original broader vision.
