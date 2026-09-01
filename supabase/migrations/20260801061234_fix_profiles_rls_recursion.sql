/*
# Fix profiles RLS recursion

## Problem
The `admin_read_all_profiles` policy used a subquery on `profiles` inside a policy ON `profiles`,
which causes infinite RLS recursion. Every SELECT on `profiles` fails — including the own-profile
read that login depends on — so users see "profile could not be loaded" after authenticating.

## Fix
1. Create a `is_admin()` SECURITY DEFINER function that checks the caller's role without
   triggering RLS recursion (it runs with the owner's privileges, bypassing RLS).
2. Drop the recursive `admin_read_all_profiles` policy and recreate it using `is_admin()`.
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "admin_read_all_profiles" ON public.profiles;
CREATE POLICY "admin_read_all_profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin());
