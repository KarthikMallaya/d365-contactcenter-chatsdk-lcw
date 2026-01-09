# Productized Copilot Chat Widget Guide (Replacing LCW)

This document explains how to use the existing widget code as a productized replacement for LCW, without the chrome extension or logo-based branding extraction. It assumes the hosting product already knows `orgId`, `orgUrl`, and `widgetId` and does not rely on passing tenant context from the page.

## What Stays vs. What's Excluded
- Included: Omnichannel Chat SDK integration (`src/chatSdk.ts`), core UI/state (`src/App.tsx`), follow-up questions via Agent Flows (`pauUrl`), optional agent tiles via Agent Flows (`agentsUrl`), attachments, typing, email transcript, voice input, basic theming via CSS variables.
- Excluded: browser-extension messaging (minimize/end-copy fallbacks) and runtime logo color extraction (dynamic theme). Keep the defaults or provide static colors via config if desired.

## High-Level Flow (No Extension, No Logo Theming)
1) Host the built widget as a static site (Azure Web App or any static hosting).  
2) The embedding page (web or mobile webview) loads the widget iframe with known `orgId`, `orgUrl`, `widgetId` (either baked into the URL or injected at runtime).  
3) `src/App.tsx` boots, reads config, initializes `chatClient` from `src/chatSdk.ts`, and calls `startChat`.  
4) Messages, attachments, typing, and email transcript flow through the Omnichannel Chat SDK to Dynamics 365 Contact Center.  
5) Optional: Agent Flows endpoints provide agents list (`agentsUrl`) and follow-up suggestions (`pauUrl`) for in-UI guidance only (they do not change SDK routing unless you extend startChat to pass context).

## Configuration Strategy for Product Environments
- Required values: `orgId`, `orgUrl`, `widgetId`. These can be:
  - Embedded in the iframe URL as query params (current default), or
  - Injected into `window.__WIDGET_CONFIG__` before the app mounts, then read in `getOmnichannelConfig` (recommended for product to avoid query reliance). Example:
    ```html
    <script>
      window.__WIDGET_CONFIG__ = {
        orgId: "<ORG_ID>",
        orgUrl: "<ORG_URL>",
        widgetId: "<WIDGET_ID>",
        pauUrl: "<OPTIONAL_AGENT_FLOWS_FOR_FOLLOWUPS>",
        agentsUrl: "<OPTIONAL_AGENT_FLOWS_FOR_AGENTS>"
      };
    </script>
    <script type="module" src="/src/main.tsx"></script>
    ```
  - If you choose the injected approach, update `src/config.ts` to read `window.__WIDGET_CONFIG__` before falling back to query params (no other code change required).
- Optional values: `pauUrl`, `agentsUrl`. Safe to omit; UI falls back to defaults (static agents, no follow-ups).
- Theming: defaults live in `src/index.css`. If you want static brand colors, set `customColors` in config instead of using the logo extractor.

## Hosting & Build
- Build: `npm install && npm run build` (Vite). Output goes to `dist/`.
- Host `dist/` on Azure App Service (static site) or any CDN. Ensure `index.html` is served for the widget entry.
- CSP/CORS:
  - Allow connections to your Dynamics endpoint (`orgUrl`), the Omnichannel Chat SDK endpoints it calls, and any Agent Flows endpoints you use.
  - If using static theme assets only (no logo extractor), you do not need `img.logo.dev`.
- Caching: cache static assets (`.js`, `.css`) with long TTL; keep `index.html` with a shorter TTL so config changes propagate.

## Embedding the Widget (Product Pages)
- Iframe example (query params):
  ```html
  <iframe
    src="https://your-hosted-widget.com/?orgId=...&orgUrl=...&widgetId=..."
    allow="microphone; clipboard-read; clipboard-write"
    style="border:0;width:100%;height:640px"
  ></iframe>
  ```
- Iframe example (injected config):
  ```html
  <iframe
    src="https://your-hosted-widget.com/"
    allow="microphone; clipboard-read; clipboard-write"
    style="border:0;width:100%;height:640px"
  ></iframe>
  ```
  In this case, the host page must inject `window.__WIDGET_CONFIG__` in the widget's `index.html` or via a prelude script.
- Mobile webview: same iframe URL; ensure `allow` permissions for mic/clipboard if you keep voice input and copy features.

## Using Agent Flows Hooks (Optional)
- Follow-up suggestions (`pauUrl`):
  - `src/App.tsx` posts `{ botResponse, companyName, url }` to the provided URL after receiving an agent message.
  - The response is expected to contain an array of suggestions (any property containing an array of strings/objects with `item` is accepted; see code at ~lines 850-905).
- Agents list (`agentsUrl`):
  - On load, `src/App.tsx` POSTs `{ company }` to the URL. If it returns `{ agents: [...] }`, the grid is populated. Otherwise the default static agents are shown.
  - This does not alter routing in Omnichannel; to route, extend `chatSdk.startChat` to pass context (e.g., selected agent) when you want queue/skill targeting.

## Extending for Productization
- Fixing configuration source: Prefer injected config to avoid reliance on query params and to keep secrets out of URLs.
- Routing/skills: Add optional `context` or `authenticatedUserToken` to `chatSdk.startChat` (Omnichannel supports both). Gate with a config flag.
- Error UX: Current behavior shows toast-level errors; consider retry/backoff on `startChat` and upload, plus a dedicated "reconnect" UI.
- Telemetry: Add a thin telemetry wrapper (page load, startChat, endChat, send, upload, download, email transcript failures) to your product's logging system.
- Accessibility: The UI is keyboardable; verify your product's A11y pass and ARIA roles for any added controls.

## Security & Privacy Notes
- Keep `orgId`, `orgUrl`, `widgetId` in product configuration; avoid exposing additional secrets in the client.
- If enabling authenticated user token or context, ensure tokens are scoped and short-lived; never log them.
- Limit `allow` attributes on the iframe to only what you use (microphone only if voice input is enabled).
- Validate uploads server-side in Omnichannel policies; client already restricts size/type but should not be the only gate.

## Operational Checklist (Per Environment)
- [ ] Config set: `orgId`, `orgUrl`, `widgetId` (and optionally `pauUrl`, `agentsUrl`).
- [ ] Hosting reachable over HTTPS; CSP allows Dynamics/Omnichannel/Agent Flows endpoints.
- [ ] Voice/copy permissions (`allow` attributes) align with features you keep.
- [ ] Build artifacts deployed from `dist/`; cache headers set.
- [ ] Basic smoke: start chat, send/receive, typing, upload/download, email transcript, follow-up suggestions (if enabled), agent tiles (if enabled).
- [ ] Error paths: invalid config shows configuration guide; offline view works; upload failure shows message; email failure shows toast.

## Quick POC vs. Production Settings
- POC: keep query params for config, enable `pauUrl`/`agentsUrl` as needed, default theme.
- Production: inject config via `window.__WIDGET_CONFIG__`, set static brand colors via config (skip logo extractor), omit browser-extension messaging, tighten CSP, and add telemetry/retry as desired.

## File References
- Core UI/state: `src/App.tsx`
- SDK wrapper: `src/chatSdk.ts`
- Config entry: `src/config.ts` (adapt to read `window.__WIDGET_CONFIG__` if desired)
- Styling: `src/index.css`
- Follow-up and agents hooks: `src/App.tsx` (~lines 360-410, 850-905)
