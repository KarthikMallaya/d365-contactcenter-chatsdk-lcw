# Copilot Chat Widget - Browser Extension

A browser extension that adds your custom Copilot chat widget to any website. Works with Chrome, Edge, Brave, and other Chromium-based browsers.

> **⚠️ Demo Feature:** This extension is part of **Layer 2** (Demo & Partner) and is intended for testing and demonstrations only. For production deployments, embed the widget directly in your website.

## 📥 Download

**First, download the extension files:**

1. Go to the [GitHub repository](https://github.com/KarthikMallaya/d365-contactcenter-chatsdk-lcw)
2. Click the green **"Code"** button → **"Download ZIP"**
3. Extract the ZIP file
4. The `browser-extension` folder contains all the extension files

## Features

- 🎨 Premium gradient design matching your chat widget
- ⚙️ Easy configuration through popup
- 🌐 Works on all websites
- 📱 Responsive design
- 🔒 Secure storage of settings
- 🎯 Passes current page URL to chat widget

## Installation

### Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `browser-extension` folder from the extracted ZIP
5. The extension is now installed!

### Microsoft Edge
1. Open Edge and go to `edge://extensions/`
2. Enable "Developer mode" in the left sidebar
3. Click "Load unpacked"
4. Select the `browser-extension` folder
5. The extension is now installed!

### Brave / Other Chromium Browsers
Same process as Chrome — navigate to the extensions page and load unpacked.

## Configuration

1. Click the extension icon in Chrome toolbar
2. Fill in your chat widget settings:
   - **Organization ID** (required)
   - **Organization URL** (required)
   - **Widget ID** (required)
   - **Company Name** (optional - for logo branding)
   - **Power Automate URLs** (optional - for questions & agents)
3. Toggle "Enable on all websites" if needed
4. Click "Save Settings"

## Usage

Once configured:
1. Visit any website
2. You'll see a floating purple chat button in the bottom-right corner
3. Click it to open the chat widget
4. The widget will have your configuration + the current page URL

## Current Page URL

The extension passes the current page URL as a `referrer` parameter. You can access it in your widget via:

```javascript
const urlParams = new URLSearchParams(window.location.search);
const currentPage = urlParams.get('referrer');
```

This lets your agents know what page the user was on when they started the chat.

## Development

Files:
- `manifest.json` - Extension configuration
- `popup.html/js` - Settings UI
- `content.js/css` - Chat button & iframe injected into pages
- `icons/` - Extension icons (16x16, 48x48, 128x128)

## Building Icons

You'll need to add icon images in the `icons/` folder:
- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels  
- `icon128.png` - 128x128 pixels

Use a purple/gradient chat bubble icon matching your brand.
