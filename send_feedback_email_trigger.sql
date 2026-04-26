-- Function to get all manager emails and send notifications
-- This will be called by a trigger when feedback is inserted

-- First, create a function to notify managers via Edge Function
CREATE OR REPLACE FUNCTION notify_managers_on_feedback()
RETURNS TRIGGER AS $$
DECLARE
  manager_emails TEXT[];
  manager_email TEXT;
  feedback_message TEXT;
  feedback_language TEXT;
BEGIN
  -- Get the feedback details
  feedback_message := NEW.message;
  feedback_language := NEW.language;
  
  -- Get all manager emails from auth.users where role = 'manager'
  -- Note: We need to use the service_role key to access auth.users
  -- This will be done via Edge Function instead
  
  -- For now, we'll use pg_net to call an Edge Function
  -- But first, let's create a simpler approach using a webhook
  
  -- Return the new row
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after feedback is inserted
DROP TRIGGER IF EXISTS feedback_notification_trigger ON feedback;
CREATE TRIGGER feedback_notification_trigger
  AFTER INSERT ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION notify_managers_on_feedback();

-- Note: The actual email sending will be handled by a Supabase Edge Function
-- because we need to access auth.users which requires admin privileges
