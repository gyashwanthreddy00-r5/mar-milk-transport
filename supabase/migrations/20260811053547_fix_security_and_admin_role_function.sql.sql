/*
# Security Fixes: Function EXECUTE Grants, Admin Role Update, Audit Log Policy

## 1. Revoke EXECUTE on SECURITY DEFINER functions from anon
The `is_admin()` and `is_milk_indent_owner()` functions are SECURITY DEFINER
and were callable by the unauthenticated anon role. Revoke EXECUTE from anon
so only authenticated users can call them.

## 2. Create admin-only role update function
The `profiles` table allows any authenticated user to UPDATE their own row,
including the `role` column. This means any user could escalate themselves
to admin by calling the data API directly. We:
- Revoke UPDATE on `profiles` from authenticated
- Grant UPDATE only on safe columns (full_name, phone, language)
- Create a SECURITY DEFINER function `update_user_role` that checks
  the caller is an admin before changing a user's role
- Revoke EXECUTE on this function from anon

## 3. Fix audit_logs SELECT policy
The SELECT policy on audit_logs was `USING (true)`, allowing any
authenticated user to read all other users' audit logs. Changed to
owner-scoped: users can only read their own audit logs.

## 4. Revoke excessive table grants from anon role
Every table had full SELECT/INSERT/UPDATE/DELETE grants to the anon role
at the database level. While RLS policies restrict access, the anon role
should not have these grants as a defense-in-depth measure.
*/

-- 1. Revoke EXECUTE on SECURITY DEFINER functions from anon
REVOKE EXECUTE ON FUNCTION is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION is_milk_indent_owner FROM anon;

-- 2. Lock down profiles table: restrict UPDATE to safe columns only
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (full_name, phone, language) ON profiles TO authenticated;

-- 3. Create admin-only function for updating user roles
CREATE OR REPLACE FUNCTION update_user_role(target_user uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF new_role NOT IN ('admin', 'manager', 'staff') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  UPDATE profiles SET role = new_role WHERE id = target_user;
END;
$$;

REVOKE EXECUTE ON FUNCTION update_user_role(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION update_user_role(uuid, text) TO authenticated;

-- 4. Fix audit_logs SELECT policy: restrict to own logs
DROP POLICY IF EXISTS "select_all_audit_logs" ON audit_logs;
CREATE POLICY "select_own_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- 5. Revoke all table privileges from anon role (defense in depth)
REVOKE SELECT, INSERT, UPDATE, DELETE ON audit_logs FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON company_bills FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON districts FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON drivers FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON finance FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON locations FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON maintenance FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON mar_bills FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON materials FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON milk_entries FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON milk_indent_details FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON milk_indent_upload FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON otp_codes FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON payments FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON profiles FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON report_settings FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON settings FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON vehicles FROM anon;
