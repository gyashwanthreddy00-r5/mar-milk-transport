/*
# Add Diesel Rate Management to Company Bills

## Overview
This migration adds a Diesel Rate field to General Settings and extends the
company_bills table to store diesel rate, diesel amount, company income, and
net company income per bill — so historical bills are protected when the
diesel rate changes.

## Changes to `settings` table
- `diesel_rate` (numeric, default 0): the current diesel price per liter,
  maintained by the admin in General Settings.

## Changes to `company_bills` table
- `diesel_rate` (numeric, default 0): the diesel rate (₹/liter) that was active
  when this bill was saved. This is frozen per-bill so historical data is
  never affected by later rate changes.
- `diesel_amount` (numeric, default 0): Company Diesel (liters) × diesel_rate.
  This is the monetary value of diesel provided by the company.
- `company_income` (numeric, default 0): (Tons × Rate Per Ton) + GST.
  The gross amount the company owes before deductions.
- `net_company_income` (numeric, default 0): company_income − diesel_amount.
  The net amount after deducting the diesel cost. (Advance is tracked
  separately via the existing `advance` and `net_receivable` fields.)

## Security
- No new tables. Existing RLS policies on settings and company_bills remain
  unchanged — the new columns inherit the same row-level access rules.

## Notes
1. The existing `diesel` column on company_bills is renamed conceptually to
   "Company Diesel (Liters)" — it stores liters, not rupees. We do NOT rename
   the column (data safety); the app updates its label and usage instead.
2. On save, the app reads the current diesel_rate from settings, multiplies
   by the liters entered, and stores both the rate and the resulting amount
   on the bill row — freezing them for that transaction.
*/

-- Add diesel_rate to settings
DO $$ BEGIN
  ALTER TABLE public.settings ADD COLUMN diesel_rate numeric NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add diesel_rate, diesel_amount, company_income, net_company_income to company_bills
DO $$ BEGIN
  ALTER TABLE public.company_bills ADD COLUMN diesel_rate numeric NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.company_bills ADD COLUMN diesel_amount numeric NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.company_bills ADD COLUMN company_income numeric NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.company_bills ADD COLUMN net_company_income numeric NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
