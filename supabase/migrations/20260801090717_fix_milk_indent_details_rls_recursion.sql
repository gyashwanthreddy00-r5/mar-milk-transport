/*
# Fix milk_indent_details RLS recursion

## Problem
The `milk_indent_details` policies use `EXISTS (SELECT 1 FROM milk_indent_upload ...)`
inside RLS. Since `milk_indent_upload` also has RLS enabled, evaluating that subquery
triggers RLS on the parent table, which can recursively re-evaluate child policies,
causing "infinite recursion detected in policy for relation" / "Maximum call stack
size exceeded" errors. Every query on `milk_indent_details` fails.

## Fix
1. Create a `is_milk_indent_owner(upload_uuid)` SECURITY DEFINER function that checks
   whether the current user owns the given `milk_indent_upload` row. Because it is
   SECURITY DEFINER, it runs with the function owner's (postgres) privileges and
   BYPASSES RLS on `milk_indent_upload`, so no recursion occurs.
2. Replace all 4 `milk_indent_details` policies to use this function instead of the
   inline EXISTS subquery.
*/

CREATE OR REPLACE FUNCTION public.is_milk_indent_owner(upload_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.milk_indent_upload
    WHERE id = upload_uuid AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_milk_indent_owner(uuid) TO authenticated;

-- Replace child policies with non-recursive ownership check
DROP POLICY IF EXISTS "select_own_milk_indent_details" ON milk_indent_details;
CREATE POLICY "select_own_milk_indent_details" ON milk_indent_details FOR SELECT
  TO authenticated USING (public.is_milk_indent_owner(upload_id));

DROP POLICY IF EXISTS "insert_own_milk_indent_details" ON milk_indent_details;
CREATE POLICY "insert_own_milk_indent_details" ON milk_indent_details FOR INSERT
  TO authenticated WITH CHECK (public.is_milk_indent_owner(upload_id));

DROP POLICY IF EXISTS "update_own_milk_indent_details" ON milk_indent_details;
CREATE POLICY "update_own_milk_indent_details" ON milk_indent_details FOR UPDATE
  TO authenticated USING (public.is_milk_indent_owner(upload_id))
  WITH CHECK (public.is_milk_indent_owner(upload_id));

DROP POLICY IF EXISTS "delete_own_milk_indent_details" ON milk_indent_details;
CREATE POLICY "delete_own_milk_indent_details" ON milk_indent_details FOR DELETE
  TO authenticated USING (public.is_milk_indent_owner(upload_id));