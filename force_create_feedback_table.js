require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Supabase connection - using service_role key for admin operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function forceCreateFeedbackTable() {
  console.log('Force creating feedback table...\n');

  const sqlCommands = `
-- Create feedback table for user feedback/reports
CREATE TABLE IF NOT EXISTS feedback (
  id BIGSERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  language VARCHAR(10),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

-- Enable Row Level Security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public feedback insert" ON feedback;
DROP POLICY IF EXISTS "Allow managers to read feedback" ON feedback;

-- Policy: Allow anyone to insert feedback (users can submit)
CREATE POLICY "Allow public feedback insert" ON feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Only authenticated users (managers) can read feedback
CREATE POLICY "Allow managers to read feedback" ON feedback
  FOR SELECT
  TO authenticated
  USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_read ON feedback(read);
`;

  try {
    // Try to query the table first
    const { error: checkError } = await supabase
      .from('feedback')
      .select('id')
      .limit(1);

    if (checkError) {
      if (checkError.code === '42P01' || checkError.message?.includes('does not exist') || checkError.message?.includes('relation')) {
        console.log('❌ Table does not exist. Creating it now...\n');
        console.log('⚠️  Cannot create table directly via JavaScript client.');
        console.log('Please run this SQL in Supabase SQL Editor:\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(sqlCommands);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📝 Steps:');
        console.log('   1. Go to: https://supabase.com/dashboard/project/hxbwusvxjxsgprexthml');
        console.log('   2. Click "SQL Editor" in the left sidebar');
        console.log('   3. Click "New query" button');
        console.log('   4. Copy and paste the SQL above');
        console.log('   5. Click "Run" button (or press Ctrl+Enter)\n');
        return;
      } else {
        console.error('❌ Error checking table:', checkError);
        return;
      }
    }

    // Table exists - test insert with anon key to verify permissions
    console.log('✅ Table exists! Testing with anon key...\n');
    
    // Create a client with anon key to test permissions
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!anonKey) {
      throw new Error('Missing SUPABASE_ANON_KEY in environment variables.');
    }
    const anonSupabase = createClient(supabaseUrl, anonKey);
    
    const { data: testData, error: insertError } = await anonSupabase
      .from('feedback')
      .insert([{ message: 'test', language: 'en' }])
      .select();

    if (insertError) {
      console.error('❌ Error inserting with anon key:', insertError);
      console.log('\n⚠️  The table exists but there may be a permissions issue.');
      console.log('The error suggests:', insertError.message);
      
      if (insertError.code === '42501' || insertError.message?.includes('policy') || insertError.message?.includes('permission')) {
        console.log('\n📝 The RLS policies may need to be recreated. Run this SQL:\n');
        console.log('ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;');
        console.log('DROP POLICY IF EXISTS "Allow public feedback insert" ON feedback;');
        console.log('CREATE POLICY "Allow public feedback insert" ON feedback');
        console.log('  FOR INSERT TO anon, authenticated WITH CHECK (true);\n');
      }
      return;
    }

    // Clean up test data
    if (testData && testData[0]) {
      await supabase.from('feedback').delete().eq('id', testData[0].id);
      console.log('✅ Test insert successful! Table is working correctly.\n');
    }

    console.log('✅ Everything is working! The table exists and has correct permissions.');
    console.log('If you\'re still seeing the error, try:');
    console.log('   1. Hard refresh the browser (Ctrl+Shift+R or Cmd+Shift+R)');
    console.log('   2. Clear browser cache');
    console.log('   3. Restart the dev server\n');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

forceCreateFeedbackTable();
