import { getMarkdownTheme, keyHint } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";

type Theme = {
  fg(color: string, text: string): string;
  bold(text: string): string;
};

type ToolResult = {
  content?: string | Array<{ type?: string; text?: string }>;
  details?: unknown;
  isError?: boolean;
};

type ResultOptions = { expanded: boolean; isError?: boolean };
type CardStatus = "success" | "warning" | "error" | "pending";

type ModeDetails = {
  mode?: string;
  source?: string;
  reason?: string;
  role?: string;
  stage?: string;
  workflow?: string;
};

type RoutingDetails = {
  result?: { detectedDefaults?: string[] };
  preview?: { scope?: string };
};

type WorkflowDetails = { id?: string; title?: string; purpose?: string };

type BoardError = {
  code: string;
  message: string;
  severity: "warning" | "error";
};

type BoardDetails = {
  sessionId?: string;
  taskId?: string;
  task?: { id?: string; status?: string };
  tasks?: unknown[];
  lifecycle?: unknown;
  error?: BoardError;
};

type BoardArgs = {
  action?: "init_session" | "expand_stage" | "show_workflows" | "show_session" | "update_task" | "replace_master_plan";
  sessionId?: string;
  taskId?: string;
  stage?: string;
};

// Tool output is model-facing data. Sanitize only at the TUI boundary so
// ANSI, OSC, and C0 controls cannot alter terminal presentation.
function sanitizePresentation(value: string): string {
  return value
    .replace(/\x1B\][\s\S]*?(?:\x07|\x1B\\)/g, "") // OSC (BEL or ST terminated)
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "") // CSI
    .replace(/[\x00-\x08\x0B-\x1F\x7F-\x9F]/g, "");
}

function resultText(result: ToolResult): string {
  const text = typeof result.content === "string"
    ? result.content
    : result.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n") ?? "";
  return sanitizePresentation(text);
}

function bounded(value: string | undefined, limit = 36): string {
  const text = sanitizePresentation(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, Math.max(1, limit - 1))}…` : text;
}

function status(result: ToolResult, options: ResultOptions, details?: { error?: BoardError }): CardStatus {
  if (details?.error?.severity) return details.error.severity;
  return result.isError || options.isError ? "error" : "success";
}

function renderToolCall(name: string, target: string | undefined, theme: Theme): Text {
  return new Text(
    `${theme.fg("toolTitle", theme.bold(`${name} `))}${target ? theme.fg("accent", bounded(target)) : ""}`,
    0,
    0,
  );
}

function renderCompactCard(options: {
  status: CardStatus;
  title: string;
  summary: string;
  metadata: string;
}, theme: Theme): Text {
  const presentation = {
    success: ["✓", "success"],
    warning: ["⚠", "warning"],
    error: ["✗", "error"],
    pending: ["…", "muted"],
  } as const;
  const [icon, color] = presentation[options.status];
  return new Text([
    `${theme.fg(color, icon)} ${theme.fg("accent", theme.bold(bounded(options.title)))} ${theme.fg("muted", bounded(options.summary, 72))}`,
    theme.fg("dim", `${bounded(options.metadata, 64)} · ${keyHint("app.tools.expand", "view details")}`),
  ].join("\n"), 0, 0);
}

function renderExpandedCard(options: {
  status: CardStatus;
  title: string;
  summary: string;
  metadata: string[];
  markdown: string;
}, theme: Theme): Container {
  const presentation = {
    success: ["✓", "success"],
    warning: ["⚠", "warning"],
    error: ["✗", "error"],
    pending: ["…", "muted"],
  } as const;
  const [icon, color] = presentation[options.status];
  const container = new Container();
  container.addChild(new Text(
    `${theme.fg(color, icon)} ${theme.fg("accent", theme.bold(sanitizePresentation(options.title)))} ${theme.fg("muted", sanitizePresentation(options.summary))}`,
    0,
    0,
  ));
  for (const detail of options.metadata) container.addChild(new Text(theme.fg("dim", sanitizePresentation(detail)), 0, 0));
  container.addChild(new Text(theme.fg("dim", keyHint("app.tools.expand", "collapse")), 0, 0));
  container.addChild(new Markdown(sanitizePresentation(options.markdown), 0, 1, getMarkdownTheme()));
  return container;
}

export function renderTakomiModeCall(args: { mode?: string } | undefined, theme: Theme): Text {
  return renderToolCall("takomi_mode", args?.mode ?? "mode", theme);
}

export function renderTakomiModeResult(result: ToolResult, options: ResultOptions, theme: Theme): Container | Text {
  const details = result.details as ModeDetails | undefined;
  const primary = details?.stage ?? details?.role ?? details?.mode ?? "mode";
  const source = details?.source ?? "model";
  const metadata = [source, details?.workflow ? `wf:${details.workflow}` : "footer updated"].join(" · ");
  if (!options.expanded) {
    return renderCompactCard({ status: status(result, options), title: "Takomi mode", summary: `${source}:${primary}`, metadata }, theme);
  }
  return renderExpandedCard({
    status: status(result, options),
    title: "Takomi mode",
    summary: `${source}:${primary}`,
    metadata: [metadata],
    markdown: resultText(result),
  }, theme);
}

export function renderTakomiRoutingCall(args: { scope?: string } | undefined, theme: Theme): Text {
  return renderToolCall("takomi_apply_routing_policy", args?.scope ?? "global", theme);
}

export function renderTakomiRoutingResult(result: ToolResult, options: ResultOptions, theme: Theme): Container | Text {
  const details = result.details as RoutingDetails | undefined;
  const scope = details?.preview?.scope ?? "global";
  const detectedCount = details?.result?.detectedDefaults?.length ?? 0;
  const summary = status(result, options) === "error" ? "policy was not saved" : `${scope} policy saved`;
  const metadata = `${detectedCount} routing defaults detected`;
  if (!options.expanded) return renderCompactCard({ status: status(result, options), title: "Takomi routing", summary, metadata }, theme);
  return renderExpandedCard({
    status: status(result, options),
    title: "Takomi routing",
    summary,
    metadata: [`Scope: ${scope}`, metadata],
    markdown: resultText(result),
  }, theme);
}

export function renderTakomiWorkflowCall(args: { workflow?: string } | undefined, theme: Theme): Text {
  return renderToolCall("takomi_workflow", args?.workflow ?? "library", theme);
}

export function renderTakomiWorkflowResult(result: ToolResult, options: ResultOptions, theme: Theme): Container | Text {
  const details = result.details as WorkflowDetails | undefined;
  const selected = details?.id;
  const title = selected ? "Takomi workflow" : "Workflow library";
  const summary = selected ? (details?.title ?? selected) : "embedded lifecycle playbooks";
  const metadata = selected ? bounded(selected) : "genesis · design · build";
  if (!options.expanded) return renderCompactCard({ status: status(result, options), title, summary, metadata }, theme);
  return renderExpandedCard({ status: status(result, options), title, summary, metadata: [metadata], markdown: resultText(result) }, theme);
}

function boardPresentation(args: BoardArgs, details: BoardDetails | undefined): { title: string; summary: string; metadata: string } {
  switch (args.action) {
    case "show_workflows":
      return { title: "Workflow library", summary: "available lifecycle playbooks", metadata: "genesis · design · build" };
    case "show_session":
      return { title: "Takomi session", summary: "session loaded", metadata: `session:${bounded(args.sessionId ?? details?.sessionId, 24)}` };
    case "update_task":
      return {
        title: `Task ${bounded(args.taskId ?? details?.taskId ?? details?.task?.id, 24) || "update"}`,
        summary: details?.task?.status ? `status: ${details.task.status}` : "task updated",
        metadata: `session:${bounded(args.sessionId ?? details?.sessionId, 24)}`,
      };
    case "expand_stage":
      return {
        title: `${args.stage ?? "Lifecycle"} stage`,
        summary: "stage expanded",
        metadata: `session:${bounded(args.sessionId ?? details?.sessionId, 24)}`,
      };
    default:
      return {
        title: "Takomi board",
        summary: "orchestrator session created",
        metadata: `session:${bounded(details?.sessionId ?? args.sessionId, 24)}`,
      };
  }
}

export function renderTakomiBoardCall(args: BoardArgs | undefined, theme: Theme): Text {
  return renderToolCall("takomi_board", args?.action ?? "init_session", theme);
}

export function renderTakomiBoardResult(result: ToolResult, options: ResultOptions, theme: Theme, args?: BoardArgs): Container | Text {
  const details = result.details as BoardDetails | undefined;
  const presentation = boardPresentation(args ?? {}, details);
  const cardStatus = status(result, options, details);
  const summary = cardStatus === "success" ? presentation.summary : details?.error?.message ?? "action needs attention";
  if (!options.expanded) return renderCompactCard({ status: cardStatus, title: presentation.title, summary, metadata: presentation.metadata }, theme);
  return renderExpandedCard({
    status: cardStatus,
    title: presentation.title,
    summary,
    metadata: [presentation.metadata],
    markdown: resultText(result),
  }, theme);
}
