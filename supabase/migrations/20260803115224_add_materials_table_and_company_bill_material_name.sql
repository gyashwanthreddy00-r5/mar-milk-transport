/*
# Add Materials Master Table and material_name to company_bills

1. New Tables
   - `materials` — stores a list of material names the user can reuse (e.g. "Fly Ash", "Sand", "Cement")
     - `id` (uuid, primary key)
     - `user_id` (uuid, FK to auth.users, owner)
     - `name` (text, not null)
     - `created_at` (timestamp)

2. Modified Tables
   - `company_bills` — adds `material_name` (text, nullable) to record what material was transported on that trip

3. Security
   - RLS enabled on `materials`
   - Owner-scoped CRUD policies for `authenticated` role (same pattern as `locations` / `districts`)
*/

-- Materials master table
CREATE TABLE IF NOT EXISTS materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_materials" ON materials;
CREATE POLICY "select_own_materials" ON materials FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_materials" ON materials;
CREATE POLICY "insert_own_materials" ON materials FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_materials" ON materials;
CREATE POLICY "update_own_materials" ON materials FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_materials" ON materials;
CREATE POLICY "delete_own_materials" ON materials FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Add material_name column to company_bills
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_bills' AND column_name = 'material_name'
  ) THEN
    ALTER TABLE company_bills ADD COLUMN material_name text;
  END IF;
END $$;
