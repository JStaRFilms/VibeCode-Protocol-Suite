import { getMarkdownTheme, keyHint } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";

type Theme = {
  fg(color: string, text: string): string;
  bold(text: string): string;
};

type ToolResult = {
  content?: Array<{ type?: string; text?: string }>;
};

export function resultText(result: ToolResult): string {
  return result.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n") ?? "";
}

export function renderToolCall(toolName: string, target: string | undefined, theme: Theme): Text {
  return new Text(
    `${theme.fg("toolTitle", theme.bold(`${toolName} `))}${target ? theme.fg("accent", target) : ""}`,
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
  const lines = [
    `${theme.fg(color, icon)} ${theme.fg("accent", theme.bold(options.title))} ${theme.fg("muted", options.summary)}`,
    options.metadata ? theme.fg("dim", `${options.metadata} · ${keyHint("app.tools.expand", "view details")}`) : theme.fg("dim", keyHint("app.tools.expand", "view details")),
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
  const container = new Container();
  container.addChild(new Text(
    `${theme.fg(color, icon)} ${theme.fg("accent", theme.bold(options.title))} ${theme.fg("muted", options.summary)}`,
    0,
    0,
  ));
  for (const detail of options.metadata ?? []) container.addChild(new Text(theme.fg("dim", detail), 0, 0));
  container.addChild(new Text(theme.fg("dim", keyHint("app.tools.expand", "collapse")), 0, 0));
  container.addChild(new Markdown(options.markdown, 0, 1, getMarkdownTheme()));
  return container;
}
