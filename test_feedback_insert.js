require('dotenv').config();
// Test if feedback insert works with anon key
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !anonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables.');
}
const supabase = createClient(supabaseUrl, anonKey);

async function testFeedbackInsert() {
  console.log('Testing feedback insert with anon key...\n');
  
  try {
    const { data, error } = await supabase
      .from('feedback')
      .insert([{ message: 'Test feedback', language: 'en' }])
      .select();
    
    if (error) {
      console.error('❌ Error:', error.message);
      console.error('   Code:', error.code);
      if (error.code === '42501') {
        console.log('\n⚠️  RLS policy issue. Please run fix_feedback_rls_policies.sql in Supabase SQL Editor.');
      }
      return;
    }
    
    console.log('✅ Success! Feedback inserted:', data[0].id);
    
    // Clean up
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.');
    }
    const adminSupabase = createClient(supabaseUrl, serviceKey);
    await adminSupabase.from('feedback').delete().eq('id', data[0].id);
    console.log('✅ Test data cleaned up.\n');
    console.log('🎉 Everything is working! You can now submit feedback from the app.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testFeedbackInsert();
