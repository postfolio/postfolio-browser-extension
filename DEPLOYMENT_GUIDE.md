# Postfolio Browser Extension - Deployment Guide

## Environment Variables in Browser Extensions

Unlike web applications, browser extensions don't have built-in support for environment variables. All code is bundled and runs client-side, so there's no server to hide secrets. However, Firebase configuration values are **meant to be public** - they're protected by Firebase Security Rules, not by being secret.

## Current Setup

Your Firebase config is currently in `firebase-config.ts`. This is perfectly fine for:
- Development
- Chrome Web Store submission
- Production use

## Why Firebase Config is Safe to Include

1. **These aren't secret keys** - they're more like your app's public address
2. **Security comes from**:
   - Firebase Security Rules (database access control)
   - Authentication (users must be logged in)
   - API Key Restrictions (can limit to specific domains/apps)
   - App Check (optional additional security)

## Deployment Options

### Option 1: Direct Configuration (Current Setup) ✅
```typescript
// firebase-config.ts
export const firebaseConfig = {
  apiKey: "AIzaSy...",
  // ... rest of config
};
```

**Pros:**
- Simple and straightforward
- No build complexity
- Works immediately

**Cons:**
- Config is in source code
- Same config for all environments

**When to use:** Most browser extensions, including yours

### Option 2: Build-Time Environment Variables

If you want to keep Firebase config out of source control:

1. **Use the template file** (`firebase-config.template.ts`)
2. **Set environment variables**:
   ```bash
   export FIREBASE_API_KEY="your-api-key"
   export FIREBASE_AUTH_DOMAIN="your-auth-domain"
   # ... etc
   ```
3. **Build with the script**:
   ```bash
   node scripts/build-with-env.js
   ```

This generates `firebase-config.ts` at build time.

### Option 3: Multiple Environment Files

For different Firebase projects (dev/staging/prod):

1. Create multiple config files:
   - `firebase-config.dev.ts`
   - `firebase-config.prod.ts`

2. Use a build script to copy the right one:
   ```bash
   # For development
   cp firebase-config.dev.ts firebase-config.ts && npm run build
   
   # For production
   cp firebase-config.prod.ts firebase-config.ts && npm run build
   ```

## Chrome Web Store Deployment

1. **Build the extension**:
   ```bash
   npm run build
   npm run zip
   ```

2. **Upload to Chrome Web Store**:
   - Upload `.output/postfolio-browser-extension-1.1.1-chrome.zip`
   - No special environment handling needed
   - Config is bundled in the extension

## CI/CD Options

### GitHub Actions Example
```yaml
name: Build Extension
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run build
        env:
          FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          # ... other secrets
      - uses: actions/upload-artifact@v2
        with:
          name: extension-build
          path: .output/*.zip
```

### Local Development vs Production

For local development, the current setup is perfect. For production:

1. **Keep using the same Firebase project** (recommended)
   - Simpler setup
   - Use Firebase Security Rules to control access
   - Most extensions do this

2. **Use separate Firebase projects** (optional)
   - Create `postfolio-web-app-prod` Firebase project
   - Update config when building for production
   - More complex but separates environments

## Security Best Practices

1. **Enable API Key Restrictions**:
   - Go to Google Cloud Console
   - Find your API key
   - Add Chrome extension ID to allowed apps

2. **Use Firebase Security Rules**:
   ```javascript
   // Firestore rules example
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /posts/{post} {
         allow read: if request.auth != null && request.auth.uid == resource.data.userId;
         allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
       }
     }
   }
   ```

3. **Monitor Usage**:
   - Check Firebase Console for unusual activity
   - Set up budget alerts
   - Review authentication logs

## Quick Start Commands

```bash
# Development
npm run dev

# Build for Chrome Web Store
npm run build
npm run zip

# Build with environment variables
FIREBASE_API_KEY="your-key" node scripts/build-with-env.js

# Test the extension
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Load unpacked from .output/chrome-mv3/
```

## Summary

Your current setup with Firebase config directly in the code is:
- ✅ Secure (protected by Firebase rules)
- ✅ Simple to maintain
- ✅ Standard practice for browser extensions
- ✅ Ready for Chrome Web Store

No changes needed unless you specifically want to separate dev/prod environments! 