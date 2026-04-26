# PowerShell script to add Resend API key to Supabase Edge Functions
# Run: .\setup_resend_key.ps1

Write-Host "Setting up Resend API key in Supabase..." -ForegroundColor Cyan

# Check if supabase CLI is installed
$supabaseInstalled = Get-Command supabase -ErrorAction SilentlyContinue

if (-not $supabaseInstalled) {
    Write-Host "❌ Supabase CLI not found." -ForegroundColor Red
    Write-Host "Install it: npm install -g supabase" -ForegroundColor Yellow
    Write-Host "Or add the key manually in Supabase Dashboard:" -ForegroundColor Yellow
    Write-Host "   https://supabase.com/dashboard/project/hxbwusvxjxsgprexthml/settings/functions" -ForegroundColor Cyan
    exit 1
}

# Set the secret
Write-Host "Adding API key..." -ForegroundColor Yellow
supabase secrets set RESEND_API_KEY=re_SWostRpx_JgQbyigGGMhBLht9F6Q7P84m

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ API key added! The Edge Function will now send emails automatically." -ForegroundColor Green
} else {
    Write-Host "❌ Failed to add key. You may need to login first: supabase login" -ForegroundColor Red
}
