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

const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Processing...');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [activeControl, setActiveControl] = useState<string | null>(null);
  const [isUrlExpanded, setIsUrlExpanded] = useState(false);
  const [contentData, setContentData] = useState<ContentData>({
    title: '',
    url: '',
    thumbnail: null
  });

  const titleInputRef = useRef<HTMLTextAreaElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const detectPageContent = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab && tab.id && tab.url && tab.title) {
          let initialThumbnail: string | null = null;
          const videoId = getYoutubeVideoId(tab.url);

          if (videoId) {
            initialThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          } else if (tab.id && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('file://')) {
            // Try to get og:image or first significant image from content script
            try {
              // Ensure content script is available. WXT auto-injects based on entrypoint definition.
              // No explicit injection needed here if area-selector.content.ts is correctly configured.
              console.log('Attempting to fetch generic image from content script for tab:', tab.id);
              const imagesFromContentScript = await chrome.tabs.sendMessage(tab.id, { action: 'extractPageImages' });
              
              if (imagesFromContentScript) {
                // Prioritize image sources
                if (imagesFromContentScript.ogImage) {
                  initialThumbnail = imagesFromContentScript.ogImage;
                } else if (imagesFromContentScript.jsonLdImage) {
                  initialThumbnail = imagesFromContentScript.jsonLdImage;
                } else if (imagesFromContentScript.twitterImage) {
                  initialThumbnail = imagesFromContentScript.twitterImage;
                } else if (imagesFromContentScript.itempropImage) {
                  initialThumbnail = imagesFromContentScript.itempropImage;
                } else if (imagesFromContentScript.linkRelImage) {
                  initialThumbnail = imagesFromContentScript.linkRelImage;
                } else if (imagesFromContentScript.firstSignificantImage) {
                  initialThumbnail = imagesFromContentScript.firstSignificantImage;
                }
                console.log('Received images from content script:', imagesFromContentScript, 'Selected:', initialThumbnail);
              } else {
                console.log('No significant images found by content script.');
              }
            } catch (err: any) {
              console.warn('Failed to communicate with content script for image extraction or no images found:', err.message);
              if (err.message && (err.message.includes('Receiving end does not exist') || err.message.includes('cannot be scripted'))) {
                console.log('Content script not available or not allowed on this page.');
              }
              // Fall through, initialThumbnail remains as is (null or YT thumbnail if that was tried first)
            }
          }

          setContentData({
            title: tab.title,
            url: tab.url,
            thumbnail: initialThumbnail // This will be null if no image found, or URL string
          });

          // Fallback to mock thumbnail if, after all initial loads, thumbnail is still null
          setTimeout(() => {
            setContentData(prev => {
              if (prev.thumbnail === null) {
                const mockThumbnail = generateMockThumbnail("Auto-detected from page");
                return { ...prev, thumbnail: mockThumbnail };
              }
              return prev;
            });
          }, 500); // Delay to allow other processes (like pending capture) to potentially set thumbnail
        } else {
          console.warn('Could not get tab details for content detection.');
          setContentData({
            title: 'Unable to detect title',
            url: '',
            thumbnail: null
          });
          setTimeout(() => {
            setContentData(prev => {
              if (prev.thumbnail === null) {
                const mockThumbnail = generateMockThumbnail("No page content detected");
                return { ...prev, thumbnail: mockThumbnail };
              }
              return prev;
            });
          }, 500);
        }
      } catch (error: any) {
        console.error('Error detecting page content:', error.message);
        setContentData({
          title: "Error detecting title",
          url: "",
          thumbnail: null
        });
        setTimeout(() => {
          setContentData(prev => {
            if (prev.thumbnail === null) {
              const mockThumbnail = generateMockThumbnail("Detection error");
              return { ...prev, thumbnail: mockThumbnail };
            }
            return prev;
          });
        }, 500);
      }
    };

    detectPageContent();
    checkForPendingCapture();
    
    // Listen for messages from background script
    const messageListener = (message: any) => {
      console.log('Popup received message:', message);
      
      if (message.action === 'areaSelectionComplete') {
        console.log('Area selection completed, setting thumbnail...');
        setContentData(prev => ({ ...prev, thumbnail: message.dataUrl }));
        showToastMessage('Area captured successfully');
        setActiveControl(null);
        hideLoadingState();
      } else if (message.action === 'areaSelectionError') {
        console.log('Area selection error:', message.error);
        showToastMessage('Failed to capture area: ' + message.error);
        setActiveControl(null);
        hideLoadingState();
      } else if (message.action === 'areaSelectionCancelled') {
        console.log('Area selection cancelled');
        showToastMessage('Area selection cancelled');
        setActiveControl(null);
        hideLoadingState();
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    
    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  const checkForPendingCapture = async () => {
    try {
      console.log('Checking for pending area capture...');
      const result = await chrome.storage.local.get(['pendingAreaCapture', 'pendingAreaError']);
      
      // Check for pending error first
      if (result.pendingAreaError) {
        const { error, timestamp } = result.pendingAreaError;
        const now = Date.now();
        
        if (now - timestamp < 30000) {
          console.log('Found pending area error:', error);
          showToastMessage('Failed to capture area: ' + error);
          await chrome.storage.local.remove('pendingAreaError');
          return;
        } else {
          await chrome.storage.local.remove('pendingAreaError');
        }
      }
      
      // Check for pending capture
      if (result.pendingAreaCapture) {
        const { dataUrl, timestamp } = result.pendingAreaCapture;
        const now = Date.now();
        
        // Only use captures from the last 30 seconds to avoid stale data
        if (now - timestamp < 30000) {
          console.log('Found pending area capture, applying to thumbnail...');
          setContentData(prev => ({ ...prev, thumbnail: dataUrl }));
          showToastMessage('Area captured successfully');
          
          // Clear the pending capture
          await chrome.storage.local.remove('pendingAreaCapture');
        } else {
          console.log('Pending capture is too old, ignoring...');
          await chrome.storage.local.remove('pendingAreaCapture');
        }
      } else {
        console.log('No pending area capture found');
      }
    } catch (error) {
      console.error('Error checking for pending capture:', error);
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

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const saveToPostfolio = async () => {
    showLoadingState('Saving to Postfolio...');
    
    // Simulate API call
    setTimeout(() => {
      hideLoadingState();
      showToastMessage('Successfully saved to Postfolio!');
      
      // Auto-close after success
      setTimeout(() => {
        window.close();
      }, 2000);
    }, 1800);
  };

  const captureVisibleArea = async () => {
    setActiveControl('visible');
    showLoadingState('Capturing visible area...');
    
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
      if (dataUrl) {
        setContentData(prev => ({ ...prev, thumbnail: dataUrl }));
        showToastMessage('Visible area captured');
      } else {
        showToastMessage('Failed to capture visible area');
      }
    } catch (error) {
      console.error('Error capturing visible area:', error);
      showToastMessage('Failed to capture visible area');
    } finally {
      hideLoadingState();
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
        showToastMessage('Image uploaded successfully');
      };
      reader.readAsDataURL(file);
    }
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

      // First try to inject the content script if it's not already there
      try {
        console.log('Injecting content script...');
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-scripts/area-selector.js']
        });
        console.log('Content script injected successfully');
      } catch (injectionError) {
        console.log('Content script might already be injected:', injectionError);
        // Content script might already be injected, continue
      }

      // Wait a bit for the script to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('Sending message to tab:', tab.id);
      
      // Send message to content script to start area selection
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'startAreaSelection' });
      console.log('Response from content script:', response);
      
      // Close popup to allow area selection
      window.close();
      
    } catch (error) {
      console.error('Error starting area selection:', error);
      showToastMessage('Failed to start area selection: ' + (error instanceof Error ? error.message : 'Unknown error'));
      setActiveControl(null);
      hideLoadingState();
    }
  };

  const removeImage = () => {
    setActiveControl('remove');
    setContentData(prev => ({ ...prev, thumbnail: null }));
    showToastMessage('Thumbnail removed');
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
                <img className="thumbnail-image" src={contentData.thumbnail} alt="Thumbnail" />
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
            onClick={saveToPostfolio}
            disabled={!contentData.title.trim()}
          >
            Save To Postfolio
          </button>
          
          {!contentData.title.trim() && (
            <div className="validation-hint">
              Please enter a title to continue
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

      {/* Success Toast */}
      {showToast && (
        <div className="success-toast show">
          <div className="toast-icon">✓</div>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default App;
