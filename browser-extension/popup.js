// Load saved settings when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  const data = await chrome.storage.sync.get([
    'orgId',
    'orgUrl',
    'widgetId',
    'company',
    'pauUrl',
    'agentsUrl',
    'enabled'
  ]);

  document.getElementById('orgId').value = data.orgId || '';
  document.getElementById('orgUrl').value = data.orgUrl || '';
  document.getElementById('widgetId').value = data.widgetId || '';
  document.getElementById('company').value = data.company || '';
  document.getElementById('pauUrl').value = data.pauUrl || '';
  document.getElementById('agentsUrl').value = data.agentsUrl || '';
  document.getElementById('enabled').checked = data.enabled !== false;
});

// Save settings
document.getElementById('saveBtn').addEventListener('click', async () => {
  const settings = {
    orgId: document.getElementById('orgId').value.trim(),
    orgUrl: document.getElementById('orgUrl').value.trim(),
    widgetId: document.getElementById('widgetId').value.trim(),
    company: document.getElementById('company').value.trim(),
    pauUrl: document.getElementById('pauUrl').value.trim(),
    agentsUrl: document.getElementById('agentsUrl').value.trim(),
    enabled: document.getElementById('enabled').checked
  };

  // Validate required fields
  if (!settings.orgId || !settings.orgUrl || !settings.widgetId) {
    showStatus('Please fill in all required fields', 'error');
    return;
  }

  await chrome.storage.sync.set(settings);
  showStatus('Settings saved successfully! ✓', 'success');

  // Notify all tabs to refresh the chat icon
  const tabs = await chrome.tabs.query({});
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated', settings }).catch(() => {});
  });

  setTimeout(() => {
    window.close();
  }, 1000);
});

// Clear settings
document.getElementById('clearBtn').addEventListener('click', async () => {
  if (confirm('Clear all settings?')) {
    await chrome.storage.sync.clear();
    document.getElementById('orgId').value = '';
    document.getElementById('orgUrl').value = '';
    document.getElementById('widgetId').value = '';
    document.getElementById('company').value = '';
    document.getElementById('pauUrl').value = '';
    document.getElementById('agentsUrl').value = '';
    document.getElementById('enabled').checked = true;
    showStatus('Settings cleared', 'success');
  }
});

function showStatus(message, type) {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = `status ${type}`;
  
  setTimeout(() => {
    status.className = 'status';
  }, 3000);
}
