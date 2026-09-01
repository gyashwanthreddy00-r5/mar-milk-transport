/*
# Milk Indent Upload & OCR Module

## Summary
Creates two new tables — `milk_indent_upload` (header) and `milk_indent_details` (line items) —
to support the Milk Indent image-upload-and-OCR workflow. Users upload a WhatsApp JPG image of
a daily milk indent sheet, AI Vision extracts school-wise liter counts, the data is reviewed in
an editable grid, saved, and exported to Excel. The original image is stored permanently in
Supabase Storage.

## Tables

### milk_indent_upload (header)
- `id` uuid PK
- `user_id` uuid NOT NULL DEFAULT auth.uid() — owner (FK auth.users)
- `report_date` date NOT NULL — date the indent report is for
- `district` text NOT NULL — district name
- `company` text NOT NULL — company/dairy name
- `total_liters` numeric DEFAULT 0 — sum of all line-item liters
- `image_url` text NOT NULL — permanent URL of original image in Supabase Storage
- `remarks` text DEFAULT '' — optional notes
- `uploaded_by` text DEFAULT '' — display name/email of uploader
- `created_at` timestamptz DEFAULT now()

### milk_indent_details (line items)
- `id` uuid PK
- `upload_id` uuid NOT NULL — FK to milk_indent_upload.id ON DELETE CASCADE
- `serial_no` integer NOT NULL — serial number shown on the report
- `school_name` text NOT NULL — school name
- `liters` numeric NOT NULL DEFAULT 0 — milk quantity in liters
- `created_at` timestamptz DEFAULT now()

## Indexes
- `idx_milk_indent_upload_user_date` on milk_indent_upload(user_id, report_date DESC)
- `idx_milk_indent_details_upload` on milk_indent_details(upload_id)

## Security
- RLS ENABLED on both tables.
- Owner-scoped CRUD on milk_indent_upload (user_id = auth.uid()).
- Child-scoped CRUD on milk_indent_details via EXISTS check against parent ownership.
- 4 policies per table (SELECT / INSERT / UPDATE / DELETE).
*/

CREATE TABLE IF NOT EXISTS milk_indent_upload (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date date NOT NULL,
  district text NOT NULL,
  company text NOT NULL,
  total_liters numeric NOT NULL DEFAULT 0,
  image_url text NOT NULL,
  remarks text NOT NULL DEFAULT '',
  uploaded_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS milk_indent_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES milk_indent_upload(id) ON DELETE CASCADE,
  serial_no integer NOT NULL,
  school_name text NOT NULL,
  liters numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE milk_indent_upload ENABLE ROW LEVEL SECURITY;
ALTER TABLE milk_indent_details ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_milk_indent_upload_user_date
  ON milk_indent_upload(user_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_milk_indent_details_upload
  ON milk_indent_details(upload_id);

-- milk_indent_upload: owner-scoped CRUD
DROP POLICY IF EXISTS "select_own_milk_indent_upload" ON milk_indent_upload;
CREATE POLICY "select_own_milk_indent_upload" ON milk_indent_upload FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_milk_indent_upload" ON milk_indent_upload;
CREATE POLICY "insert_own_milk_indent_upload" ON milk_indent_upload FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_milk_indent_upload" ON milk_indent_upload;
CREATE POLICY "update_own_milk_indent_upload" ON milk_indent_upload FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_milk_indent_upload" ON milk_indent_upload;
CREATE POLICY "delete_own_milk_indent_upload" ON milk_indent_upload FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- milk_indent_details: child-scoped via parent ownership
DROP POLICY IF EXISTS "select_own_milk_indent_details" ON milk_indent_details;
CREATE POLICY "select_own_milk_indent_details" ON milk_indent_details FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM milk_indent_upload WHERE milk_indent_upload.id = milk_indent_details.upload_id AND milk_indent_upload.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_milk_indent_details" ON milk_indent_details;
CREATE POLICY "insert_own_milk_indent_details" ON milk_indent_details FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM milk_indent_upload WHERE milk_indent_upload.id = milk_indent_details.upload_id AND milk_indent_upload.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_milk_indent_details" ON milk_indent_details;
CREATE POLICY "update_own_milk_indent_details" ON milk_indent_details FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM milk_indent_upload WHERE milk_indent_upload.id = milk_indent_details.upload_id AND milk_indent_upload.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM milk_indent_upload WHERE milk_indent_upload.id = milk_indent_details.upload_id AND milk_indent_upload.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_milk_indent_details" ON milk_indent_details;
CREATE POLICY "delete_own_milk_indent_details" ON milk_indent_details FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM milk_indent_upload WHERE milk_indent_upload.id = milk_indent_details.upload_id AND milk_indent_upload.user_id = auth.uid())
  );