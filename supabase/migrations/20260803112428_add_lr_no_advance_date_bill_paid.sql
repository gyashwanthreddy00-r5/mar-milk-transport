/*
# Add LR No, Advance Date, and Bill Paid fields

## Purpose
This migration adds three new features to the transport and milk modules:
1. LR Number field on company_bills for tracking transport receipts
2. Advance Date field on company_bills to record when advance was paid
3. Bill Paid checkbox on both company_bills and milk_entries for quick payment tracking

## Changes to company_bills table
- `lr_no` (text, nullable): Lorry Receipt number for the transport trip
- `advance_company_date` (date, nullable): Date when the advance was paid by company
- `bill_paid` (boolean, default false): Quick checkbox to mark bill as fully paid
- `paid_date` (timestamptz, nullable): Timestamp when bill was marked as paid

## Changes to milk_entries table
- `bill_paid` (boolean, default false): Quick checkbox to mark milk bill as fully paid
- `paid_date` (timestamptz, nullable): Timestamp when milk bill was marked as paid

## Security
No RLS policy changes needed — existing policies cover the new columns.
*/

-- Add LR No and Advance Date to company_bills
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_bills' AND column_name = 'lr_no') THEN
    ALTER TABLE company_bills ADD COLUMN lr_no text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_bills' AND column_name = 'advance_company_date') THEN
    ALTER TABLE company_bills ADD COLUMN advance_company_date date;
  END IF;
END $$;

-- Add bill_paid and paid_date to company_bills
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_bills' AND column_name = 'bill_paid') THEN
    ALTER TABLE company_bills ADD COLUMN bill_paid boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_bills' AND column_name = 'paid_date') THEN
    ALTER TABLE company_bills ADD COLUMN paid_date timestamptz;
  END IF;
END $$;

-- Add bill_paid and paid_date to milk_entries
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milk_entries' AND column_name = 'bill_paid') THEN
    ALTER TABLE milk_entries ADD COLUMN bill_paid boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'milk_entries' AND column_name = 'paid_date') THEN
    ALTER TABLE milk_entries ADD COLUMN paid_date timestamptz;
  END IF;
END $$;
