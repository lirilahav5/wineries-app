-- Simple fix for feedback RLS policies
-- Run this in Supabase SQL Editor

-- First, disable RLS temporarily
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;

-- Re-enable it
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies (using DO block to handle errors)
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow public feedback insert" ON feedback;
  DROP POLICY IF EXISTS "Allow managers to read feedback" ON feedback;
  DROP POLICY IF EXISTS "feedback_insert_anon" ON feedback;
  DROP POLICY IF EXISTS "feedback_insert_auth" ON feedback;
  DROP POLICY IF EXISTS "feedback_select_auth" ON feedback;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create a simple insert policy for anon users
CREATE POLICY "feedback_insert_anon" ON feedback
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create insert policy for authenticated users
CREATE POLICY "feedback_insert_auth" ON feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create select policy for authenticated users (managers)
CREATE POLICY "feedback_select_auth" ON feedback
  FOR SELECT
  TO authenticated
  USING (true);
