-- Fix RLS policies for feedback table
-- This allows anonymous users to insert feedback

-- Enable Row Level Security (if not already enabled)
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public feedback insert" ON feedback;
DROP POLICY IF EXISTS "Allow managers to read feedback" ON feedback;

-- Policy: Allow anyone (anon and authenticated) to insert feedback
CREATE POLICY "Allow public feedback insert" ON feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Only authenticated users (managers) can read feedback
CREATE POLICY "Allow managers to read feedback" ON feedback
  FOR SELECT
  TO authenticated
  USING (true);
