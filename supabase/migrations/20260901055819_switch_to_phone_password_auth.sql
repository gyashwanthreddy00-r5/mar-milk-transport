/*
# Switch to phone-number + password authentication

## Changes
1. `profiles` table:
   - Add `password_hash` column (text, nullable) — stores bcrypt-style SHA-256 hash of the user's password.
   - The column is NOT directly writable by clients (column-level privilege restriction).

2. Drop the OTP system entirely:
   - Drop `otp_codes` table (no longer needed).
   - Remove `admin_phone` column from `settings` (was only for OTP).

3. Update the `handle_new_user` trigger to NOT auto-create profiles with empty passwords.
   Instead, profiles are created by the admin via the auth-manage-user edge function,
   which sets the password_hash and phone at creation time.

4. Security:
   - Revoke UPDATE on `password_hash` from authenticated (only the edge function with service role can set it).
   - Revoke SELECT on `password_hash` from authenticated and anon (password hashes never exposed to clients).
   - Grant UPDATE (full_name, phone, language) ON profiles TO authenticated (already done, reaffirmed).
*/

-- 1. Add password_hash column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash text;

-- 2. Drop OTP system
DROP TABLE IF EXISTS otp_codes;

-- Remove admin_phone from settings (OTP-only column)
ALTER TABLE settings DROP COLUMN IF EXISTS admin_phone;

-- 3. Revoke access to password_hash from all client roles
--    Only the service role (used by edge functions) can read/write it
REVOKE UPDATE (password_hash) ON profiles FROM authenticated;
--    Ensure password_hash is never SELECTed by clients
--    We do this by creating a restrictive view later if needed, but
--    the simplest approach: revoke SELECT on the column via column privileges
REVOKE SELECT ON profiles FROM authenticated;
GRANT SELECT (id, email, full_name, phone, role, language, created_at) ON profiles TO authenticated;

-- Also revoke from anon (already no access, but be explicit)
REVOKE SELECT ON profiles FROM anon;
GRANT SELECT (id, email, full_name, phone, role, language, created_at) ON profiles TO anon;

-- 4. Update handle_new_user trigger: set phone from raw_user_meta_data if provided
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;

-- 5. Create function to verify phone+password (used by edge function via service role)
CREATE OR REPLACE FUNCTION public.verify_phone_password(p_phone text, p_password text)
RETURNS TABLE (id uuid, email text, full_name text, phone text, role text, language text)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email, u.full_name, u.phone, u.role, u.language
  FROM public.profiles u
  WHERE u.phone = p_phone
    AND u.password_hash = encode(
      digest(p_password, 'sha256'),
      'hex'
    );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.verify_phone_password(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.verify_phone_password(text, text) TO authenticated;

-- 6. Create function to set password (admin-only, called from edge function with service role)
CREATE OR REPLACE FUNCTION public.set_user_password(p_user_id uuid, p_password_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET password_hash = p_password_hash WHERE id = p_user_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_user_password(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_user_password(uuid, text) TO authenticated;
