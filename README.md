# Save to Postfolio - Browser Extension

A modern browser extension that allows you to save web content to your Postfolio with automatic content detection and screenshot capabilities.

## Features

- **Automatic Content Detection**: Automatically extracts page title and URL
- **Thumbnail Options**: Multiple ways to capture thumbnails:
  - Auto-detection from current page
  - Visible area capture
  - Area selection
  - Image upload
  - Remove thumbnail option
- **Context Menu Integration**: Right-click on any page to save to Postfolio
- **Modern UI**: Clean, responsive interface matching your design specifications
- **Real-time Preview**: See exactly what will be saved before confirming

## Installation

### Development Mode

1. Clone the repository:
   ```bash
   git clone [your-repo-url]
   cd postfolio-browser-extension
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked"
   - Select the `.output/chrome-mv3` folder

### Production Build

For distribution:
```bash
npm run zip
```

This creates a zip file in the `.output` directory ready for Chrome Web Store submission.

## Usage

### Via Extension Icon
1. Click the Postfolio extension icon in your browser toolbar
2. The extension will automatically detect the current page content
3. Customize the title, thumbnail, or other details if needed
4. Click "Save to Postfolio"

### Via Context Menu
1. Right-click anywhere on a webpage
2. Select "Save to Postfolio" from the context menu
3. The extension popup will open with the page content pre-filled

### Thumbnail Options

- **Visible Area**: Captures the currently visible portion of the webpage
- **Select Area**: Interactive area selection tool - click and drag to select any area of the page for capture
- **Upload**: Upload your own image as thumbnail
- **Remove**: Remove the thumbnail entirely

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run zip` - Create distribution zip
- `npm run dev:firefox` - Development mode for Firefox
- `npm run build:firefox` - Build for Firefox

### Project Structure

```
entrypoints/
├── popup/           # Extension popup UI
│   ├── App.tsx      # Main React component
│   ├── App.css      # Popup styles
│   ├── main.tsx     # React entry point
│   └── types.ts     # TypeScript types
├── background.ts    # Background script
└── content.ts       # Content script

public/
└── icon/           # Extension icons
```

### Tech Stack

- **Framework**: WXT (Web Extension Tools)
- **Frontend**: React + TypeScript
- **Build Tool**: Vite
- **Styling**: CSS (custom design system)

### Browser APIs Used

- `chrome.tabs` - For accessing current tab information
- `chrome.contextMenus` - For right-click context menu
- `chrome.action` - For extension toolbar interaction
- Screen Capture APIs - For thumbnail generation

## Features in Detail

### Auto-Detection
The extension automatically:
- Extracts the page title
- Gets the current URL
- Attempts to find relevant images for thumbnails

### Expandable Edit Panel
- Toggle between quick save and detailed editing
- Smooth animations and transitions
- Form validation for URLs
- Auto-resizing text areas

### Loading States & Feedback
- Loading spinners for async operations
- Toast notifications for user feedback
- Status indicators for current state

### Responsive Design
- Works across different screen sizes
- Optimized for extension popup constraints
- Accessibility-friendly focus states

## Browser Support

- Chrome (Manifest V3)
- Firefox support available via separate build
- Edge (Chromium-based)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

[Your License Here]

## Roadmap

- [x] Area selection tool for custom screenshots
- [ ] Multiple collection support
- [ ] Keyboard shortcuts
- [ ] Dark mode theme
- [ ] Bulk save functionality
- [ ] Integration with Postfolio API
