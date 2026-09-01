/*
# Add OTP-based phone login system

1. Changes to existing tables
- `settings`: add `admin_phone` column (text, nullable) — the phone number admins enter in Settings for OTP login.

2. New Tables
- `otp_codes`
  - `id` (uuid, primary key)
  - `phone` (text, not null) — the phone number the OTP was sent to
  - `code_hash` (text, not null) — bcrypt-style hash of the 6-digit OTP code (never store plaintext)
  - `expires_at` (timestamptz, not null) — when the code expires (5 minutes)
  - `used` (boolean, default false) — single-use flag
  - `created_at` (timestamptz, default now())

3. Security
- Enable RLS on `otp_codes`.
- No SELECT/INSERT/UPDATE/DELETE for anon or authenticated via API — the edge function uses the service role key to manage OTP codes server-side. Deny-by-default.
- `settings` table: existing policies already allow authenticated owners to manage their own row; the new column inherits those policies.

4. Important Notes
- The OTP code is generated server-side in the edge function, hashed, and stored. The plaintext code is sent via SMS (or returned in development mode).
- Each code is single-use: marked `used = true` after successful verification.
- Codes expire after 5 minutes.
- Rate limiting: only one unused, unexpired code per phone number at a time; old codes are marked used when a new one is requested.
*/

-- Add admin_phone column to settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'settings' AND column_name = 'admin_phone') THEN
    ALTER TABLE settings ADD COLUMN admin_phone text;
  END IF;
END $$;

-- Create otp_codes table
CREATE TABLE IF NOT EXISTS otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Deny all access from anon and authenticated roles; edge function uses service role key
DROP POLICY IF EXISTS "deny_otp_select" ON otp_codes;
CREATE POLICY "deny_otp_select" ON otp_codes FOR SELECT TO anon, authenticated USING (false);

DROP POLICY IF EXISTS "deny_otp_insert" ON otp_codes;
CREATE POLICY "deny_otp_insert" ON otp_codes FOR INSERT TO anon, authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "deny_otp_update" ON otp_codes;
CREATE POLICY "deny_otp_update" ON otp_codes FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_otp_delete" ON otp_codes;
CREATE POLICY "deny_otp_delete" ON otp_codes FOR DELETE TO anon, authenticated USING (false);

-- Index for lookup by phone
CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON otp_codes(phone);
