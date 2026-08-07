# Admin Dashboard Feature Specification

**Date:** 2026-07-19  
**Status:** Design Phase  
**Priority:** High

---

## Overview

A single **Admin Dashboard** page accessible only to admin users, consolidating farmer account management, chicken breed catalog management, and inventory item type management.

---

## User Access & Routing

### Authentication

- Add `is_admin` boolean flag to `profiles` table (default: `false`)
- Only users with `is_admin = true` can access admin features

### Tab Bar Visibility

- **Admin users** see an additional **⚙️ Admin** tab in the bottom navigation
- **Non-admin users** see regular farmer tabs (Home, Scanner, Journal, Reports, Profile)
- Tab bar updated dynamically based on `auth_provider` context

### Navigation

```
Admin Tab → Admin Dashboard Screen
  ├─ Tab 1: Farmers
  ├─ Tab 2: Chicken Breeds
  └─ Tab 3: Item Types
```

---

## Database Schema Changes

### 1. Update `profiles` Table

```sql
ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN DEFAULT false;
```

### 2. Create Audit Log (Optional for now, can add later)

```sql
CREATE TABLE admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID REFERENCES profiles(id),
  action TEXT, -- 'CREATE_FARMER', 'DEACTIVATE_FARMER', 'ADD_BREED', etc.
  target_type TEXT, -- 'farmer', 'breed', 'item_type'
  target_id UUID,
  changes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Admin Dashboard Features

### 📑 TAB 1: Farmers Management

#### List View

- **Table/List of all farmers:**
  - Name (from `profiles.full_name`)
  - Email (from `auth.users.email`)
  - Farm Count
  - Status (Active / Deactivated)
  - Last Login
  - Actions: Edit, Deactivate/Reactivate

#### Create New Farmer

- **Form fields:**
  - Email (required)
  - Full Name (required)
  - Password (required, auto-generate option)
  - Confirm Password
  - Button: "Create Farmer"
- **On success:** Show confirmation, add to list, optionally copy login credentials

#### Edit Farmer

- **Modal/Form:**
  - Full Name
  - Email (read-only or with warning)
  - Status toggle (Active / Deactivated)
  - Button: "Save Changes"

#### Deactivate Farmer

- **Confirmation dialog:**
  - "Are you sure? Farms and data will be preserved but farmer cannot log in."
  - Buttons: Cancel, Deactivate
  - Updates `profiles.is_active` or similar flag

---

### 🐔 TAB 2: Chicken Breeds

#### List View

- **Table of all breeds:**
  - Breed Name (from `breeds.name`)
  - Description
  - Status (Active / Inactive)
  - Actions: Edit, Delete/Deactivate

#### Add New Breed

- **Form fields:**
  - Breed Name (required)
  - Description (optional)
  - Button: "Add Breed"
- **On success:** Add to list, show confirmation

#### Edit Breed

- **Modal/Form:**
  - Breed Name
  - Description
  - Status toggle
  - Button: "Save Changes"

---

### 📦 TAB 3: Item Types

#### List View

- **Table of all item types:**
  - Item Type Name (from `inventory_categories.name`)
  - Description
  - Status (Active / Inactive)
  - Actions: Edit, Delete/Deactivate

#### Add New Item Type

- **Form fields:**
  - Item Type Name (required, e.g., "Feed", "Supplement", "Equipment")
  - Description (optional)
  - Button: "Add Item Type"
- **On success:** Add to list, show confirmation

#### Edit Item Type

- **Modal/Form:**
  - Item Type Name
  - Description
  - Status toggle
  - Button: "Save Changes"

---

## Implementation Roadmap

### Phase 1: Database & Auth

- [ ] Add `is_admin` column to `profiles`
- [ ] Create admin SQL migration file
- [ ] Update auth provider to pass `is_admin` flag
- [ ] Mark test admin user in seed data

### Phase 2: UI Shell

- [ ] Create `app/admin/_layout.tsx` (admin section routing)
- [ ] Create `app/admin/dashboard.tsx` (main admin page with tab UI)
- [ ] Add admin tab icon to `components/chick-tab-bar.tsx`
- [ ] Conditionally render admin tab based on `is_admin`

### Phase 3: Farmers Management

- [ ] Create `app/admin/farmers-tab.tsx` (list + create form)
- [ ] Build farmer list component
- [ ] Build create farmer form & submission
- [ ] Build edit farmer modal
- [ ] Connect to Supabase functions

### Phase 4: Breeds Management

- [ ] Create `app/admin/breeds-tab.tsx`
- [ ] Build breed list component
- [ ] Build add breed form
- [ ] Build edit breed modal
- [ ] Connect to Supabase

### Phase 5: Item Types Management

- [ ] Create `app/admin/item-types-tab.tsx`
- [ ] Build item type list component
- [ ] Build add item type form
- [ ] Build edit item type modal
- [ ] Connect to Supabase

### Phase 6: Polish & Testing

- [ ] Error handling & validation
- [ ] Loading states
- [ ] Success/error toasts
- [ ] Test with admin & non-admin users

---

## Security Considerations

- ✅ Use Supabase RLS to restrict admin operations (only admins can create/edit farmers, breeds, item types)
- ✅ Require admin auth before showing admin UI
- ✅ Log all admin actions (audit trail for compliance)
- ✅ Soft-delete farmers (deactivate, don't delete) to preserve data integrity
- ✅ Validate all form inputs server-side

---

## UI/UX Notes

- **Color scheme:** Use ChickIntel palette (`constants/chickintel-palette.ts`)
- **Responsive:** Design for mobile-first (same as farmer screens)
- **Feedback:** Toast notifications for create/edit/delete success/error
- **Loading:** Show spinners during API calls
- **Empty states:** Friendly messages when no farmers/breeds/items exist

---

## File Structure

```
app/
  admin/
    _layout.tsx           (admin section layout)
    dashboard.tsx         (main admin dashboard with tabs)
    farmers-tab.tsx       (farmers management)
    breeds-tab.tsx        (breeds management)
    item-types-tab.tsx    (item types management)

utils/
  supabase-admin.ts       (admin-specific queries & mutations)

components/
  admin/
    farmer-list.tsx       (reusable farmer list)
    farmer-form.tsx       (reusable farmer form)
    breed-list.tsx
    breed-form.tsx
    item-type-list.tsx
    item-type-form.tsx
```

---

## Testing Checklist

- [ ] Admin can log in and see admin tab
- [ ] Non-admin user does NOT see admin tab
- [ ] Admin can create a farmer and receive login credentials
- [ ] Admin can edit farmer details
- [ ] Admin can deactivate/reactivate farmer
- [ ] Admin can add chicken breed
- [ ] Admin can edit breed
- [ ] Admin can add item type
- [ ] Admin can edit item type
- [ ] All forms validate input
- [ ] Deactivated farmer cannot log in
- [ ] Data persists after app reload

---

## Next Steps

1. ✅ Approve feature spec
2. Get database schema review
3. Start Phase 1 (database & auth)
4. Build UI incrementally
5. Deploy & test end-to-end
