# Architecture Overview (LCW Replacement)

This document maps the productized chat widget to the architecture shown in the diagram (web/mobile embedding, Omnichannel Chat SDK, Dynamics 365 Contact Center, Agent Flows for prompts). Chrome extension and logo-based theming are excluded.

## Components
- User channels: Website (desktop) and Mobile webview/app hosting the widget iframe.
- Chat widget (hosted, e.g., Azure Web App): React + Vite app (`src/App.tsx`, `src/index.css`), orchestrates UI, state, and SDK calls.
- Omnichannel Chat SDK: `@microsoft/omnichannel-chat-sdk` wrapped by `src/chatSdk.ts` for start/end chat, send/receive, attachments, typing, transcript.
- Dynamics 365 Contact Center: backend destination for all chat traffic via the SDK.
- Agent Flows (optional):
  - `agentsUrl`: returns agent tiles/metadata shown in the UI.
  - `pauUrl`: returns follow-up questions (Copilot-style prompts) after bot/agent replies.

## Runtime Flow
1) Embed: Host page loads an iframe pointing to the widget (with `orgId`, `orgUrl`, `widgetId` provided via query params or injected config).
2) Init: `src/App.tsx` reads config, initializes `chatClient` (`src/chatSdk.ts`), and calls `startChat`.
3) Messaging: User sends messages/attachments -> `chatClient` -> Omnichannel Chat SDK -> Dynamics 365. Agent/bot replies flow back through the SDK subscription into the UI.
4) Typing/status: SDK typing events update the UI indicator; queue/wait hints are parsed from system messages.
5) Follow-ups (optional): After receiving an agent/bot message, the widget POSTs to `pauUrl`; the returned suggestions render as quick prompts.
6) Agents (optional): On load, the widget POSTs to `agentsUrl`; returned agents populate the agent tiles. (Routing is UI-only unless you add context to `startChat`.)
7) Transcript: User can trigger email transcript via SDK `emailLiveChatTranscript`.

## Hosting & Integration
- Build: `npm run build` → `dist/`. Host as static site (Azure Web App, CDN).
- Embed iframe with `allow="microphone; clipboard-read; clipboard-write"` if using voice/copy features.
- Config: Supply `orgId`, `orgUrl`, `widgetId` from product config (no tenant context needed). Optional `agentsUrl`, `pauUrl`. Theme can stay default or use static `customColors` (no logo extractor).

## Data & Dependency Lines (as in diagram)
- User ⇄ Host page (web/mobile) ⇄ Widget iframe (Azure-hosted).
- Widget → Omnichannel Chat SDK → Dynamics 365 Contact Center (bi-directional chat traffic).
- Widget → Agent Flows endpoints:
  - `agentsUrl` for agent tiles (one-way fetch).
  - `pauUrl` for follow-up question prompts (one-way fetch).

## Reliability & Security Notes
- CSP/CORS: Permit Dynamics/Omnichannel endpoints and Agent Flows endpoints used. No dependency on img.logo.dev.
- Permissions: Only request mic/clipboard if features are enabled.
- Uploads: Client validates, server-side controls should remain in Omnichannel policies.
- Errors: UI shows toast-level errors; consider adding retry/backoff for `startChat` and uploads in product hardening.

## File Pointers
- UI/state: `src/App.tsx`
- SDK wrapper: `src/chatSdk.ts`
- Config: `src/config.ts` (extend to read injected config if preferred)
- Styles: `src/index.css`
