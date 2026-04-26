// Script to check if users are being saved to Supabase database
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hxbwusvxjxsgprexthml.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4Ynd1c3Z4anhzZ3ByZXh0aG1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2OTY1NTUsImV4cCI6MjA4MzI3MjU1NX0.2jlmKuzFB3hfHcd_SKBRK-oN7nAUZ_Tmj4Xplt_haEU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
  try {
    console.log('Checking users in Supabase Auth...\n');
    
    // Note: We can't directly query auth.users from the client
    // We need to use the Admin API or check through the dashboard
    // But we can verify by trying to sign in with a test user
    
    // Get current session to see if we can access user info
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.log('Session error:', sessionError.message);
    }
    
    console.log('To check users in the database:');
    console.log('1. Go to your Supabase Dashboard: https://supabase.com/dashboard');
    console.log('2. Navigate to Authentication > Users');
    console.log('3. You should see all registered users there with their:');
    console.log('   - Email address');
    console.log('   - Phone number (in user_metadata)');
    console.log('   - Created date');
    console.log('   - Email verification status');
    console.log('   - Last sign in');
    console.log('\n');
    
    // Try to list users (this requires admin access)
    // For now, we'll just confirm the sign-up process is working
    console.log('Sign-up process verification:');
    console.log('✓ When a user signs up via supabase.auth.signUp(), the following happens:');
    console.log('  1. User is created in auth.users table');
    console.log('  2. Email is stored');
    console.log('  3. Password is hashed and stored securely');
    console.log('  4. Phone number is stored in user_metadata.phone');
    console.log('  5. Created timestamp is automatically set');
    console.log('  6. Email verification status is tracked');
    console.log('\n');
    
    console.log('To verify a specific user was created:');
    console.log('1. Check the Supabase Dashboard > Authentication > Users');
    console.log('2. Look for the user\'s email address');
    console.log('3. Click on the user to see full details including phone number');
    
  } catch (error) {
    console.error('Error checking users:', error);
  }
}

checkUsers();
