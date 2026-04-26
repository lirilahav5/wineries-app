-- Aggressive fix - completely reset RLS and create permissive policies
-- Run this in Supabase SQL Editor

-- Step 1: Disable RLS completely
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL policies (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Allow public feedback insert" ON feedback;
DROP POLICY IF EXISTS "Allow managers to read feedback" ON feedback;
DROP POLICY IF EXISTS "feedback_insert_anon" ON feedback;
DROP POLICY IF EXISTS "feedback_insert_auth" ON feedback;
DROP POLICY IF EXISTS "feedback_select_auth" ON feedback;

-- Step 3: Re-enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Step 4: Create a VERY permissive insert policy for anon
-- This allows ANY insert from anonymous users
CREATE POLICY "anon_insert_all" ON feedback
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Step 5: Create insert policy for authenticated
CREATE POLICY "auth_insert_all" ON feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Step 6: Create select policy for authenticated (managers can read)
CREATE POLICY "auth_select_all" ON feedback
  FOR SELECT
  TO authenticated
  USING (true);

-- Verify: Check if policies were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'feedback';
