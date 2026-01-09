# How to Get Valid Omnichannel Configuration

Your current config domain `m-e33ae28d-ada6-ef11-8a64-000d3a370c12.us.omnichannelengagementhub.com` does not resolve (DNS failure).

## Steps to Get Valid Configuration:

### Option 1: From Dynamics 365 Admin Center
1. Sign in to https://admin.powerplatform.microsoft.com/
2. Select your environment
3. Go to **Customer Service admin center**
4. Navigate to **Customer Support** > **Channels** > **Chat**
5. Select your chat widget
6. Click **Widget settings** tab
7. Copy the **Code snippet** - it contains:
   - `data-org-id` (your orgId)
   - `data-org-url` (your orgUrl - THIS IS CRITICAL)
   - `data-app-id` (your widgetId)

### Option 2: From Existing Working Page
1. Open the page where your LiveChatWidget works
2. Open Browser DevTools (F12)
3. Go to **Network** tab
4. Refresh the page or trigger the chat
5. Look for requests containing:
   - `omnichannelengagementhub.com`
   - `azureedge.net`
   - `livechatconnector/config`
6. Copy the **actual working domain** from those requests

### Option 3: Check Widget Embed Code
If you have the HTML embed code, look for:
```html
<script id="Microsoft_Omnichannel_LCWidget" 
        src="https://[ACTUAL-DOMAIN]/livechatwidget/scripts/LiveChatBootstrapper.js"
        data-app-id="YOUR-WIDGET-ID"
        data-org-id="YOUR-ORG-ID" 
        data-org-url="https://YOUR-ORG-URL">
</script>
```

## Update config.ts with correct values:
```typescript
export const omnichannelConfig = {
  orgId: "YOUR-ACTUAL-ORG-ID",
  orgUrl: "https://YOUR-ACTUAL-ORG-URL", // This must resolve via DNS
  widgetId: "YOUR-ACTUAL-WIDGET-ID",
  channelId: "lcw"
};
```

## Common Valid Domain Patterns:
- `https://oc-cdn-ocprod.azureedge.net`
- `https://[region]-[org].omnichannelengagementhub.com`
- `https://org[hash].crm.dynamics.com` (for some configurations)

The current domain simply doesn't exist in DNS, so no code changes will fix this - you need the correct domain from your active Dynamics 365 environment.
