require('dotenv').config();
// Fix RLS policies directly using service role key
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixRLSPolicies() {
  console.log('Fixing RLS policies for feedback table...\n');

  // Read the SQL file
  const fs = require('fs');
  const sql = fs.readFileSync('fix_feedback_rls_policies.sql', 'utf8');

  console.log('SQL to execute:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(sql);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('⚠️  Supabase JavaScript client cannot execute DDL statements directly.');
  console.log('You MUST run this SQL in Supabase SQL Editor:\n');
  console.log('📝 Steps:');
  console.log('   1. Open: https://supabase.com/dashboard/project/hxbwusvxjxsgprexthml/sql/new');
  console.log('   2. Copy the SQL above (between the lines)');
  console.log('   3. Paste it into the SQL Editor');
  console.log('   4. Click "Run" (or press Ctrl+Enter)\n');
  console.log('After running, test again with: node test_feedback_insert.js\n');

  // Try to verify current policies by checking if we can insert with service role
  console.log('Verifying table access...');
  const { data: testData, error: testError } = await supabase
    .from('feedback')
    .insert([{ message: 'test', language: 'en' }])
    .select();

  if (testError) {
    console.error('❌ Even service role cannot insert:', testError.message);
  } else {
    console.log('✅ Service role can insert (this is expected)');
    // Clean up
    if (testData && testData[0]) {
      await supabase.from('feedback').delete().eq('id', testData[0].id);
    }
  }
}

fixRLSPolicies();
