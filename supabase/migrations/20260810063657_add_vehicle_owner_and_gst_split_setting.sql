/*
# Add vehicle owner name and GST split display setting

1. Changes to `vehicles` table
   - Add `owner_name` (text, nullable) — stores the vehicle owner's name as entered in Vehicle Master.

2. Changes to `settings` table
   - Add `show_sgst_cgst` (boolean, default false) — when true, the transport invoice shows GST split into SGST and CGST instead of a single GST line. When false, GST is shown as one combined amount.
   - The toggle controls display only; both SGST and CGST are always on together or off together (no independent toggling).

3. Security
   - No new tables. RLS already enabled on both `vehicles` and `settings`.
   - Existing owner-scoped policies cover the new columns automatically (UPDATE/INSERT policies use auth.uid() = user_id, which is unaffected by adding columns).
*/

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS owner_name text;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS show_sgst_cgst boolean NOT NULL DEFAULT false;
