-- Setup email notifications for feedback
-- This creates a database trigger that calls a function to notify managers

-- First, enable pg_net extension if not already enabled (for HTTP calls)
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a function that will be called when feedback is inserted
-- This function will trigger the email sending via Edge Function or webhook
CREATE OR REPLACE FUNCTION notify_managers_on_feedback()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url TEXT;
  payload JSONB;
BEGIN
  -- Prepare the payload
  payload := jsonb_build_object(
    'feedback_id', NEW.id,
    'message', NEW.message,
    'language', NEW.language
  );
  
  -- Call the Edge Function via HTTP
  -- Note: Replace with your actual Edge Function URL
  edge_function_url := 'https://hxbwusvxjxsgprexthml.supabase.co/functions/v1/send-feedback-email';
  
  -- Use pg_net to make HTTP request (requires pg_net extension)
  -- PERFORM net.http_post(
  --   url := edge_function_url,
  --   headers := jsonb_build_object(
  --     'Content-Type', 'application/json',
  --     'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
  --   ),
  --   body := payload::text
  -- );
  
  -- For now, we'll use a simpler approach: log the feedback
  -- The actual email sending will be handled by the Edge Function
  -- which can be called directly from the app after feedback insertion
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger that fires after feedback is inserted
DROP TRIGGER IF EXISTS feedback_notification_trigger ON feedback;
CREATE TRIGGER feedback_notification_trigger
  AFTER INSERT ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION notify_managers_on_feedback();

-- Note: The actual email sending is currently handled in the app code
-- (WineriesMap.tsx) which calls the Edge Function after inserting feedback.
-- This trigger is set up for future use if you want to move email sending
-- entirely to the database level.
