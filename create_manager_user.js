require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Supabase connection - using service_role key for admin operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}
const supabase = createClient(supabaseUrl, supabaseKey);

async function createManagerUser() {
  const email = 'lahavliri5@gmail.com';
  const password = 'LiriLahav28@';

  console.log('Creating manager user...');
  console.log(`Email: ${email}`);

  try {
    // Create the user using admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email so they can login immediately
      user_metadata: {
        role: 'manager',
        app: 'management-app'
      }
    });

    if (error) {
      console.error('Error creating user:', error);
      return;
    }

    console.log('\n✅ User created successfully!');
    console.log('User ID:', data.user.id);
    console.log('Email:', data.user.email);
    console.log('\nThe user can now login to the management app at:');
    console.log('http://localhost:3001/login');
    console.log(`\nEmail: ${email}`);
    console.log('Password: [the password you provided]');

  } catch (error) {
    console.error('Error:', error);
  }
}

createManagerUser();
