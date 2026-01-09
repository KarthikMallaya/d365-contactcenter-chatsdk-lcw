# Copilot Chat Widget Architecture & Feature Notes

This document explains how the widget is put together, what comes from the Microsoft Omnichannel Chat SDK, and what we implement ourselves. It also calls out gaps/known limitations and how to extend the experience.

## High-Level Flow
- `App.tsx` is the main UI/logic container. It orchestrates SDK calls, message state, theming, and browser-extension messaging.
- `chatSdk.ts` wraps `@microsoft/omnichannel-chat-sdk` with a small facade so the UI code uses a single client for start/end chat, send message, upload/download attachments, typing events, and email transcript.
- `config.ts` reads query-string parameters (`orgId`, `orgUrl`, `widgetId`, `company`, `agentsUrl`, `pauUrl`, custom colors) and maps domains to preset brand colors.
- `colorExtractor.ts` extracts a palette from the company logo (via `img.logo.dev`) with fallbacks and applies CSS variables for runtime theming.
- `index.css` holds the styling for the widget (bubbles, toolbar, modals, skeletons, etc.).
- `browser-extension/` injects the iframe and passes messages (minimize/end chat) between the host page and the widget.

## SDK Usage (Covered)
- Initialize + start chat: `chatSdk.startChat()` calls `sdk.startChat()`.
- End chat: `chatSdk.endChat()` calls `sdk.endChat()` and clears local SDK instance.
- Send message: `chatSdk.sendMessage(text)` wraps `sdk.sendMessage`.
- Upload file: `chatSdk.uploadFileAttachment(file)` passes the raw `File` to `sdk.uploadFileAttachment`.
- Download file from agent: `sdk.downloadFileAttachment` with blob handling and blob URL creation for previews.
- Typing events: subscribed via `sdk.onTypingEvent`.
- New messages: subscribed via `sdk.onNewMessage`; we normalize payloads, suggested actions, adaptive cards, and file metadata.
- Email transcript: `chatSdk.emailTranscript(emailAddress, attachmentMessage?)` wraps `sdk.emailLiveChatTranscript`.

## SDK Gaps We Handle Manually
- Queue position / average wait time: SDK has no dedicated API. We parse system messages in `onNewMessage` for phrases like “position in queue” and “average wait” and extract numbers. Banner shows when connected and values are present; cleared on first agent message.
- Dynamic branding/theme: not provided by SDK. We fetch logo → extract colors → set CSS variables; fall back to presets/custom query params.
- Add-to-home/manifest icons: generated at runtime via canvas; injected as favicon, apple-touch-icon, and manifest icons.
- Edge clipboard fallback: we postMessage to the host/extension to copy when the Clipboard API fails.
- Suggested actions/adaptive cards: parsed from structured JSON messages and rendered as buttons/notice (interactive actions inside the iframe are limited).

## UI Features (Covered)
- Message transcript with agent/user bubbles, avatars, and file previews.
- Suggested actions (quick replies).
- Typing indicator.
- Upload (images/PDF) with optimistic states and validation.
- Voice input toggle (browser SpeechRecognition).
- “Email transcript” modal with validation and SDK call.
- Agents drawer (local/default or fetched from `agentsUrl` Power Automate endpoint).
- End chat confirmation and minimize/end messaging to the host frame.
- Dynamic share/copy link with host-assisted fallback (Edge/extension).
- Home screen icon readiness hint after dynamic manifest/icon injection.

## Not Covered / Known Limitations
- SDK features not wired: authenticated user token flow, custom context passing on startChat, proactive chat, reconnect/resume transcripts, real-time presence, co-browse, or custom event telemetry.
- Queue parsing is best-effort English regex; localized or differently phrased system messages may be missed.
- Adaptive cards: rendered as a non-interactive notice only; full interaction would require hosting Microsoft Adaptive Cards renderer with action wiring.
- Error handling is toast-level; no retry UI for startChat failures beyond messaging.
- No built-in offline queueing of outbound messages.
- No dynamic chunking/code-splitting (build chunk-size warning remains from Vite).
- Camera capture is limited on desktop (we display a notice).

## Runtime Data Flow
1. On load, `config.ts` pulls query params; `App.tsx` applies predefined/custom colors or extracts from logo, then applies theme variables.
2. `App.tsx` auto-starts chat when config is valid → `chatSdk.startChat`.
3. Incoming messages: `onNewMessage` normalizes payloads, parses queue info, files, suggested actions, adaptive cards, then updates state.
4. Outgoing messages/files: optimistic insert → `chatClient.sendMessage` / `uploadFileAttachment`.
5. Email transcript: modal → `chatClient.emailTranscript` (SDK call).
6. Icons/manifest: once logo/colors resolve, canvas generates icons → inject link + manifest (maskable) + document title updated to “<Brand> Chat”.

## Extending Safely
- Add new SDK calls by extending `chatSdk.ts` so UI stays decoupled.
- When parsing system messages, keep regex localized or configurable.
- For adaptive cards, integrate an Adaptive Cards renderer and map submit actions to `sendMessage`.
- Consider adding startChat optional params (e.g., `authenticatedUserToken`, custom context) behind config flags.
- To reduce bundle size, introduce code-splitting (Vite manualChunks) for non-critical panels.

## Testing Notes
- `npm run build` runs `tsc` + Vite build (currently emits a chunk-size warning; functionality is unaffected).
- Manual checks: start/end chat, send/receive messages, upload/download, email transcript, queue banner parsing, copy link fallback, add-to-home icon readiness, theming from logo/custom colors.

## References
- SDK docs: https://github.com/microsoft/omnichannel-chat-sdk
- Project entry points: `src/App.tsx`, `src/chatSdk.ts`, `src/colorExtractor.ts`, `src/config.ts`, `src/index.css`.
