/*
# Enforce one-to-one Company Bill → MAR Bill linking

## Purpose
A Company Bill can now be linked to at most ONE MAR Bill at any time.
This prevents duplicate linking both at the application layer and at the
database layer — even a direct API call cannot link an already-linked
Company Bill to a second MAR Bill.

## Changes
1. Adds a partial UNIQUE index on `mar_bills.company_bill_id` that only
   covers non-NULL values. This allows multiple MAR bills to have
   `company_bill_id = NULL` (unlinked bills) while guaranteeing that no
   two MAR bills ever share the same `company_bill_id`.

## Security
- No RLS policy changes. Existing policies on `mar_bills` remain unchanged.
- No data is modified or deleted.

## Important Notes
1. The index is a PARTIAL unique index — `WHERE company_bill_id IS NOT NULL` —
   because PostgreSQL treats NULL values as distinct by default, but being
   explicit ensures multiple NULLs are always allowed.
2. If any duplicate links already exist in the data, this migration will
   fail. In that case, duplicates must be resolved before re-applying.
3. When a MAR Bill is deleted, the FK (`ON DELETE SET NULL` is not relevant
   here since we delete the MAR bill row entirely) simply removes the link,
   freeing the Company Bill for re-use — exactly the desired behavior.
*/

-- Remove any existing version of this index to keep the migration idempotent
DROP INDEX IF EXISTS public.idx_mar_bills_company_bill_id_unique;

-- Partial unique index: only one MAR bill can reference a given company_bill_id
CREATE UNIQUE INDEX idx_mar_bills_company_bill_id_unique
  ON public.mar_bills (company_bill_id)
  WHERE company_bill_id IS NOT NULL;
