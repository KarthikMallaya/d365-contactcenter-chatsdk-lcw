# D365 Contact Center Chat SDK - Live Chat Widget

A modern, customizable chat widget built with React and TypeScript that integrates with **Microsoft Dynamics 365 Contact Center** (Omnichannel for Customer Service) using the official Chat SDK.

![Powered by Microsoft Copilot Studio](https://img.shields.io/badge/Powered%20by-Microsoft%20Copilot%20Studio-blue)
![React](https://img.shields.io/badge/React-18.2-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Vite](https://img.shields.io/badge/Vite-5.1-646cff)

## 🎯 Overview

This widget provides a fully-featured, embeddable chat experience that connects to your Dynamics 365 Contact Center environment. It supports both **Copilot Studio bots** and **live human agents**, with seamless handoff between them.

### Key Capabilities

- **Real-time chat** with bot and human agents via Omnichannel SDK
- **Adaptive Cards** rendering for rich interactive content
- **File attachments** - Upload images (JPG, PNG) and PDFs
- **Voice input** - Speech-to-text for hands-free messaging
- **Text-to-speech** - Read agent responses aloud
- **Email transcript** - Send conversation history to email
- **Dynamic branding** - Auto-extract colors from company logos
- **Queue management** - Display position and estimated wait time
- **Agent switching** - Switch between different support topics
- **Suggested actions** - Quick reply buttons from bot responses
- **Follow-up questions** - AI-powered question suggestions via Power Automate
- **PWA support** - Add to Home Screen with dynamic icons
- **Chrome Extension** - Inject widget into any website

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- A Dynamics 365 Contact Center environment with:
  - Organization ID
  - Organization URL
  - Chat Widget ID (from Omnichannel admin)

### Installation

```bash
# Clone the repository
git clone https://github.com/KarthikMallaya/d365-contactcenter-chatsdk-lcw.git
cd d365-contactcenter-chatsdk-lcw

# Install dependencies
npm install

# Start development server
npm run dev
```

### Configuration

The widget is configured via URL parameters. Navigate to:

```
http://localhost:5173/?orgId=YOUR_ORG_ID&orgUrl=https://YOUR_ORG.crm.dynamics.com&widgetId=YOUR_WIDGET_ID
```

#### Required Parameters

| Parameter | Description |
|-----------|-------------|
| `orgId` | Your Dynamics 365 Organization ID |
| `orgUrl` | Your Dynamics 365 Organization URL (e.g., `https://contoso.crm.dynamics.com`) |
| `widgetId` | Chat Widget ID from Omnichannel admin center |

#### Optional Parameters

| Parameter | Description |
|-----------|-------------|
| `company` | Company domain for automatic logo and branding (e.g., `contoso.com`) |
| `primaryColor` | Custom primary brand color (hex, e.g., `#0078D4`) |
| `secondaryColor` | Custom secondary color |
| `lightColor` | Custom light accent color |
| `darkColor` | Custom dark accent color |
| `pauUrl` | Power Automate URL for AI follow-up question generation |
| `agentsUrl` | Power Automate URL for dynamic agent/topic list |
| `channelId` | Channel identifier (defaults to `lcw`) |

### Example URL

```
https://yourapp.com/?orgId=abc123-def456&orgUrl=https://contoso.crm.dynamics.com&widgetId=xyz789&company=contoso.com&primaryColor=%230078D4
```

## 🏗️ Project Structure

```
├── src/
│   ├── App.tsx              # Main chat widget component
│   ├── chatSdk.ts           # Omnichannel SDK wrapper
│   ├── config.ts            # Configuration & branding utilities
│   ├── colorExtractor.ts    # Dynamic color extraction from logos
│   ├── index.css            # Styles
│   ├── main.tsx             # React entry point
│   └── assets/              # Icons and images
├── chrome-extension/        # Browser extension for embedding
│   ├── manifest.json
│   ├── content.js
│   ├── popup.html
│   └── icons/
├── docs/                    # Architecture documentation
│   ├── ARCHITECTURE.md
│   ├── ARCHITECTURE_OVERVIEW.md
│   └── PRODUCTIZED_WIDGET_GUIDE.md
├── dist/                    # Production build output
└── public/                  # Static assets
```

## ✨ Features

### 💬 Chat Experience

- **Markdown rendering** - Rich text formatting with code blocks, lists, links
- **Typing indicators** - See when agents are composing responses
- **Message timestamps** - Clear time display for each message
- **Auto-scroll** - Smooth scrolling to latest messages

### 📎 File Handling

- **Image uploads** - JPG, PNG up to 5MB with preview thumbnails
- **PDF uploads** - Document attachments up to 5MB
- **Camera capture** - Direct photo capture on mobile devices
- **Download support** - Receive and download files from agents

### 🎨 Dynamic Branding

The widget automatically adapts to your company's brand:

1. **Logo Detection** - Fetches company logo from domain
2. **Color Extraction** - Extracts primary colors from logo
3. **Theme Application** - Applies colors to UI elements
4. **Predefined Brands** - Built-in color schemes for major companies

```typescript
// Custom colors via URL
?primaryColor=%23FF5722&secondaryColor=%23E64A19
```

### 🎤 Voice Features

- **Speech-to-text** - Click microphone to dictate messages
- **Text-to-speech** - Click speaker icon to hear agent responses
- **Language support** - Uses browser's speech recognition

### 📧 Email Transcript

Users can request their conversation transcript via email:
- Click the email icon in the action toolbar
- Enter email address
- Transcript is sent via Omnichannel's email functionality

### 🔄 Agent Switching

Switch between different support topics/queues without ending the chat:
- General Support
- Technical Support
- Sales & Products
- Billing & Account
- Feedback & Suggestions
- Urgent Assistance

Dynamic agents can be loaded from Power Automate.

## 🧩 Chrome Extension

The included Chrome extension allows injecting the chat widget into any website.

### Installation

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. Configure your Omnichannel parameters in the extension popup

See [chrome-extension/README.md](chrome-extension/README.md) for detailed instructions.

## 🛠️ Development

### Build Commands

```bash
# Development server with hot reload
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

### Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **@microsoft/omnichannel-chat-sdk** - Official D365 Chat SDK
- **Adaptive Cards** - Rich card rendering
- **Marked** - Markdown parsing
- **DOMPurify** - XSS sanitization

## 📚 Documentation

- [Architecture Overview](docs/ARCHITECTURE_OVERVIEW.md) - High-level system design
- [Detailed Architecture](docs/ARCHITECTURE.md) - Component deep-dive
- [Productization Guide](docs/PRODUCTIZED_WIDGET_GUIDE.md) - Deployment best practices

## 🔧 Finding Your Omnichannel Parameters

1. Go to **Dynamics 365 Customer Service admin center**
2. Navigate to **Channels** → **Chat**
3. Select your chat widget
4. Copy the **Organization ID**, **Organization URL**, and **Widget ID** from the widget script

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is intended for use with Microsoft Dynamics 365 Contact Center.

## 🔗 Related Resources

- [Microsoft Omnichannel Chat SDK](https://github.com/microsoft/omnichannel-chat-sdk)
- [Dynamics 365 Contact Center Documentation](https://learn.microsoft.com/en-us/dynamics365/contact-center/)
- [Adaptive Cards](https://adaptivecards.io/)
- [Copilot Studio](https://www.microsoft.com/en-us/microsoft-copilot/microsoft-copilot-studio)

---

**Built for Microsoft Dynamics 365 Contact Center** | Powered by Microsoft Copilot Studio
