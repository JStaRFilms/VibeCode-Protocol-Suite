import path from "path";

export const CATEGORY_INDEX = {
  announcement: { label: "Announcements", count: 10, url: "https://21st.dev/s/announcement" },
  background: { label: "Backgrounds", count: 33, url: "https://21st.dev/s/background" },
  border: { label: "Borders", count: 12, url: "https://21st.dev/s/border" },
  "call-to-action": { label: "Calls to Action", count: 34, url: "https://21st.dev/s/call-to-action" },
  comparison: { label: "Comparisons", count: 6, url: "https://21st.dev/s/comparison" },
  dock: { label: "Docks", count: 6, url: "https://21st.dev/s/dock" },
  features: { label: "Features", count: 36, url: "https://21st.dev/s/features" },
  footer: { label: "Footers", count: 14, url: "https://21st.dev/s/footer" },
  hero: { label: "Heroes", count: 73, url: "https://21st.dev/s/hero" },
  hook: { label: "Hooks", count: 31, url: "https://21st.dev/s/hook" },
  image: { label: "Images", count: 26, url: "https://21st.dev/s/image" },
  map: { label: "Maps", count: 2, url: "https://21st.dev/s/map" },
  "navbar-navigation": { label: "Navigation Menus", count: 11, url: "https://21st.dev/s/navbar-navigation" },
  "pricing-section": { label: "Pricing Sections", count: 17, url: "https://21st.dev/s/pricing-section" },
  "scroll-area": { label: "Scroll Areas", count: 24, url: "https://21st.dev/s/scroll-area" },
  shader: { label: "Shaders", count: 15, url: "https://21st.dev/s/shader" },
  testimonials: { label: "Testimonials", count: 15, url: "https://21st.dev/s/testimonials" },
  text: { label: "Texts", count: 58, url: "https://21st.dev/s/text" },
  video: { label: "Videos", count: 9, url: "https://21st.dev/s/video" },
  accordion: { label: "Accordions", count: 40, url: "https://21st.dev/s/accordion" },
  "ai-chat": { label: "AI Chats", count: 30, url: "https://21st.dev/s/ai-chat" },
  alert: { label: "Alerts", count: 23, url: "https://21st.dev/s/alert" },
  avatar: { label: "Avatars", count: 17, url: "https://21st.dev/s/avatar" },
  badge: { label: "Badges", count: 25, url: "https://21st.dev/s/badge" },
  button: { label: "Buttons", count: 130, url: "https://21st.dev/s/button" },
  calendar: { label: "Calendars", count: 34, url: "https://21st.dev/s/calendar" },
  card: { label: "Cards", count: 79, url: "https://21st.dev/s/card" },
  carousel: { label: "Carousels", count: 16, url: "https://21st.dev/s/carousel" },
  checkbox: { label: "Checkboxes", count: 19, url: "https://21st.dev/s/checkbox" },
  "date-picker": { label: "Date Pickers", count: 12, url: "https://21st.dev/s/date-picker" },
  "modal-dialog": { label: "Dialogs / Modals", count: 37, url: "https://21st.dev/s/modal-dialog" },
  dropdown: { label: "Dropdowns", count: 25, url: "https://21st.dev/s/dropdown" },
  "empty-state": { label: "Empty States", count: 1, url: "https://21st.dev/s/empty-state" },
  "file-tree": { label: "File Trees", count: 2, url: "https://21st.dev/s/file-tree" },
  "upload-download": { label: "File Uploads", count: 7, url: "https://21st.dev/s/upload-download" },
  form: { label: "Forms", count: 23, url: "https://21st.dev/s/form" },
  icons: { label: "Icons", count: 10, url: "https://21st.dev/s/icons" },
  input: { label: "Inputs", count: 102, url: "https://21st.dev/s/input" },
  link: { label: "Links", count: 13, url: "https://21st.dev/s/link" },
  menu: { label: "Menus", count: 18, url: "https://21st.dev/s/menu" },
  notification: { label: "Notifications", count: 5, url: "https://21st.dev/s/notification" },
  number: { label: "Numbers", count: 18, url: "https://21st.dev/s/number" },
  pagination: { label: "Paginations", count: 20, url: "https://21st.dev/s/pagination" },
  popover: { label: "Popovers", count: 23, url: "https://21st.dev/s/popover" },
  "radio-group": { label: "Radio Groups", count: 22, url: "https://21st.dev/s/radio-group" },
  select: { label: "Selects", count: 62, url: "https://21st.dev/s/select" },
  sidebar: { label: "Sidebars", count: 10, url: "https://21st.dev/s/sidebar" },
  "sign-in": { label: "Sign Ins", count: 4, url: "https://21st.dev/s/sign-in" },
  "registration-signup": { label: "Sign ups", count: 4, url: "https://21st.dev/s/registration-signup" },
  slider: { label: "Sliders", count: 45, url: "https://21st.dev/s/slider" },
  "spinner-loader": { label: "Spinner Loaders", count: 21, url: "https://21st.dev/s/spinner-loader" },
  table: { label: "Tables", count: 30, url: "https://21st.dev/s/table" },
  tabs: { label: "Tabs", count: 38, url: "https://21st.dev/s/tabs" },
  "chip-tag": { label: "Tags", count: 6, url: "https://21st.dev/s/chip-tag" },
  textarea: { label: "Text Areas", count: 22, url: "https://21st.dev/s/textarea" },
  toast: { label: "Toasts", count: 2, url: "https://21st.dev/s/toast" },
  toggle: { label: "Toggles", count: 12, url: "https://21st.dev/s/toggle" },
  tooltip: { label: "Tooltips", count: 28, url: "https://21st.dev/s/tooltip" },
};

export const SECTION_CATEGORY_MAP = {
  announcement: ["announcement", "badge", "text", "link"],
  header: ["announcement", "navbar-navigation", "button", "dropdown"],
  navbar: ["navbar-navigation", "button", "dropdown", "menu"],
  navigation: ["navbar-navigation", "sidebar", "dropdown", "menu"],
  hero: ["hero", "call-to-action", "background", "text", "image"],
  cta: ["call-to-action", "button", "badge", "text"],
  features: ["features", "card", "icons", "number"],
  logos: ["image", "icons", "scroll-area"],
  testimonials: ["testimonials", "card", "carousel"],
  pricing: ["pricing-section", "comparison", "card", "button"],
  faq: ["accordion", "text"],
  footer: ["footer", "link", "button"],
  sidebar: ["sidebar", "menu", "navbar-navigation", "scroll-area"],
  form: ["form", "input", "textarea", "select", "button"],
  dashboard: ["sidebar", "table", "card", "tabs", "pagination"],
  auth: ["sign-in", "registration-signup", "form", "input", "button"],
  gallery: ["image", "carousel", "card", "video"],
  blog: ["text", "card", "image", "pagination"],
  stats: ["number", "card", "features"],
  table: ["table", "pagination", "tabs"],
  modal: ["modal-dialog", "popover", "button"],
  chat: ["ai-chat", "input", "button", "avatar"],
  map: ["map", "card", "popover"],
};

export function parseArgs(argv) {
  const parsed = { _: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith("--")) {
      parsed._.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const key = rawKey.trim();
    const nextValue = inlineValue ?? argv[i + 1];
    const hasNextValue = inlineValue !== undefined || (nextValue && !nextValue.startsWith("--"));

    if (!hasNextValue) {
      parsed[key] = true;
      continue;
    }

    const value = inlineValue ?? nextValue;
    if (inlineValue === undefined) {
      i += 1;
    }

    if (parsed[key] === undefined) {
      parsed[key] = value;
    } else if (Array.isArray(parsed[key])) {
      parsed[key].push(value);
    } else {
      parsed[key] = [parsed[key], value];
    }
  }

  return parsed;
}

export function forceArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "takomi-21st-dev-components/1.0",
      accept: "text/html,application/json,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

export function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function slugifySectionName(section) {
  return section
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeSections(sectionInput) {
  if (!sectionInput) return [];

  const trimmed = sectionInput.trim();
  if (trimmed.startsWith("[")) {
    const parsed = safeJsonParse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  }

  return trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getSectionCategories(section) {
  const key = slugifySectionName(section);
  return SECTION_CATEGORY_MAP[key] ?? [];
}

export function categoryDetails(slug) {
  return CATEGORY_INDEX[slug] ?? { label: slug, count: null, url: `https://21st.dev/s/${slug}` };
}

export function extractNextFlightPayloads(html) {
  const marker = 'self.__next_f.push([1,"';
  const payloads = [];
  let cursor = 0;

  while (true) {
    const start = html.indexOf(marker, cursor);
    if (start === -1) break;

    let i = start + marker.length;
    let raw = "";

    while (i < html.length) {
      if (html[i] === '"' && html.slice(i, i + 3) === '"])') {
        break;
      }

      if (html[i] === "\\") {
        raw += html.slice(i, i + 2);
        i += 2;
        continue;
      }

      raw += html[i];
      i += 1;
    }

    const decoded = safeJsonParse(`"${raw}"`);
    if (typeof decoded === "string") {
      payloads.push(decoded);
    }

    cursor = i + 3;
  }

  return payloads;
}

export function findJsonString(text, key) {
  const pattern = new RegExp(`${escapeRegex(key)}"((?:[^"\\\\]|\\\\.)*)"`);
  const match = pattern.exec(text);
  if (!match) return null;
  return safeJsonParse(`"${match[1]}"`);
}

export function findJsonObject(text, key, predicate = null) {
  let cursor = 0;

  while (true) {
    const start = text.indexOf(key, cursor);
    if (start === -1) return null;

    const braceIndex = text.indexOf("{", start + key.length);
    if (braceIndex === -1) return null;

    const objectText = sliceBalancedJsonObject(text, braceIndex);
    if (!objectText) return null;

    const parsed = safeJsonParse(objectText);
    if (parsed && (!predicate || predicate(parsed))) {
      return parsed;
    }

    cursor = braceIndex + 1;
  }
}

export function sliceBalancedJsonObject(text, startIndex) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = startIndex; i < text.length; i += 1) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }

  return null;
}

export function deriveOutputPath(baseDir, sourceUrl) {
  const url = new URL(sourceUrl);
  const fileName = path.basename(url.pathname) || "source.txt";
  return path.join(baseDir, fileName);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
