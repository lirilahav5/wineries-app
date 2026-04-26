# Add Resend API Key to Supabase

## Steps:

1. Go to Supabase Dashboard:
   https://supabase.com/dashboard/project/hxbwusvxjxsgprexthml/settings/functions

2. Scroll down to "Edge Function Secrets" or "Environment Variables"

3. Click "Add new secret" or "Add environment variable"

4. Enter:
   - **Name**: `RESEND_API_KEY`
   - **Value**: `re_SWostRpx_JgQbyigGGMhBLht9F6Q7P84m`

5. Click "Save" or "Add"

6. The Edge Function will automatically use this key when called.

## Alternative: If you can't find the settings page

You can also add it via Supabase CLI:
```bash
supabase secrets set RESEND_API_KEY=re_SWostRpx_JgQbyigGGMhBLht9F6Q7P84m
```

But you need to be logged in to Supabase CLI first.
