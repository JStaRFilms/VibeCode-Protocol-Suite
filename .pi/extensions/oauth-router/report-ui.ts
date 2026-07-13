import { truncateToWidth, wrapTextWithAnsi, type Component } from "@earendil-works/pi-tui";

export const ROUTER_REPORT_WIDGET_KEY = "oauth-router-report";
export const ROUTER_REPORT_DISMISS_HINT = "Dismiss: /router-clear";

type RouterTheme = {
  fg(color: "accent" | "success" | "warning" | "error" | "muted" | "dim", text: string): string;
  bold(text: string): string;
};

const SENSITIVE_VALUE_KEYS = new Set([
  "access_token", "access-token", "accesstoken",
  "refresh_token", "refresh-token", "refreshtoken",
  "id_token", "id-token", "idtoken",
  "auth_token", "auth-token", "authtoken",
  "api_key", "api-key", "apikey",
  "authorization",
  "client_secret", "client-secret", "clientsecret",
  "password", "secret", "code",
]);
const SENSITIVE_QUERY_KEYS = [...SENSITIVE_VALUE_KEYS, "token", "key"];
const SENSITIVE_QUERY_VALUE = new RegExp(`([?&#](?:${SENSITIVE_QUERY_KEYS.join("|")})=)[^&#\\s"']*`, "gi");

function isKeyCharacter(value: string | undefined): boolean {
  return Boolean(value && /[A-Za-z0-9_-]/.test(value));
}

function skipWhitespace(text: string, start: number): number {
  let index = start;
  while (/\s/.test(text[index] ?? "")) index += 1;
  return index;
}

function quotedEnd(text: string, start: number): number | undefined {
  const quote = text[start];
  for (let index = start + 1; index < text.length; index += 1) {
    if (text[index] === "\\") {
      index += 1;
      continue;
    }
    if (text[index] === quote) return index + 1;
  }
  return undefined;
}

type SensitiveAssignment = { key: string; valueStart: number };

/**
 * Locate a complete assignment key rather than using a word-boundary regex.
 * Underscores and hyphens are key characters, so `zipcode`, `account_code`,
 * and `authorization_status` cannot be mistaken for sensitive keys.
 */
function sensitiveAssignmentAt(text: string, start: number): SensitiveAssignment | undefined {
  if (isKeyCharacter(text[start - 1])) return undefined;

  let key: string;
  let afterKey: number;
  if (text[start] === '"' || text[start] === "'") {
    const end = quotedEnd(text, start);
    if (!end) return undefined;
    key = text.slice(start + 1, end - 1);
    afterKey = end;
  } else {
    if (!isKeyCharacter(text[start])) return undefined;
    afterKey = start;
    while (isKeyCharacter(text[afterKey])) afterKey += 1;
    key = text.slice(start, afterKey);
  }

  if (!SENSITIVE_VALUE_KEYS.has(key.toLowerCase())) return undefined;
  const delimiter = skipWhitespace(text, afterKey);
  if (text[delimiter] !== ":" && text[delimiter] !== "=") return undefined;
  return { key: key.toLowerCase(), valueStart: skipWhitespace(text, delimiter + 1) };
}

function redactSensitiveAssignments(text: string): string {
  let output = "";
  let cursor = 0;

  for (let start = 0; start < text.length; start += 1) {
    const assignment = sensitiveAssignmentAt(text, start);
    if (!assignment || assignment.valueStart >= text.length) continue;

    const valueStart = assignment.valueStart;
    const quote = text[valueStart];
    if (quote === '"' || quote === "'") {
      const valueEnd = quotedEnd(text, valueStart);
      if (!valueEnd) continue;
      output += `${text.slice(cursor, valueStart + 1)}[redacted]${quote}`;
      cursor = valueEnd;
      start = valueEnd - 1;
      continue;
    }

    let valueEnd = valueStart;
    if (assignment.key === "authorization") {
      while (valueEnd < text.length && text[valueEnd] !== "|" && text[valueEnd] !== "\r" && text[valueEnd] !== "\n") valueEnd += 1;
      while (valueEnd > valueStart && /\s/.test(text[valueEnd - 1])) valueEnd -= 1;
    } else {
      while (valueEnd < text.length && !/[\s|,;"'&#]/.test(text[valueEnd])) valueEnd += 1;
    }
    if (valueEnd === valueStart) continue;

    output += `${text.slice(cursor, valueStart)}[redacted]`;
    cursor = valueEnd;
    start = valueEnd - 1;
  }

  return output + text.slice(cursor);
}

/**
 * Remove terminal controls and credentials from presentation only. Router data
 * remains untouched; this boundary exists because labels and upstream errors
 * can originate outside the extension.
 */
export function sanitizeReportText(value: unknown): string {
  let text = String(value ?? "")
    .replace(/\x1b(?:\][^\x07]*(?:\x07|\x1b\\)|\[[0-?]*[ -/]*[@-~]|[PX^_][^\x1b]*(?:\x1b\\))/g, "")
    .replace(/[\x00-\x1f\x7f-\x9f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Bearer credentials can occur outside a key/value field. Assignment
  // parsing below handles every quoted/bare sensitive-key combination and
  // keeps Authorization's multi-word field value intact while redacting it.
  text = text
    .replace(/\b(Bearer\s+)(?:"[^"]*"|'[^']*'|[^\s,;|"']+)/gi, "$1[redacted]")
    .replace(SENSITIVE_QUERY_VALUE, "$1[redacted]");
  text = redactSensitiveAssignments(text)
    .replace(/\b(sk-[A-Za-z0-9_-]{8,}|(?:eyJ[A-Za-z0-9_-]+\.){2}[A-Za-z0-9_-]+)\b/gi, "[redacted]");

  return text;
}

/** Return the RPC-compatible report representation without terminal controls. */
export function createRouterReportLines(text: string): string[] {
  return text.split(/\r?\n/).map(sanitizeReportText);
}

function fitQuotaBar(line: string, width: number): string {
  const match = /\[([█░]+)\]/.exec(line);
  if (!match) return line;
  const source = match[1];
  const targetWidth = width <= 45 ? 8 : width <= 70 ? 12 : 18;
  if (source.length <= targetWidth) return line;
  const filled = [...source].filter((cell) => cell === "█").length;
  const targetFilled = Math.round((filled / source.length) * targetWidth);
  return `${line.slice(0, match.index)}[${"█".repeat(targetFilled)}${"░".repeat(targetWidth - targetFilled)}]${line.slice(match.index + match[0].length)}`;
}

function styleLine(theme: RouterTheme, line: string): string {
  if (line === ROUTER_REPORT_DISMISS_HINT) return theme.fg("accent", theme.bold(line));
  if (line.startsWith("# ")) return theme.fg("accent", theme.bold(line.slice(2)));
  if (line.startsWith("## ")) return theme.fg("accent", theme.bold(line.slice(3)));

  // State words must win over incidental success counters or a prior healthy
  // status. In particular, an explicitly disabled account is never success.
  if (/\b(auth=invalid|auth invalid|invalid)\b/i.test(line)) return theme.fg("error", line);
  if (/\b(degraded|cooldown|penalty)\b/i.test(line)) return theme.fg("warning", line);
  if (/\b(enabled\s*=\s*false|disabled|inactive)\b/i.test(line)) return theme.fg("muted", line);
  if (/^Provider:\s*/.test(line)) return theme.fg("accent", line);
  if (/^Local:\s*/.test(line)) return theme.fg("muted", line);

  const quota = /(\d+)% left/.exec(line);
  if (quota) {
    const remaining = Number(quota[1]);
    return theme.fg(remaining <= 20 ? "error" : remaining <= 50 ? "warning" : "success", line);
  }
  if (/\b(healthy|enabled|ok)\b/i.test(line) && !/\b(unhealthy|not healthy)\b/i.test(line)) return theme.fg("success", line);
  if (/\b(failures?|429s?|error)\b/i.test(line)) return theme.fg("warning", line);
  if (/^(Raw:|Usage:|Aliases:|Valid values:|Compact account list|Provider bars show)/.test(line)) return theme.fg("muted", line);
  if (/^(note:|headers:|claimKeys:|endpoint:|tokenExpires=)/.test(line)) return theme.fg("dim", line);
  return line;
}

class RouterReportComponent implements Component {
  constructor(private readonly lines: string[], private readonly theme: RouterTheme) {}

  invalidate() {
    // Rendering is derived solely from the report snapshot and current width.
  }

  render(width: number): string[] {
    const usableWidth = Math.max(1, width);
    const rendered: string[] = [];
    for (const line of this.lines) {
      if (!line) {
        rendered.push("");
        continue;
      }
      const styled = styleLine(this.theme, fitQuotaBar(line, usableWidth));
      const wrapped = wrapTextWithAnsi(styled, usableWidth);
      rendered.push(...(wrapped.length ? wrapped.map((part) => truncateToWidth(part, usableWidth)) : [""]));
    }
    return rendered;
  }
}

export function createRouterReportWidget(text: string) {
  // Snapshot and sanitize now as well as at render time so replacement has no
  // mutable dependency and no stale report can reappear on a later lifecycle event.
  const safeLines = createRouterReportLines(text);
  return (_tui: unknown, theme: RouterTheme): Component => new RouterReportComponent(safeLines, theme);
}
