require('dotenv').config();
// Check current RLS policies on feedback table
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPolicies() {
  console.log('Checking current RLS policies...\n');

  try {
    // Try to query pg_policies to see what exists
    // This requires direct SQL access, so we'll use a workaround
    
    // Test insert with anon key
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!anonKey) {
      throw new Error('Missing SUPABASE_ANON_KEY in environment variables.');
    }
    const anonSupabase = createClient(supabaseUrl, anonKey);
    
    const { data, error } = await anonSupabase
      .from('feedback')
      .insert([{ message: 'test', language: 'en' }])
      .select();

    if (error) {
      console.log('❌ Still getting error:', error.message);
      console.log('   Code:', error.code);
      console.log('\nLet me try a different policy approach...\n');
      
      // Try creating a simpler policy
      console.log('Try this SQL instead (simpler version):\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`
-- First, disable RLS temporarily to check
ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;

-- Re-enable it
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Allow public feedback insert" ON feedback;
  DROP POLICY IF EXISTS "Allow managers to read feedback" ON feedback;
END $$;

-- Create a simple insert policy for anon
CREATE POLICY "feedback_insert_anon" ON feedback
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create insert policy for authenticated
CREATE POLICY "feedback_insert_auth" ON feedback
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create select policy for authenticated (managers)
CREATE POLICY "feedback_select_auth" ON feedback
  FOR SELECT
  TO authenticated
  USING (true);
      `);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } else {
      console.log('✅ Success! The policy is working now!');
      // Clean up
      if (data && data[0]) {
        await supabase.from('feedback').delete().eq('id', data[0].id);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkPolicies();
