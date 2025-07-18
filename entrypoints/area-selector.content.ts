export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  main() {
    console.log('[AreaSelector] Content script loaded for URL:', window.location.href);
    
    let isSelecting = false;
    let startX = 0;
    let startY = 0;
    let overlay: HTMLDivElement | null = null;
    let selectionBox: HTMLDivElement | null = null;

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[AreaSelector] Content script received message:', message);
      
      // Ignore auth-related messages - let the auth bridge handle them
      if (message.action === 'getFirebaseAuthTokenFromPage') {
        console.log('[AreaSelector] Ignoring auth message, should be handled by auth bridge');
        return false; // Don't handle this message
      }
      
      if (message.action === 'startAreaSelection') {
        console.log('[AreaSelector] Received startAreaSelection action.');
        // Ensure this only runs in the top-most frame to avoid multiple overlays/handlers
        if (window.self !== window.top) {
          console.log('[AreaSelector] In an iframe, ignoring startAreaSelection message.');
          sendResponse({ success: false, reason: 'Cannot start selection in iframe directly' });
          return true; // Indicate async response, though not strictly needed here
        }
        console.log('[AreaSelector] Attempting to start area selection in top frame...');
        startAreaSelection();
        sendResponse({ success: true });
      } else if (message.action === 'extractPageImages') {
        console.log('Extracting page images...');
        
        let imageUrls: { [key: string]: string | null } = {
          ogImage: null,
          twitterImage: null,
          itempropImage: null,
          linkRelImage: null,
          jsonLdImage: null,
          firstSignificantImage: null
        };

        // 1. Meta tags
        const ogImageMeta = document.querySelector('meta[property="og:image"]');
        imageUrls.ogImage = ogImageMeta ? ogImageMeta.getAttribute('content') : null;

        const twitterImageMeta = document.querySelector('meta[name="twitter:image"]');
        imageUrls.twitterImage = twitterImageMeta ? twitterImageMeta.getAttribute('content') : null;

        const itempropImageMeta = document.querySelector('meta[itemprop="image"]');
        imageUrls.itempropImage = itempropImageMeta ? itempropImageMeta.getAttribute('content') : null;

        const linkRelImage = document.querySelector('link[rel="image_src"]');
        imageUrls.linkRelImage = linkRelImage ? linkRelImage.getAttribute('href') : null;

        // 2. JSON-LD
        try {
          const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          for (const script of jsonLdScripts) {
            if (script.textContent) {
              const jsonData = JSON.parse(script.textContent);
              // Common properties for images in JSON-LD
              let foundJsonLdImage = null;
              if (jsonData.image && typeof jsonData.image === 'string') {
                foundJsonLdImage = jsonData.image;
              } else if (jsonData.image && Array.isArray(jsonData.image) && jsonData.image.length > 0) {
                foundJsonLdImage = typeof jsonData.image[0] === 'string' ? jsonData.image[0] : (jsonData.image[0] as any)?.url;
              } else if (jsonData.image && typeof jsonData.image === 'object' && (jsonData.image as any)?.url) {
                foundJsonLdImage = (jsonData.image as any).url;
              } else if (jsonData.thumbnailUrl && typeof jsonData.thumbnailUrl === 'string') {
                foundJsonLdImage = jsonData.thumbnailUrl;
              }
              if (foundJsonLdImage) {
                imageUrls.jsonLdImage = foundJsonLdImage;
                break; // Take the first one found
              }
            }
          }
        } catch (e) {
          console.warn('Error parsing JSON-LD for images:', e);
        }

        // 3. First significant <img> tag (fallback)
        const images = Array.from(document.getElementsByTagName('img'));
        const significantImage = images.find(img => 
          img.src && 
          img.naturalWidth > 100 && 
          img.naturalHeight > 100 && 
          !img.src.startsWith('data:') &&
          img.complete
        );
        if (significantImage) {
          imageUrls.firstSignificantImage = significantImage.src;
        }
        
        console.log('Extracted image URLs:', imageUrls);
        sendResponse(imageUrls);
      }
      return true; // Required for async sendResponse
    });

    function startAreaSelection() {
      if (isSelecting) {
        console.log('[AreaSelector] Already selecting, ignoring call to startAreaSelection.');
        return;
      }
      
      console.log('[AreaSelector] Executing startAreaSelection function.');
      isSelecting = true;
      createOverlay();
      document.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('keydown', onKeyDown);
    }

    function createOverlay() {
      console.log('[AreaSelector] Creating overlay and selection box...');
      // Create overlay
      overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.3);
        z-index: 999999;
        cursor: crosshair;
        user-select: none;
      `;

      // Create selection box
      selectionBox = document.createElement('div');
      selectionBox.style.cssText = `
        position: absolute;
        border: 2px solid #016fb9;
        background: rgba(1, 111, 185, 0.1);
        display: none;
        pointer-events: none;
      `;

      // Create instruction text
      const instruction = document.createElement('div');
      instruction.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 14px;
        font-weight: 500;
        z-index: 1000000;
      `;
      instruction.textContent = 'Click and drag to select an area. Press ESC to cancel.';

      overlay.appendChild(selectionBox);
      overlay.appendChild(instruction);
      document.body.appendChild(overlay);
    }

    function onMouseDown(e: MouseEvent) {
      if (!overlay || !selectionBox) return;
      
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      
      selectionBox.style.left = startX + 'px';
      selectionBox.style.top = startY + 'px';
      selectionBox.style.width = '0px';
      selectionBox.style.height = '0px';
      selectionBox.style.display = 'block';
    }

    function onMouseMove(e: MouseEvent) {
      if (!selectionBox || !selectionBox.style.display || selectionBox.style.display === 'none') return;
      
      const currentX = e.clientX;
      const currentY = e.clientY;
      
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);
      const left = Math.min(currentX, startX);
      const top = Math.min(currentY, startY);
      
      selectionBox.style.left = left + 'px';
      selectionBox.style.top = top + 'px';
      selectionBox.style.width = width + 'px';
      selectionBox.style.height = height + 'px';
    }

    function onMouseUp(e: MouseEvent) {
      if (!selectionBox || !overlay) return;
      
      const rect = selectionBox.getBoundingClientRect();
      
      // Check if selection is large enough
      if (rect.width < 10 || rect.height < 10) {
        cleanup();
        return;
      }
      
      // Capture the selected area
      captureSelectedArea(rect);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        cleanup();
        // Send cancellation message to popup
        chrome.runtime.sendMessage({ 
          action: 'areaSelectionCancelled' 
        });
      }
    }

    async function captureSelectedArea(rect: DOMRect) {
      try {
        console.log('captureSelectedArea called with local rect:', rect);
        
        if (overlay) {
          overlay.style.display = 'none';
        }
        await new Promise(resolve => setTimeout(resolve, 100));

        const devicePixelRatio = window.devicePixelRatio || 1;
        console.log('Device pixel ratio:', devicePixelRatio);
        
        // The rect.x and rect.y are from getBoundingClientRect() and are in CSS pixels.
        // The debugger API expects coordinates in CSS pixels, so we no longer multiply by DPR here.
        const captureParams = {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };

        console.log('[AreaSelector] Calculated CSS pixel capture params for background script:', captureParams);
        
        // First, test if background script is reachable
        try {
          console.log('[AreaSelector] Testing background script connectivity...');
          const testResponse = await chrome.runtime.sendMessage({ action: 'ping' });
          console.log('[AreaSelector] Background script ping response:', testResponse);
        } catch (pingError) {
          console.error('[AreaSelector] Background script ping failed:', pingError);
        }
        
        try {
          const response = await chrome.runtime.sendMessage({
            action: 'captureArea',
            rect: captureParams,
            devicePixelRatio: devicePixelRatio
          });
          console.log('[AreaSelector] Message sent to background script successfully, response:', response);
        } catch (messageError) {
          console.error('[AreaSelector] Failed to send message to background script:', messageError);
          throw new Error('Failed to communicate with background script: ' + (messageError instanceof Error ? messageError.message : 'Unknown error'));
        }

      } catch (error) {
        console.error('Error capturing area:', error);
        console.error('[AreaSelector] Error in captureSelectedArea:', error);
        chrome.runtime.sendMessage({ 
          action: 'areaSelectionError', 
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
        console.log('[AreaSelector] Error message sent to background script');
      } finally {
        cleanup();
      }
    }

    function cleanup() {
      isSelecting = false;
      
      if (overlay) {
        document.body.removeChild(overlay);
        overlay = null;
        selectionBox = null;
      }
      
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
    }
  },
}); 