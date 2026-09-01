/*
# Product Master and Milk Entries Product Enhancement

1. New Tables
- `products` — central product master for the Milk Distribution module
  - id, name, code, unit, unit_display, default_purchase_rate, default_selling_rate,
    is_active, sort_order, user_id (nullable for seeded rows), created_at

2. Modified Tables
- `milk_entries` — add product_id, product_name, unit, unit_display columns

3. Data Backfill
- Existing milk_entries treated as Milk / L / Litres. No financial values changed.

4. Seed Data
- Milk (L), Curd (Kg), Ghee (Kg) with default rates 0, owned by the admin user.

5. Security
- RLS on products: shared SELECT, owner-or-admin write.
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text DEFAULT '',
  unit text NOT NULL DEFAULT 'L',
  unit_display text NOT NULL DEFAULT 'Litres',
  default_purchase_rate numeric NOT NULL DEFAULT 0,
  default_selling_rate numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_all_products" ON products;
CREATE POLICY "select_all_products" ON products FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_products" ON products;
CREATE POLICY "insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_products" ON products;
CREATE POLICY "update_products" ON products FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "delete_products" ON products;
CREATE POLICY "delete_products" ON products FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milk_entries' AND column_name = 'product_id') THEN
    ALTER TABLE milk_entries ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milk_entries' AND column_name = 'product_name') THEN
    ALTER TABLE milk_entries ADD COLUMN product_name text DEFAULT 'Milk';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milk_entries' AND column_name = 'unit') THEN
    ALTER TABLE milk_entries ADD COLUMN unit text DEFAULT 'L';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milk_entries' AND column_name = 'unit_display') THEN
    ALTER TABLE milk_entries ADD COLUMN unit_display text DEFAULT 'Litres';
  END IF;
END $$;

UPDATE milk_entries
SET product_name = COALESCE(product_name, 'Milk'),
    unit = COALESCE(unit, 'L'),
    unit_display = COALESCE(unit_display, 'Litres')
WHERE product_name IS NULL OR unit IS NULL OR unit_display IS NULL;

INSERT INTO products (name, code, unit, unit_display, default_purchase_rate, default_selling_rate, is_active, sort_order, user_id)
SELECT 'Milk', 'MILK', 'L', 'Litres', 0, 0, true, 1, '23797aad-c977-4aa0-9398-b07693678163'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Milk');

INSERT INTO products (name, code, unit, unit_display, default_purchase_rate, default_selling_rate, is_active, sort_order, user_id)
SELECT 'Curd', 'CURD', 'Kg', 'Kilograms', 0, 0, true, 2, '23797aad-c977-4aa0-9398-b07693678163'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Curd');

INSERT INTO products (name, code, unit, unit_display, default_purchase_rate, default_selling_rate, is_active, sort_order, user_id)
SELECT 'Ghee', 'GHEE', 'Kg', 'Kilograms', 0, 0, true, 3, '23797aad-c977-4aa0-9398-b07693678163'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name = 'Ghee');

UPDATE milk_entries me
SET product_id = p.id
FROM products p
WHERE p.name = 'Milk' AND me.product_id IS NULL AND me.product_name = 'Milk';
