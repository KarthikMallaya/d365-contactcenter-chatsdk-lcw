// Chat widget state
let chatButton = null;
let chatContainer = null;
let settings = null;

// Initialize the extension
async function init() {
  settings = await chrome.storage.sync.get([
    'orgId',
    'orgUrl',
    'widgetId',
    'company',
    'pauUrl',
    'agentsUrl',
    'enabled'
  ]);

  // Only show if enabled and settings exist
  if (settings.enabled !== false && settings.orgId && settings.orgUrl && settings.widgetId) {
    createChatButton();
  }
}

// Create floating chat button
function createChatButton() {
  // Remove existing button if any
  if (chatButton) {
    chatButton.remove();
  }

  chatButton = document.createElement('div');
  chatButton.id = 'copilot-chat-button';
  chatButton.innerHTML = `
    <img src="${chrome.runtime.getURL('icons/icon48.png')}" alt="Chat" />
  `;
  
  chatButton.addEventListener('click', openChat);
  document.body.appendChild(chatButton);
}

// Open chat widget
function openChat() {
  // If chat is already created but hidden (minimized), just show it
  if (chatContainer && chatContainer.style.display === 'none') {
    chatContainer.style.display = 'block';
    const backdrop = document.getElementById('copilot-chat-backdrop');
    if (backdrop) backdrop.style.display = 'block';
    chatButton.style.display = 'none';
    return;
  }

  // If chat is already open, do nothing (shouldn't happen as button is hidden)
  if (chatContainer) {
    return;
  }

  // Hide chat button when opening chat
  chatButton.style.display = 'none';

  // Get current page URL (base domain)
  const baseUrl = `${window.location.protocol}//${window.location.host}`;
  const fullUrl = window.location.href;
  const domain = window.location.hostname; // e.g., www.bankofamerica.com

  // Build widget URL with config
  const params = new URLSearchParams({
    orgId: settings.orgId,
    orgUrl: settings.orgUrl,
    widgetId: settings.widgetId,
    company: settings.company || domain, // Use configured company or auto-detect from URL
    referrer: encodeURIComponent(baseUrl),
    pageUrl: encodeURIComponent(fullUrl)
  });
  if (settings.pauUrl) params.append('pauUrl', settings.pauUrl);
  if (settings.agentsUrl) params.append('agentsUrl', settings.agentsUrl);

  const widgetUrl = `https://kuocwidget-aecddkc9cueqfxfu.australiaeast-01.azurewebsites.net/?${params.toString()}`;

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'copilot-chat-backdrop';
  document.body.appendChild(backdrop);

  // Create chat container (no X button - controlled by React app)
  chatContainer = document.createElement('div');
  chatContainer.id = 'copilot-chat-container';
  chatContainer.innerHTML = `
    <iframe id="copilot-chat-iframe" src="${widgetUrl}" frameborder="0" allow="microphone; camera; clipboard-write"></iframe>
  `;

  document.body.appendChild(chatContainer);

  // Minimize chat (don't end session) - hide UI but keep iframe alive
  const minimizeChat = () => {
    console.log('minimizeChat() called');
    const backdropEl = document.getElementById('copilot-chat-backdrop');
    console.log('backdropEl:', backdropEl);
    if (backdropEl) {
      console.log('Setting backdrop display to none');
      backdropEl.style.setProperty('display', 'none', 'important');
      console.log('Backdrop display is now:', backdropEl.style.display);
    }
    console.log('chatContainer:', chatContainer);
    if (chatContainer) {
      console.log('Setting chatContainer display to none');
      chatContainer.style.setProperty('display', 'none', 'important');
      console.log('chatContainer display is now:', chatContainer.style.display);
    }
    if (chatButton) {
      console.log('Setting chatButton display to flex');
      chatButton.style.setProperty('display', 'flex', 'important');
    }
    console.log('Chat minimized - checking visibility');
    console.log('Backdrop computed style:', backdropEl ? window.getComputedStyle(backdropEl).display : 'N/A');
    console.log('ChatContainer computed style:', chatContainer ? window.getComputedStyle(chatContainer).display : 'N/A');
  };

  // End chat session (called from iframe after confirmation) - destroy everything
  const endChatSession = () => {
    console.log('endChatSession() called');
    const backdropEl = document.getElementById('copilot-chat-backdrop');
    if (backdropEl) backdropEl.remove();
    if (chatContainer) {
      chatContainer.remove();
      chatContainer = null;
    }
    if (chatButton) chatButton.style.display = 'flex';
    console.log('Chat session ended');
  };

  // Listen for messages from iframe (React app)
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Clipboard API copy failed, falling back', err);
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return true;
      } catch (fallbackErr) {
        console.error('Legacy copy failed', fallbackErr);
        return false;
      }
    }
  };

  window.addEventListener('message', (event) => {
    console.log('Extension received message:', event.data, 'from origin:', event.origin);
    // Check if message has data and action property
    if (!event.data || typeof event.data !== 'object') {
      console.log('Invalid message format, ignoring');
      return;
    }
    // Security: Verify origin in production
    if (event.data.action === 'endChat') {
      console.log('Executing endChatSession()');
      endChatSession();
    } else if (event.data.action === 'minimizeChat') {
      console.log('Executing minimizeChat()');
      minimizeChat();
    } else if (event.data.action === 'copyLink') {
      const urlToCopy = typeof event.data.url === 'string' ? event.data.url : window.location.href;
      copyText(urlToCopy).then((success) => {
        try {
          if (event.source && typeof event.source.postMessage === 'function') {
            event.source.postMessage({ action: 'copyLinkResult', success }, '*');
          }
        } catch (postErr) {
          console.warn('Could not notify iframe of copy result', postErr);
        }
      });
    } else {
      console.log('Unknown action:', event.data.action);
    }
  });
}

// Listen for settings updates
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'settingsUpdated') {
    settings = message.settings;
    if (chatButton) chatButton.remove();
    if (chatContainer) chatContainer.remove();
    chatButton = null;
    chatContainer = null;
    
    if (settings.enabled && settings.orgId) {
      createChatButton();
    }
  }
});

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
