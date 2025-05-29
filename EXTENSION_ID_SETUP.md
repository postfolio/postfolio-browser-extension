# Chrome Extension ID Setup

## Why You Need a Consistent Extension ID

When developing Chrome extensions, the extension gets a new ID each time you load it unpacked unless you specify a key in the manifest. This causes issues with:
- Google Sign-In authentication
- Firebase authentication domains
- Chrome storage data persistence

## How to Get Your Extension's ID

### Method 1: From Chrome Extensions Page
1. Load your extension in Chrome (`chrome://extensions/`)
2. Find your extension and copy the ID shown
3. This ID will change each time you reload unless you follow the steps below

### Method 2: Generate a Stable ID
1. Go to `chrome://extensions/`
2. Click "Pack extension" button
3. Select your extension directory (`.output/chrome-mv3`)
4. Click "Pack Extension"
5. This creates a `.crx` file and a `.pem` file
6. Keep the `.pem` file safe - it's your private key

## Making the ID Consistent

1. Open the `.pem` file in a text editor
2. Remove the first and last lines (BEGIN/END PRIVATE KEY)
3. Remove all line breaks to make it one long string
4. Add this to your `wxt.config.ts`:

```typescript
manifest: {
  key: "YOUR_KEY_STRING_HERE",
  // ... rest of manifest
}
```

## Alternative: Development-Only Solution

For development, you can:
1. Note your current extension ID from Chrome
2. Add it to Firebase authorized domains
3. Update any Firebase settings to allow this ID

## For Google Sign-In

Currently, Google Sign-In in Chrome extensions requires special handling:
- Option 1: Use `chrome.identity` API (complex setup)
- Option 2: Redirect to web app for authentication (current implementation)
- Option 3: Use Firebase Auth with email/password only

The extension currently uses Option 2 as a workaround. 