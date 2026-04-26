// Test the HTML email template
const fetch = require('node-fetch');

const RESEND_API_KEY = 're_SWostRpx_JgQbyigGGMhBLht9F6Q7P84m';
const TEST_EMAIL = 'lahavliri5@gmail.com';
const TEST_MESSAGE = 'This is a test message to verify the email template works correctly.';

const emailSubject = `New Feedback from WineME App - EN`;
const emailBodyHTML = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #8B1D24; color: white; padding: 15px; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
    .message-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #8B1D24; border-radius: 4px; }
    .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">New Feedback from WineME App</h2>
    </div>
    <div class="content">
      <p><strong>Language:</strong> EN</p>
      <div class="message-box">
        <strong>User Message:</strong>
        <p style="margin-top: 10px; white-space: pre-wrap;">${TEST_MESSAGE.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
      </div>
    </div>
    <div class="footer">
      This is an automated notification from the WineME feedback system.
    </div>
  </div>
</body>
</html>
`.trim();

async function testEmail() {
  console.log('Testing HTML email template...\n');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: TEST_EMAIL,
        subject: emailSubject,
        html: emailBodyHTML,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('✅ Email sent successfully!');
      console.log('   Email ID:', result.id);
      console.log(`   Check your inbox at ${TEST_EMAIL}\n`);
    } else {
      console.error('❌ Failed to send email:');
      console.error('   Status:', response.status);
      console.error('   Error:', result);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testEmail();
