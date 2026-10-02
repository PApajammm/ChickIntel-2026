# Supabase Database Scripts — Execution Order & Reference

This directory contains the database migration, setup, seed, and patch scripts for ChickIntel.

> ⚠️ **IMPORTANT WARNING: NON-IDEMPOTENT POLICIES**
> Many scripts in this directory use `create policy` statements without a preceding `drop policy if exists`. Re-running these scripts on an existing database will cause policy creation errors (`policy ... already exists`). Do not re-run setup scripts blindly against a live database.

---

## Recommended Initial Setup / Migration Order

When bootstrapping a clean database from scratch, execute scripts in the following numbered order to ensure foreign keys, helper functions (e.g. `set_updated_at`, `is_admin`), and dependent tables resolve properly:

### 1. Base Auth & Farm Core
- `auth-farm-setup.sql` — Creates `farms`, `profiles`, `farm_members` tables, roles, and core RLS policies.

### 2. Farm Data Schema & Shared Functions
- `farm-data-setup.sql` — Defines the `set_updated_at()` trigger function, batches (`batches`, `egg_batches`), and inventory items table.

### 3. Master Lookup Data
- `master-data-setup.sql` — Creates lookup reference tables: `breeds`, `feed_types`, `inventory_categories`, `symptoms`, `medications`, and `vitamins`.

### 4. Disease Knowledge Schema
- `disease-knowledge-setup.sql` — Creates base `diseases`, `disease_symptoms`, and treatment guideline structures.

### 5. Disease Knowledge Expansion & Health Protocols
- `disease-knowledge-batch-1.sql` — Adds initial batch of disease profiles and symptoms.
- `disease-knowledge-crd-bumblefoot.sql` — Adds Chronic Respiratory Disease and Bumblefoot datasets.
- `health-camera-database-driven-refactor.sql` — Refactors symptom and behavior categories for camera-driven inference.
- `disease-treatment-protocol-improvements.sql` — Upgrades treatment protocols, active ingredients, and dosing metadata.

### 6. Schedule Core
- `schedule-setup.sql` — Creates `schedule_tasks` table and reminder scheduling policies.

### 7. Health Logs Core
- `health-logs-setup.sql` — Creates `health_logs` and `scan_records` tables for individual log tracking.

### 8. Health Monitoring & Longitudinal Follow-Up
- `health-monitoring-setup.sql` — Creates `health_monitoring_records`, `health_monitoring_tasks`, and `health_monitoring_task_occurrences`.
- `health-monitoring-history-v2-setup.sql` — Enhances historical resolution and querying on monitoring records.

### 9. Schedule Completions, Evidence & Audit History
- `schedule-completions-setup.sql` — Creates `schedule_task_completions` for routine tasks.
- `schedule-evidence-migration.sql` — Adds photo evidence and completion notes columns.
- `schedule-inventory-history-setup.sql` — Creates `schedule_task_history`, `inventory_item_history`, and exclusion tracking tables.

### 10. History, Dispositions & Migrations
- `chicken-batch-history-setup.sql` — Creates `chicken_batch_history` for deleted chicken batch audits.
- `chick-batch-origin-migration.sql` — Adds origin/source metadata to chick batches.
- `egg-batch-history-setup.sql` — Creates `egg_batch_history` for deleted egg batch tracking.
- `egg-disposition-logs-setup.sql` — Creates `egg_disposition_logs` for tracking sales, culls, transfers, and spoilage.
- `egg-batch-disposition-migration.sql` — Adds disposition columns and indices.
- `farmer-role-migration.sql` — Tightens farm member role management and permissions.

### 11. Behaviors & Reporting Upgrades
- `update-behaviors-schema-and-data.sql` — Updates `behavior_categories` and `health_behaviors` schema and seeded options.
- `health-journal-status-notes-migration.sql` — Adds status, resolution notes, and updated timestamp fields to health entries.
- `reporting-setup.sql` — Sets up views and aggregation helper functions for farm analytics.

### 12. Admin Dashboard, Audit Logs & Security
- `admin-setup.sql` — Core admin authorization schema.
- `admin-farmers-setup.sql` — Defines the `is_admin()` security helper function and farmer administration procedures.
- `profiles-rls-fix.sql` — Adjusts profile table RLS to use `is_admin()`.
- `admin-master-data-setup.sql` — Enables admin CRUD policies on lookup tables.
- `admin-activity-logs-setup.sql` — Creates `admin_audit_logs` table for tracking admin actions.
- `login-fix.sql` — Ensures profile insertion policies work properly for both self-registration and admin-created accounts.

### 13. Optional Seeds & Developer Utilities
- `homepage-kpi-sample-seed.sql` — Sample data seed for development and testing of KPI cards.
- `transfer-farmer-owner-to-dev.sql` — Helper script to reassign farm ownership in development environments.
