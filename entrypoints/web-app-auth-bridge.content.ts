export default defineContentScript({
  matches: ['http://localhost:3001/*', 'https://www.mypostfolio.com/*', 'https://mypostfolio.com/*'], // Support localhost:3001 and production domains
  main() {
    console.log('[AuthBridge] Content script loaded on:', window.location.href);

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'getFirebaseAuthTokenFromPage') {
        console.log('[AuthBridge] Received request for auth token from background script.');

        let responseReceived = false;
        
        // Listener for the response from the page
        const handlePageMessage = (event: MessageEvent) => {
          console.log('[AuthBridge] Received message from page:', event.data, 'Origin:', event.origin);
          // Check if it's the expected message type from our web app
          if (event.source === window && event.data && 
              event.data.type === 'POSTFOLIO_AUTH_RESPONSE' && 
              event.data.source === 'postfolio-web-app') {
            responseReceived = true;
            window.removeEventListener('message', handlePageMessage); // Clean up

            if (event.data.error) {
              console.error('[AuthBridge] Error from page:', event.data.error);
              sendResponse({ success: false, error: event.data.error });
            } else {
              console.log('[AuthBridge] Received auth details from page:', { userId: event.data.userId, token: event.data.token ? 'Token Present' : 'No Token' });
              sendResponse({ success: true, token: event.data.token, userId: event.data.userId, userEmail: event.data.userEmail });
            }
          }
        };
        window.addEventListener('message', handlePageMessage, false);

        // Set a timeout in case the page doesn't respond
        setTimeout(() => {
          if (!responseReceived) {
            console.warn('[AuthBridge] Timeout waiting for auth response from page');
            window.removeEventListener('message', handlePageMessage);
            sendResponse({ success: false, error: 'Timeout waiting for auth response from Postfolio page. Make sure you are logged in.' });
          }
        }, 5000); // 5 second timeout

        // Send a message to the page to request auth details
        console.log('[AuthBridge] Posting message to page to request auth details.');
        window.postMessage({ 
          type: 'REQUEST_POSTFOLIO_AUTH',
          source: 'postfolio-extension',
          timestamp: Date.now()
        }, '*');
        
        return true; // Indicates that sendResponse will be called asynchronously
      }
    });
  }
}); 