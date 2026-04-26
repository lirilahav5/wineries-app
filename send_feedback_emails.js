require('dotenv').config();
// Script to send feedback emails to all managers
// This can be called manually or via a webhook/trigger
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function sendFeedbackEmails(feedbackId, message, language) {
  console.log('Sending feedback emails to managers...\n');
  console.log(`Feedback ID: ${feedbackId}`);
  console.log(`Language: ${language}`);
  console.log(`Message: ${message.substring(0, 50)}...\n`);

  try {
    // Get all users from auth
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      throw usersError;
    }

    // Filter managers (users with role='manager' in user_metadata or app='management-app')
    const managers = users.filter(user => 
      user.user_metadata?.role === 'manager' || 
      user.user_metadata?.app === 'management-app'
    );

    if (managers.length === 0) {
      console.log('⚠️  No managers found in the system.');
      console.log('Make sure managers have user_metadata.role = "manager" or user_metadata.app = "management-app"');
      return;
    }

    console.log(`Found ${managers.length} manager(s):`);
    managers.forEach(manager => {
      console.log(`  - ${manager.email} (${manager.id})`);
    });
    console.log('');

    // Prepare email content
    const emailSubject = `New Feedback from WineME App - ${(language || 'EN').toUpperCase()}`;
    const emailBody = `
New feedback has been submitted to the WineME app:

Language: ${(language || 'EN').toUpperCase()}
Message:
${message}

---
This is an automated notification from the WineME feedback system.
You can view all feedback in the management app.
    `.trim();

    console.log('Email Subject:', emailSubject);
    console.log('Email Body:');
    console.log(emailBody);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  NOTE: This script only prepares the email content.');
    console.log('To actually send emails, you need to:');
    console.log('1. Set up an email service (Resend, SendGrid, Mailgun, etc.)');
    console.log('2. Or use Supabase Edge Functions with email integration');
    console.log('3. Or configure Supabase to send emails via SMTP');
    console.log('\nFor now, emails should be sent to:');
    managers.forEach(manager => {
      console.log(`  📧 ${manager.email}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // TODO: Integrate with email service
    // Example with Resend (uncomment and add your API key):
    /*
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY) {
      const resend = require('resend').Resend({ apiKey: RESEND_API_KEY });
      
      for (const manager of managers) {
        try {
          await resend.emails.send({
            from: 'noreply@wineme.com', // Change to your domain
            to: manager.email,
            subject: emailSubject,
            html: emailBody.replace(/\n/g, '<br>'),
          });
          console.log(`✅ Email sent to ${manager.email}`);
        } catch (err) {
          console.error(`❌ Failed to send email to ${manager.email}:`, err);
        }
      }
    }
    */

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// If called directly with arguments
if (process.argv.length >= 4) {
  const feedbackId = process.argv[2];
  const message = process.argv[3];
  const language = process.argv[4] || 'en';
  sendFeedbackEmails(feedbackId, message, language);
} else {
  console.log('Usage: node send_feedback_emails.js <feedback_id> <message> [language]');
  console.log('\nExample:');
  console.log('node send_feedback_emails.js 1 "App is not working" en');
}

module.exports = { sendFeedbackEmails };
