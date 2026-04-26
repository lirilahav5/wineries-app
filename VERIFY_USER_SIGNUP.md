# Verifying User Sign-Up in Database

## How User Data is Stored

When a user signs up through the management app, their data is automatically saved to Supabase's authentication system. Here's what happens:

### Automatic Database Storage

1. **User Account Creation**: When `supabase.auth.signUp()` is called, Supabase automatically:
   - Creates a new user in the `auth.users` table
   - Stores the email address
   - Hashes and stores the password securely
   - Sets a unique user ID (UUID)
   - Records the creation timestamp
   - Tracks email verification status

2. **User Metadata**: Additional data is stored in `user_metadata`:
   - Phone number (from the sign-up form)
   - Any other custom metadata you specify

### What Gets Stored

- **Email**: Stored in `auth.users.email`
- **Password**: Hashed and stored securely (never stored in plain text)
- **Phone Number**: Stored in `auth.users.user_metadata.phone`
- **User ID**: Auto-generated UUID in `auth.users.id`
- **Created At**: Timestamp in `auth.users.created_at`
- **Email Verified**: Status in `auth.users.email_confirmed_at`

## How to Verify Users in Database

### Method 1: Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** > **Users**
4. You'll see a list of all registered users with:
   - Email address
   - User ID
   - Created date
   - Email verification status
   - Last sign in
5. Click on any user to see full details including:
   - Phone number (in user_metadata)
   - All metadata
   - Authentication providers

### Method 2: Using the Verification Script

Run the verification script:

```bash
node check_users_database.js
```

This will provide instructions on how to verify users.

### Method 3: Check in Application Code

The sign-up process logs user creation details to the browser console. After a successful sign-up, check the browser console (F12) to see:

```
User created successfully: {
  id: "...",
  email: "...",
  phone: "...",
  created_at: "...",
  email_confirmed: false
}
```

## Testing Sign-Up

1. **Sign up a new user** through the management app
2. **Check the success message** - it confirms "Your details have been saved to the database"
3. **Check browser console** - user details are logged
4. **Verify in Supabase Dashboard** - user should appear in Authentication > Users

## Important Notes

- **Password Security**: Passwords are never stored in plain text. Supabase uses industry-standard hashing (bcrypt).
- **Email Verification**: Users must verify their email before they can sign in (if email verification is enabled).
- **Phone Number**: Stored in user metadata, accessible via `user.user_metadata.phone`.
- **Automatic Storage**: No additional code is needed - Supabase handles all database operations automatically.

## Troubleshooting

If a user doesn't appear in the database:

1. Check for errors in the browser console
2. Verify the sign-up completed successfully (check success message)
3. Check Supabase Dashboard for any errors
4. Ensure email verification email was sent (check spam folder)
5. Verify Supabase project settings allow new user sign-ups
