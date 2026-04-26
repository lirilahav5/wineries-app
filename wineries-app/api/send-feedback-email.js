import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!RESEND_API_KEY) {
    res.status(500).json({ error: 'Missing RESEND_API_KEY' });
    return;
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    return;
  }

  const { message } = req.body || {};
  if (!message || typeof message !== 'string') {
    res.status(400).json({ error: 'Missing message' });
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let managerEmails = [];
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) {
      throw error;
    }
    managerEmails = (data?.users || [])
      .map((user) => user.email)
      .filter(Boolean);
  } catch (err) {
    console.error('Failed to load manager emails from Supabase:', err);
  }

  if (managerEmails.length === 0) {
    const managerEmailsEnv = process.env.MANAGER_EMAILS;
    managerEmails = managerEmailsEnv
      ? managerEmailsEnv.split(',').map((email) => email.trim()).filter(Boolean)
      : [];
  }

  if (managerEmails.length === 0) {
    res.status(500).json({ error: 'No manager emails configured' });
    return;
  }

  const emailSubject = 'New Place Suggestion from WineME App';
  const safeMessage = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
      <div class="message-box">
        <strong>User Message:</strong>
        <p style="margin-top: 10px; white-space: pre-wrap;">${safeMessage}</p>
      </div>
    </div>
    <div class="footer">
      This is an automated notification from the WineME feedback system.
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: managerEmails,
        subject: emailSubject,
        html: emailBodyHTML
      })
    });

    const data = await response.json();
    if (!response.ok) {
      res.status(response.status).json({ error: data });
      return;
    }

    res.status(200).json({ id: data.id, recipients: managerEmails.length });
  } catch (error) {
    res.status(500).json({ error: error?.message || 'Email send failed' });
  }
}
