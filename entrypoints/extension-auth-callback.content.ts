export default defineContentScript({
  matches: [
    '*://localhost/extension-auth*',
    'https://www.mypostfolio.com/extension-auth*',
    'https://mypostfolio.com/extension-auth*'
  ],
  main() {
    console.log('[ExtensionAuthCallbackCS] EXECUTION STARTED for page:', window.location.href, 'at', new Date().toISOString());
    
    // Test message to background script immediately to check connectivity
    chrome.runtime.sendMessage({ action: 'pingFromExtensionAuthCallbackCS' })
      .then(response => console.log('[ExtensionAuthCallbackCS] Ping to background successful:', response))
      .catch(err => console.error('[ExtensionAuthCallbackCS] Ping to background failed:', err));

    // Listen for auth token from the page
    const handleMessage = (event: MessageEvent) => {
      console.log('[ExtensionAuthCallbackCS] handleMessage: Received event. Origin:', event.origin, 'Data:', event.data);
      
      // IMPORTANT: Check the origin of the message for security
      if (event.origin !== window.location.origin) {
          console.warn('[ExtensionAuthCallbackCS] Message from unexpected origin, ignoring:', event.origin, 'Expected:', window.location.origin);
          return;
      }

      if (event.data && 
          event.data.type === 'POSTFOLIO_EXTENSION_AUTH' && 
          event.data.source === 'postfolio-web-app') {
        
        const { token, userId, userEmail } = event.data;
        console.log('[ExtensionAuthCallbackCS] POSTFOLIO_EXTENSION_AUTH message received and validated:', { token: !!token, userId, userEmail });
        
        if (token && userId) {
          console.log('[ExtensionAuthCallbackCS] Token and UserId are present. Attempting to send to background script for storage.');
          
          // Send auth details to background script for storage
          chrome.runtime.sendMessage({
            action: 'storeAuthToken',
            token,
            userId,
            userEmail
          }).then((response) => {
            if (chrome.runtime.lastError) {
              console.error('[ExtensionAuthCallbackCS] Error sending storeAuthToken to background AFTER response (lastError):', chrome.runtime.lastError.message);
            }
            if (response) {
              console.log('[ExtensionAuthCallbackCS] Response from background after sending storeAuthToken:', response);
            } else {
              console.warn('[ExtensionAuthCallbackCS] No response from background after sending storeAuthToken. This might be okay if background does not sendResponse for this action, or an error occurred.');
            }
          }).catch((error) => {
            console.error('[ExtensionAuthCallbackCS] Catch: Error sending storeAuthToken to background:', error);
          });
        } else {
          console.warn('[ExtensionAuthCallbackCS] Message received, but token or userId missing.', event.data);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    // Clean up listener when the page is unloaded
    window.addEventListener('beforeunload', () => {
      window.removeEventListener('message', handleMessage);
    });
  }
}); 