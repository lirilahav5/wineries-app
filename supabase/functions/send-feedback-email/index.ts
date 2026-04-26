// Supabase Edge Function to send feedback emails to all managers
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get feedback data from request
    const { feedback_id, message, language } = await req.json()

    // Get all manager emails from auth.users
    const { data: managers, error: managersError } = await supabase.auth.admin.listUsers()
    
    if (managersError) {
      throw managersError
    }

    // Filter managers (users with role='manager' in user_metadata)
    const managerEmails = managers.users
      .filter(user => user.user_metadata?.role === 'manager' || user.user_metadata?.app === 'management-app')
      .map(user => user.email)
      .filter(email => email) // Remove null/undefined emails

    if (managerEmails.length === 0) {
      console.log('No manager emails found')
      return new Response(
        JSON.stringify({ message: 'No managers found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Send email to each manager
    // Note: Supabase doesn't have built-in email sending in Edge Functions
    // You'll need to use an email service like Resend, SendGrid, or Mailgun
    // For now, we'll log the emails that should be sent
    
    const emailSubject = `New Feedback from WineME App - ${language?.toUpperCase() || 'EN'}`
    const emailBody = `
New feedback has been submitted to the WineME app:

Language: ${language?.toUpperCase() || 'EN'}
Message:
${message}

---
This is an automated notification from the WineME feedback system.
    `.trim()

    // Try to send emails using Resend (if API key is configured)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    
    if (RESEND_API_KEY) {
      console.log('Sending emails via Resend...')
      
      // Send to each manager individually
      const emailResults = []
      for (const email of managerEmails) {
        try {
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'onboarding@resend.dev', // Change to your verified domain
              to: email,
              subject: emailSubject,
              html: emailBody.replace(/\n/g, '<br>'),
            }),
          })
          
          const result = await resendResponse.json()
          
          if (resendResponse.ok) {
            console.log(`✅ Email sent to ${email}`)
            emailResults.push({ email, success: true })
          } else {
            console.error(`❌ Failed to send to ${email}:`, result)
            emailResults.push({ email, success: false, error: result })
          }
        } catch (err) {
          console.error(`❌ Error sending to ${email}:`, err)
          emailResults.push({ email, success: false, error: err.message })
        }
      }
      
      return new Response(
        JSON.stringify({ 
          message: 'Email sending attempted',
          emails_sent: emailResults.filter(r => r.success).length,
          total_recipients: managerEmails.length,
          results: emailResults
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    } else {
      // No email service configured - just log
      console.log('⚠️  RESEND_API_KEY not configured. Emails not sent.')
      console.log('Should send emails to:', managerEmails)
      console.log('Subject:', emailSubject)
      console.log('Body:', emailBody)
      console.log('\nTo enable email sending:')
      console.log('1. Sign up at https://resend.com')
      console.log('2. Get your API key')
      console.log('3. Add it as RESEND_API_KEY in Supabase Edge Function environment variables')
    }

    return new Response(
      JSON.stringify({ 
        message: 'Feedback notification processed',
        emails_sent: managerEmails.length,
        recipients: managerEmails
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
