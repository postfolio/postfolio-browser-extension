import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { ContentData } from './types';

// Helper function to extract YouTube video ID from URL
const getYoutubeVideoId = (url: string): string | null => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2] && match[2].length === 11) {
    return match[2];
  }
  return null;
};

interface AuthDetails {
  userId: string | null;
  token: string | null;
  userEmail: string | null;
  error?: string | null;
}

const WEB_APP_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:3001'
  : 'https://www.mypostfolio.com';
const LOGIN_PAGE_PATH = '/login'; // Or your actual login path e.g. /auth

// Toast state and function
interface ToastDetails {
  message: string;
  type: 'success' | 'error' | 'warning';
  show: boolean;
}

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Processing...');
  const [toastDetails, setToastDetails] = useState<ToastDetails>({
    message: '',
    type: 'success',
    show: false,
  });
  const [activeControl, setActiveControl] = useState<string | null>(null);
  const [isUrlExpanded, setIsUrlExpanded] = useState(false);
  const [contentData, setContentData] = useState<ContentData>({
    title: '',
    url: '',
    thumbnail: null
  });
  const [authDetails, setAuthDetails] = useState<AuthDetails>({ userId: null, token: null, userEmail: null, error: null });
  const [isSaved, setIsSaved] = useState(false);
  const [savedPostTitle, setSavedPostTitle] = useState('');

  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLoginError = (errMsg: string | undefined | null): boolean => {
    if (!errMsg) return false;
    const lowerMsg = errMsg.toLowerCase();
    return lowerMsg.includes('not logged in') ||
           lowerMsg.includes('login status not found') ||
           lowerMsg.includes('ensure it is open and you are logged in') ||
           lowerMsg.includes('postfolio tab not found') ||
           lowerMsg.includes('could not retrieve login status');
  };
  
  const getPreferredImage = (images: any, baseUrl: string): string | null => {
    let preferredThumbnail = null;
    if (images) {
      if (images.ogImage) preferredThumbnail = images.ogImage;
      else if (images.jsonLdImage) preferredThumbnail = images.jsonLdImage;
      else if (images.twitterImage) preferredThumbnail = images.twitterImage;
      else if (images.itempropImage) preferredThumbnail = images.itempropImage;
      else if (images.linkRelImage) preferredThumbnail = images.linkRelImage;
      else if (images.firstSignificantImage) preferredThumbnail = images.firstSignificantImage;
      
      if (preferredThumbnail && !preferredThumbnail.startsWith('http') && !preferredThumbnail.startsWith('data:')) {
        try {
          const base = new URL(baseUrl).origin;
          preferredThumbnail = base + (preferredThumbnail.startsWith('/') ? preferredThumbnail : '/' + preferredThumbnail);
        } catch (e) {
          console.warn("Error constructing absolute URL for thumbnail:", e);
          return null; // Invalid base URL
        }
      }
    }
    return preferredThumbnail;
  };

  const fetchContentDetailsForUrl = async (urlToFetch: string, currentTab?: chrome.tabs.Tab | null ) => {
    if (!urlToFetch) {
      setContentData(prev => ({ ...prev, title: 'No URL provided', thumbnail: null }));
      return;
    }

    let newTitle = currentTab?.title || `Content from ${new URL(urlToFetch).hostname}`;
    let newThumbnail: string | null = null;

    const videoId = getYoutubeVideoId(urlToFetch);
    if (videoId) {
      newThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    } else if (currentTab && currentTab.id && currentTab.url && currentTab.url === urlToFetch && !currentTab.url.startsWith('chrome://') && !currentTab.url.startsWith('file://')) {
      try {
        console.log('Attempting to fetch generic image from content script for tab:', currentTab.id);
        const imagesFromContentScript = await chrome.tabs.sendMessage(currentTab.id, { action: 'extractPageImages' });
        newThumbnail = getPreferredImage(imagesFromContentScript, currentTab.url);
        console.log('Received images from content script:', imagesFromContentScript, 'Selected:', newThumbnail);
      } catch (err: any) {
        console.warn('Failed to communicate with content script for image extraction:', err.message);
      }
    }
    
    setContentData(prev => ({
      ...prev,
      url: urlToFetch,
      title: newTitle,
      thumbnail: newThumbnail
    }));
  };


  useEffect(() => {
    const initialSetup = async () => {
      console.log('[Popup] Initial setup running...');
      // 1. Fetch Auth Details
      console.log('[Popup] Requesting auth details from background script...');
      try {
        const response = await chrome.runtime.sendMessage({ action: 'getAuthDetails' });
        if (response && response.success) {
          console.log('[Popup] Auth details received:', { userId: response.userId, tokenPresent: !!response.token, userEmail: response.userEmail });
          setAuthDetails({ userId: response.userId, token: response.token, userEmail: response.userEmail, error: null });
        } else {
          console.error('[Popup] Failed to get auth details:', response?.error);
          const errorMsg = response?.error || 'Could not retrieve login status. Please ensure you are logged into Postfolio in an active tab.';
          setAuthDetails({ userId: null, token: null, userEmail: null, error: errorMsg });
          showToastMessage(errorMsg, 'error'); // Display auth error as toast
        }
      } catch (err: any) {
        console.error('[Popup] Error fetching auth details:', err);
        const errorMessage = 'Error connecting to Postfolio. Make sure it is open and you are logged in. (' + err.message + ')';
        setAuthDetails({ userId: null, token: null, userEmail: null, error: errorMessage });
        showToastMessage(errorMessage, 'error'); // Display connection error as toast
      }

      // 2. Initial content detection
      let activeTab: chrome.tabs.Tab | null = null;
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) activeTab = tab;
      } catch (e) {
        console.warn('Could not get active tab details:', e);
      }
      
      const initialUrl = activeTab?.url || '';
      const initialTitle = activeTab?.title || (initialUrl ? `Content from ${new URL(initialUrl).hostname}` : 'Unable to detect title');

      setContentData({ title: initialTitle, url: initialUrl, thumbnail: null });

      if (initialUrl) {
        await fetchContentDetailsForUrl(initialUrl, activeTab);
        } else {
         setContentData(prev => ({ ...prev, thumbnail: generateMockThumbnail("No page content detected") }));
        }
    
      // Add a delay before checking for pending captures
    setTimeout(() => {
      checkForPendingCapture();
    }, 200);
    
    // Listen for messages from background script
    const messageListener = (message: any) => {
      console.log('Popup received message:', message);
      if (message.action === 'areaSelectionComplete') {
        setContentData(prev => ({ ...prev, thumbnail: message.dataUrl }));
          showToastMessage('Area captured successfully', 'success');
          setActiveControl(null); hideLoadingState();
      } else if (message.action === 'areaSelectionError') {
          showToastMessage('Failed to capture area: ' + message.error, 'error');
          setActiveControl(null); hideLoadingState();
      } else if (message.action === 'areaSelectionCancelled') {
          showToastMessage('Area selection cancelled', 'warning');
          setActiveControl(null); hideLoadingState();
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);
      return () => chrome.runtime.onMessage.removeListener(messageListener);
    };

    initialSetup();
  }, []);
  
  useEffect(() => {
    // This effect runs when authDetails changes, especially after login.
    if (authDetails.token && authDetails.userId) { // User is logged in
      chrome.storage.local.get(['postfolioReturnToUrl'], async (result) => {
        if (result.postfolioReturnToUrl) {
          const savedUrl = result.postfolioReturnToUrl;
          console.log('[Popup] Found returnToUrlAfterLogin:', savedUrl);
          await chrome.storage.local.remove('postfolioReturnToUrl');

          if (contentData.url !== savedUrl) {
            console.log('[Popup] Current URL is different, restoring to saved URL and fetching details.');
            // Query for the tab again, in case its title changed or to pass it to fetchContentDetailsForUrl
            let restoredTab : chrome.tabs.Tab | null = null;
            try {
                const tabs = await chrome.tabs.query({url: savedUrl, currentWindow: true});
                if (tabs && tabs.length > 0) restoredTab = tabs[0];
                else { // If tab not found, maybe query for any active tab to get a base URL if needed
                    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (activeTab) restoredTab = activeTab; // Use active tab as a fallback for context
                }
            } catch(e) { console.warn("Could not get tab for restored URL", e); }

            setContentData(prev => ({
              ...prev,
              url: savedUrl,
              title: restoredTab?.title || `Loading details for ${new URL(savedUrl).hostname}...`,
              thumbnail: null,
            }));
            await fetchContentDetailsForUrl(savedUrl, restoredTab);
          } else {
            console.log('[Popup] Current URL matches saved URL, no restore action needed.');
          }
        }
      });
    }
  }, [authDetails.token, authDetails.userId]); // Runs when login status changes


  const checkForPendingCapture = async () => {
    try {
      console.log('[Popup] Checking for pending area capture...');
      const result = await chrome.storage.local.get(['pendingAreaCapture', 'pendingAreaError']);
      
      if (result.pendingAreaError) {
        const { error, timestamp } = result.pendingAreaError;
        const now = Date.now();
        if (now - timestamp < 30000) { // Only show recent errors
          console.log('[Popup] Found pending area error:', error);
          showToastMessage('Failed to capture area: ' + error, 'error');
          await chrome.storage.local.remove('pendingAreaError');
          return; // Prioritize showing error over a potentially stale capture
        } else {
          console.log('[Popup] Pending area error is too old, removing...');
          await chrome.storage.local.remove('pendingAreaError');
        }
      }
      
      if (result.pendingAreaCapture) {
        const { dataUrl, timestamp } = result.pendingAreaCapture;
        const now = Date.now();
        if (now - timestamp < 30000) {
          console.log('[Popup] Found pending area capture, applying to thumbnail...');
          setContentData(prev => ({ ...prev, thumbnail: dataUrl }));
          showToastMessage('Area captured successfully', 'success');
          await chrome.storage.local.remove('pendingAreaCapture');
        } else {
          console.log('[Popup] Pending capture is too old, ignoring and removing...');
          await chrome.storage.local.remove('pendingAreaCapture');
        }
      } else {
        console.log('[Popup] No pending area capture or recent error found in storage');
      }
    } catch (error) {
      console.error('[Popup] Error checking for pending capture:', error);
      showToastMessage('Error checking for pending items', 'error');
    }
  };

  const generateMockThumbnail = (text: string): string => {
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="360" height="140" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f8fafc"/>
            <stop offset="100%" style="stop-color:#e2e8f0"/>
          </linearGradient>
        </defs>
        <rect width="360" height="140" fill="url(#grad)"/>
        <text x="180" y="75" text-anchor="middle" fill="#6b7280" font-family="system-ui" font-size="14" font-weight="500">${text}</text>
      </svg>
    `)}`;
  };

  const showLoadingState = (message: string) => {
    setLoadingText(message);
    setIsLoading(true);
  };

  const hideLoadingState = () => {
    setIsLoading(false);
  };

  const showToastMessage = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastDetails({ message, type, show: true });
    setTimeout(() => setToastDetails(prev => ({ ...prev, show: false })), 4000); // Increased duration slightly
  };

  const closeToast = () => {
    setToastDetails(prev => ({ ...prev, show: false }));
  };

  const saveToPostfolio = async () => {
    if (!authDetails.token || !authDetails.userId) {
      showToastMessage(authDetails.error || 'Not logged in. Please log in to Postfolio and try again.', 'error');
      setIsLoading(false);
      return;
    }

    showLoadingState('Saving to Postfolio...');

    const postDataToSave = {
      url: contentData.url,
      title: contentData.title.trim(),
      thumbnailUrl: contentData.thumbnail,
      userId: authDetails.userId,
    };

    console.log('[Popup] Attempting to save post:', postDataToSave);

    try {
      const apiEndpoint = `${WEB_APP_BASE_URL}/api/posts`;
      
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authDetails.token}`,
        },
        body: JSON.stringify(postDataToSave),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Popup] Post saved successfully:', result);
        hideLoadingState();
        setSavedPostTitle(postDataToSave.title);
        setIsSaved(true);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Failed to save. Server error.' }));
        console.error('[Popup] Error saving post:', response.status, errorData);
        hideLoadingState();
        showToastMessage(`Error: ${errorData.error || response.statusText || 'Could not save post.'}`, 'error');
      }
    } catch (error: any) {
      console.error('[Popup] Network or other error saving post:', error);
      hideLoadingState();
      showToastMessage('Failed to save: ' + error.message, 'error');
    }
  };

  const captureVisibleArea = async () => {
    setActiveControl('visible');
    showLoadingState('Capturing visible area...');
    
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
      if (dataUrl) {
        setContentData(prev => ({ ...prev, thumbnail: dataUrl }));
        showToastMessage('Visible area captured', 'success');
      } else {
        showToastMessage('Failed to capture visible area', 'error');
      }
    } catch (error) {
      console.error('Error capturing visible area:', error);
      showToastMessage('Failed to capture visible area', 'error');
    } finally {
      hideLoadingState();
      setActiveControl(null);
    }
  };

  const uploadImage = () => {
    setActiveControl('upload');
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setContentData(prev => ({ ...prev, thumbnail: result }));
        showToastMessage('Image uploaded successfully', 'success');
      };
      reader.readAsDataURL(file);
    }
    setActiveControl(null);
  };

  const selectArea = async () => {
    setActiveControl('select');
    showLoadingState('Preparing area selection...');
    
    try {
      // Get current tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('Current tab:', tab);
      
      if (!tab.id) {
        throw new Error('No active tab found');
      }

      // The content script area-selector.content.ts is configured for auto-injection via defineContentScript.
      // Programmatic injection here is redundant and likely causing it to load twice.
      // try {
      //   console.log('Injecting content script...');
      //   await chrome.scripting.executeScript({
      //     target: { tabId: tab.id },
      //     files: ['content-scripts/area-selector.js']
      //   });
      //   console.log('Content script injected successfully');
      // } catch (injectionError) {
      //   console.log('Content script might already be injected:', injectionError);
      //   // Content script might already be injected, continue
      // }

      // Wait a bit for the script to initialize if it was auto-injected.
      // This delay might still be useful to ensure the auto-injected script is ready.
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('Sending message to tab to start area selection:', tab.id);
      
      // Send message to content script to start area selection
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'startAreaSelection' });
      console.log('Response from content script:', response);
      
      // Close popup to allow area selection
      window.close();
      
    } catch (error) {
      console.error('Error starting area selection:', error);
      showToastMessage('Failed to start area selection: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error');
      setActiveControl(null);
      hideLoadingState();
    }
  };

  const removeImage = () => {
    setActiveControl('remove');
    setContentData(prev => ({ ...prev, thumbnail: null }));
    showToastMessage('Thumbnail removed', 'success'); // Or 'warning' or a new 'info' type
    setActiveControl(null);
  };

  const autoResizeTextarea = () => {
    const textarea = titleInputRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }
  };

  const toggleUrlExpanded = () => {
    setIsUrlExpanded(!isUrlExpanded);
    if (!isUrlExpanded) {
      setTimeout(() => {
        urlInputRef.current?.focus();
      }, 200);
    }
  };

  const formatUrl = (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + urlObj.pathname;
    } catch (e) {
      return url;
    }
  };

  const closeExtension = () => {
    window.close();
  };

  const handlePrimaryAction = () => {
    if (authDetails.token && authDetails.userId) {
      saveToPostfolio();
    } else {
      // Assumed not logged in, or error exists that implies login needed
      if (contentData.url) {
        chrome.storage.local.set({ postfolioReturnToUrl: contentData.url }, () => {
          console.log('[Popup] Stored return URL:', contentData.url);
          chrome.tabs.create({ url: `${WEB_APP_BASE_URL}${LOGIN_PAGE_PATH}` });
          window.close();
        });
      } else {
        // If there's no URL (e.g. new tab page), just open login
        chrome.tabs.create({ url: `${WEB_APP_BASE_URL}${LOGIN_PAGE_PATH}` });
        window.close();
      }
    }
  };
  
  const primaryButtonText = () => {
    if (authDetails.token && authDetails.userId) return 'Save To Postfolio';
    return 'Login to Save';
  };

  const isPrimaryButtonDisabled = () => {
    if (authDetails.token && authDetails.userId) {
      return !contentData.title.trim(); // Disabled if no title when logged in
    }
    // Login button is never disabled if shown, unless maybe no URL? For now, always enabled.
    return false; 
  };

  if (isSaved) {
    return (
      <div className="extension-wrapper saved-ui-wrapper">
        <div className="saved-icon-container">
          <svg className="saved-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <h2 className="saved-title">Successfully Saved!</h2>
        {savedPostTitle && <p className="saved-post-title">{savedPostTitle}</p>}
        <button 
          className="primary-action done-button"
          onClick={() => window.close()}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="extension-wrapper">
      {/* Header */}
      <div className="header">
        <div className="brand">
          <div className="brand-icon">
            <img src="/icon/postfolio-logo-blue.png" alt="Postfolio" className="brand-logo" />
          </div>
        </div>
        <button className="close-button" onClick={closeExtension}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Title Section */}
        <div className="form-section">
          <label className="form-label">
            <span>Title</span>
            <span className="optional-label">Required</span>
          </label>
          <textarea
            ref={titleInputRef}
            className="form-input form-textarea"
            placeholder="Enter a descriptive title..."
            value={contentData.title}
            onChange={(e) => {
              setContentData(prev => ({ ...prev, title: e.target.value }));
              autoResizeTextarea();
            }}
          />
        </div>

        {/* Thumbnail Section */}
        <div className="form-section">
          <label className="form-label">
            <span>Thumbnail</span>
            <span className="optional-label">Optional</span>
          </label>
          
          <div className="thumbnail-container">
            {contentData.thumbnail ? (
              <>
                <img 
                  className="thumbnail-image" 
                  src={contentData.thumbnail} 
                  alt="Thumbnail"
                  onError={(e) => {
                    console.error('Thumbnail image failed to load:', contentData.thumbnail);
                    console.error('Image error event:', e);
                    setContentData(prev => ({ ...prev, thumbnail: null }));
                    showToastMessage('Failed to load thumbnail image', 'error');
                  }}
                  onLoad={() => {
                    console.log('Thumbnail image loaded successfully:', contentData.thumbnail);
                  }}
                />
                <div className="thumbnail-overlay">
                  <button className="thumbnail-change-btn" onClick={removeImage}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <div className="thumbnail-placeholder">
                <svg className="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21,15 16,10 5,21"/>
                </svg>
                <div className="placeholder-text">Add a thumbnail</div>
                <div className="placeholder-subtext">Choose how to capture or upload</div>
              </div>
            )}
          </div>

          {/* Thumbnail Controls */}
          <div className="thumbnail-controls">
            <button 
              className={`control-button ${activeControl === 'visible' ? 'active' : ''}`}
              onClick={captureVisibleArea}
              title="Capture visible area of the page"
            >
              <svg className="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span>Visible area</span>
            </button>
            <button 
              className={`control-button ${activeControl === 'select' ? 'active' : ''}`}
              onClick={selectArea}
              title="Select a specific area to capture"
            >
              <svg className="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 9h6v6h-6z"/>
                <path d="M21 15V6a2 2 0 0 0-2-2H9"/>
                <path d="M3 9v9a2 2 0 0 0 2 2h9"/>
              </svg>
              <span>Select area</span>
            </button>
            <button 
              className={`control-button ${activeControl === 'upload' ? 'active' : ''}`}
              onClick={uploadImage}
              title="Upload an image from your device"
            >
              <svg className="control-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Upload</span>
            </button>
          </div>
        </div>

        {/* URL Section - Below Thumbnail */}
        <div className="form-section">
          <button className="url-toggle-minimal" onClick={toggleUrlExpanded}>
            <svg 
              className={`chevron-icon ${isUrlExpanded ? 'expanded' : ''}`} 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <polyline points="6,9 12,15 18,9"/>
            </svg>
            <span className="more-field-text">1 more field</span>
          </button>
          
          {isUrlExpanded && (
            <div className="url-input-container">
              <label className="form-label">
                <span>URL</span>
                <div className="auto-detected">Auto-detected</div>
              </label>
              <input
                ref={urlInputRef}
                type="url"
                className="form-input url-input"
                value={contentData.url}
                onChange={(e) => setContentData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="Enter URL..."
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="actions-section">
          <button 
            className="primary-action" 
            onClick={handlePrimaryAction}
            disabled={isPrimaryButtonDisabled()}
          >
             {primaryButtonText()}
          </button>
          
          {isPrimaryButtonDisabled() && authDetails.token && (
            <div className="validation-hint">
              Please enter a title to continue
            </div>
          )}
          {authDetails.error && (
             <div className="validation-hint">
              {authDetails.error}
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="loading-overlay active">
          <div className="loading-spinner"></div>
          <div className="loading-text">{loadingText}</div>
        </div>
      )}

      {/* Toast Notification Commented Out
      {toastDetails.show && (
        <div className={`toast ${toastDetails.type} show`}>
          <div className="toast-icon-container">
            {toastDetails.type === 'success' && (
              // Using a checkmark similar to CircleCheck from lucide
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            )}
            {toastDetails.type === 'error' && (
              // Using an X similar to CircleX from lucide
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            )}
            {toastDetails.type === 'warning' && (
              // Using an exclamation in a circle, similar to AlertTriangle or AlertCircle
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            )}
          </div>
          <p className="toast-message">{toastDetails.message}</p>
          <button className="toast-close-button" onClick={closeToast}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      )}
      */}
    </div>
  );
};

export default App;
