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

  // Handle messages from content scripts and popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Background] Received message:', message, 'from sender:', sender);
    
    if (message.action === 'ping') {
      console.log('[Background] Ping received, responding with pong');
      sendResponse({ status: 'pong', timestamp: Date.now() });
      return true;
    } else if (message.action === 'captureArea') {
      console.log('[Background] Processing captureArea request with rect:', message.rect);
      handleAreaCapture(message.rect, message.devicePixelRatio, sender.tab?.id);
      sendResponse({ status: 'processing', message: 'Area capture initiated' });
      return true; // Indicate we will send a response
    } else if (message.action === 'areaSelectionError') {
      console.log('[Background] Forwarding areaSelectionError:', message.error);
      // Forward error to popup if it's open
      chrome.runtime.sendMessage({
        action: 'areaSelectionError',
        error: message.error
      }).catch(() => {
        console.log('[Background] Could not forward error to popup (popup likely closed)');
      });
    } else if (message.action === 'areaSelectionCancelled') {
      console.log('[Background] Forwarding areaSelectionCancelled');
      // Forward cancellation to popup if it's open
      chrome.runtime.sendMessage({
        action: 'areaSelectionCancelled'
      }).catch(() => {
        console.log('[Background] Could not forward cancellation to popup (popup likely closed)');
      });
    } else if (message.action === 'getAuthDetails') {
      console.log('[Background] Received getAuthDetails request from popup.');
      
      // First check active tab, then search all tabs for Postfolio
      chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
        const activeTab = activeTabs[0];
        console.log('[Background] Active tab found:', activeTab ? { id: activeTab.id, url: activeTab.url, title: activeTab.title } : 'No tab');
        
        const isPostfolioTab = (tab: chrome.tabs.Tab) => {
          return tab.url && (
            tab.url.startsWith('http://localhost:3001') || 
            tab.url.startsWith('https://localhost:3001') ||
            tab.url.startsWith('https://www.mypostfolio.com') || 
            tab.url.startsWith('https://mypostfolio.com')
          );
        };
        
        // Check if active tab is Postfolio
        if (activeTab && activeTab.id && isPostfolioTab(activeTab)) {
          console.log('[Background] Active tab is Postfolio, sending message to auth bridge content script on tab:', activeTab.id);
          chrome.tabs.sendMessage(activeTab.id, { action: 'getFirebaseAuthTokenFromPage' })
            .then(response => {
              if (response && response.success) {
                console.log('[Background] Auth details received from content script:', { userId: response.userId, tokenPresent: !!response.token, userEmail: response.userEmail });
                sendResponse({ success: true, token: response.token, userId: response.userId, userEmail: response.userEmail });
              } else {
                console.error('[Background] Failed to get auth details from content script:', response?.error);
                sendResponse({ success: false, error: response?.error || 'Failed to get auth token from page. Is Postfolio open and logged in?' });
              }
            })
            .catch(err => {
              console.error('[Background] Error sending message to content script or content script error:', err);
              sendResponse({ success: false, error: 'Error communicating with Postfolio page. Ensure it is open and you are logged in. ' + err.message });
            });
        } else {
          // Active tab is not Postfolio, search all tabs
          console.log('[Background] Active tab is not Postfolio, searching all tabs...');
          chrome.tabs.query({}, (allTabs) => {
            const postfolioTabs = allTabs.filter(tab => tab.id && isPostfolioTab(tab));
            console.log('[Background] Found Postfolio tabs:', postfolioTabs.map(tab => ({ id: tab.id, url: tab.url })));
            
            if (postfolioTabs.length > 0) {
              const postfolioTab = postfolioTabs[0]; // Use the first one found
              console.log('[Background] Using Postfolio tab:', postfolioTab.id, postfolioTab.url);
              chrome.tabs.sendMessage(postfolioTab.id!, { action: 'getFirebaseAuthTokenFromPage' })
                .then(response => {
                  if (response && response.success) {
                    console.log('[Background] Auth details received from content script:', { userId: response.userId, tokenPresent: !!response.token, userEmail: response.userEmail });
                    sendResponse({ success: true, token: response.token, userId: response.userId, userEmail: response.userEmail });
                  } else {
                    console.error('[Background] Failed to get auth details from content script:', response?.error);
                    sendResponse({ success: false, error: response?.error || 'Failed to get auth token from page. Is Postfolio open and logged in?' });
                  }
                })
                .catch(err => {
                  console.error('[Background] Error sending message to content script or content script error:', err);
                  sendResponse({ success: false, error: 'Error communicating with Postfolio page. Ensure it is open and you are logged in. ' + err.message });
                });
            } else {
              console.warn('[Background] No Postfolio tabs found. Active tab URL:', activeTab?.url);
              sendResponse({ success: false, error: 'Postfolio tab not found. Please open http://localhost:3001 and log in.' });
            }
          });
        }
      });
      return true; // Indicates asynchronous response
    }
    return true;
  });

  async function handleAreaCapture(rect: any, devicePixelRatio: number, tabId?: number) {
    try {
      console.log('[Background] handleAreaCapture called with:', { rect, devicePixelRatio, tabId });
      
      if (!tabId) {
        throw new Error('No tab ID available');
      }

      // Capture the full visible tab
      console.log('Capturing visible tab...');
      const dataUrl = await chrome.tabs.captureVisibleTab({ 
        format: 'png'
      });

      if (!dataUrl) {
        throw new Error('Failed to capture tab');
      }

      console.log('Tab captured successfully, data URL length:', dataUrl.length);
      console.log('[Background] Tab captured successfully, data URL length:', dataUrl.length);

      // Use createImageBitmap instead of Image constructor (works in service workers)
      console.log('Converting data URL to blob for processing...');
      console.log('[Background] Converting data URL to blob for processing...');
      
      // Convert data URL to blob first
      const response = await fetch(dataUrl);
      const fullImageBlob = await response.blob();
      
      // Create ImageBitmap from the blob
      const imageBitmap = await createImageBitmap(fullImageBlob);
      console.log('ImageBitmap created:', imageBitmap.width, 'x', imageBitmap.height);
      console.log('[Background] ImageBitmap created:', imageBitmap.width, 'x', imageBitmap.height);

      // Create a canvas to crop the image
      const canvas = new OffscreenCanvas(rect.width, rect.height);
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      console.log('Canvas created:', rect.width, 'x', rect.height);
      console.log('[Background] Canvas created:', rect.width, 'x', rect.height);

      console.log('Drawing cropped area:', {
        sourceX: rect.x,
        sourceY: rect.y,
        sourceWidth: rect.width,
        sourceHeight: rect.height,
        destX: 0,
        destY: 0,
        destWidth: rect.width,
        destHeight: rect.height
      });
      console.log('[Background] Drawing cropped area from rect:', rect);

      // Draw the cropped area using ImageBitmap
      ctx.drawImage(
        imageBitmap,
        rect.x, rect.y, rect.width, rect.height,
        0, 0, rect.width, rect.height
      );

      console.log('Image drawn to canvas, converting to blob...');
      console.log('[Background] Image drawn to canvas, converting to blob...');

      // Convert to blob and then to data URL
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      console.log('Blob created, size:', blob.size);
      console.log('[Background] Blob created, size:', blob.size);
      
      // Convert blob to data URL
      const reader = new FileReader();
      
      reader.onload = async () => {
        const croppedDataUrl = reader.result as string;
        console.log('Cropped data URL created, length:', croppedDataUrl.length);
        console.log('[Background] Cropped data URL created, length:', croppedDataUrl.length);
        
        // Store the captured image in chrome storage for later retrieval
        await chrome.storage.local.set({
          'pendingAreaCapture': {
            dataUrl: croppedDataUrl,
            timestamp: Date.now()
          }
        });
        console.log('Stored captured area in chrome.storage.local');
        console.log('[Background] Stored captured area in chrome.storage.local');
        
        // Try to send message to popup (might be closed)
        console.log('[Background] Attempting to send areaSelectionComplete message to popup...');
        chrome.runtime.sendMessage({
          action: 'areaSelectionComplete',
          dataUrl: croppedDataUrl
        }).catch(async (error) => {
          console.log('Failed to send message to popup (popup is closed):', error);
          console.log('[Background] Failed to send message to popup (popup is closed):', error);
          
          // Popup is closed, so open it automatically to show the result
          try {
            console.log('[Background] Opening popup to show captured area...');
            // Small delay to ensure everything is ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            await chrome.action.openPopup();
          } catch (popupError) {
            console.log('Failed to open popup automatically:', popupError);
            console.log('[Background] Failed to open popup automatically:', popupError);
            // Fallback: show a notification
            chrome.notifications.create({
              type: 'basic',
              iconUrl: '/icon/icon-48.png',
              title: 'Area Captured',
              message: 'Click the extension icon to see your captured area.'
            });
          }
        });
      };
      
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        console.error('[Background] FileReader error:', error);
        throw new Error('Failed to convert blob to data URL');
      };
      
      reader.readAsDataURL(blob);

      // Clean up ImageBitmap
      imageBitmap.close();

    } catch (error) {
      console.error('Error in handleAreaCapture:', error);
      console.error('[Background] Error in handleAreaCapture:', error);
      
      // Store error in storage as well
      await chrome.storage.local.set({
        'pendingAreaError': {
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          timestamp: Date.now()
        }
      });
      
      chrome.runtime.sendMessage({
        action: 'areaSelectionError',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }).catch(async () => {
        // Popup is closed, try to open it to show the error
        try {
          console.log('Opening popup to show error...');
          await chrome.action.openPopup();
        } catch (popupError) {
          console.log('Failed to open popup for error:', popupError);
          // Fallback: show a notification
          chrome.notifications.create({
            type: 'basic',
            iconUrl: '/icon/icon-48.png',
            title: 'Area Capture Failed',
            message: 'Click the extension icon for details.'
          });
        }
      });
    }
  }
});
