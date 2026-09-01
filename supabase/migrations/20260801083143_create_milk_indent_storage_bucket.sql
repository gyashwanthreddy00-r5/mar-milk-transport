/*
# Milk Indent Storage Bucket

## Summary
Creates a dedicated Supabase Storage bucket `milk-indent-images` to permanently store
the original JPG/PNG images uploaded for the Milk Indent OCR workflow.
Original images must never be deleted and must be viewable/downloadable by the owner.

## Storage
- Bucket: `milk-indent-images` (private)
- Path pattern: `{user_id}/{filename}`
- RLS storage policies: owner can read, insert, update, delete their own objects.
*/

INSERT INTO storage.buckets (id, name, public)
SELECT 'milk-indent-images', 'milk-indent-images', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'milk-indent-images');

-- Allow authenticated users to manage their own objects in milk-indent-images bucket
DROP POLICY IF EXISTS "select_own_milk_indent_images" ON storage.objects;
CREATE POLICY "select_own_milk_indent_images" ON storage.objects FOR SELECT
  TO authenticated USING (
    bucket_id = 'milk-indent-images' AND auth.uid() = owner
  );

DROP POLICY IF EXISTS "insert_own_milk_indent_images" ON storage.objects;
CREATE POLICY "insert_own_milk_indent_images" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'milk-indent-images' AND auth.uid() = owner
  );

DROP POLICY IF EXISTS "update_own_milk_indent_images" ON storage.objects;
CREATE POLICY "update_own_milk_indent_images" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'milk-indent-images' AND auth.uid() = owner
  ) WITH CHECK (
    bucket_id = 'milk-indent-images' AND auth.uid() = owner
  );

DROP POLICY IF EXISTS "delete_own_milk_indent_images" ON storage.objects;
CREATE POLICY "delete_own_milk_indent_images" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'milk-indent-images' AND auth.uid() = owner
  );