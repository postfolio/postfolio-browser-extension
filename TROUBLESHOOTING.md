# Postfolio Browser Extension - Troubleshooting Guide

## Common Issues and Solutions

### 1. Save to Postfolio Button Not Working

**Symptoms:**
- Clicking "Save to Postfolio" does nothing
- No error messages appear

**Solutions:**
1. Check if you're logged in (you should see your email at the top)
2. Make sure you've entered a title (it's required)
3. Check the browser console for errors (Right-click → Inspect → Console)
4. Try logging out and logging back in

### 2. Area Selection Not Working

**Symptoms:**
- Error: "Could not establish connection. Receiving end does not exist"
- Clicking "Select area" does nothing

**Common Causes & Solutions:**

1. **You're on a restricted page:**
   - Chrome doesn't allow extensions on chrome://, chrome-extension://, or Chrome Web Store pages
   - Solution: Navigate to a regular website (e.g., google.com) and try again

2. **Page not fully loaded:**
   - Wait for the page to completely load before clicking the extension
   - Try refreshing the page and waiting a few seconds

3. **Extension needs reload:**
   - Go to chrome://extensions/
   - Click the refresh button on the Postfolio extension
   - Try again

### 3. Google Sign-In Issues

**Current Status:**
- Google Sign-In in Chrome extensions requires special handling
- The extension currently opens the Postfolio website for Google authentication

**Workaround:**
1. Click "Continue with Google"
2. Complete sign-in on the Postfolio website that opens
3. Return to the extension and log in with your email/password

**Future Solution:**
- We're working on implementing proper Chrome Identity API integration

### 4. Toast Notifications Not Showing

**If you're not seeing error messages:**
1. Check browser console for errors
2. Make sure you're using the latest build
3. The toasts appear at the top of the extension popup

### 5. Authentication Issues

**"Not logged in" errors:**
1. Your session may have expired
2. Log out and log back in
3. Check if your Firebase token is still valid

**"Token refresh" errors:**
1. This happens when your auth token expires
2. The extension should auto-refresh, but if not, log out and back in

## Developer Debugging Tips

### Check Console Logs
1. Right-click the extension icon → "Inspect popup"
2. Look for errors in the Console tab
3. Check for [Popup], [Background], or [AreaSelector] prefixed messages

### Background Script Errors
1. Go to chrome://extensions/
2. Find Postfolio extension
3. Click "background page" or "service worker"
4. Check the console for errors

### Content Script Issues
1. On the webpage, right-click → Inspect
2. Check console for [AreaSelector] messages
3. Look for injection errors

### Common Error Messages

**"Could not establish connection"**
- Content script not injected on current page
- Page is restricted (chrome:// URLs)

**"Failed to fetch"**
- Network error saving to Postfolio
- Check your internet connection
- Verify the API endpoint is correct

**"Invalid credential"**
- Your login credentials are incorrect
- For Google sign-in, use email/password instead

## Quick Fixes

1. **Reload Extension:**
   ```
   chrome://extensions/ → Refresh button
   ```

2. **Clear Extension Data:**
   ```
   chrome://extensions/ → Details → Clear data
   ```

3. **Reinstall Extension:**
   - Remove extension
   - Load unpacked again from `.output/chrome-mv3`

## Still Having Issues?

1. Check the EXTENSION_REVIEW_AND_ISSUES.md file
2. Review recent code changes
3. Test in an incognito window (with extension allowed)
4. Try a different Chrome profile 