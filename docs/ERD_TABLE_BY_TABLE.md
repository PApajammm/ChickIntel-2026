# ChickInteL2026 ERD Table by Table

This version explains the ERD step by step:

- first table
- fields inside that table
- which field is `PK`
- which field is `FK`
- what table it connects to next

## 1. `profiles`

**Purpose:** stores the user profile used by the app.

| Field | Key | Description |
|---|---|---|
| `id` | `PK`, `FK` | primary key; also references `auth.users.id` |
| `email` |  | user email |
| `display_name` |  | display name |
| `default_farm_id` | `FK` | references `farms.id` |
| `created_at` |  | date created |

**Connects to next tables:**

- `auth.users` through `profiles.id`
- `farms` through `farms.owner_user_id`
- `farm_members` through `farm_members.user_id`
- `farms` through `profiles.default_farm_id`

## 2. `farms`

**Purpose:** stores each farm in the system.

| Field | Key | Description |
|---|---|---|
| `id` | `PK` | farm id |
| `name` |  | farm name |
| `owner_user_id` | `FK` | references `profiles.id` |
| `created_at` |  | date created |

**Connects to next tables:**

- `profiles` through `owner_user_id`
- `farm_members` through `farm_members.farm_id`
- `batches` through `batches.farm_id`
- `egg_batches` through `egg_batches.farm_id`
- `inventory_items` through `inventory_items.farm_id`
- `health_logs` through `health_logs.farm_id`
- `scan_records` through `scan_records.farm_id`
- `schedule_tasks` through `schedule_tasks.farm_id`

## 3. `farm_members`

**Purpose:** bridge table between users and farms.

| Field | Key | Description |
|---|---|---|
| `id` | `PK` | membership id |
| `farm_id` | `FK` | references `farms.id` |
| `user_id` | `FK` | references `profiles.id` |
| `role` |  | owner, manager, worker |
| `created_at` |  | date created |

**Connects to next tables:**

- `farms` through `farm_id`
- `profiles` through `user_id`

## 4. `batches`

**Purpose:** stores chicken batch records.

| Field | Key | Description |
|---|---|---|
| `id` | `PK` | batch row id |
| `farm_id` | `FK` | references `farms.id` |
| `batch_no` |  | batch number |
| `breed_name` |  | breed name |
| `female_count` |  | female count |
| `male_count` |  | male count |
| `age_label` |  | age label |
| `isolated_count` |  | isolated birds |
| `killed_count` |  | dead/lost birds |
| `color_name` |  | display color name |
| `color_hex` |  | display color hex |
| `created_at` |  | created timestamp |
| `updated_at` |  | updated timestamp |

**Connects to next tables:**

- `farms` through `farm_id`

## 5. `egg_batches`

**Purpose:** stores egg batch and hatch tracking records.

| Field | Key | Description |
|---|---|---|
| `id` | `PK` | egg batch id |
| `farm_id` | `FK` | references `farms.id` |
| `batch_no` |  | batch number |
| `egg_qty` |  | egg quantity |
| `line_no` |  | line number |
| `age_unit` |  | days old or weeks old |
| `hatched_qty` |  | hatched eggs |
| `damaged_qty` |  | damaged eggs |
| `unhatched_qty` |  | unhatched eggs |
| `color_name` |  | display color name |
| `color_hex` |  | display color hex |
| `origin` |  | origin/source |
| `created_at` |  | created timestamp |
| `updated_at` |  | updated timestamp |

**Connects to next tables:**

- `farms` through `farm_id`

## 6. `inventory_items`

**Purpose:** stores farm inventory records.

| Field | Key | Description |
|---|---|---|
| `id` | `PK` | inventory item id |
| `farm_id` | `FK` | references `farms.id` |
| `item_type` |  | type of item |
| `item_name` |  | item name |
| `qty` |  | quantity |
| `unit` |  | unit of measure |
| `price` |  | item price |
| `status_percent` |  | item status |
| `purchased_date` |  | purchase date |
| `delivered_date` |  | delivery date |
| `created_at` |  | created timestamp |
| `updated_at` |  | updated timestamp |

**Connects to next tables:**

- `farms` through `farm_id`

## 7. `health_logs`

**Purpose:** stores saved health scan journal records.

| Field | Key | Description |
|---|---|---|
| `id` | `PK` | health log id |
| `farm_id` | `FK` | references `farms.id` |
| `disease_id` | `FK` | references `diseases.id` |
| `photo_uri` |  | image path |
| `detected_illness` |  | detected illness name |
| `behavior_ids` |  | symptom/behavior codes |
| `result_summary` |  | result summary |
| `recommendation_text` |  | recommendation |
| `action_status` |  | action to take |
| `duration_value` |  | duration |
| `detection_source` |  | source of detection |
| `confidence` |  | confidence score |
| `saved_at` |  | saved time |
| `created_at` |  | created timestamp |
| `updated_at` |  | updated timestamp |

**Connects to next tables:**

- `farms` through `farm_id`
- `diseases` through `disease_id`

## 8. `scan_records`

**Purpose:** stores scan history and raw scan results.

| Field | Key | Description |
|---|---|---|
| `id` | `PK` | scan record id |
| `farm_id` | `FK` | references `farms.id` |
| `disease_id` | `FK` | references `diseases.id` |
| `scan_type` |  | health or breed |
| `image_uri` |  | image path |
| `breed_name` |  | breed result |
| `detected_illness` |  | disease result |
| `raw_result` |  | raw json result |
| `confidence` |  | confidence score |
| `created_at` |  | created timestamp |
| `updated_at` |  | updated timestamp |

**Connects to next tables:**

- `farms` through `farm_id`
- `diseases` through `disease_id`

## 9. `schedule_tasks`

**Purpose:** stores task schedules for a farm.

| Field | Key | Description |
|---|---|---|
| `id` | `PK` | task id |
| `farm_id` | `FK` | references `farms.id` |
| `title` |  | task title |
| `task_time` |  | task time |
| `category` |  | task category |
| `repeat_type` |  | repeat type |
| `custom_repeat_days` |  | custom repeat days |
| `start_date` |  | start date |
| `created_at` |  | created timestamp |
| `updated_at` |  | updated timestamp |

**Connects to next tables:**

- `farms` through `farm_id`

## 10. `diseases`

**Purpose:** stores disease master records.

| Field | Key | Description |
|---|---|---|
| `id` | `PK` | disease id |
| `slug` |  | unique disease slug |
| `name` |  | disease name |
| `short_label` |  | short name |
| `summary` |  | disease summary |
| `severity` |  | disease severity |
| `reference_source` |  | source reference |
| `is_active` |  | active flag |
| `created_at` |  | created timestamp |
| `updated_at` |  | updated timestamp |

**Connects to next tables:**

- `disease_aliases` through `disease_aliases.disease_id`
- `disease_symptoms` through `disease_symptoms.disease_id`
- `disease_treatments` through `disease_treatments.disease_id`
- `disease_reference_images` through `disease_reference_images.disease_id`
- `disease_detection_rules` through `disease_detection_rules.disease_id`
- `health_logs` through `health_logs.disease_id`
- `scan_records` through `scan_records.disease_id`

## 11. `symptoms`

**Purpose:** stores symptom master records.

| Field | Key | Description |
|---|---|---|
| `id` | `PK` | symptom id |
| `code` |  | symptom code |
| `label` |  | symptom label |
| `description` |  | symptom description |
| `severity` |  | symptom severity |
| `is_active` |  | active flag |
| `created_at` |  | created timestamp |

**Connects to next tables:**

- `disease_symptoms` through `disease_symptoms.symptom_id`

## 12. `disease_symptoms`

**Purpose:** bridge table between diseases and symptoms.

| Field | Key | Description |
|---|---|---|
| `id` | `PK` | bridge id |
| `disease_id` | `FK` | references `diseases.id` |
| `symptom_id` | `FK` | references `symptoms.id` |
| `weight` |  | symptom weight |
| `is_primary` |  | primary symptom flag |
| `created_at` |  | created timestamp |

**Connects to next tables:**

- `diseases` through `disease_id`
- `symptoms` through `symptom_id`

## 13. `disease_treatments`

**Purpose:** stores treatments for each disease.

| Field | Key | Description |
|---|---|---|
| `id` | `PK` | treatment id |
| `disease_id` | `FK` | references `diseases.id` |
| `medication_id` | `FK` | references `medications.id` |
| `vitamin_id` | `FK` | references `vitamins.id` |
| `title` |  | treatment title |
| `treatment_text` |  | treatment instructions |
| `sort_order` |  | order of steps |
| `created_at` |  | created timestamp |

**Connects to next tables:**

- `diseases` through `disease_id`
- `medications` through `medication_id`
- `vitamins` through `vitamin_id`

## 14. `medications`

**Purpose:** stores medication master records.

| Field | Key | Description |
|---|---|---|
| `id` | `PK` | medication id |
| `name` |  | medication name |
| `medication_type` |  | medication type |
| `notes` |  | notes |
| `is_active` |  | active flag |
| `created_at` |  | created timestamp |

**Connects to next tables:**

- `disease_treatments` through `disease_treatments.medication_id`

## 15. `vitamins`

**Purpose:** stores vitamin master records.

| Field | Key | Description |
|---|---|---|
| `id` | `PK` | vitamin id |
| `name` |  | vitamin name |
| `vitamin_type` |  | vitamin type |
| `notes` |  | notes |
| `is_active` |  | active flag |
| `created_at` |  | created timestamp |

**Connects to next tables:**

- `disease_treatments` through `disease_treatments.vitamin_id`

## 16. Supporting Master Tables

These are lookup tables used by the app, but they are not connected by real foreign keys in the current schema:

### `breeds`

| Field | Key |
|---|---|
| `id` | `PK` |
| `name` |  |
| `category` |  |
| `temperament` |  |
| `purpose` |  |
| `is_active` |  |
| `created_at` |  |

Used by the app for breed choices, but `batches.breed_name` is stored as plain text.

### `feed_types`

| Field | Key |
|---|---|
| `id` | `PK` |
| `name` |  |
| `description` |  |
| `is_active` |  |
| `created_at` |  |

### `inventory_categories`

| Field | Key |
|---|---|
| `id` | `PK` |
| `name` |  |
| `description` |  |
| `is_active` |  |
| `created_at` |  |

## Clear ERD Chain

If you want to trace the project from start to end, follow this order:

```text
auth.users
   -> profiles
   -> farms
   -> farm_members
   -> batches / egg_batches / inventory_items / health_logs / scan_records / schedule_tasks

diseases
   -> disease_aliases
   -> disease_symptoms -> symptoms
   -> disease_treatments -> medications
   -> disease_treatments -> vitamins
   -> disease_reference_images
   -> disease_detection_rules
   -> health_logs
   -> scan_records
```
