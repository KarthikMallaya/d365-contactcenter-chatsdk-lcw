import { OmnichannelChatSDK } from "@microsoft/omnichannel-chat-sdk";
import { getOmnichannelConfig } from "./config";

export type ChatMessage = {
  id: string;
  from: "user" | "agent";
  text: string;
  timestamp: number;
  agentName?: string;
  agentType?: "bot" | "human";
  fileMetadata?: {
    name: string;
    type: string;
    size: number;
    url?: string; // For displaying preview
    id?: string; // For async download
  };
  uploading?: boolean;
  downloading?: boolean; // For files being downloaded from agent
  suggestedActions?: Array<{
    type: string;
    title: string;
    value: string;
  }>;
  adaptiveCard?: any;
};

type TypingPayload = {
  typingIndicator?: {
    state?: string;
  };
};

const createId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export class ChatSdkClient {
  private sdk: any | null = null;
  private chatConfig: any | null = null;

  private async ensureSdk() {
    if (!this.sdk) {
      const config = getOmnichannelConfig();
      if (!config.isValid) {
        throw new Error("Invalid Omnichannel configuration");
      }
      this.sdk = new OmnichannelChatSDK({
        orgId: config.orgId!,
        orgUrl: config.orgUrl!,
        widgetId: config.widgetId!
      });
      await this.sdk.initialize();
      this.chatConfig = await this.sdk.getLiveChatConfig();
    }
    return this.sdk;
  }

  async startChat() {
    const sdk = await this.ensureSdk();
    await sdk.startChat();
    return sdk;
  }

  async endChat() {
    if (!this.sdk) {
      console.log('SDK not initialized, cannot end chat');
      return;
    }
    console.log('Calling SDK.endChat()');
    try {
      await this.sdk.endChat();
      console.log('SDK.endChat() completed');
    } finally {
      this.sdk = null;
      console.log('SDK instance cleared');
    }
  }

  async sendMessage(text: string) {
    const sdk = await this.ensureSdk();
    await sdk.sendMessage({
      content: text
    });
  }

  async uploadFileAttachment(file: File) {
    const sdk = await this.ensureSdk();
    // SDK expects the actual File object, not base64
    await sdk.uploadFileAttachment(file);
  }

  async downloadFileAttachment(fileMetadata: any): Promise<Blob | null> {
    if (!this.sdk) {
      console.error("SDK not initialized");
      return null;
    }
    
    const originalWarn = console.warn;
    try {
      // Temporarily suppress console warnings during SDK calls
      console.warn = () => {};
      
      console.log("Calling SDK downloadFileAttachment with metadata:", fileMetadata);
      const result = await this.sdk.downloadFileAttachment(fileMetadata);
      
      console.log("Download result:", result);
      
      // SDK might return blob directly or in result.data
      const blob = result?.data || result;
      
      if (blob && blob instanceof Blob) {
        console.log("Returning blob with size:", blob.size);
        return blob;
      }
      console.log("No valid blob in result, returning null");
      return null;
    } catch (error) {
      console.error("Error downloading file attachment:", error);
      return null;
    } finally {
      // Always restore console.warn
      console.warn = originalWarn;
    }
  }

  onNewMessage(handler: (message: ChatMessage) => void) {
    if (!this.sdk) return () => {};
    const subscription = this.sdk.onNewMessage((payload: any) => {
      try {
        console.log("Received message payload:", payload);
        
        // Handle different message payload structures
        const from = payload?.sender?.role?.toLowerCase() === "user" ? "user" : "agent";
        let text = payload?.content || 
                   payload?.message?.content || 
                   payload?.text || 
                   payload?.messagePayload?.text || 
                   "";
        
        // Parse structured content (adaptive cards, suggested actions)
        let suggestedActions: Array<{type: string; title: string; value: string}> | undefined = undefined;
        let adaptiveCard: any = undefined;
        let fileMetadata: {name: string; type: string; size: number; url: string; id?: string} | undefined = undefined;
        
        // Check if text field contains structured JSON
        if (text && typeof text === 'string' && text.startsWith('{')) {
          try {
            const parsed = JSON.parse(text);
            
            // Handle suggested actions (quick reply buttons)
            if (parsed.suggestedActions?.actions && Array.isArray(parsed.suggestedActions.actions)) {
              suggestedActions = parsed.suggestedActions.actions.map((action: any) => ({
                type: action.type || 'imBack',
                title: action.title || action.text || action.value,
                value: action.value || action.text
              }));
              text = parsed.text || ""; // Extract text from structured message
              console.log("✅ Parsed suggested actions:", suggestedActions);
            }
            
            // Handle adaptive cards
            if (parsed.attachments && Array.isArray(parsed.attachments) && parsed.attachments.length > 0) {
              const attachment = parsed.attachments[0];
              if (attachment.contentType === 'application/vnd.microsoft.card.adaptive') {
                adaptiveCard = attachment.content;
                text = parsed.text || attachment.content?.body?.[0]?.text || "";
              }
            }
          } catch (e) {
            // Not JSON, treat as regular text
            console.log("Not structured JSON, treating as plain text");
          }
        }
        
        // Parse file attachments from agent - check both payload.fileMetadata and payload.attachments
        if (payload?.fileMetadata) {
          console.log("Found fileMetadata in payload:", JSON.stringify(payload.fileMetadata, null, 2));
          const fileInfo = payload.fileMetadata;
          
          fileMetadata = {
            name: fileInfo.name || fileInfo.fileName || "file",
            type: fileInfo.type || fileInfo.contentType || "application/octet-stream",
            size: fileInfo.size || 0,
            url: fileInfo.url || "", // Use provided URL if available
            id: fileInfo.id // Store ID for download
          };
          
          console.log("Created fileMetadata:", fileMetadata);
        } else if (payload?.attachments && Array.isArray(payload.attachments) && payload.attachments.length > 0) {
          const attachment = payload.attachments[0];
          console.log("Processing attachment:", JSON.stringify(attachment, null, 2));
          // Only treat as file if it's not an adaptive card
          if (attachment.contentType !== 'application/vnd.microsoft.card.adaptive') {
            fileMetadata = {
              name: attachment.name || attachment.fileName || "file",
              type: attachment.contentType || attachment.type || "application/octet-stream",
              size: attachment.size || 0,
              url: attachment.contentUrl || attachment.url
            };
            console.log("Created fileMetadata:", fileMetadata);
          }
        }
        
        // Skip empty system messages without attachments
        if (!text && !fileMetadata && payload?.messageType?.toLowerCase() === "system") {
          console.log("Skipping empty system message");
          return;
        }
        
        // Detect agent information from various payload structures
        const agentName = payload?.sender?.displayName || 
                         payload?.sender?.name || 
                         payload?.agentName ||
                         (Array.isArray(payload?.tags) ? payload.tags.find((t: string) => t.startsWith("agentName:"))?.split(":")[1] : null);
        
        // Determine if this is a bot or human agent (with safe type checks)
        const senderType = typeof payload?.sender?.type === "string" ? payload.sender.type.toLowerCase() : "";
        const messageType = typeof payload?.messageType === "string" ? payload.messageType.toLowerCase() : "";
        const hasTagsBot = Array.isArray(payload?.tags) && payload.tags.includes("bot");
        
        const isBot = senderType === "bot" || 
                      messageType === "bot" ||
                      hasTagsBot ||
                      !agentName;
        
        const agentType = isBot ? "bot" : "human";
        
        console.log("Parsed message - from:", from, "text:", text, "agent:", agentName, "type:", agentType, "file:", fileMetadata);
        
        const messageId = payload?.messageId || payload?.id || createId();
        
        // If file needs to be downloaded, show message with downloading state first
        const needsDownload = fileMetadata && !fileMetadata.url && payload?.fileMetadata;
        
        // Show message immediately (with downloading state for files if needed)
        handler({
          id: messageId,
          from,
          text,
          timestamp: Date.now(),
          agentName,
          agentType,
          downloading: needsDownload || undefined,
          fileMetadata,
          suggestedActions,
          adaptiveCard
        });
        
        // If file needs to be downloaded, download it and update the message
        if (needsDownload && fileMetadata) {
          console.log("Starting file download in background");
          const fileInfo = payload.fileMetadata;
          const savedName = fileMetadata.name;
          const savedType = fileMetadata.type;
          const savedId = fileMetadata.id;
          
          this.downloadFileAttachment(fileInfo).then((blob) => {
            if (blob) {
              const blobUrl = URL.createObjectURL(blob);
              console.log("Downloaded file and created blob URL:", blobUrl, "Size:", blob.size);
              console.log("Updating message with ID:", messageId, "downloading: false");
              // Update the message with complete file data
              handler({
                id: messageId,
                from,
                text,
                timestamp: Date.now(),
                agentName,
                agentType,
                downloading: false,
                fileMetadata: {
                  name: savedName,
                  type: blob.type || savedType,
                  size: blob.size,
                  url: blobUrl,
                  id: savedId
                },
                suggestedActions,
                adaptiveCard
              });
            }
          }).catch((err) => {
            console.error("Failed to download file:", err);
          });
        }
      } catch (error) {
        console.error("Error processing message payload:", error, payload);
        // Don't throw - just skip this message to prevent SDK errors
      }
    });
    return () => subscription?.unsubscribe?.();
  }

  onTyping(handler: (payload: TypingPayload) => void) {
    if (!this.sdk) return () => {};
    const subscription = this.sdk.onTypingEvent(handler);
    return () => subscription?.unsubscribe?.();
  }

  async emailTranscript(emailAddress: string, attachmentMessage?: string) {
    const sdk = await this.ensureSdk();
    const body: any = { emailAddress };
    if (attachmentMessage) {
      body.attachmentMessage = attachmentMessage;
    }
    await sdk.emailLiveChatTranscript(body);
  }
}

export const chatClient = new ChatSdkClient();
