import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { ContentData } from './types';

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
    detectPageContent();
  }, []);

  const detectPageContent = async () => {
    try {
      // Get current tab information
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tab && tab.url && tab.title) {
        setContentData({
          title: tab.title,
          url: tab.url,
          thumbnail: null
        });

        // Try to get favicon or page screenshot
        setTimeout(() => {
          const mockThumbnail = generateMockThumbnail("Auto-detected from page");
          setContentData(prev => ({ ...prev, thumbnail: mockThumbnail }));
        }, 1000);
      }
    } catch (error) {
      console.error('Error detecting page content:', error);
      // Fallback data for testing
      setContentData({
        title: "Amazing Tutorial - How to Build Extensions",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        thumbnail: null
      });
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

  const selectArea = () => {
    setActiveControl('select');
    showToastMessage('Area selection mode activated');
    // In a real implementation, this would open area selection UI
    setTimeout(() => {
      const mockThumbnail = generateMockThumbnail("Area selected");
      setContentData(prev => ({ ...prev, thumbnail: mockThumbnail }));
    }, 1000);
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
