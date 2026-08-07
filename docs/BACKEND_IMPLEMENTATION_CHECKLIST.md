# Backend Implementation Checklist

This checklist reflects the current backend/database state in this repository as of `2026-04-03`.

Status legend:
- `[x]` Implemented
- `[-]` Partially implemented
- `[ ]` Not implemented

## Auth And Farm Ownership

- [x] Supabase client setup
- [x] Session persistence via secure storage
- [x] Login with Supabase password auth
- [x] `profiles` table
- [x] `farms` table
- [x] `farm_members` table
- [x] Auto-create `profiles` row from `auth.users` trigger
- [x] Helper to create farm for authenticated owner
- [x] Row Level Security for profile/farm ownership tables
- [x] Auth provider loads session, profile, memberships, and active farm
- [ ] Register/signup flow in app UI
- [ ] Forgot-password / reset-password flow in app UI

## Core Farm Data

### Chicken Batches

- [x] `batches` table
- [x] Insert chicken batch
- [x] Read chicken batches by farm
- [x] Update chicken batch
- [x] Delete chicken batch
- [x] `updated_at` trigger
- [x] RLS policies

### Egg Batches

- [x] `egg_batches` table
- [x] Insert egg batch
- [x] Read egg batches by farm
- [x] Update egg batch
- [x] Delete egg batch
- [x] `updated_at` trigger
- [x] RLS policies

### Inventory

- [x] `inventory_items` table
- [x] Insert inventory item
- [x] Read inventory items by farm
- [x] Update inventory item delivery date
- [x] Delete inventory item
- [x] `updated_at` trigger
- [x] RLS policies
- [ ] Dedicated feed consumption table
- [ ] Dedicated egg collection table separate from egg batches
- [ ] Individual chicken table

## Health And Scanning

- [x] `health_logs` table
- [x] Create health journal entry
- [x] Read health journal entries by farm
- [x] Read single health journal entry by id
- [x] Delete health journal entries
- [x] `scan_records` table
- [x] Save health scan record snapshot
- [x] RLS policies for health logs and scan records
- [-] Breed scan persistence
  Current scanner result uses placeholder breed inference and in-memory featured cards.
- [ ] Real ML/API-backed health scanner
- [ ] Real ML/API-backed breed scanner

## Schedule

- [x] `schedule_tasks` table
- [x] Create schedule task
- [x] Read schedule tasks by farm
- [x] Delete schedule task
- [x] `updated_at` trigger
- [x] RLS policies
- [ ] Update schedule task endpoint/helper
- [ ] Mark schedule task complete/incomplete

## Master Data / Lookup Tables

- [x] `breeds`
- [x] `feed_types`
- [x] `inventory_categories`
- [x] `symptoms`
- [x] `medications`
- [x] `vitamins`
- [x] Seed data for all lookup tables above
- [x] Authenticated read policies for lookup tables
- [x] Lookup helpers in app for breeds, categories, feed types, symptoms, medications, vitamins
- [ ] Feed names table
- [ ] Chicken sexing characteristics lookup table

## Home Dashboard / KPIs

- [x] Total Birds KPI backed by live `batches` data
- [x] Collected Eggs KPI backed by live `egg_batches` data
- [x] Home KPI trends computed for `7 days`, `30 days`, `12 months`
- [-] Feeds Consumed KPI backed by existing inventory data
  Current implementation uses feed-category inventory quantities because there is no feed consumption table yet.
- [ ] True feed consumption KPI from consumption records
- [ ] Real-time subscriptions / live dashboard updates

## Reports

- [ ] Report backend tables or views
- [ ] Report query layer
- [ ] Real report metrics on reports screen
- [ ] Export/print generation backend

## API Layer

- [-] Backend exists through Supabase tables, RLS, and direct client queries
- [ ] Separate REST API layer
- [ ] Server-side service layer outside app client
- [ ] Pagination for long lists
- [ ] WebSocket/realtime strategy for dashboards

## App-Level Integration Status

- [x] Login screen connected to backend
- [x] Home KPIs connected to backend data
- [x] Batch profile screens connected to backend
- [x] Add-batch save flow connected to backend
- [x] Add-batch form reset on reopen
- [x] Egg batch creation flow connected to backend
- [x] Inventory screen connected to backend
- [x] Schedule screen connected to backend
- [x] Health journal save/load/delete connected to backend
- [-] Scanner flow connected to backend tables only for health save archive
- [ ] Reports screen connected to backend

## SQL Files Present

- [x] `supabase/auth-farm-setup.sql`
- [x] `supabase/farm-data-setup.sql`
- [x] `supabase/health-logs-setup.sql`
- [x] `supabase/master-data-setup.sql`
- [x] `supabase/schedule-setup.sql`

## Main Remaining Backend Gaps

- [ ] App signup/reset-password flows
- [ ] Individual chicken records
- [ ] Egg collection records separate from egg batch records
- [ ] Feed consumption records
- [ ] Reports backend
- [ ] Real scanner inference backend
- [ ] Standalone API/service layer if required beyond direct Supabase access
