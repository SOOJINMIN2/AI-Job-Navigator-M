-- fix_permission_denied.sql
-- Run this in your Supabase SQL Editor to fix the "permission denied for table users" error

-- 1. Redefine get_my_role() to use plpgsql and explicitly set search_path
-- Using SQL language can sometimes inline the function and lose SECURITY DEFINER context.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Explicitly grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;

-- 3. Ensure the 'Users can view own profile' policy exists and is correct
-- This acts as a fallback if the function needs explicit table access
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (id = auth.uid());
