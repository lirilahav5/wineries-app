# Setting Up Email Notifications for Feedback

The feedback system is working, but emails aren't being sent yet. You need to configure an email service.

## Option 1: Use Supabase SMTP (Easiest if already configured)

If you have SMTP configured in Supabase:
1. Go to Supabase Dashboard → Settings → Auth → SMTP Settings
2. Make sure SMTP is configured
3. The Edge Function can use Supabase's email API

## Option 2: Use Resend (Recommended - Free tier available)

1. Sign up at https://resend.com (free tier: 3,000 emails/month)
2. Get your API key
3. Add it as an environment variable in Supabase:
   - Go to Supabase Dashboard → Project Settings → Edge Functions
   - Add environment variable: `RESEND_API_KEY` = your API key
4. Update the Edge Function to use Resend (code is already there, just needs to be uncommented)

## Option 3: Use SendGrid, Mailgun, or other email service

Similar to Resend, but different API.

## Quick Test

To test if emails are being sent, check the Supabase Edge Function logs:
1. Go to Supabase Dashboard → Edge Functions → send-feedback-email
2. Check the logs to see if the function is being called
3. Look for any errors
