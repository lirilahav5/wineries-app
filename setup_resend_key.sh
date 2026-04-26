#!/bin/bash
# Script to add Resend API key to Supabase Edge Functions
# Run: bash setup_resend_key.sh

echo "Setting up Resend API key in Supabase..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found."
    echo "Install it: npm install -g supabase"
    echo "Or add the key manually in Supabase Dashboard"
    exit 1
fi

# Set the secret
supabase secrets set RESEND_API_KEY=re_SWostRpx_JgQbyigGGMhBLht9F6Q7P84m

echo "✅ API key added! The Edge Function will now send emails automatically."
