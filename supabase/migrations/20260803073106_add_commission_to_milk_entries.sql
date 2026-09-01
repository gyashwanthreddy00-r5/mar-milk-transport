ALTER TABLE milk_entries
  ADD COLUMN IF NOT EXISTS commission_rate  numeric(10,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_amount numeric(10,2) NOT NULL DEFAULT 0;