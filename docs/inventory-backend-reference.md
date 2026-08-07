# Inventory Module - Backend Reference

This document details the expected REST interactions for the **Inventory** screen. The frontend currently utilizes a comprehensive, horizontally-sortable table component holding mock objects.

## 1. List Inventory Items

### Required Data Endpoint
**GET** `/api/inventory`

**Query Parameters (Sorting & Filtering)**
- `sortBy`: string (`"name"` | `"type"` | `"qty"` | `"date"`)
- `sortDir`: string (`"asc"` | `"desc"`)
- `type`: string (Optional filter, e.g., `"Feeds"`, `"Medicine"`)

**Response Format**
```json
{
  "totalItems": 142,
  "page": 1,
  "data": [
    {
      "id": "item-101",
      "type": "Feeds",
      "name": "Grower Mash 50kg",
      "qty": 50,
      "unit": "kg",
      "statusPercent": 60,
      "purchasedDate": "2026-03-01T00:00:00Z",
      "deliveredDate": "2026-03-03T00:00:00Z"
    },
    {
      "id": "item-102",
      "type": "Vitamins",
      "name": "Electrolyte Plus",
      "qty": 1,
      "unit": "box",
      "statusPercent": 15,
      "purchasedDate": "2026-03-10T00:00:00Z",
      "deliveredDate": "2026-03-12T00:00:00Z"
    }
  ]
}
```

## 2. Bulk Actions

The UI supports multi-selecting rows via the left-hand column checkboxes.

### Deletion Endpoint
**DELETE** `/api/inventory/bulk`

**Payload**
```json
{
  "itemIds": ["item-101", "item-102"]
}
```

## 3. Row Actions (CRUD)

1. **View (Eye Icon):** Triggers a navigation push or modal opening that requests detailed info (like transaction history logs for that specific serial number).
   - **GET** `/api/inventory/{id}/details`
2. **Edit (Pencil Icon):** Triggers a similar form to "Add New Item", populated with data.
   - **PUT** `/api/inventory/{id}`
3. **Delete (Trash Icon):** Singular deletion.
   - **DELETE** `/api/inventory/{id}`
