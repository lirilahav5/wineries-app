// Test script to verify email sending works with Resend
// Using built-in fetch (Node 18+) or node-fetch as fallback
let fetch;
try {
  fetch = globalThis.fetch || require('node-fetch');
} catch {
  fetch = require('node-fetch');
}

const RESEND_API_KEY = 're_SWostRpx_JgQbyigGGMhBLht9F6Q7P84m';
const TEST_EMAIL = 'lahavliri5@gmail.com';

async function testEmailSending() {
  console.log('Testing email sending with Resend...\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev', // Resend's default test domain
        to: TEST_EMAIL,
        subject: 'Test Email from WineME Feedback System',
        html: `
          <h2>Test Email</h2>
          <p>This is a test email from the WineME feedback system.</p>
          <p>If you received this, email sending is working correctly!</p>
        `,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Email sent successfully!');
      console.log('   Email ID:', result.id);
      console.log(`   Check your inbox at ${TEST_EMAIL}\n`);
      console.log('🎉 Email service is working! Now add the API key to Supabase Edge Functions.');
    } else {
      console.error('❌ Failed to send email:');
      console.error('   Status:', response.status);
      console.error('   Error:', result);
      
      if (result.message?.includes('domain')) {
        console.log('\n⚠️  You need to verify a domain in Resend.');
        console.log('   Go to: https://resend.com/domains');
        console.log('   Add and verify your domain, then use: from: "noreply@yourdomain.com"');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEmailSending();
