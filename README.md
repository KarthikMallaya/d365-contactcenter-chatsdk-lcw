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
- **Agent switching** - Switch between support topics *(UI only - routing not implemented)*
- **Suggested actions** - Quick reply buttons from bot responses
- **Follow-up questions** - AI-powered question suggestions *(demo feature)*
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

### 🔄 Agent Switching (UI Demo - Implementation Pending)

> ⚠️ **Partial Implementation**: The agent switching UI is fully functional, but the backend routing to different Omnichannel workstreams has **not been implemented yet**. Currently, switching agents only updates the UI state and shows a toast notification.

The widget displays a panel for switching between different support topics:
- General Support
- Technical Support
- Sales & Products
- Billing & Account
- Feedback & Suggestions
- Urgent Assistance

**What's Implemented:**
- ✅ Agent selection UI panel
- ✅ Dynamic agent list loading from Power Automate (`agentsUrl`)
- ✅ Visual state management and toast notifications

**What Needs Implementation:**
- ❌ Connecting to different Omnichannel workstreams (different `widgetId` values)
- ❌ Ending current chat session and starting new one with different widget
- ❌ Preserving context/transcript when switching

**Intended Behavior (for contributors):**

Each "agent" should map to a different **Chat Widget ID** in Dynamics 365 Omnichannel, routing users to different queues/workstreams:

```typescript
// Example: Agent to Widget mapping (not yet implemented)
const agentWidgetMapping = {
  "general": "widget-id-for-general-queue",
  "technical": "widget-id-for-tech-support-queue",
  "sales": "widget-id-for-sales-queue",
  "billing": "widget-id-for-billing-queue"
};

// When user switches agent, the app should:
// 1. End current chat session
// 2. Reinitialize SDK with new widgetId
// 3. Start new chat session with the appropriate queue
```

**Dynamic Agents via Power Automate:**

You can provide a custom agent list by passing an `agentsUrl` parameter:
```
?agentsUrl=https://your-flow.azure.com/api/agents
```

Expected response format:
```json
{
  "agents": [
    { "id": "support", "name": "Customer Support", "description": "General help", "icon": "" },
    { "id": "tech", "name": "Technical Team", "description": "Technical issues", "icon": "" }
  ]
}
```

### 🤖 AI-Powered Follow-Up Questions (Demo Feature)

> ⚠️ **Demo Feature**: The follow-up question generation is included as a demonstration. The default `pauUrl` points to a sample Power Automate flow that may not be available. **Contributors should implement their own endpoint.**

After each bot response, the widget can fetch AI-generated follow-up questions to help users continue the conversation. This feature calls an HTTP endpoint (typically a Power Automate flow or Azure Function) that returns suggested questions.

#### Expected JSON Response Format

Your endpoint should return JSON in one of these formats:

**Option 1: Array property (recommended)**
```json
{
  "questions": [
    { "item": "How do I reset my password?" },
    { "item": "What are your business hours?" }
  ]
}
```

**Option 2: Simple string array**
```json
{
  "suggestions": [
    "How do I reset my password?",
    "What are your business hours?"
  ]
}
```

The widget extracts the first array found in the response and displays up to 2 questions.

#### Request Payload

Your endpoint receives a POST request with:
```json
{
  "botResponse": "The last message from the bot/agent",
  "companyName": "contoso.com",
  "url": "contoso.com"
}
```

#### Configuration

Pass your endpoint URL via the `pauUrl` query parameter:
```
?pauUrl=https://your-function.azurewebsites.net/api/generate-questions
```

**Implementation Ideas:**
- Azure Function with Azure OpenAI
- Power Automate flow with AI Builder
- Custom API with any LLM provider

## 🌐 Hosting & Deployment

This chat widget is a **static web application** that must be hosted on a web server to function. It cannot run as a local file due to browser security restrictions and the need to communicate with Dynamics 365 APIs.

### Recommended Hosting Options

| Platform | Description | Best For |
|----------|-------------|----------|
| **Azure Static Web Apps** | Free tier available, global CDN, custom domains | Production deployments |
| **Azure App Service** | Full web app hosting with SSL | Enterprise deployments |
| **Azure Blob Storage** | Static website hosting, very low cost | Simple deployments |
| **GitHub Pages** | Free hosting for public repos | Demo/testing |
| **Vercel / Netlify** | Free tier, automatic deployments | Quick prototyping |

### Deployment Steps

1. **Build the production bundle:**
   ```bash
   npm run build
   ```

2. **Deploy the `dist/` folder** to your hosting platform

3. **Configure your domain** in Dynamics 365:
   - Go to **Customer Service admin center** → **Channels** → **Chat**
   - Add your hosted domain to the **Allowed origins** list

### Environment Considerations

- **HTTPS Required**: Omnichannel SDK requires secure connections
- **CORS**: Your hosting domain must be whitelisted in D365 admin center
- **Custom Domain**: Recommended for production use with SSL certificate

### Example: Azure Static Web Apps Deployment

```bash
# Install Azure SWA CLI
npm install -g @azure/static-web-apps-cli

# Build the app
npm run build

# Deploy to Azure
swa deploy ./dist --env production
```

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

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Disclaimer

> ⚠️ **This is a community project, NOT an official Microsoft product.**

- Provided "AS IS" without warranty of any kind
- Not endorsed by or affiliated with Microsoft Corporation
- Microsoft, Dynamics 365, Copilot Studio are trademarks of Microsoft Corporation
- Requires a valid Microsoft Dynamics 365 Contact Center license
- Use at your own risk in production environments

## 🔗 Related Resources

- [Microsoft Omnichannel Chat SDK](https://github.com/microsoft/omnichannel-chat-sdk)
- [Dynamics 365 Contact Center Documentation](https://learn.microsoft.com/en-us/dynamics365/contact-center/)
- [Adaptive Cards](https://adaptivecards.io/)
- [Copilot Studio](https://www.microsoft.com/en-us/microsoft-copilot/microsoft-copilot-studio)

---

**Built for Microsoft Dynamics 365 Contact Center** | Powered by Microsoft Copilot Studio
