/*
# Add Company Bill Link and Diesel/Profit Fields to MAR Bills

## Overview
This migration reworks the MAR Bills module so each MAR Bill links to a
Company Bill. The linked Company Bill provides read-only reference data
(vehicle, date, driver, tons, rate, company income, diesel liters, diesel
rate, diesel amount). The MAR Bill auto-calculates diesel cost and trip
profit from the linked data — the user never types a diesel rate manually.

## Changes to `mar_bills` table
- `company_bill_id` (uuid, nullable): foreign key to company_bills.id.
  Links this MAR bill to its source Company Bill for reference data.
- `diesel_rate` (numeric, default 0): the diesel rate snapshot copied from
  the linked Company Bill at save time. Frozen per-record for historical
  data protection.
- `net_company_income` (numeric, default 0): the net company income snapshot
  copied from the linked Company Bill. Used as the income side of the trip
  profit formula.
- `trip_profit` (numeric, default 0): now stored explicitly (column already
  exists, but we ensure it's present and has a default).

## Trip Profit Formula
  Trip Profit = Net Company Income
              - Driver Wage
              - Diesel Cost (Diesel Liters x Diesel Rate)
              - Toll Charges
              - Waiting Charges
              - Other Charges
              - Maintenance Charges

The existing `trip_income` column is retained for backward compatibility
but the new profit calculation uses `net_company_income` as the income
source instead of a manually-entered trip income.

## Security
- No new tables. Existing RLS policies on mar_bills remain unchanged.
- The foreign key references company_bills which has the same owner-scoped
  RLS, so users can only link to their own Company Bills.

## Notes
1. The diesel_rate and net_company_income are snapshots — copied from the
   linked Company Bill when the MAR Bill is saved. If the diesel rate
   changes in Settings later, existing MAR Bills are never recalculated.
2. The existing `trip_income` column is kept (data safety) but the app now
   uses `net_company_income` as the income source for trip profit.
*/

-- Add company_bill_id foreign key
DO $$ BEGIN
  ALTER TABLE public.mar_bills ADD COLUMN company_bill_id uuid REFERENCES public.company_bills(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add diesel_rate snapshot
DO $$ BEGIN
  ALTER TABLE public.mar_bills ADD COLUMN diesel_rate numeric NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add net_company_income snapshot
DO $$ BEGIN
  ALTER TABLE public.mar_bills ADD COLUMN net_company_income numeric NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Ensure trip_profit has a default (column already exists)
DO $$ BEGIN
  ALTER TABLE public.mar_bills ALTER COLUMN trip_profit SET DEFAULT 0;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Index for looking up MAR bills by company bill
CREATE INDEX IF NOT EXISTS idx_mar_bills_company_bill_id ON public.mar_bills(company_bill_id);
