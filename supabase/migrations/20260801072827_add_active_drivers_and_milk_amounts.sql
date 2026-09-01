-- Add is_active flag to drivers table
DO $$ BEGIN
  ALTER TABLE public.drivers ADD COLUMN is_active boolean NOT NULL DEFAULT true;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Add purchase_amount and selling_amount to milk_entries
DO $$ BEGIN
  ALTER TABLE public.milk_entries ADD COLUMN purchase_amount numeric NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.milk_entries ADD COLUMN selling_amount numeric NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Back-fill computed values for existing rows
UPDATE public.milk_entries
SET
  purchase_amount = COALESCE(purchase_rate, 0) * COALESCE(quantity, 0),
  selling_amount  = COALESCE(selling_rate, 0)  * COALESCE(quantity, 0)
WHERE purchase_amount = 0 OR selling_amount = 0;
