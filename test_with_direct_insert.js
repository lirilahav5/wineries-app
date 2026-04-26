require('dotenv').config();
// Test inserting directly and check what happens
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !anonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables.');
}
const supabase = createClient(supabaseUrl, anonKey);

async function testDirectInsert() {
  console.log('Testing direct insert...\n');
  console.log('Using anon key (first 20 chars):', anonKey.substring(0, 20) + '...\n');
  
  try {
    // Try a simple insert
    const { data, error } = await supabase
      .from('feedback')
      .insert({
        message: 'Direct test',
        language: 'en'
      })
      .select();
    
    if (error) {
      console.error('❌ Error details:');
      console.error('   Message:', error.message);
      console.error('   Code:', error.code);
      console.error('   Details:', error.details);
      console.error('   Hint:', error.hint);
      
      if (error.code === '42501') {
        console.log('\n⚠️  RLS is still blocking. Try this:');
        console.log('   1. Run fix_feedback_rls_aggressive.sql in Supabase');
        console.log('   2. OR temporarily disable RLS: ALTER TABLE feedback DISABLE ROW LEVEL SECURITY;');
        console.log('   3. Then test again\n');
      }
      return;
    }
    
    console.log('✅ SUCCESS! Insert worked!');
    console.log('   Inserted ID:', data[0].id);
    console.log('   Message:', data[0].message);
    
    // Clean up
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in environment variables.');
    }
    const adminSupabase = createClient(supabaseUrl, serviceKey);
    await adminSupabase.from('feedback').delete().eq('id', data[0].id);
    console.log('✅ Test data cleaned up.\n');
    console.log('🎉 Everything is working! Your app should work now.');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

testDirectInsert();
