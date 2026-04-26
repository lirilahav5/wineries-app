# Icon Setup Guide

## Current Setup
The app uses SVG logos which work great for modern browsers and PWAs.

## Logo Files
- `logo.svg` - Main logo (wine bottle with wineME branding)

## For Better Compatibility (Optional)
If you want to generate PNG versions for older devices, you can:

1. **Use an online converter:**
   - Visit https://convertio.co/svg-png/ or https://cloudconvert.com/svg-to-png
   - Upload `logo.svg`
   - Generate sizes: 192x192, 512x512
   - Save as `icon-192.png` and `icon-512.png` in the `public` folder

2. **Update manifest.json** to include PNG icons:
   ```json
   {
     "icons": [
       {
         "src": "/icon-192.png",
         "sizes": "192x192",
         "type": "image/png"
       },
       {
         "src": "/icon-512.png",
         "sizes": "512x512",
         "type": "image/png"
       }
     ]
   }
   ```

## Current Status
✅ SVG logo is set up and will work on modern devices
✅ Manifest.json is configured
✅ PWA support is enabled

The SVG logo will automatically scale to any size needed!
