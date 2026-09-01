/*
# MAR ERP — Full Schema

Creates the complete database for the MAR Milk Distribution & Transport ERP.

## Tables
1. `profiles` — user profile (role, full_name, phone). Linked 1:1 to auth.users.
2. `districts` — milk districts (Karimnagar, Jammikunta, Sircilla, Vemulawada).
3. `locations` — unloading locations reused by Transport & Milk modules.
4. `vehicles` — vehicle master (number, driver, monthly EMI, EMI date, status).
5. `drivers` — driver master (name, phone).
6. `milk_entries` — daily milk distribution entries.
7. `company_bills` — transport company bills (per-trip).
8. `mar_bills` — MAR bills with auto profit calculation.
9. `maintenance` — tyre/repair/other vehicle maintenance.
10. `payments` — company payment tracking (transport + milk).
11. `finance` — income/expense ledger entries.
12. `settings` — app-level settings (currency, language default, gst rate).
13. `audit_logs` — action audit trail.

## Security
- RLS enabled on every table.
- Owner-scoped CRUD for authenticated users (TO authenticated, ownership via auth.uid()).
- profiles scoped so each user manages their own profile; a profile is auto-created on signup via trigger.
- All business tables are scoped to the authenticated user who created them (user_id DEFAULT auth.uid()).
- A trigger auto-creates a profile row when a new auth.users row is inserted.
*/

-- ===== profiles =====
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text DEFAULT '',
  phone text DEFAULT '',
  role text NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','manager','staff')),
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en','te')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON public.profiles;
CREATE POLICY "insert_own_profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Admins can read all profiles (for user management)
DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.profiles;
CREATE POLICY "admin_read_all_profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== districts =====
CREATE TABLE IF NOT EXISTS public.districts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_districts" ON public.districts;
CREATE POLICY "select_own_districts" ON public.districts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_districts" ON public.districts;
CREATE POLICY "insert_own_districts" ON public.districts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_districts" ON public.districts;
CREATE POLICY "update_own_districts" ON public.districts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_districts" ON public.districts;
CREATE POLICY "delete_own_districts" ON public.districts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== locations =====
CREATE TABLE IF NOT EXISTS public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_locations" ON public.locations;
CREATE POLICY "select_own_locations" ON public.locations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_locations" ON public.locations;
CREATE POLICY "insert_own_locations" ON public.locations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_locations" ON public.locations;
CREATE POLICY "update_own_locations" ON public.locations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_locations" ON public.locations;
CREATE POLICY "delete_own_locations" ON public.locations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== drivers =====
CREATE TABLE IF NOT EXISTS public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_drivers" ON public.drivers;
CREATE POLICY "select_own_drivers" ON public.drivers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_drivers" ON public.drivers;
CREATE POLICY "insert_own_drivers" ON public.drivers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_drivers" ON public.drivers;
CREATE POLICY "update_own_drivers" ON public.drivers
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_drivers" ON public.drivers;
CREATE POLICY "delete_own_drivers" ON public.drivers
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== vehicles =====
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_number text NOT NULL,
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  monthly_emi numeric NOT NULL DEFAULT 0,
  emi_date int NOT NULL DEFAULT 1 CHECK (emi_date BETWEEN 1 AND 31),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_vehicles" ON public.vehicles;
CREATE POLICY "select_own_vehicles" ON public.vehicles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_vehicles" ON public.vehicles;
CREATE POLICY "insert_own_vehicles" ON public.vehicles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_vehicles" ON public.vehicles;
CREATE POLICY "update_own_vehicles" ON public.vehicles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_vehicles" ON public.vehicles;
CREATE POLICY "delete_own_vehicles" ON public.vehicles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== milk_entries =====
CREATE TABLE IF NOT EXISTS public.milk_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  district_id uuid REFERENCES public.districts(id) ON DELETE SET NULL,
  district_name text NOT NULL DEFAULT '',
  purchase_rate numeric NOT NULL DEFAULT 0,
  selling_rate numeric NOT NULL DEFAULT 0,
  quantity numeric NOT NULL DEFAULT 0,
  margin numeric NOT NULL DEFAULT 0,
  daily_emi numeric NOT NULL DEFAULT 0,
  company_paid numeric NOT NULL DEFAULT 0,
  image_url text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.milk_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_milk" ON public.milk_entries;
CREATE POLICY "select_own_milk" ON public.milk_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_milk" ON public.milk_entries;
CREATE POLICY "insert_own_milk" ON public.milk_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_milk" ON public.milk_entries;
CREATE POLICY "update_own_milk" ON public.milk_entries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_milk" ON public.milk_entries;
CREATE POLICY "delete_own_milk" ON public.milk_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== company_bills =====
CREATE TABLE IF NOT EXISTS public.company_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_date date NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_number text NOT NULL DEFAULT '',
  driver_name text NOT NULL DEFAULT '',
  unloading_location text NOT NULL DEFAULT '',
  tons numeric NOT NULL DEFAULT 0,
  per_ton numeric NOT NULL DEFAULT 0,
  amount_without_gst numeric NOT NULL DEFAULT 0,
  gst_amount numeric NOT NULL DEFAULT 0,
  amount_with_gst numeric NOT NULL DEFAULT 0,
  advance numeric NOT NULL DEFAULT 0,
  diesel numeric NOT NULL DEFAULT 0,
  net_receivable numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','partial','paid')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.company_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_company_bills" ON public.company_bills;
CREATE POLICY "select_own_company_bills" ON public.company_bills
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_company_bills" ON public.company_bills;
CREATE POLICY "insert_own_company_bills" ON public.company_bills
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_company_bills" ON public.company_bills;
CREATE POLICY "update_own_company_bills" ON public.company_bills
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_company_bills" ON public.company_bills;
CREATE POLICY "delete_own_company_bills" ON public.company_bills
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== mar_bills =====
CREATE TABLE IF NOT EXISTS public.mar_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_date date NOT NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_number text NOT NULL DEFAULT '',
  driver_name text NOT NULL DEFAULT '',
  driver_wage numeric NOT NULL DEFAULT 0,
  diesel_litres numeric NOT NULL DEFAULT 0,
  diesel_cost numeric NOT NULL DEFAULT 0,
  toll_gates numeric NOT NULL DEFAULT 0,
  driver_waiting numeric NOT NULL DEFAULT 0,
  other_charges numeric NOT NULL DEFAULT 0,
  maintenance numeric NOT NULL DEFAULT 0,
  daily_emi numeric NOT NULL DEFAULT 0,
  total_expense numeric NOT NULL DEFAULT 0,
  trip_income numeric NOT NULL DEFAULT 0,
  trip_profit numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.mar_bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_mar_bills" ON public.mar_bills;
CREATE POLICY "select_own_mar_bills" ON public.mar_bills
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_mar_bills" ON public.mar_bills;
CREATE POLICY "insert_own_mar_bills" ON public.mar_bills
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_mar_bills" ON public.mar_bills;
CREATE POLICY "update_own_mar_bills" ON public.mar_bills
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_mar_bills" ON public.mar_bills;
CREATE POLICY "delete_own_mar_bills" ON public.mar_bills
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== maintenance =====
CREATE TABLE IF NOT EXISTS public.maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  vehicle_number text NOT NULL DEFAULT '',
  type text NOT NULL CHECK (type IN ('tyre','repair','service','other')),
  date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_maintenance" ON public.maintenance;
CREATE POLICY "select_own_maintenance" ON public.maintenance
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_maintenance" ON public.maintenance;
CREATE POLICY "insert_own_maintenance" ON public.maintenance
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_maintenance" ON public.maintenance;
CREATE POLICY "update_own_maintenance" ON public.maintenance
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_maintenance" ON public.maintenance;
CREATE POLICY "delete_own_maintenance" ON public.maintenance
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== payments =====
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  ref_type text NOT NULL CHECK (ref_type IN ('company_bill','milk','transport')),
  ref_id uuid,
  party text NOT NULL DEFAULT '',
  date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  mode text DEFAULT 'cash',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_payments" ON public.payments;
CREATE POLICY "select_own_payments" ON public.payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_payments" ON public.payments;
CREATE POLICY "insert_own_payments" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_payments" ON public.payments;
CREATE POLICY "update_own_payments" ON public.payments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_payments" ON public.payments;
CREATE POLICY "delete_own_payments" ON public.payments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== finance =====
CREATE TABLE IF NOT EXISTS public.finance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income','expense')),
  category text NOT NULL DEFAULT 'general',
  description text NOT NULL DEFAULT '',
  date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.finance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_finance" ON public.finance;
CREATE POLICY "select_own_finance" ON public.finance
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_finance" ON public.finance;
CREATE POLICY "insert_own_finance" ON public.finance
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_finance" ON public.finance;
CREATE POLICY "update_own_finance" ON public.finance
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_finance" ON public.finance;
CREATE POLICY "delete_own_finance" ON public.finance
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== settings =====
CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  gst_rate numeric NOT NULL DEFAULT 18,
  currency text NOT NULL DEFAULT '₹',
  default_language text NOT NULL DEFAULT 'en' CHECK (default_language IN ('en','te')),
  company_name text NOT NULL DEFAULT 'MAR Transport',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_settings" ON public.settings;
CREATE POLICY "select_own_settings" ON public.settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_settings" ON public.settings;
CREATE POLICY "insert_own_settings" ON public.settings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_settings" ON public.settings;
CREATE POLICY "update_own_settings" ON public.settings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== audit_logs =====
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text DEFAULT '',
  details text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_audit_logs" ON public.audit_logs;
CREATE POLICY "select_own_audit_logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_audit_logs" ON public.audit_logs;
CREATE POLICY "insert_own_audit_logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_milk_user_date ON public.milk_entries (user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_company_bills_user_date ON public.company_bills (user_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_mar_bills_user_date ON public.mar_bills (user_id, trip_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_user_date ON public.maintenance (user_id, date);
CREATE INDEX IF NOT EXISTS idx_finance_user_date ON public.finance (user_id, date);
CREATE INDEX IF NOT EXISTS idx_payments_user_date ON public.payments (user_id, date);
CREATE INDEX IF NOT EXISTS idx_audit_user_date ON public.audit_logs (user_id, created_at);
