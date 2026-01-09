import { FormEvent, useEffect, useRef, useState, useCallback } from "react";
import { ChatMessage, chatClient } from "./chatSdk";
import { getOmnichannelConfig, getCompanyLogoUrl, getBrandColors } from "./config";
import { extractColorsFromImage, applyDynamicTheme } from "./colorExtractor";
import copilotIcon from "./assets/copilot-icon.png";
import aiIcon from "./assets/ai.png";
import volumeIcon from "./assets/volume.png";
import { AdaptiveCard, HostConfig, SubmitAction } from "adaptivecards";
import DOMPurify from "dompurify";
import { marked } from "marked";

type IconSet = {
  small: string; // 192
  medium: string; // 256
  large: string; // 512
};

const toTitleCase = (value: string) => value
  .split(/[\s-_]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
  .join(" ");

const deriveDisplayName = (companyParam?: string | null) => {
  const fallback = "Copilot";
  const raw = companyParam || window.location.hostname || "";
  const cleaned = raw
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0];
  if (!cleaned) return fallback;
  const parts = cleaned.split(".").filter(Boolean);
  let base: string;
  const hasCountryTld = parts.length >= 2 && parts[parts.length - 1].length === 2;
  const secondLevel = parts[parts.length - 2];
  const knownGeneric = ["com", "co", "net", "org", "gov", "edu", "ac"];
  if (parts.length >= 3 && hasCountryTld && knownGeneric.includes(secondLevel)) {
    base = parts[parts.length - 3];
  } else if (parts.length >= 2) {
    base = secondLevel;
  } else {
    base = parts[0];
  }
  const human = toTitleCase(base.replace(/[^a-zA-Z0-9-_ ]/g, " "));
  return human || fallback;
};

const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const drawIcon = (img: HTMLImageElement, size: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  roundedRect(ctx, 0, 0, size, size, size * 0.28);
  ctx.fill();

  const padding = size * 0.14;
  const maxSide = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = (size - padding * 2) / maxSide;
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  const dx = (size - drawW) / 2;
  const dy = (size - drawH) / 2;

  ctx.drawImage(img, dx, dy, drawW, drawH);
  return canvas.toDataURL("image/png");
};

const loadImage = (src: string, useCORS: boolean) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    if (useCORS) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

const buildIconSet = async (src: string, fallbackSrc: string): Promise<IconSet | null> => {
  let img: HTMLImageElement | null = null;
  try {
    img = await loadImage(src, true);
  } catch (e) {
    console.warn("Logo load failed with CORS, falling back to bundled icon", e);
    try {
      img = await loadImage(fallbackSrc, false);
    } catch (fallbackErr) {
      console.error("Fallback icon failed to load", fallbackErr);
      return null;
    }
  }

  const sizes = [192, 256, 512];
  const urls = sizes.map((s) => drawIcon(img as HTMLImageElement, s));
  if (urls.some((u) => !u)) return null;
  return {
    small: urls[0] as string,
    medium: urls[1] as string,
    large: urls[2] as string
  };
};

const upsertLink = (id: string, rel: string, href: string, sizes?: string) => {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = rel;
    document.head.appendChild(link);
  }
  if (sizes) link.sizes.value = sizes;
  link.href = href;
};

const AdaptiveCardView = ({
  card,
  onSubmit,
  colors
}: {
  card: any;
  onSubmit: (data: any, actionTitle?: string) => Promise<void>;
  colors?: { primary?: string };
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const primary = colors?.primary || "#1d4ed8";

  useEffect(() => {
    if (!containerRef.current || !card) return;
    containerRef.current.innerHTML = "";

    const adaptiveCard = new AdaptiveCard();
    adaptiveCard.hostConfig = new HostConfig({
      fontFamily: "'Segoe UI Variable Display','Segoe UI',system-ui,-apple-system,sans-serif",
      supportsInteractivity: true,
      spacing: {
        small: 6,
        default: 10,
        medium: 14,
        large: 18,
        extraLarge: 22,
        padding: 16
      },
      fontStyles: {
        default: {
          fontFamily: "'Segoe UI Variable Display','Segoe UI',system-ui,-apple-system,sans-serif",
          fontSizes: { small: 11, default: 12, medium: 13, large: 14, extraLarge: 15 },
          fontWeights: { lighter: 300, default: 400, bolder: 600 }
        }
      },
      containerStyles: {
        default: {
          backgroundColor: "#ffffff",
          foregroundColors: {
            default: { default: "#0f172a", subtle: "#475569" },
            accent: { default: primary, subtle: primary },
            good: { default: "#22c55e", subtle: "#16a34a" },
            warning: { default: "#f59e0b", subtle: "#d97706" },
            attention: { default: "#ef4444", subtle: "#dc2626" }
          }
        }
      },
      actions: {
        maxActions: 5,
        buttonSpacing: 8,
        actionsOrientation: "horizontal",
        actionAlignment: "stretch",
        showCard: { actionMode: "popup", inlineTopMargin: 12 }
      },
      imageSizes: {
        small: 60,
        medium: 120,
        large: 180
      },
      inputs: {
        errorMessage: {
          size: "small",
          color: "attention"
        }
      }
    });

    adaptiveCard.onExecuteAction = async (action: any) => {
      try {
        const typeName = action?.getJsonTypeName?.();
        if (typeName === "Action.Submit" || action instanceof SubmitAction) {
          const data = { ...(action?.data || {}) };
          const inputs = action?.getInputs?.() || [];
          inputs.forEach((input: any) => {
            if (input?.id) {
              data[input.id] = input.value;
            }
          });
          await onSubmit(data, action?.title);
        } else if (typeName === "Action.OpenUrl") {
          const url = action?.url;
          if (url) {
            window.open(url, "_blank", "noopener,noreferrer");
          }
        }
      } catch (err) {
        console.error("Adaptive card action failed", err);
      }
    };

    adaptiveCard.parse(card);
    const rendered = adaptiveCard.render();
    if (rendered && containerRef.current) {
      containerRef.current.appendChild(rendered);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [card, onSubmit]);

  return <div className="adaptive-card-container" ref={containerRef} style={{ ["--ac-primary" as string]: primary }} />;
};

const injectIcons = (
  icons: IconSet,
  themeColor = "#ffffff",
  manifestUrlRef?: { current: string | null },
  appName = "Copilot"
) => {
  const startUrl = window.location.href;
  upsertLink("dynamic-favicon", "icon", icons.small, "32x32");
  upsertLink("dynamic-apple-touch-icon", "apple-touch-icon", icons.large, "180x180");

  const fullName = `${appName} Chat`.trim();
  const shortName = `${appName} Chat`.trim();

  const manifest = {
    name: fullName,
    short_name: shortName,
    start_url: startUrl,
    display: "standalone",
    theme_color: themeColor,
    background_color: "#ffffff",
    icons: [
      { src: icons.small, sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: icons.medium, sizes: "256x256", type: "image/png", purpose: "any maskable" },
      { src: icons.large, sizes: "512x512", type: "image/png", purpose: "any maskable" }
    ]
  };

  const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  const manifestUrl = URL.createObjectURL(blob);

  if (manifestUrlRef?.current) {
    try {
      URL.revokeObjectURL(manifestUrlRef.current);
    } catch (e) {
      console.warn("Failed to revoke old manifest URL", e);
    }
  }

  if (manifestUrlRef) {
    manifestUrlRef.current = manifestUrl;
  }
  const manifestLinkId = "dynamic-manifest";
  let link = document.getElementById(manifestLinkId) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = manifestLinkId;
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  link.href = manifestUrl;
};
// Calculate relative luminance and determine text color
const getLuminance = (hex: string): number => {
  const rgb = parseInt(hex.replace("#", ""), 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

const getContrastColor = (bgColor: string): string => {
  const luminance = getLuminance(bgColor);
  return luminance > 0.5 ? "#1e293b" : "#ffffff";
};

type Status = "idle" | "connecting" | "connected";

const createId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

interface Suggestion {
  question: string;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const formatAdaptiveSubmission = (data: any, fallback?: string) => {
  if (!data) return fallback || "Submitted response";
  if (typeof data === "string") return data;
  if (data.text) return data.text;
  const entries = Object.entries(data)
    .map(([key, value]) => `${key}: ${value}`)
    .join(", ");
  return entries || fallback || "Submitted response";
};

const renderMarkdown = (text?: string) => {
  if (!text) return "";
  const html = marked.parse(text, { breaks: true, gfm: true }) as string;
  return DOMPurify.sanitize(html);
};

const markdownToPlainText = (text?: string) => {
  if (!text) return "";
  const html = renderMarkdown(text);
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
};

// Default industry-agnostic agents
const defaultAgents: Agent[] = [
  { id: "general", name: "General Support", description: "Get help with common questions", icon: "" },
  { id: "technical", name: "Technical Support", description: "Solve technical issues", icon: "" },
  { id: "sales", name: "Sales & Products", description: "Learn about our offerings", icon: "" },
  { id: "billing", name: "Billing & Account", description: "Manage payments and account", icon: "" },
  { id: "feedback", name: "Feedback & Suggestions", description: "Share your thoughts", icon: "" },
  { id: "emergency", name: "Urgent Assistance", description: "Priority support needed", icon: "" }
];

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const [autoConnecting, setAutoConnecting] = useState(true);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [menuOpen, setMenuOpen] = useState(false);
  const [agents, setAgents] = useState<Agent[]>(defaultAgents);
  const [currentAgent, setCurrentAgent] = useState<string>("general");
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [avgWaitTime, setAvgWaitTime] = useState<number | null>(null);
  const [showEndChatConfirm, setShowEndChatConfirm] = useState(false);
  const [endingChat, setEndingChat] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [currentAgentName, setCurrentAgentName] = useState<string | null>(null);
  const [currentAgentType, setCurrentAgentType] = useState<"bot" | "human" | null>(null);
  const [copyStatus, setCopyStatus] = useState<"" | "copied">("");
  const [iconReady, setIconReady] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manifestUrlRef = useRef<string | null>(null);
  
  // Check if configuration is valid
  const config = getOmnichannelConfig();
  const isConfigValid = config.isValid;
  const [logoUrl, setLogoUrl] = useState<string>(aiIcon); // Start with ai.png immediately
  const [brandColors, setBrandColors] = useState<any>(null);
  const [showSkeleton, setShowSkeleton] = useState<boolean>(true);
  
  // Load company logo after initial render
  useEffect(() => {
    if (config.company) {
      const companyLogoUrl = getCompanyLogoUrl(config.company);
      // Test if company logo loads, otherwise keep ai.png
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth >= 32 && img.naturalHeight >= 32) {
          setLogoUrl(companyLogoUrl);
        }
      };
      img.onerror = () => {
        console.log("Company logo failed to load, using ai.png");
      };
      img.src = companyLogoUrl;
    }
  }, [config.company]);

  // Apply brand colors - try predefined first, then extract from logo
  useEffect(() => {
    const predefinedColors = getBrandColors(config.company);
    
    if (config.customColors) {
      console.log("Using custom colors from query params");
      setBrandColors(config.customColors);
      applyDynamicTheme(config.customColors);
    } else if (predefinedColors) {
      console.log("Using predefined colors for", config.company, predefinedColors);
      setBrandColors(predefinedColors);
      applyDynamicTheme(predefinedColors);
    } else if (logoUrl && logoUrl !== aiIcon) {
      console.log("Extracting colors from logo:", logoUrl);
      extractColorsFromImage(logoUrl, config.company || window.location.hostname)
        .then((colors) => {
          console.log("Extracted colors:", colors);
          setBrandColors(colors);
          applyDynamicTheme(colors);
        })
        .catch((err) => {
          console.error("Failed to extract colors:", err);
          // Use default fallback theme
          const fallback = { primary: "#3b82f6", secondary: "#0ea5e9", light: "#e0f2ff", dark: "#1d4ed8" };
          setBrandColors(fallback);
          applyDynamicTheme(fallback);
        });
    }
  }, [logoUrl, config.company, config.customColors]);
  
  // Monitor network connectivity
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Setup speech recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = async (event: any) => {
        const transcript = event.results[0][0].transcript;
        setListening(false);
        
        // Send immediately after voice input
        const optimistic: ChatMessage = {
          id: createId(),
          from: "user",
          text: transcript,
          timestamp: Date.now()
        };
        setMessages((prev) => [...prev, optimistic]);
        setTyping(true);
        
        try {
          await chatClient.sendMessage(transcript);
        } catch (err) {
          console.error(err);
          setError("Message failed to send.");
          setTyping(false);
        }
      };
      
      recognition.onerror = () => {
        setListening(false);
      };
      
      recognition.onend = () => {
        setListening(false);
      };
      
      recognitionRef.current = recognition;
    }
  }, []);

  // Fetch dynamic agents from Power Automate
  useEffect(() => {
    const fetchAgents = async () => {
      if (!config.agentsUrl) return;
      
      try {
        const response = await fetch(config.agentsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company: config.company })
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.agents && Array.isArray(data.agents)) {
            setAgents(data.agents);
            console.log("Dynamic agents loaded:", data.agents);
          }
        }
      } catch (error) {
        console.log("Using default agents, could not fetch dynamic agents:", error);
      }
    };

    fetchAgents();
  }, [config.agentsUrl, config.company]);

  // Prepare dynamic icons for Add to Home/shortcut tiles
  useEffect(() => {
    let cancelled = false;
    const generateIcons = async () => {
      setIconReady(false);
      const source = logoUrl || aiIcon;
      if (!source) return;
      try {
        const iconSet = await buildIconSet(source, aiIcon);
        if (cancelled || !iconSet) return;
        const theme = brandColors?.primary || "#ffffff";
        const appName = deriveDisplayName(config.company);
        injectIcons(iconSet, theme, manifestUrlRef, appName);
        // Update document title to match the brand name + Chat
        document.title = `${appName} Chat`;
        setIconReady(true);
      } catch (e) {
        console.error("Icon generation failed", e);
      }
    };
    generateIcons();
    return () => {
      cancelled = true;
    };
  }, [logoUrl, brandColors]);

  // Auto-connect on mount
  useEffect(() => {
    if (isConfigValid && status === "idle" && autoConnecting && !isClosing) {
      const timer = setTimeout(() => {
        start();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isConfigValid, isClosing]);

  const start = async () => {
    setError("");
    setStatus("connecting");
    
    console.log("Starting chat with config:", {
      orgId: config.orgId,
      orgUrl: config.orgUrl,
      widgetId: config.widgetId
    });
    
    try {
      await chatClient.startChat();
      setMessages([]);
      setStatus("connected");
      
    } catch (err: any) {
      console.error("Chat initialization error:", err);
      console.error("Error details:", {
        message: err?.message,
        stack: err?.stack,
        response: err?.response
      });
      
      const errorMsg = err?.message || err?.toString() || "Could not start chat";
      setError(`Connection failed: ${errorMsg}. Please verify your Organization ID, URL, and Widget ID are correct.`);
      setStatus("idle");
      setAutoConnecting(false);
    }
  };

  const handleMinimizeChat = () => {
    console.log('Minimize chat requested');
    console.log('window.parent:', window.parent);
    console.log('window.parent === window:', window.parent === window);
    console.log('window.top:', window.top);
    // Send message to parent (extension) to minimize
    if (window.parent && window.parent !== window) {
      console.log('Sending minimizeChat message to parent with origin *');
      try {
        window.parent.postMessage({ action: 'minimizeChat' }, '*');
        console.log('Message sent successfully');
      } catch (e) {
        console.error('Error sending message:', e);
      }
    } else {
      console.log('Not in iframe, cannot minimize');
    }
  };

  const handleEndChatRequest = () => {
    // Show confirmation dialog
    setShowEndChatConfirm(true);
  };

  const confirmEndChat = async () => {
    console.log('End chat confirmed');
    setShowEndChatConfirm(false);
    setEndingChat(true);
    setIsClosing(true); // Prevent any auto-connect or UI updates
    setAutoConnecting(false); // Disable auto-connect
    
    // End the chat session with SDK first
    setTyping(false);
    setStatus("idle");
    console.log('Calling chatClient.endChat()');
    try {
      await chatClient.endChat();
      console.log('chatClient.endChat() completed successfully');
    } catch (err) {
      console.error("Error ending chat:", err);
    }
    
    // Clear messages and reset state
    setMessages([]);
    setCurrentAgentName(null);
    setCurrentAgentType("bot");
    setQueuePosition(null);
    setAvgWaitTime(null);
    setSuggestions([]);
    setInput("");
    setError("");
    
    // Small delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Notify parent (extension) to close after cleanup
    if (window.parent && window.parent !== window) {
      console.log('Sending endChat message to parent');
      try {
        window.parent.postMessage({ action: 'endChat' }, '*');
        console.log('endChat message sent');
      } catch (e) {
        console.error('Error sending endChat message:', e);
      }
    }
  };

  const cancelEndChat = () => {
    setShowEndChatConfirm(false);
  };

  const stop = async () => {
    setTyping(false);
    try {
      await chatClient.endChat();
    } catch (err) {
      console.error(err);
    } finally {
      setStatus("idle");
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;

    const optimistic: ChatMessage = {
      id: createId(),
      from: "user",
      text,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    
    // Show typing indicator as fallback if SDK doesn't fire typing events
    setTyping(true);

    try {
      await chatClient.sendMessage(text);
    } catch (err) {
      console.error(err);
      setError("Message failed to send.");
      setTyping(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (status === "connected") {
      send();
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setError("Speech recognition not supported in this browser");
      return;
    }
    
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  };

  const showTemporaryError = (message: string) => {
    setError(message);
    setTimeout(() => setError(""), 4000); // Clear error after 4 seconds
  };

  const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const openEmailDialog = () => {
    if (status !== "connected") {
      showTemporaryError("Connect to chat to email the transcript.");
      return;
    }
    setEmailInput("");
    setEmailSending(false);
    setShowEmailDialog(true);
  };

  const closeEmailDialog = () => {
    setShowEmailDialog(false);
    setEmailSending(false);
  };

  const sendEmailTranscript = async () => {
    const email = emailInput.trim();
    if (!validateEmail(email)) {
      showTemporaryError("Enter a valid email address.");
      return;
    }
    setEmailSending(true);
    try {
      await chatClient.emailTranscript(email);
      setShowEmailDialog(false);
      showTemporaryError(`Transcript will be emailed to ${email}`);
    } catch (err) {
      console.error("Failed to email transcript", err);
      showTemporaryError("Could not send transcript. Try again.");
    } finally {
      setEmailSending(false);
    }
  };

  const handleAdaptiveCardSubmit = useCallback(async (data: any, actionTitle?: string) => {
    const summary = formatAdaptiveSubmission(data, actionTitle);
    const optimistic: ChatMessage = {
      id: createId(),
      from: "user",
      text: summary,
      timestamp: Date.now()
    };
    setMessages((prev) => [...prev, optimistic]);
    setTyping(true);
    try {
      await chatClient.sendMessage(JSON.stringify({
        type: "adaptiveCardSubmit",
        data
      }));
    } catch (err) {
      console.error("Adaptive card submit failed", err);
      setError("Message failed to send.");
      setTyping(false);
    }
  }, []);

  // Ack copy attempts handled by the host page / extension (Edge fallback)
  useEffect(() => {
    const handleCopyAck = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;
      const data: any = event.data;
      if (data.action === "copyLinkResult") {
        if (data.success) {
          setCopyStatus("copied");
          setTimeout(() => setCopyStatus(""), 1600);
        } else {
          showTemporaryError("Could not copy the link. Copy manually.");
        }
      }
    };
    window.addEventListener("message", handleCopyAck);
    return () => window.removeEventListener("message", handleCopyAck);
  }, []);

  const speakMessage = (messageId: string, text: string) => {
    // Stop any currently speaking message
    window.speechSynthesis.cancel();
    
    if (speakingMessageId === messageId) {
      // If clicking the same message, stop speaking
      setSpeakingMessageId(null);
      return;
    }

    const cleanText = markdownToPlainText(text).trim();
    if (!cleanText) {
      showTemporaryError("No readable text to speak.");
      return;
    }

    // Start speaking the new message
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    utterance.onend = () => {
      setSpeakingMessageId(null);
    };
    
    utterance.onerror = () => {
      setSpeakingMessageId(null);
    };

    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const handleCameraClick = () => {
    // Check if on desktop/laptop
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) {
      showTemporaryError("Camera access is limited on desktop. Please select an image from your files.");
    }
    cameraInputRef.current?.click();
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        showTemporaryError("Image must be less than 5MB");
        return;
      }
      
      // Validate file type
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
        showTemporaryError("Only JPG, JPEG, and PNG images are allowed");
        return;
      }
      
      await handleFileUpload(file);
    }
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        showTemporaryError("File must be less than 5MB");
        return;
      }
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        showTemporaryError("Only PDF, JPG, JPEG, and PNG files are allowed");
        return;
      }
      
      await handleFileUpload(file);
    }
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const handleFileUpload = async (file: File) => {
    // Create preview URL for images
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
    
    // Create optimistic message with uploading state
    const uploadingMessage: ChatMessage = {
      id: createId(),
      from: "user",
      text: input.trim() || "", // Include any text in the input
      timestamp: Date.now(),
      fileMetadata: {
        name: file.name,
        type: file.type,
        size: file.size,
        url: previewUrl
      },
      uploading: true
    };

    // Add to messages immediately
    setMessages((prev) => [...prev, uploadingMessage]);
    setInput(""); // Clear input

    try {
      // Upload to Omnichannel - SDK expects the File object directly
      await chatClient.uploadFileAttachment(file);

      // Update message to remove uploading state
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === uploadingMessage.id
            ? { ...msg, uploading: false }
            : msg
        )
      );

    } catch (error) {
      console.error("File upload failed:", error);
      showTemporaryError("Failed to upload file. Please try again.");
      
      // Remove the failed upload message
      setMessages((prev) => prev.filter((msg) => msg.id !== uploadingMessage.id));
      
      // Clean up preview URL
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    }
  };

  const handleAgentSwitch = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;
    
    setCurrentAgent(agentId);
    setMenuOpen(false);
    
    // Only show toast notification, no message in chat
    showTemporaryError(`Switched to ${agent.name}`);
  };

  const copyShareUrl = async () => {
    const shareUrl = window.location.href;
    const markCopied = () => {
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus(""), 1600);
    };
    try {
      await navigator.clipboard.writeText(shareUrl);
      markCopied();
      return;
    } catch (err) {
      console.error("Failed to copy URL via Clipboard API:", err);
      // Fallback for environments with clipboard permissions blocked
      try {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        markCopied();
        return;
      } catch (fallbackErr) {
        console.error("Fallback copy failed:", fallbackErr);
        // Last attempt: ask the host page/extension (Edge) to copy for us
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ action: "copyLink", url: shareUrl }, "*");
          return;
        }
        showTemporaryError("Could not copy the link. Copy manually.");
      }
    }
  };

  const handleSuggestionClick = async (question: string) => {
    setInput(question);
    
    // Auto-send the question
    const optimistic: ChatMessage = {
      id: createId(),
      from: "user",
      text: question,
      timestamp: Date.now()
    };

    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setTyping(true);

    try {
      await chatClient.sendMessage(question);
    } catch (err) {
      console.error(err);
      setError("Message failed to send.");
      setTyping(false);
    }
  };

  const fetchFollowUpQuestions = async (botResponses: string) => {
    if (!config.pauUrl) return;
    
    setSuggestionsLoading(true);
    
    try {
      const response = await fetch(config.pauUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          botResponse: botResponses, 
          companyName: config.company || "",
          url: config.company || ""
        })
      });
      
      const result = await response.json();
      const questions = Object.values(result).find((value) => Array.isArray(value)) || [];
      
      const formatted = questions
        .map((qObj: any) => ({ question: qObj.item || qObj }))
        .filter((q: Suggestion) => typeof q.question === "string" && q.question.trim() !== "")
        .slice(0, 2);
      
      setSuggestions(formatted);
    } catch (error) {
      console.error("Error fetching follow-up questions:", error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  useEffect(() => {
    if (status !== "connected") return;

    const unsubscribeNewMessage = chatClient.onNewMessage((message) => {
      // Queue info comes as system messages - parse them
      const messageText = message.text?.toLowerCase() || '';
      
      // Check for queue position in system message
      if (messageText.includes('position') && messageText.includes('queue')) {
        const positionMatch = messageText.match(/position.*?(\d+)/i);
        if (positionMatch && positionMatch[1]) {
          setQueuePosition(parseInt(positionMatch[1]));
        }
      }
      
      // Check for average wait time in system message
      if (messageText.includes('average') || messageText.includes('wait')) {
        const timeMatch = messageText.match(/(\d+)\s*(min|minute)/i);
        if (timeMatch && timeMatch[1]) {
          setAvgWaitTime(parseInt(timeMatch[1]) * 60); // Convert to seconds
        }
      }
      
      setMessages((prev) => {
        // Check if message already exists (updating for file download completion)
        const existingIndex = prev.findIndex(m => m.id === message.id);
        if (existingIndex !== -1) {
          console.log("Updating existing message at index:", existingIndex, "with ID:", message.id, "downloading:", message.downloading);
          // Update existing message
          const updated = [...prev];
          updated[existingIndex] = message;
          return updated;
        }
        // Add new message
        console.log("Adding new message with ID:", message.id, "downloading:", message.downloading);
        return [...prev, message];
      });
      // Hide typing indicator when message arrives
      setTyping(false);
      // Hide skeleton on first message
      setShowSkeleton(false);
      if (message.from === "agent") {
        // Track agent information for typing indicator (but skip placeholder names)
        if (message.agentName && !message.agentName.includes("_") && message.agentName.length < 50) {
          setCurrentAgentName(message.agentName);
          setCurrentAgentType(message.agentType || "bot");
        }
        // Clear queue status when first agent message arrives
        setQueuePosition(null);
        setAvgWaitTime(null);
        fetchFollowUpQuestions(message.text);
      }
    });
    const unsubscribeTyping = chatClient.onTyping((payload) => {
      console.log("Typing event received:", payload);
      const state = payload?.typingIndicator?.state;
      console.log("Typing state:", state);
      setTyping(state === "typing");
    });

    return () => {
      unsubscribeNewMessage?.();
      unsubscribeTyping?.();
    };
  }, [status]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, typing]);

  const isBusy = status === "connecting";
  const isConnected = status === "connected";

  // Show offline message if no internet
  if (!isOnline) {
    return (
      <div className="page">
        <div className="frame config-frame">
          <div className="config-container">
            <div className="config-icon-wrapper">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="config-icon">
                <path d="M2 10s3-3 10-3 10 3 10 3"/>
                <path d="M12 2v5"/>
                <circle cx="12" cy="17" r="3"/>
                <line x1="1" y1="1" x2="23" y2="23" strokeWidth="2"/>
              </svg>
            </div>
            <h1 className="config-title">No Internet Connection</h1>
            <p className="config-subtitle">
              Please check your network connection and try again
            </p>
            <div className="config-status-badge offline">
              <span className="status-dot"></span>
              Offline
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show configuration guide if invalid
  if (!isConfigValid) {
    return (
      <div className="page">
        <div className="frame config-frame">
          <div className="config-container">
            <div className="config-icon-wrapper">
              <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="config-icon">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M12 8v4"/>
                <path d="M12 16h.01"/>
              </svg>
            </div>
            <h1 className="config-title">Configuration Required</h1>
            <p className="config-subtitle">
              Add Omnichannel parameters to the URL to get started
            </p>
            
            <div className="config-card">
              <div className="config-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M9 3v18"/>
                </svg>
                <span>Required Parameters</span>
              </div>
              <div className="config-params">
                <div className="config-param">
                  <code>orgId</code>
                  <span>Organization ID</span>
                </div>
                <div className="config-param">
                  <code>orgUrl</code>
                  <span>Organization URL</span>
                </div>
                <div className="config-param">
                  <code>widgetId</code>
                  <span>Chat widget ID</span>
                </div>
              </div>
              
              <div className="config-card-header optional">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4"/>
                  <path d="M12 8h.01"/>
                </svg>
                <span>Optional Parameters</span>
              </div>
              <div className="config-params">
                <div className="config-param">
                  <code>company</code>
                  <span>Company domain for branding</span>
                </div>
              </div>
            </div>

            <div className="config-example">
              <div className="config-example-header">Example URL</div>
              <div className="config-example-code">
                <span className="config-url-base">https://yourapp.com/</span><span className="config-url-param">?orgId=abc123</span><span className="config-url-param">&orgUrl=https://org.dynamics.com</span><span className="config-url-param">&widgetId=xyz789</span><span className="config-url-param optional">&company=contoso.com</span>
              </div>
            </div>

            <div className="config-tip">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
              <span>Find these values in <strong>Dynamics 365 Customer Service</strong> under Chat → Widget settings</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="frame">
        <header style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          background: "white",
          borderBottom: "1px solid #f1f5f9"
        }}>
          {/* Left: Company Logo */}
          <img 
            src={logoUrl} 
            alt="Company Logo" 
            style={{ 
              height: "28px",
              maxWidth: "100px",
              objectFit: "contain"
            }}
            onError={(e) => {
              if (logoUrl !== aiIcon) {
                setLogoUrl(aiIcon);
              }
            }}
            onLoad={(e) => {
              const img = e.target as HTMLImageElement;
              if ((img.naturalWidth < 32 || img.naturalHeight < 32) && logoUrl !== aiIcon && !logoUrl.includes('ai.png')) {
                setLogoUrl(aiIcon);
              }
            }}
          />

          {/* Right: Control Icons */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {status === "connected" && messages.length > 0 && (
            <>
              <button
                onClick={handleMinimizeChat}
                title="Minimize chat"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "6px",
                  transition: "background 0.2s",
                  color: "#94a3b8"
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5"/>
                </svg>
              </button>
              
              <button
                onClick={handleEndChatRequest}
                title="End chat"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "6px",
                  transition: "background 0.2s",
                  color: "#94a3b8"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#fef2f2";
                  e.currentTarget.style.color = "#ef4444";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#94a3b8";
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </>
          )}
          </div>
        </header>

        {/* Queue Status Banner */}
        {status === "connected" && (queuePosition !== null || avgWaitTime !== null) && (
          <div className="queue-banner">
            <div className="queue-content">
              <div className="queue-spinner">
                <div className="spinner-ring"></div>
              </div>
              <div className="queue-text">
                <div className="queue-message">Connecting you with an agent</div>
                <div className="queue-details">
                  {queuePosition !== null && queuePosition > 0 && (
                    <span>Position in queue: {queuePosition}</span>
                  )}
                  {avgWaitTime !== null && avgWaitTime > 0 && (
                    <span>{queuePosition !== null && queuePosition > 0 ? " • " : ""}Estimated wait: {Math.ceil(avgWaitTime / 60)} min</span>
                  )}
                  {(queuePosition === null || queuePosition === 0) && (avgWaitTime === null || avgWaitTime === 0) && (
                    <span>Please wait...</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Agents Side Panel */}
        {menuOpen && (
          <>
            <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
            <div className="agents-panel">
              <div className="agents-panel-header">
                <div>
                  <h3>Choose Your Assistant</h3>
                  <p>{agents.find(a => a.id === currentAgent)?.name || "General Support"}</p>
                </div>
                <button className="panel-close" onClick={() => setMenuOpen(false)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              
              <div className="agents-grid">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className={`agent-tile ${currentAgent === agent.id ? 'active' : ''}`}
                    onClick={() => handleAgentSwitch(agent.id)}
                    style={currentAgent === agent.id && brandColors ? {
                      background: `linear-gradient(135deg, ${brandColors.primary}08, ${brandColors.primary}04)`,
                      borderColor: brandColors.primary,
                      boxShadow: `0 0 0 1px ${brandColors.primary}30`
                    } : undefined}
                  >
                    <div 
                      className="agent-icon-indicator"
                      style={currentAgent === agent.id && brandColors ? {
                        background: brandColors.primary
                      } : undefined}
                    />
                    <div className="agent-info">
                      <div 
                        className="agent-name"
                        style={currentAgent === agent.id && brandColors ? {
                          color: brandColors.primary
                        } : undefined}
                      >
                        {agent.name}
                      </div>
                      <div className="agent-desc">{agent.description}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="agents-panel-footer">
                <button className="floating-return-button" onClick={() => setMenuOpen(false)}>
                  Return to Chat
                </button>
                <button className="copy-link" type="button" onClick={copyShareUrl} aria-label="Copy chat link">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l2.57-2.57a5 5 0 0 0-7.07-7.07L11 5"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54L3.89 13a5 5 0 1 0 7.07 7.07L13 19"/>
                  </svg>
                  <span>Copy chat link</span>
                  {copyStatus === "copied" && <span className="copy-link-status">Copied</span>}
                </button>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
                  {iconReady ? "Home screen icon ready for Add to Home Screen." : "Preparing home screen icon..."}
                </div>
              </div>
            </div>
          </>
        )}

        <section className="chat-shell">
          <div className="transcript" ref={transcriptRef}>
            {showSkeleton && messages.length === 0 && (
              <div className="skeleton-loader">
                <div className="skeleton-status">
                  <div className="skeleton-status-dot"></div>
                  <span>Connecting to assistant...</span>
                </div>
                <div className="skeleton-bubble-row">
                  <div className="skeleton-avatar"></div>
                  <div className="skeleton-bubble skeleton-shimmer"></div>
                </div>
                <div className="skeleton-bubble-row">
                  <div className="skeleton-avatar"></div>
                  <div className="skeleton-bubble skeleton-bubble-short skeleton-shimmer"></div>
                </div>
              </div>
            )}
            {messages.map((message, index) => {
              // Show agent name only when it changes or is the first message from this agent
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const showAgentName = message.from === "agent" && 
                                   message.agentName && 
                                   message.agentType === "human" &&
                                   !message.agentName.includes("_") &&
                                   message.agentName.length < 50 &&
                                   (!prevMessage || prevMessage.agentName !== message.agentName);
              
              return (
              <div key={message.id}>
                {showAgentName && (
                  <div className="agent-name-label">{message.agentName}</div>
                )}
                <div className={`bubble-row ${message.from}`}>
                  {message.from === "agent" && logoUrl && (
                    <div className="agent-avatar" title={message.agentName && !message.agentName.includes("_") ? message.agentName : "AI Assistant"}>
                      <img src={logoUrl} alt="Agent" />
                    </div>
                  )}
                  <div className="bubble-container">
                    {message.fileMetadata && (
                      <a 
                        href={message.fileMetadata.url} 
                        download={message.fileMetadata.name}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`file-preview ${message.uploading || message.downloading ? 'uploading' : ''} ${message.fileMetadata?.type.startsWith('image/') ? 'image-preview' : ''}`}
                        onClick={(e) => {
                          if (message.uploading || message.downloading || !message.fileMetadata?.url) {
                            e.preventDefault();
                            return;
                          }
                          // For non-image files or if user wants to download, trigger download
                          if (message.fileMetadata && (!message.fileMetadata.type.startsWith('image/') || e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            const link = document.createElement('a');
                            link.href = message.fileMetadata.url;
                            link.download = message.fileMetadata.name;
                            link.click();
                          }
                          // For images, let default behavior open in new tab
                        }}
                      >
                        {message.fileMetadata.type.startsWith('image/') && message.fileMetadata.url ? (
                          <>
                            <img 
                              src={message.fileMetadata.url} 
                              alt={message.fileMetadata.name}
                              className="file-thumbnail"
                            />
                            <div className="file-info-overlay">
                              <div className="file-size">{(message.fileMetadata.size / 1024).toFixed(0)} KB</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="file-icon">
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                              </svg>
                            </div>
                            <div className="file-info">
                              <div className="file-name">{message.fileMetadata.name}</div>
                              <div className="file-size">
                                {message.downloading ? (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <div className="progress-spinner" style={{ width: '12px', height: '12px' }}></div>
                                    Downloading...
                                  </span>
                                ) : (
                                  `${(message.fileMetadata.size / 1024).toFixed(0)} KB`
                                )}
                              </div>
                            </div>
                          </>
                        )}
                        {message.uploading && (
                          <div className="upload-progress">
                            <div className="progress-spinner"></div>
                          </div>
                        )}
                      </a>
                    )}
                    {(message.text || message.suggestedActions || message.adaptiveCard) && (
                    <div 
                      className="bubble"
                    style={message.from === "user" && brandColors ? {
                      background: brandColors.primary,
                      color: getContrastColor(brandColors.primary)
                    } : undefined}
                  >
                    {message.text && (
                      <div
                        className="message-text"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.text) }}
                      />
                    )}
                    
                    {message.suggestedActions && message.suggestedActions.length > 0 && (
                      <div className="suggested-actions">
                        {message.suggestedActions.map((action, idx) => (
                          <button
                            key={idx}
                            className="suggested-action-button"
                            style={brandColors ? {
                              borderColor: brandColors.primary,
                              color: brandColors.primary
                            } : undefined}
                            onClick={async () => {
                              // Send immediately without going to input
                              const optimistic: ChatMessage = {
                                id: createId(),
                                from: "user",
                                text: action.value,
                                timestamp: Date.now()
                              };
                              setMessages((prev) => [...prev, optimistic]);
                              setTyping(true);
                              try {
                                await chatClient.sendMessage(action.value);
                              } catch (err) {
                                console.error(err);
                                setError("Message failed to send.");
                                setTyping(false);
                              }
                            }}
                          >
                            {action.title}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {message.adaptiveCard && (
                      <div className="adaptive-card-wrapper">
                        <AdaptiveCardView
                          card={message.adaptiveCard}
                          onSubmit={handleAdaptiveCardSubmit}
                          colors={brandColors || undefined}
                        />
                      </div>
                    )}
                  </div>
                  )}
                  </div>
                  {message.from === "agent" && (
                    <button 
                      className={`speak-button ${speakingMessageId === message.id ? 'speaking' : ''}`}
                      onClick={() => speakMessage(message.id, message.text)}
                      title={speakingMessageId === message.id ? "Stop reading" : "Read aloud"}
                    >
                      <img src={volumeIcon} alt="" />
                    </button>
                  )}
                </div>
              </div>
            );
            })}
            {typing && (
              <div className="bubble-row agent">
                {logoUrl && (
                  <div className="agent-avatar" title={currentAgentName || "AI Assistant"}>
                    <img src={logoUrl} alt="Agent" />
                  </div>
                )}
                <div className="typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
          </div>

          {suggestionsLoading && (
            <div className="suggestions">
              <div className="suggestions-header">Not Sure? Questions to Help</div>
              <div className="suggestions-grid">
                <div className="suggestion-card-skeleton skeleton-shimmer"></div>
                <div className="suggestion-card-skeleton skeleton-shimmer"></div>
              </div>
            </div>
          )}

          {!suggestionsLoading && suggestions.length > 0 && (
            <div className="suggestions">
              <div className="suggestions-header">Not Sure? Questions to Help</div>
              <div className="suggestions-grid">
                {suggestions.map((s, idx) => (
                  <div 
                    key={idx} 
                    className="suggestion-card"
                    onClick={() => handleSuggestionClick(s.question)}
                    style={brandColors ? {
                      transition: 'all 0.2s ease'
                    } : undefined}
                    onMouseEnter={(e) => {
                      if (brandColors) {
                        e.currentTarget.style.borderColor = brandColors.primary;
                        e.currentTarget.style.background = `${brandColors.primary}08`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.background = 'white';
                    }}
                  >
                    <div className="suggestion-text">{s.question}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Toolbar - Above Composer */}
          <div className="action-toolbar">
            <button 
              type="button" 
              className="action-btn"
              onClick={toggleListening}
              disabled={!isConnected}
              aria-label="Voice input"
              title="Voice input"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" x2="12" y1="19" y2="22"/>
              </svg>
            </button>
            <button 
              type="button" 
              className="action-btn"
              onClick={handleCameraClick}
              disabled={!isConnected}
              aria-label="Camera"
              title="Camera"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                <circle cx="12" cy="13" r="3"/>
              </svg>
            </button>
            <button 
              type="button" 
              className="action-btn"
              onClick={handleFileClick}
              disabled={!isConnected}
              aria-label="Attach file"
              title="Attach file"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <button 
              type="button" 
              className="action-btn"
              onClick={openEmailDialog}
              disabled={!isConnected}
              aria-label="Send email"
              title="Send email"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
            </button>
            <button 
              type="button" 
              className="action-btn"
              onClick={() => setMenuOpen(!menuOpen)}
              disabled={!isConnected}
              aria-label="More options"
              title="More options"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="1"/>
                <circle cx="19" cy="12" r="1"/>
                <circle cx="5" cy="12" r="1"/>
              </svg>
            </button>
          </div>

          <form className="composer" onSubmit={onSubmit}>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              capture="user"
              style={{ display: 'none' }}
              onChange={handleCameraChange}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,image/png,image/jpeg,application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <input
              type="text"
              placeholder={isConnected ? (listening ? "Listening..." : "Ask a question") : "Connecting..."}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              disabled={!isConnected}
            />
            <button type="submit" className="primary" disabled={!isConnected || !input.trim()}>
              ➤
            </button>
          </form>
          
          {/* Powered by Copilot */}
          <div className="powered-by">
            <img 
              src={copilotIcon} 
              alt="Microsoft Copilot Studio" 
            />
            <span>Powered by Microsoft Copilot Studio</span>
          </div>
        </section>

        {error && (
          <div className="toast-notification">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* End Chat Confirmation Dialog */}
        {showEndChatConfirm && (
          <>
            <div className="menu-backdrop" onClick={cancelEndChat} />
            <div style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "white",
              borderRadius: "12px",
              padding: "24px",
              boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
              zIndex: 10001,
              maxWidth: "360px",
              width: "90%"
            }}>
              <h3 style={{ 
                margin: "0 0 12px 0", 
                fontSize: "18px", 
                fontWeight: "600",
                color: "#1e293b"
              }}>
                End Chat Session?
              </h3>
              <p style={{ 
                margin: "0 0 24px 0", 
                fontSize: "14px", 
                color: "#64748b",
                lineHeight: "1.5"
              }}>
                Are you sure you want to end this chat? This will close your conversation and you won't be able to reconnect to this session.
              </p>
              <div style={{ 
                display: "flex", 
                gap: "12px", 
                justifyContent: "flex-end" 
              }}>
                <button
                  onClick={cancelEndChat}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    background: "white",
                    color: "#64748b",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "white"}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmEndChat}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#ef4444",
                    color: "white",
                    fontSize: "14px",
                    fontWeight: "500",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#dc2626"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#ef4444"}
                >
                  End Chat
                </button>
              </div>
            </div>
          </>
        )}

        {/* Email transcript dialog */}
        {showEmailDialog && (
          <>
            <div className="menu-backdrop" onClick={closeEmailDialog} />
            <div style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "white",
              borderRadius: "16px",
              padding: "22px",
              boxShadow: "0 20px 60px rgba(15,23,42,0.16)",
              zIndex: 10001,
              width: "92%",
              maxWidth: "420px",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}>
              <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "flex-start", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>Email transcript</div>
                  <div style={{ fontSize: "12px", color: "#6b7280" }}>We’ll send the chat transcript to your email.</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "11px", fontWeight: 600, color: "#475569", letterSpacing: "0.01em" }}>Email address</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    background: "#f5f7fb",
                    fontSize: "13px",
                    color: "#0f172a",
                    outline: "none",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
                    transition: "border-color 0.15s ease, box-shadow 0.15s ease"
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      sendEmailTranscript();
                    }
                  }}
                  autoFocus
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
                <button
                  onClick={closeEmailDialog}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "12px",
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#475569",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    minWidth: "110px",
                    boxShadow: "0 10px 22px rgba(15,23,42,0.04)"
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={sendEmailTranscript}
                  disabled={emailSending}
                  style={{
                    padding: "12px 20px",
                    borderRadius: "12px",
                    border: "none",
                    background: brandColors?.primary || "#f59e0b",
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: emailSending ? "wait" : "pointer",
                    minWidth: "130px",
                    boxShadow: "0 14px 30px rgba(0,0,0,0.14)",
                    opacity: emailSending ? 0.85 : 1,
                    transition: "transform 0.12s ease"
                  }}
                >
                  {emailSending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Ending Chat Overlay */}
        {endingChat && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(255, 255, 255, 0.95)",
            zIndex: 10002,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px"
          }}>
            <div className="progress-spinner" style={{ width: "40px", height: "40px" }}></div>
            <div style={{
              fontSize: "16px",
              fontWeight: "500",
              color: "#64748b"
            }}>
              Ending conversation...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
