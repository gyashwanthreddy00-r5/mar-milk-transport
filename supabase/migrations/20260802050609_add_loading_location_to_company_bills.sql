-- Add loading_location column to company_bills table
ALTER TABLE public.company_bills ADD COLUMN loading_location text NOT NULL DEFAULT '';
