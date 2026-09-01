/*
# Add advance_salary column to drivers table

1. Modified Tables
- `drivers`
  - Added `advance_salary` column (numeric, default 0, not null)
  - This stores money taken by a driver from the company in advance.
  - It is manually editable from the Drivers settings page only.

2. Security
- No changes to existing RLS policies. The column inherits the table's existing policies (owner-scoped CRUD for authenticated users).

3. Important Notes
- The column defaults to 0 so all existing drivers show ₹0 advance.
- This field is NOT used in any reports, dashboards, KPIs, exports, or calculations. It is visible and manageable only from the Drivers page.
*/

ALTER TABLE drivers
ADD COLUMN IF NOT EXISTS advance_salary numeric NOT NULL DEFAULT 0;
