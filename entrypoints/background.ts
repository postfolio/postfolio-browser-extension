export default defineBackground(() => {
  console.log('Save to Postfolio extension loaded', { id: browser.runtime.id });

  // Create context menu item
  chrome.contextMenus.create({
    id: "save-to-postfolio",
    title: "Save to Postfolio",
    contexts: ["page", "selection", "image", "link"]
  });

  // Handle context menu click
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "save-to-postfolio") {
      // Open the extension popup
      chrome.action.openPopup();
    }
  });

  // Helper function to check if a URL is a Postfolio URL
  const POSTFOLIO_URLS = [
    'http://localhost:3001',
    'https://localhost:3001',
    'https://www.mypostfolio.com',
    'https://mypostfolio.com'
  ];
  
  const isPostfolioUrl = (url: string | undefined): boolean => {
    if (!url) return false;
    return POSTFOLIO_URLS.some(baseUrl => url.startsWith(baseUrl));
  };

  // Automatically fetch auth when on a Postfolio tab
  const tryFetchAuthFromTab = async (tabId: number, url: string) => {
    if (!isPostfolioUrl(url)) return;
    
    console.log('[Background] Postfolio tab detected, attempting to fetch auth:', url);
    
    try {
      // Wait a bit for the page to load
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = await chrome.tabs.sendMessage(tabId, { action: 'getFirebaseAuthTokenFromPage' });
      
      if (response && response.success && response.token && response.userId) {
        console.log('[Background] Successfully fetched auth from Postfolio tab');
        await storeAuthDetailsInStorage(response.token, response.userId, response.userEmail, 'auto-fetch-from-tab');
      }
    } catch (error) {
      console.log('[Background] Could not fetch auth from tab (page might not be ready):', error);
    }
  };

  // Listen for tab updates
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      tryFetchAuthFromTab(tabId, tab.url);
    }
  });

  // Listen for tab activation
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      tryFetchAuthFromTab(activeInfo.tabId, tab.url);
    }
  });

  // Reusable function to store auth details
  const storeAuthDetailsInStorage = (token: string, userId: string, userEmail: string | null, source: string): Promise<{success: boolean, error?: string, message?: string}> => {
    return new Promise((resolve) => {
      console.log(`[Background] storeAuthDetailsInStorage (from ${source}): Attempting to store auth for user:`, userId);
      chrome.storage.local.set({
        postfolioAuth: {
          token,
          userId,
          userEmail,
          timestamp: Date.now()
        }
      }, () => {
        if (chrome.runtime.lastError) {
          const errorMsg = `[Background] storeAuthDetailsInStorage (from ${source}): Error storing auth token in chrome.storage.local: ${chrome.runtime.lastError.message}`;
          console.error(errorMsg);
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          const successMsg = `[Background] storeAuthDetailsInStorage (from ${source}): Auth token stored successfully in chrome.storage.local.`;
          console.log(successMsg);
          chrome.storage.local.get('postfolioAuth', (result) => {
            console.log(`[Background] storeAuthDetailsInStorage (from ${source}): Auth verification complete`);
            resolve({ success: true, message: "Token stored and verified." });
          });
        }
      });
    });
  };

  // Handle messages from content scripts and popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] <<< RAW MESSAGE RECEIVED >>>:', JSON.stringify(message), 'from sender:', sender.id, 'url:', sender.url, 'tabId:', sender.tab?.id);
    
    if (message.action === 'ping') {
      console.log('[Background] Ping received, responding with pong');
      sendResponse({ status: 'pong', timestamp: Date.now() });
      return true;
    } else if (message.action === 'pingFromExtensionAuthCallbackCS') {
      console.log('[Background] Received ping from ExtensionAuthCallbackCS on URL:', sender.tab?.url || sender.url);
      sendResponse({ status: 'pongFromBackground', receivedAt: Date.now() });
      return true;
    } else if (message.action === 'captureArea') {
      console.log('[Background] Processing captureArea request with rect:', message.rect);
      handleAreaCapture(message.rect, message.devicePixelRatio, sender.tab?.id);
      sendResponse({ status: 'processing', message: 'Area capture initiated' });
      return true; 
    } else if (message.action === 'areaSelectionError') {
      console.log('[Background] Forwarding areaSelectionError:', message.error);
      chrome.runtime.sendMessage({
        action: 'areaSelectionError',
        error: message.error
      }).catch(() => {
        console.log('[Background] Could not forward error to popup (popup likely closed)');
      });
      sendResponse({success: true, description: "Error forwarded or logged"});
      return true;
    } else if (message.action === 'areaSelectionCancelled') {
      console.log('[Background] Forwarding areaSelectionCancelled');
      chrome.runtime.sendMessage({
        action: 'areaSelectionCancelled'
      }).catch(() => {
        console.log('[Background] Could not forward cancellation to popup (popup likely closed)');
      });
      sendResponse({success: true, description: "Cancellation forwarded or logged"});
      return true;
    } else if (message.action === 'storeAuthToken') {
      console.log('[Background] storeAuthToken: Matched action. Received auth for userId:', message.userId);
      
      if (!message.token || !message.userId) {
        const errorMsg = '[Background] storeAuthToken: Token or UserId missing in message. Cannot store.';
        console.error(errorMsg);
        sendResponse({ success: false, error: 'Token or UserId missing in received message for storeAuthToken' });
        return true; // Important to return true for async sendResponse
      }

      storeAuthDetailsInStorage(message.token, message.userId, message.userEmail, 'storeAuthToken action')
        .then(sendResponse) // sendResponse will be called with {success: true/false, error?, message?}
        .catch(error => {
          // This catch is for errors in the promise chain of storeAuthDetailsInStorage itself, though unlikely with current structure.
          console.error('[Background] storeAuthToken: Error in storeAuthDetailsInStorage promise chain:', error);
          sendResponse({ success: false, error: 'Internal error during token storage promise chain.' });
        });
      return true; // Indicates asynchronous response
    } else if (message.action === 'clearAuthToken') {
      console.log('[Background] Clearing stored auth token');
      
      chrome.storage.local.remove('postfolioAuth', () => {
        if (chrome.runtime.lastError) {
          console.error('[Background] clearAuthToken: Error clearing token:', chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('[Background] Auth token cleared');
          sendResponse({ success: true });
        }
      });
      return true;
    } else if (message.action === 'getAuthDetails') {
      console.log('[Background] getAuthDetails: Matched action. Request from popup.');
      
      chrome.storage.local.get('postfolioAuth', (result) => {
        console.log('[Background] getAuthDetails: Retrieved from chrome.storage.local:', result);
        if (result.postfolioAuth && result.postfolioAuth.token && result.postfolioAuth.userId) {
          const authData = result.postfolioAuth;
          const tokenAge = Date.now() - authData.timestamp;
          const maxAge = 60 * 60 * 1000; // 1 hour
          
          if (tokenAge < maxAge) {
            console.log('[Background] getAuthDetails: Found valid stored auth token for userId:', authData.userId);
            sendResponse({ 
              success: true, 
              token: authData.token, 
              userId: authData.userId, 
              userEmail: authData.userEmail 
            });
            return;
          } else {
            console.log('[Background] getAuthDetails: Stored auth token is EXPIRED. Clearing it.');
            chrome.storage.local.remove('postfolioAuth'); // Clear expired token
          }
        } else {
          console.log('[Background] getAuthDetails: No valid authData found in local storage.');
        }
        
        console.log('[Background] getAuthDetails: No valid stored token, proceeding to check for open Postfolio tab...');
        
        chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
          const activeTab = activeTabs[0];
          console.log('[Background] getAuthDetails: Active tab found:', activeTab ? { id: activeTab.id, url: activeTab.url, title: activeTab.title } : 'No active tab');
          
          const isPostfolioTab = (tab: chrome.tabs.Tab) => {
            return tab.url && isPostfolioUrl(tab.url);
          };
          
          const attemptFetchFromTab = (targetTab: chrome.tabs.Tab, source: string) => {
            console.log(`[Background] getAuthDetails: Attempting to fetch from ${source} Postfolio tab:`, targetTab.id, targetTab.url);
            chrome.tabs.sendMessage(targetTab.id!, { action: 'getFirebaseAuthTokenFromPage' })
              .then(response => {
                if (response && response.success && response.token && response.userId) {
                  console.log('[Background] getAuthDetails: Auth details received from content script for userId:', response.userId);
                  storeAuthDetailsInStorage(response.token, response.userId, response.userEmail, 'getAuthDetails-liveFetch')
                    .then(storeResult => {
                      if (storeResult.success) {
                        console.log("[Background] getAuthDetails: Successfully stored freshly fetched token.");
                      } else {
                        console.error("[Background] getAuthDetails: Failed to store freshly fetched token:", storeResult.error);
                      }
                      sendResponse({ success: true, token: response.token, userId: response.userId, userEmail: response.userEmail });
                    })
                    .catch(storeError => {
                        console.error("[Background] getAuthDetails: Error in storeAuthDetailsInStorage promise chain after live fetch:", storeError);
                        // Still send original token back to popup even if secondary store fails
                        sendResponse({ success: true, token: response.token, userId: response.userId, userEmail: response.userEmail, warning: "Failed to persist freshly fetched token for next time." });
                    });
                } else {
                  console.error('[Background] getAuthDetails: Failed to get valid auth details from content script:', response?.error);
                  sendResponse({ success: false, error: response?.error || 'Failed to get auth token from Postfolio page. Is it open and are you logged in?' });
                }
              })
              .catch(err => {
                console.error('[Background] getAuthDetails: Error sending message to content script or content script error:', err);
                sendResponse({ success: false, error: `Error communicating with Postfolio page (${err.message}). Ensure it is open and you are logged in.` });
              });
          };

          if (activeTab && activeTab.id && isPostfolioTab(activeTab)) {
            attemptFetchFromTab(activeTab, 'active');
          } else {
            console.log('[Background] getAuthDetails: Active tab is not Postfolio, searching all tabs...');
            chrome.tabs.query({}, (allTabs) => {
              const postfolioTabs = allTabs.filter(tab => tab.id && isPostfolioTab(tab));
              console.log('[Background] getAuthDetails: Found Postfolio tabs:', postfolioTabs.map(tab => ({ id: tab.id, url: tab.url })));
              
              if (postfolioTabs.length > 0) {
                attemptFetchFromTab(postfolioTabs[0], 'any'); 
              } else {
                console.warn('[Background] getAuthDetails: No Postfolio tabs found. Active tab URL:', activeTab?.url);
                sendResponse({ success: false, error: 'Postfolio tab not found. Please open your Postfolio app and log in.' });
              }
            });
          }
        });
      });
      return true; 
    }
    
    console.warn("[Background] Message action '" + message.action + "' not recognized or fell through.");
    sendResponse({ success: false, error: "Unknown or unhandled action: " + message.action });
    return true; 
  });

  // Helper to promisify debugger APIs to use with async/await
  function sendDebuggerCommand(tabId: number, method: string, params?: { [key: string]: any }): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve(result);
      });
    });
  }
  
  // Helper to promisify attaching the debugger
  function attachDebugger(tabId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.debugger.attach({ tabId }, '1.3', () => {
        if (chrome.runtime.lastError) {
          return reject(chrome.runtime.lastError);
        }
        resolve();
      });
    });
  }
  
  // Helper to promisify detaching the debugger
  function detachDebugger(tabId: number): Promise<void> {
    return new Promise((resolve) => {
      chrome.debugger.detach({ tabId }, () => {
        // We can ignore the lastError here, as it might throw an error if the tab was closed.
        resolve();
      });
    });
  }

  async function handleAreaCapture(rect: {x: number, y: number, width: number, height: number}, devicePixelRatio: number, tabId?: number) {
    if (!tabId) {
      console.error('[Background] handleAreaCapture called without a tabId.');
      return;
    }

    try {
      await attachDebugger(tabId);
    } catch (err: any) {
      console.error('[Background] Failed to attach debugger:', err);
      const errorMessage = err.message?.includes('another debugger')
        ? 'Cannot capture with browser DevTools open. Please close them and try again.'
        : `Failed to start screenshot tool: ${err.message}`;
      
      await chrome.storage.local.set({ 'pendingAreaError': { error: errorMessage, timestamp: Date.now() } });
      await chrome.action.openPopup().catch(() => {});
      return;
    }

    try {
      // The debugger API takes coordinates in CSS pixels, which is what we now receive from the content script.
      // The `captureBeyondViewport` flag is crucial for capturing off-screen content.
      const result = await sendDebuggerCommand(tabId, 'Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        clip: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          scale: 1, // We are providing coordinates in CSS pixels.
        }
      });

      if (result && result.data) {
        const croppedDataUrl = 'data:image/png;base64,' + result.data;
        console.log('[Background] Full-page area capture successful. Data URL length:', croppedDataUrl.length);

        await chrome.storage.local.set({
          'pendingAreaCapture': { dataUrl: croppedDataUrl, timestamp: Date.now() }
        });
        
        console.log('[Background] Attempting to send areaSelectionComplete message to popup...');
        chrome.runtime.sendMessage({
          action: 'areaSelectionComplete',
          dataUrl: croppedDataUrl
        }).catch(async (error) => {
          console.log('[Background] Popup was not open, opening it to show result...');
          try {
            await chrome.action.openPopup();
          } catch (popupError) {
            console.error('Failed to open popup automatically:', popupError);
            chrome.notifications.create({
              type: 'basic',
              iconUrl: '/icon/icon-48.png',
              title: 'Area Captured',
              message: 'Click the extension icon to see your captured area.'
            });
          }
        });
      } else {
        throw new Error('Capture command returned no data.');
      }
    } catch (error) {
      console.error('[Background] Error during handleAreaCapture with debugger:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during capture.';
      
      await chrome.storage.local.set({
        'pendingAreaError': { error: errorMessage, timestamp: Date.now() }
      });

      chrome.runtime.sendMessage({
        action: 'areaSelectionError',
        error: errorMessage
      }).catch(async () => {
        try {
          await chrome.action.openPopup();
        } catch (popupError) {
          console.error('Failed to open popup for error:', popupError);
        }
      });
    } finally {
      // Ensure the debugger is always detached.
      await detachDebugger(tabId);
    }
  }
});
