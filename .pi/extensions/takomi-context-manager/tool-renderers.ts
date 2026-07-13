import { getMarkdownTheme, keyHint } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";

type Theme = {
  fg(color: string, text: string): string;
  bold(text: string): string;
};

type ToolResult = {
  content?: Array<{ type?: string; text?: string }>;
};

const OSC_SEQUENCE = /\x1B\][\s\S]*?(?:\x07|\x1B\\|$)/g;
const STRING_TERMINATED_SEQUENCE = /\x1B[PX^_][\s\S]*?(?:\x1B\\|$)/g;
const CSI_SEQUENCE = /(?:\x1B\[|\x9B)[0-?]*[ -/]*[@-~]/g;
const ESC_SEQUENCE = /\x1B(?:[()][0-2A-Z0-9]|[=>]|[ -/]*[@-~]?)/g;
const UNSAFE_CONTROLS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;

/**
 * Remove terminal controls at the TUI boundary while retaining Markdown's
 * printable syntax and line structure. Tool result content remains unchanged.
 */
export function sanitizePresentation(value: string): string {
  return value
    .replace(OSC_SEQUENCE, "")
    .replace(STRING_TERMINATED_SEQUENCE, "")
    .replace(CSI_SEQUENCE, "")
    .replace(ESC_SEQUENCE, "")
    .replace(UNSAFE_CONTROLS, "");
}

/** Read model-facing content without modifying it, then make a presentation-safe copy. */
export function resultText(result: ToolResult): string {
  const text = result.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n") ?? "";
  return sanitizePresentation(text);
}

export function renderToolCall(toolName: string, target: string | undefined, theme: Theme): Text {
  const safeToolName = sanitizePresentation(toolName);
  const safeTarget = target ? sanitizePresentation(target) : "";
  return new Text(
    `${theme.fg("toolTitle", theme.bold(`${safeToolName} `))}${safeTarget ? theme.fg("accent", safeTarget) : ""}`,
    0,
    0,
  );
}

export function renderCompactCard(options: {
  status: "success" | "warning" | "error" | "pending";
  title: string;
  summary: string;
  metadata?: string;
}, theme: Theme): Text {
  const status = {
    success: ["✓", "success"],
    warning: ["⚠", "warning"],
    error: ["✗", "error"],
    pending: ["…", "muted"],
  } as const;
  const [icon, color] = status[options.status];
  const title = sanitizePresentation(options.title);
  const summary = sanitizePresentation(options.summary);
  const metadata = options.metadata ? sanitizePresentation(options.metadata) : undefined;
  const lines = [
    `${theme.fg(color, icon)} ${theme.fg("accent", theme.bold(title))} ${theme.fg("muted", summary)}`,
    metadata ? theme.fg("dim", `${metadata} · ${keyHint("app.tools.expand", "view details")}`) : theme.fg("dim", keyHint("app.tools.expand", "view details")),
  ];
  return new Text(lines.join("\n"), 0, 0);
}

export function renderExpandedMarkdown(options: {
  status: "success" | "warning" | "error" | "pending";
  title: string;
  summary: string;
  metadata?: string[];
  markdown: string;
}, theme: Theme): Container {
  const status = {
    success: ["✓", "success"],
    warning: ["⚠", "warning"],
    error: ["✗", "error"],
    pending: ["…", "muted"],
  } as const;
  const [icon, color] = status[options.status];
  const title = sanitizePresentation(options.title);
  const summary = sanitizePresentation(options.summary);
  const container = new Container();
  container.addChild(new Text(
    `${theme.fg(color, icon)} ${theme.fg("accent", theme.bold(title))} ${theme.fg("muted", summary)}`,
    0,
    0,
  ));
  for (const detail of options.metadata ?? []) container.addChild(new Text(theme.fg("dim", sanitizePresentation(detail)), 0, 0));
  container.addChild(new Text(theme.fg("dim", keyHint("app.tools.expand", "collapse")), 0, 0));
  container.addChild(new Markdown(sanitizePresentation(options.markdown), 0, 1, getMarkdownTheme()));
  return container;
}
