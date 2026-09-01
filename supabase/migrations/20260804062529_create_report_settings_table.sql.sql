/*
# Create Report Settings table

1. Purpose
   - Allows administrators to control which reports are visible in the UI.
   - This is a UI visibility feature only — it does NOT affect data, calculations, or report generation.

2. New Table: report_settings
   - id (uuid, primary key)
   - report_key (text, unique) — e.g. 'milk:daily', 'transport:vehicle'
   - report_name (text) — human-readable display name
   - module (text) — 'milk' or 'transport'
   - is_active (boolean, default true) — whether the report appears in the UI
   - updated_by (uuid, nullable) — the admin user who last changed the setting
   - updated_at (timestamptz, default now())

3. Security
   - Enable RLS on report_settings.
   - All authenticated users can SELECT (they need to read visibility settings).
   - Only admin users can INSERT/UPDATE/DELETE (staff cannot change visibility).
   - Admin check uses the profiles table: role = 'admin'.

4. Seed Data
   - Seeds all known Milk and Transport report keys with is_active = true.
*/

CREATE TABLE IF NOT EXISTS report_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_key text UNIQUE NOT NULL,
  report_name text NOT NULL,
  module text NOT NULL CHECK (module IN ('milk', 'transport')),
  is_active boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE report_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read report visibility settings
DROP POLICY IF EXISTS "select_report_settings" ON report_settings;
CREATE POLICY "select_report_settings"
  ON report_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert new report settings
DROP POLICY IF EXISTS "insert_report_settings_admin" ON report_settings;
CREATE POLICY "insert_report_settings_admin"
  ON report_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Only admins can update report settings
DROP POLICY IF EXISTS "update_report_settings_admin" ON report_settings;
CREATE POLICY "update_report_settings_admin"
  ON report_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Only admins can delete report settings
DROP POLICY IF EXISTS "delete_report_settings_admin" ON report_settings;
CREATE POLICY "delete_report_settings_admin"
  ON report_settings FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Seed Milk reports (upsert so re-runs are safe)
INSERT INTO report_settings (report_key, report_name, module, is_active) VALUES
  ('milk:daily',              'Daily Milk Sales Report',     'milk', true),
  ('milk:dateWise',           'Date Wise Sales Report',      'milk', true),
  ('milk:monthly',            'Monthly Sales Report',        'milk', true),
  ('milk:customer',           'Customer Wise Report',        'milk', true),
  ('milk:route',              'Route Wise Report',           'milk', true),
  ('milk:vehicle',            'Vehicle Wise Report',         'milk', true),
  ('milk:product',            'Product Wise Report',         'milk', true),
  ('milk:quantity',           'Quantity Report',             'milk', true),
  ('milk:salesAmount',        'Sales Amount Report',         'milk', true),
  ('milk:paidBills',          'Paid Bills Report',           'milk', true),
  ('milk:pendingBills',       'Pending Bills Report',        'milk', true),
  ('milk:outstanding',        'Outstanding Report',          'milk', true),
  ('milk:collection',         'Collection Report',           'milk', true),
  ('milk:paymentHistory',     'Payment History Report',      'milk', true),
  ('milk:ledger',             'Customer Ledger',             'milk', true),
  ('milk:statement',          'Customer Statement',          'milk', true),
  ('milk:profit',             'Profit Report',               'milk', true),
  ('milk:gst',                'GST Report',                  'milk', true),
  ('milk:invoiceRegister',    'Invoice Register',            'milk', true),
  ('milk:topCustomers',       'Top Customers Report',        'milk', true)
ON CONFLICT (report_key) DO NOTHING;

-- Seed Transport reports
INSERT INTO report_settings (report_key, report_name, module, is_active) VALUES
  ('transport:daily',           'Daily Trip Report',           'transport', true),
  ('transport:dateWise',        'Date Wise Trip Report',       'transport', true),
  ('transport:monthly',         'Monthly Trip Report',         'transport', true),
  ('transport:vehicle',         'Vehicle Wise Report',         'transport', true),
  ('transport:driver',          'Driver Wise Report',          'transport', true),
  ('transport:lrNumber',        'LR Number Report',            'transport', true),
  ('transport:material',        'Material Wise Report',        'transport', true),
  ('transport:loading',         'Loading Location Report',     'transport', true),
  ('transport:unloading',       'Unloading Location Report',   'transport', true),
  ('transport:customer',        'Customer Wise Report',        'transport', true),
  ('transport:companyIncome',   'Company Income Report',       'transport', true),
  ('transport:diesel',          'Diesel Expense Report',       'transport', true),
  ('transport:maintenance',     'Maintenance Report',          'transport', true),
  ('transport:advance',         'Advance Report',              'transport', true),
  ('transport:paidBills',       'Paid Bills Report',           'transport', true),
  ('transport:pendingBills',    'Pending Bills Report',        'transport', true),
  ('transport:outstanding',     'Outstanding Report',          'transport', true),
  ('transport:tripProfit',      'Trip Profit Report',          'transport', true),
  ('transport:vehicleProfit',   'Vehicle Profitability Report','transport', true),
  ('transport:driverPayment',   'Driver Payment Report',       'transport', true),
  ('transport:gstInvoice',      'GST Report',                  'transport', true),
  ('transport:invoiceRegister', 'Invoice Register',            'transport', true),
  ('transport:ledger',          'Transport Ledger',            'transport', true),
  ('transport:collection',      'Collection Report',           'transport', true),
  ('transport:vehicleUtil',     'Vehicle Utilization Report',  'transport', true),
  ('transport:tripSummary',     'Trip Summary Report',         'transport', true)
ON CONFLICT (report_key) DO NOTHING;
