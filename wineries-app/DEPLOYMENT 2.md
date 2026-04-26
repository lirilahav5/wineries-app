# Deployment Guide for wineME App

## Quick Deployment Options

### Option 1: Vercel (Recommended - Free & Easy)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Deploy from the wineries-app folder**:
   ```bash
   cd wineries-app
   vercel
   ```

3. **Follow the prompts:**
   - Login or create account
   - Link to existing project or create new
   - Deploy!

4. **Your app will be live at**: `https://your-app-name.vercel.app`

### Option 2: Netlify (Free & Easy)

1. **Install Netlify CLI**:
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy**:
   ```bash
   cd wineries-app
   netlify deploy --prod
   ```

3. **Or drag and drop the `dist` folder** to https://app.netlify.com/drop

### Option 3: GitHub Pages

1. Push your code to GitHub
2. Go to Settings > Pages
3. Select source: GitHub Actions
4. The app will be available at: `https://yourusername.github.io/wineries-app`

## Installing on Smartphone

### Method 1: Install as PWA (Progressive Web App)

1. **Open the deployed app** in your smartphone browser (Chrome/Safari)
2. **Look for the "Add to Home Screen" prompt** or:
   - **Android (Chrome)**: Menu (3 dots) > "Add to Home Screen"
   - **iOS (Safari)**: Share button > "Add to Home Screen"
3. The app will install and appear like a native app!

### Method 2: Access via Browser

Simply open the deployed URL in your smartphone browser and bookmark it.

## Building for Production

The app is already built! The production files are in the `dist` folder.

To rebuild:
```bash
cd wineries-app
npm run build
```

## Testing Locally Before Deployment

1. **Preview the production build**:
   ```bash
   cd wineries-app
   npm run preview
   ```

2. **Access on your phone**:
   - Find your computer's IP address (e.g., `ipconfig` on Windows)
   - On your phone, go to: `http://YOUR_IP:4173`
   - Make sure both devices are on the same WiFi network

## Important Notes

- The app uses Supabase for data, so make sure your Supabase project is accessible
- For production, you may need to configure CORS settings in Supabase
- The app requires location permissions to show distances
