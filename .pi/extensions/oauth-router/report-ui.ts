import { truncateToWidth, wrapTextWithAnsi, type Component } from "@earendil-works/pi-tui";

export const ROUTER_REPORT_WIDGET_KEY = "oauth-router-report";
export const ROUTER_REPORT_WIDGET_OPTIONS = { placement: "belowEditor" } as const;

type RouterTheme = {
  fg(color: "accent" | "success" | "warning" | "error" | "muted" | "dim", text: string): string;
  bold(text: string): string;
};

const SENSITIVE_VALUE_KEY = "(?:access[_-]?token|refresh[_-]?token|id[_-]?token|auth[_-]?token|api[_-]?key|authorization|password|secret)";
const SENSITIVE_QUERY_KEY = `(?:${SENSITIVE_VALUE_KEY}|token|key)`;

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

  // Handle Bearer credentials first because an authorization value may contain
  // whitespace. The credential itself, rather than account-like identifiers,
  // is the redaction target.
  text = text
    .replace(/\b(Bearer\s+)(?:"[^"]*"|'[^']*'|[^\s,;|"']+)/gi, "$1[redacted]")
    .replace(new RegExp(`([?&#]${SENSITIVE_QUERY_KEY}=)[^&#\\s"']*`, "gi"), "$1[redacted]")
    .replace(
      new RegExp(`((?:["'])?${SENSITIVE_VALUE_KEY}(?:["'])?\\s*[:=]\\s*)(["'])(?:\\\\.|(?!\\2)[^\\\\])*\\2`, "gi"),
      "$1$2[redacted]$2",
    )
    .replace(new RegExp(`(\\b${SENSITIVE_VALUE_KEY}\\b\\s*[:=]\\s*)([^\\s|,;"'&#]+)`, "gi"), "$1[redacted]")
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
