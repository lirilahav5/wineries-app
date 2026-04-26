require('dotenv').config();
// Simple script to send feedback email using Node.js
// This can be used as a fallback if Edge Functions aren't working
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.');
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function sendFeedbackEmail(feedbackId) {
  console.log('Getting feedback and manager emails...\n');

  try {
    // Get the feedback
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .select('*')
      .eq('id', feedbackId)
      .single();

    if (feedbackError || !feedback) {
      console.error('Error getting feedback:', feedbackError);
      return;
    }

    // Get all manager emails
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      throw usersError;
    }

    // Filter managers
    const managers = users.filter(user => 
      user.user_metadata?.role === 'manager' || 
      user.user_metadata?.app === 'management-app' ||
      user.email === 'lahavliri5@gmail.com' // Include your email
    );

    if (managers.length === 0) {
      console.log('⚠️  No managers found.');
      return;
    }

    console.log(`Found ${managers.length} manager(s):`);
    managers.forEach(m => console.log(`  - ${m.email}`));
    console.log('');

    const emailSubject = `New Feedback from WineME App - ${(feedback.language || 'EN').toUpperCase()}`;
    const emailBody = `
New feedback has been submitted to the WineME app:

Language: ${(feedback.language || 'EN').toUpperCase()}
Message:
${feedback.message}

---
This is an automated notification from the WineME feedback system.
You can view all feedback in the management app.
    `.trim();

    console.log('Email Subject:', emailSubject);
    console.log('Email Body:');
    console.log(emailBody);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  To actually send emails, you need to:');
    console.log('   1. Set up Resend (https://resend.com) - free tier available');
    console.log('   2. Or configure Supabase SMTP');
    console.log('   3. Or use another email service');
    console.log('\nFor now, the email content is prepared above.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // If you have Resend API key, uncomment below:
    /*
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (RESEND_API_KEY) {
      const { Resend } = require('resend');
      const resend = new Resend(RESEND_API_KEY);
      
      for (const manager of managers) {
        try {
          await resend.emails.send({
            from: 'noreply@wineme.com', // Change to your verified domain
            to: manager.email,
            subject: emailSubject,
            html: emailBody.replace(/\n/g, '<br>'),
          });
          console.log(`✅ Email sent to ${manager.email}`);
        } catch (err) {
          console.error(`❌ Failed to send to ${manager.email}:`, err);
        }
      }
    }
    */

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Get feedback ID from command line or use latest
if (process.argv[2]) {
  sendFeedbackEmail(parseInt(process.argv[2]));
} else {
  // Get latest feedback
  supabase
    .from('feedback')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
    .then(({ data, error }) => {
      if (data) {
        sendFeedbackEmail(data.id);
      } else {
        console.log('No feedback found. Usage: node send_email_simple.js <feedback_id>');
      }
    });
}
