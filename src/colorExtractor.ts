// Extract dominant colors from an image URL
export const extractColorsFromImage = (imageUrl: string, seed?: string): Promise<{
  primary: string;
  secondary: string;
  light: string;
  dark: string;
}> => {
  return new Promise((resolve) => {
    const finishWithDefault = () => resolve(defaultPalette(seed));
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onerror = () => {
      console.warn("CORS error loading image, using fallback colors");
      finishWithDefault();
    };
    
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        
        if (!ctx) {
          finishWithDefault();
          return;
        }

        // Use smaller size for performance
        const size = 100;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        let imageData;
        try {
          imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch (e) {
          console.warn("Cannot read image data (CORS), using fallback colors", e);
          finishWithDefault();
          return;
        }
        const pixels = imageData.data;
        const bucketStep = 12;
        const edgeMargin = 6;

        type Bucket = { count: number; r: number; g: number; b: number; s: number; l: number };
        const buckets = new Map<string, Bucket>();
        const edgeBuckets = new Map<string, Bucket>();

        const addToBucket = (map: Map<string, Bucket>, key: string, r: number, g: number, b: number, s: number, l: number) => {
          const bucket = map.get(key) || { count: 0, r: 0, g: 0, b: 0, s: 0, l: 0 };
          bucket.count += 1;
          bucket.r += r;
          bucket.g += g;
          bucket.b += b;
          bucket.s += s;
          bucket.l += l;
          map.set(key, bucket);
        };

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const i = (y * size + x) * 4;
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const a = pixels[i + 3];

            if (a < 120) continue;

            const hsl = rgbToHsl(r, g, b);
            // Skip near-white/near-black and very gray pixels to reduce background bias
            if (hsl.l > 0.97 || hsl.l < 0.03) continue;
            if (hsl.s < 0.05) continue;

            const key = `${Math.round(r / bucketStep) * bucketStep},${Math.round(g / bucketStep) * bucketStep},${Math.round(b / bucketStep) * bucketStep}`;
            addToBucket(buckets, key, r, g, b, hsl.s, hsl.l);

            if (x < edgeMargin || x >= size - edgeMargin || y < edgeMargin || y >= size - edgeMargin) {
              addToBucket(edgeBuckets, key, r, g, b, hsl.s, hsl.l);
            }
          }
        }

        const normalizeBuckets = (map: Map<string, Bucket>) =>
          Array.from(map.entries()).map(([key, data]) => {
            const count = data.count || 1;
            const r = Math.round(data.r / count);
            const g = Math.round(data.g / count);
            const b = Math.round(data.b / count);
            const hsl = rgbToHsl(r, g, b);
            return {
              key,
              r,
              g,
              b,
              h: hsl.h,
              s: Math.max(0, Math.min(1, data.s / count)),
              l: Math.max(0, Math.min(1, data.l / count)),
              count
            };
          });

        const colors = normalizeBuckets(buckets);
        const edgeColors = normalizeBuckets(edgeBuckets);

        if (!colors.length) {
          finishWithDefault();
          return;
        }

        // Use edges to guess the background and aggressively exclude it from scoring
        const probableBackground = edgeColors
          .filter(c => c.l > 0.65 || c.s < 0.18)
          .sort((a, b) => b.count - a.count)[0];

        const accentCandidates = colors.filter((c) => {
          if (c.count < 3 && c.s < 0.2) return false;
          if (c.l > 0.93 || c.l < 0.08) return false;
          if (c.s < 0.12) return false;
          if (probableBackground && colorDistance(c, probableBackground) < 26) return false;
          return true;
        });

        // Keep very vivid pixels even if they are tiny (e.g., small orange swoosh on white)
        const vividSpots = colors.filter(c =>
          c.s > 0.45 && c.l > 0.18 && c.l < 0.82 && (!probableBackground || colorDistance(c, probableBackground) > 20)
        );

        const mergedCandidatesMap = new Map<string, typeof colors[number]>();
        [...accentCandidates, ...vividSpots].forEach(c => {
          if (!mergedCandidatesMap.has(c.key)) mergedCandidatesMap.set(c.key, c);
        });
        const mergedCandidates = Array.from(mergedCandidatesMap.values());

        if (!mergedCandidates.length) {
          finishWithDefault();
          return;
        }

        const scored = mergedCandidates
          .map((c) => {
            const presence = Math.pow(c.count, 0.92);
            const vividness = Math.pow(Math.max(0.12, c.s), 1.7);
            const balance = 1 - Math.abs(c.l - 0.52);
            const score = presence * (0.6 + vividness * 1.6) * (0.6 + balance) * (c.s > 0.5 ? 1.2 : 1);
            return { ...c, score };
          })
          .sort((a, b) => b.score - a.score);

        const superVivid = scored
          .filter(c => c.s > 0.55 && c.l > 0.2 && c.l < 0.8)
          .sort((a, b) => b.s - a.s || b.count - a.count);

        const primaryCandidate = superVivid[0] || scored[0];

        if (!primaryCandidate) {
          finishWithDefault();
          return;
        }

        let primaryHex = punchyHex(primaryCandidate);
        const primaryHsl = rgbToHsl(primaryCandidate.r, primaryCandidate.g, primaryCandidate.b);

        let secondaryCandidate = scored.find(c => {
          const hueGap = Math.abs(c.h - primaryHsl.h);
          const lightGap = Math.abs(c.l - primaryHsl.l);
          const satGap = Math.abs(c.s - primaryHsl.s);
          return c.key !== primaryCandidate.key && ((hueGap > 0.12 && hueGap < 0.88) || lightGap > 0.12 || satGap > 0.22);
        }) || primaryCandidate;

        let secondaryHex = punchyHex(secondaryCandidate);
        if (getContrastRatio(primaryHex, secondaryHex) < 1.35) {
          secondaryHex = primaryHsl.l > 0.5 ? darkenColor(secondaryHex, 25) : lightenColor(secondaryHex, 25);
          secondaryHex = clampHexLightness(secondaryHex, 0.18, 0.82);
        }

        primaryHex = clampHexLightness(primaryHex, 0.2, 0.82);

        const lightHex = clampHexLightness(lightenColor(primaryHex, 40), 0.15, 0.95);
        const darkHex = clampHexLightness(darkenColor(primaryHex, 22), 0.08, 0.6);

        resolve({
          primary: primaryHex,
          secondary: secondaryHex,
          light: lightHex,
          dark: darkHex
        });
      } catch (error) {
        console.error("Color extraction failed, using fallback palette", error);
        finishWithDefault();
      }
    };

    img.src = imageUrl;
  });
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
};

const hslToHex = (h: number, s: number, l: number): string => {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
};

const lightenColor = (hex: string, percent: number): string => {
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

const darkenColor = (hex: string, percent: number): string => {
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

const hexToRgbTuple = (hex: string) => {
  const normalized = hex.replace("#", "");
  const num = parseInt(normalized, 16);
  return {
    r: (num >> 16) & 0xff,
    g: (num >> 8) & 0xff,
    b: num & 0xff
  };
};

const clampHexLightness = (hex: string, min: number, max: number) => {
  const { r, g, b } = hexToRgbTuple(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const clampedL = Math.min(max, Math.max(min, l));
  return hslToHex(h, s, clampedL);
};

const punchyHex = (c: { r: number; g: number; b: number }) => {
  const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
  let sat = Math.max(s, 0.38);
  let light = l;
  if (light > 0.78) light = 0.58;
  if (light < 0.2) light = 0.26;
  return hslToHex(h, sat, light);
};

const colorDistance = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
};

// Convert RGB to HSL to judge saturation/lightness
const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
};

const defaultPalette = (seed?: string) => {
  if (!seed) {
    return {
      primary: "#3b82f6",
      secondary: "#0ea5e9",
      light: "#e0f2ff",
      dark: "#1d4ed8"
    };
  }
  const hue = hashStringToHue(seed);
  const primary = hslToHex(hue, 0.65, 0.52);
  return {
    primary,
    secondary: hslToHex(hue, 0.55, 0.44),
    light: hslToHex(hue, 0.45, 0.90),
    dark: hslToHex(hue, 0.75, 0.32)
  };
};

const monochromePalette = () => ({
  primary: "#111827",
  secondary: "#0f172a",
  light: "#f5f7fb",
  dark: "#0b1324"
});

const hashStringToHue = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return ((hash % 360) + 360) % 360 / 360; // return normalized 0-1 hue
};

// Calculate relative luminance
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

// Calculate contrast ratio between two colors
const getContrastRatio = (color1: string, color2: string): number => {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
};

// Determine if we should use dark or light text (WCAG AA compliant)
const getContrastColor = (bgColor: string): string => {
  const whiteContrast = getContrastRatio(bgColor, "#ffffff");
  const darkContrast = getContrastRatio(bgColor, "#1e293b");
  
  // WCAG AA requires 4.5:1 for normal text
  // If both fail, choose the one with better contrast
  if (darkContrast >= 4.5) {
    return "#1e293b";
  } else if (whiteContrast >= 4.5) {
    return "#ffffff";
  } else {
    // Neither meets WCAG, pick the better one
    return darkContrast > whiteContrast ? "#1e293b" : "#ffffff";
  }
};

export const applyDynamicTheme = (colors: {
  primary: string;
  secondary: string;
  light: string;
  dark: string;
}) => {
  const root = document.documentElement;
  
  const textColor = getContrastColor(colors.primary);
  
  // Convert hex to RGB for use in rgba
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "99, 102, 241";
  };
  
  root.style.setProperty("--accent", colors.primary);
  root.style.setProperty("--accent-rgb", hexToRgb(colors.primary));
  root.style.setProperty("--accent-strong", colors.dark);
  root.style.setProperty("--accent-light", colors.light);
  root.style.setProperty("--bubble-user", colors.primary);
  root.style.setProperty("--bubble-user-text", textColor);
  
  // Generate background gradient based on brand colors
  const bgLight = lightenColor(colors.primary, 45);
  const bgLight2 = lightenColor(colors.secondary, 45);
  root.style.setProperty("--bg", `linear-gradient(135deg, ${bgLight} 0%, ${bgLight2} 50%, #dbeafe 100%)`);
  
  // Update body background
  document.body.style.background = `linear-gradient(135deg, ${bgLight} 0%, ${bgLight2} 50%, #dbeafe 100%)`;
};
