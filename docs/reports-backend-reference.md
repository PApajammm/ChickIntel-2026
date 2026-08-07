# Reports Module - Backend Reference

This document outlines the data structures and endpoints required for the **Reports** screen. The frontend is currently using mock data for demonstration purposes.

## 1. Production Overview (Donut Chart)

### Required Data Endpoint
**GET** `/api/reports/production`

**Query Parameters**
- `period`: string (`"Weekly"` | `"Monthly"` | `"Annually"`)
- `type`: string (`"Eggs"` | `"Chickens"`)

**Response Format**
```json
{
  "total": 24,
  "segments": [
    {
      "label": "hatched",
      "count": 10,
      "percentage": 42
    },
    {
      "label": "unhatched",
      "count": 10,
      "percentage": 42
    },
    {
      "label": "damaged",
      "count": 4,
      "percentage": 16
    }
  ]
}
```

## 2. Supply Consumption (Bar Chart)

### Required Data Endpoint
**GET** `/api/reports/supply`

**Query Parameters**
- `period`: string (`"Weekly"` | `"Monthly"` | `"Annually"`)
- `supply`: string (`"Vitamins & Meds"` | `"Feeds"`)

**Response Format**
```json
{
  "maxValue": 100,
  "data": [
    { "label": "M", "value": 40 },
    { "label": "T", "value": 110, "isPeak": true },
    { "label": "W", "value": 75 },
    { "label": "Th", "value": 65 },
    { "label": "F", "value": 15 },
    { "label": "Sat", "value": 15 },
    { "label": "S", "value": 25 }
  ]
}
```

## Data Syncing Notes
The Reports module acts as the final aggregation destination for data entered in:
1. **Batch Profile:** Hatch rates, egg counts, and chicken survival tracking.
2. **Inventory:** Daily log of supply usage (Vitamins, Meds, Feeds).

Backend logic should aggregate the relevant logging records accurately based on the selected `period` filter.
