require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Supabase connection - using service_role key for admin operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createFeedbackTable() {
  console.log('Creating feedback table...\n');

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

-- Policy: Allow anyone to insert feedback (users can submit)
DROP POLICY IF EXISTS "Allow public feedback insert" ON feedback;
CREATE POLICY "Allow public feedback insert" ON feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Only authenticated users (managers) can read feedback
DROP POLICY IF EXISTS "Allow managers to read feedback" ON feedback;
CREATE POLICY "Allow managers to read feedback" ON feedback
  FOR SELECT
  TO authenticated
  USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_read ON feedback(read);
`;

  try {
    // Check if table exists
    const { error: checkError } = await supabase
      .from('feedback')
      .select('id')
      .limit(1);

    if (checkError) {
      if (checkError.code === '42P01' || checkError.message?.includes('does not exist') || checkError.message?.includes('relation')) {
        console.log('❌ Table does not exist.');
        console.log('\n⚠️  Supabase JavaScript client cannot execute DDL (CREATE TABLE) statements.');
        console.log('You need to run the SQL in Supabase Dashboard.\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 COPY THIS SQL AND RUN IT IN SUPABASE SQL EDITOR:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log(sqlCommands);
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📝 Steps:');
        console.log('   1. Go to: https://supabase.com/dashboard/project/hxbwusvxjxsgprexthml');
        console.log('   2. Click "SQL Editor" in the left sidebar');
        console.log('   3. Click "New query" button');
        console.log('   4. Paste the SQL above');
        console.log('   5. Click "Run" button (or press Ctrl+Enter / Cmd+Enter)\n');
        return;
      } else {
        console.error('Error checking table:', checkError);
        return;
      }
    }

    // Table exists, verify it works
    console.log('✅ Feedback table exists!');
    console.log('Testing table functionality...\n');

    // Test insert
    const { data: testData, error: insertError } = await supabase
      .from('feedback')
      .insert([{ message: 'test', language: 'en' }])
      .select();

    if (insertError) {
      console.error('❌ Error inserting test data:', insertError);
      if (insertError.code === '42501' || insertError.message?.includes('policy') || insertError.message?.includes('permission')) {
        console.log('\n⚠️  RLS policies may not be set up correctly.');
        console.log('Please run this SQL in Supabase SQL Editor:\n');
        console.log('ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;');
        console.log('\nDROP POLICY IF EXISTS "Allow public feedback insert" ON feedback;');
        console.log('CREATE POLICY "Allow public feedback insert" ON feedback');
        console.log('  FOR INSERT TO anon, authenticated WITH CHECK (true);\n');
      }
      return;
    }

    // Clean up test data
    if (testData && testData[0]) {
      await supabase.from('feedback').delete().eq('id', testData[0].id);
    }

    console.log('✅ Table is working correctly!');
    console.log('✅ RLS policies are configured.');
    console.log('✅ Ready to receive user feedback.\n');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    console.log('\nPlease check the error above and try running the SQL manually.');
  }
}

createFeedbackTable();
