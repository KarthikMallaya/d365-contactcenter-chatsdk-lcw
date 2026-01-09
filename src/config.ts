// Get configuration from URL parameters
export const getOmnichannelConfig = () => {
  const params = new URLSearchParams(window.location.search);
  
  const orgId = params.get("orgId");
  const orgUrl = params.get("orgUrl");
  const widgetId = params.get("widgetId");
  const channelId = params.get("channelId") || "lcw";
  const company = params.get("company");
  const headerIcon = params.get("headerIcon");
  const pauUrl = params.get("pauUrl") || ""; // Optional: Power Automate URL for AI follow-up questions (demo feature)
  const agentsUrl = params.get("agentsUrl"); // Power Automate URL for dynamic agents
  const primaryColor = normalizeHex(params.get("primaryColor"));
  const secondaryColor = normalizeHex(params.get("secondaryColor"));
  const lightColor = normalizeHex(params.get("lightColor"));
  const darkColor = normalizeHex(params.get("darkColor"));

  const customColors = primaryColor ? {
    primary: primaryColor,
    secondary: secondaryColor || primaryColor,
    light: lightColor || lightenHex(primaryColor, 40),
    dark: darkColor || darkenHex(primaryColor, 20)
  } : null;

  return {
    orgId,
    orgUrl,
    widgetId,
    channelId,
    company,
    headerIcon,
    pauUrl,
    agentsUrl,
    customColors,
    isValid: !!(orgId && orgUrl && widgetId)
  };
};

// Brand color mappings for known companies
const brandColors: Record<string, { primary: string; secondary: string; light: string; dark: string }> = {
  "nab.com.au": { primary: "#E10A0A", secondary: "#C00808", light: "#FFE5E5", dark: "#A00606" },
  "cba.com.au": { primary: "#FFCC00", secondary: "#000000", light: "#FFF9E0", dark: "#CCA300" },
  "anz.com": { primary: "#007DBB", secondary: "#005A87", light: "#E0F2FA", dark: "#004A6D" },
  "westpac.com.au": { primary: "#DA1710", secondary: "#A51108", light: "#FFE8E6", dark: "#7D0D06" },
};

export const getCompanyLogoUrl = (company: string | null) => {
  if (!company) return "/src/assets/ai.png";
  
  // Clean up the URL - remove protocol, www, and extract base domain only
  let baseUrl = company
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]  // Get only the domain part before any path
    .split('?')[0]  // Remove query parameters if any
    .replace(/\/$/, '');
  
  // Basic validation - check if domain looks reasonable
  if (!baseUrl.includes('.') || baseUrl.length < 4) {
    return "/src/assets/ai.png";
  }
  
  // Logo.dev API - Get your free token at https://logo.dev
  // For production, consider hosting logos yourself instead of using third-party APIs
  return `https://img.logo.dev/${baseUrl}?token=YOUR_LOGO_DEV_TOKEN&fallback_url=placeholder`;
};

export const getBrandColors = (company: string | null) => {
  if (!company) return null;
  
  // Clean up the URL - extract base domain only
  let baseUrl = company
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]  // Get only the domain part before any path
    .split('?')[0]  // Remove query parameters if any
    .replace(/\/$/, '');
  
  return brandColors[baseUrl] || null;
};

const normalizeHex = (value: string | null) => {
  if (!value) return null;
  const hex = value.trim();
  const match = hex.match(/^#?([0-9a-fA-F]{6})$/);
  return match ? `#${match[1]}` : null;
};

// Lightweight lighten/darken helpers for custom colors
const lightenHex = (hex: string, percent: number) => {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
};

const darkenHex = (hex: string, percent: number) => {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  return "#" + (
    0x1000000 +
    (R > 0 ? R : 0) * 0x10000 +
    (G > 0 ? G : 0) * 0x100 +
    (B > 0 ? B : 0)
  ).toString(16).slice(1);
};
