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
    if (message.action === 'captureArea') {
      handleAreaCapture(message.rect, message.devicePixelRatio, sender.tab?.id);
    } else if (message.action === 'areaSelectionError') {
      // Forward error to popup if it's open
      chrome.runtime.sendMessage({
        action: 'areaSelectionError',
        error: message.error
      }).catch(() => {
        // Popup might be closed, ignore error
      });
    } else if (message.action === 'areaSelectionCancelled') {
      // Forward cancellation to popup if it's open
      chrome.runtime.sendMessage({
        action: 'areaSelectionCancelled'
      }).catch(() => {
        // Popup might be closed, ignore error
      });
    }
    return true;
  });

  async function handleAreaCapture(rect: any, devicePixelRatio: number, tabId?: number) {
    try {
      console.log('handleAreaCapture called with:', { rect, devicePixelRatio, tabId });
      
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

      // Use createImageBitmap instead of Image constructor (works in service workers)
      console.log('Converting data URL to blob for processing...');
      
      // Convert data URL to blob first
      const response = await fetch(dataUrl);
      const fullImageBlob = await response.blob();
      
      // Create ImageBitmap from the blob
      const imageBitmap = await createImageBitmap(fullImageBlob);
      console.log('ImageBitmap created:', imageBitmap.width, 'x', imageBitmap.height);

      // Create a canvas to crop the image
      const canvas = new OffscreenCanvas(rect.width, rect.height);
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      console.log('Canvas created:', rect.width, 'x', rect.height);

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

      // Draw the cropped area using ImageBitmap
      ctx.drawImage(
        imageBitmap,
        rect.x, rect.y, rect.width, rect.height,
        0, 0, rect.width, rect.height
      );

      console.log('Image drawn to canvas, converting to blob...');

      // Convert to blob and then to data URL
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      console.log('Blob created, size:', blob.size);
      
      // Convert blob to data URL
      const reader = new FileReader();
      
      reader.onload = async () => {
        const croppedDataUrl = reader.result as string;
        console.log('Cropped data URL created, length:', croppedDataUrl.length);
        
        // Store the captured image in chrome storage for later retrieval
        await chrome.storage.local.set({
          'pendingAreaCapture': {
            dataUrl: croppedDataUrl,
            timestamp: Date.now()
          }
        });
        console.log('Stored captured area in chrome.storage.local');
        
        // Try to send message to popup (might be closed)
        chrome.runtime.sendMessage({
          action: 'areaSelectionComplete',
          dataUrl: croppedDataUrl
        }).catch(async (error) => {
          console.log('Failed to send message to popup (popup is closed):', error);
          
          // Popup is closed, so open it automatically to show the result
          try {
            console.log('Opening popup to show captured area...');
            // Small delay to ensure everything is ready
            await new Promise(resolve => setTimeout(resolve, 500));
            await chrome.action.openPopup();
          } catch (popupError) {
            console.log('Failed to open popup automatically:', popupError);
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
        throw new Error('Failed to convert blob to data URL');
      };
      
      reader.readAsDataURL(blob);

      // Clean up ImageBitmap
      imageBitmap.close();

    } catch (error) {
      console.error('Error in handleAreaCapture:', error);
      
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
