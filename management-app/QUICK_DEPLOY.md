# Quick Deploy Guide - Management App

## Deploy to Vercel (Recommended - 2 minutes)

### Step 1: Login to Vercel
```bash
cd management-app
vercel login
```

### Step 2: Deploy
```bash
vercel --prod
```

Follow the prompts:
- **Link to existing project?** → Choose `N` (create new)
- **Project name?** → Press Enter (or type a name like `wineme-management`)
- **Directory?** → Press Enter (uses current directory)
- **Override settings?** → Press Enter (uses vercel.json)

### Step 3: Access Your App
After deployment, you'll get a URL like:
- `https://your-app-name.vercel.app`

**That's it!** Your app is live! 🎉

---

## Install on Your Phone

### Method 1: Add to Home Screen (PWA)
1. Open the deployed URL in your phone's browser (Chrome/Safari)
2. **Android**: Tap menu (3 dots) → "Add to Home Screen"
3. **iOS**: Tap Share button → "Add to Home Screen"
4. The app will appear like a native app!

### Method 2: Bookmark
Simply bookmark the URL in your browser for quick access.

---

## Alternative: Deploy to Netlify

### Step 1: Install Netlify CLI
```bash
npm install -g netlify-cli
```

### Step 2: Login
```bash
netlify login
```

### Step 3: Deploy
```bash
cd management-app
netlify deploy --prod
```

---

## Important Notes

- The management app requires authentication (login)
- Make sure your Supabase project allows connections from your deployment URL
- Keep the deployment URL secure - this is an admin interface!
