import type { VibeLifecycleStage } from "../../../src/pi-takomi-core";
import type { TakomiRuntimeCommandState } from "./commands";
import type { TakomiSubagentController } from "./subagent-types";

export type TakomiCompletion = {
  value: string;
  label: string;
  description: string;
};

const ROOT_COMPLETIONS: TakomiCompletion[] = [
  { value: "help", label: "help", description: "Show the Takomi command guide" },
  { value: "genesis", label: "genesis", description: "Run the Genesis planning stage" },
  { value: "design", label: "design", description: "Run UI/UX design from approved scope" },
  { value: "build", label: "build", description: "Implement against the agreed UI" },
  { value: "plan", label: "plan", description: "Create or update the orchestration plan" },
  { value: "mode", label: "mode", description: "Set idle, code, review, or orchestrate main-agent mode" },
  { value: "gate", label: "gate", description: "Set auto or review-gated execution" },
  { value: "subagents", label: "subagents", description: "Control subagent usage and view" },
  { value: "stats", label: "stats", description: "Show token, model, project, session, tool, and subagent usage stats" },
  { value: "routing", label: "routing", description: "Show or update Takomi model routing policy" },
];

const SUBCOMMAND_COMPLETIONS: Record<string, TakomiCompletion[]> = {
  mode: [
    { value: "idle", label: "idle", description: "Clear active Takomi main-agent behavior" },
    { value: "code", label: "code", description: "Implement directly in the main session" },
    { value: "review", label: "review", description: "Inspect outputs and route fixes" },
    { value: "orchestrate", label: "orchestrate", description: "Coordinate lifecycle work and specialist personas" },
  ],
  gate: [
    { value: "review", label: "review", description: "Return to the user after each task" },
    { value: "auto", label: "auto", description: "Continue approved plans automatically" },
  ],
  subagents: [
    { value: "list", label: "list", description: "List available Takomi subagents" },
    { value: "status", label: "status", description: "Show active subagents" },
    { value: "on", label: "on", description: "Allow subagent delegation" },
    { value: "off", label: "off", description: "Disable subagent delegation" },
  ],
  stats: [
    { value: "overview", label: "overview", description: "Show the full profile-card dashboard" },
    { value: "daily", label: "daily", description: "Show daily usage rows" },
    { value: "models", label: "models", description: "Show model usage leaderboard" },
    { value: "projects", label: "projects", description: "Show project usage leaderboard" },
    { value: "projects-full", label: "projects-full", description: "Show full project names" },
    { value: "sessions", label: "sessions", description: "Show longest active main sessions" },
    { value: "sessions-full", label: "sessions-full", description: "Show full session names and files" },
    { value: "tasks", label: "tasks", description: "Show longest tasks by active turn span" },
    { value: "tasks-full", label: "tasks-full", description: "Show full task prompts" },
    { value: "tools", label: "tools", description: "Show most used tools" },
    { value: "agents", label: "agents", description: "Show main agent role leaderboard" },
    { value: "subagents", label: "subagents", description: "Show subagent run leaderboard" },
    { value: "sources", label: "sources", description: "Show global/project source split" },
    { value: "since 7d", label: "since 7d", description: "Filter stats to the last 7 days" },
    { value: "since 14d", label: "since 14d", description: "Filter stats to the last 14 days" },
    { value: "since 4w", label: "since 4w", description: "Filter stats to the last 4 weeks" },
    { value: "since 3m", label: "since 3m", description: "Filter stats to the last 3 months" },
  ],
  routing: [
    { value: "show", label: "show", description: "Show active routing policy source, path, and contents" },
    { value: "global", label: "global", description: "Save following policy text globally" },
    { value: "local", label: "local", description: "Save following policy text as a project override" },
    { value: "where", label: "where", description: "Show where the active routing policy is loaded from" },
  ],
};

const SUBCOMMAND_ALIASES: Record<string, string> = {
  subagent: "subagents",
};

function normalizeSubcommand(value: string): string {
  return SUBCOMMAND_ALIASES[value] ?? value;
}

function matchesToken(completion: TakomiCompletion, token: string): boolean {
  const lowered = token.toLowerCase();
  return !lowered || completion.value.toLowerCase().startsWith(lowered) || completion.label.toLowerCase().startsWith(lowered);
}

function withArgumentPrefix(parent: string, completions: TakomiCompletion[], token: string): TakomiCompletion[] {
  return completions
    .filter((completion) => matchesToken(completion, token))
    .map((completion) => ({
      ...completion,
      value: `${parent} ${completion.value}`,
    }));
}

export function commandHelp(): string {
  return [
    "Takomi commands:",
    "/takomi help                           # show this guide",
    "/takomi genesis [prompt]",
    "/takomi design [prompt]",
    "/takomi build [prompt]",
    "/takomi plan [title]",
    "/takomi mode <idle|code|review|orchestrate>",
    "/takomi gate <auto|review>",
    "/takomi subagents <list|on|off|status>",
    "/takomi stats [overview|daily|models|projects|projects-full|sessions|sessions-full|tasks|tasks-full|tools|subagents|sources] [since 7d]",
    "/takomi routing [show|where]",
    "/takomi routing <policy text>              # updates global policy",
    "/takomi routing local <policy text>        # project override",
    "/takomi-status",
    "/takomi-stats [view] [since 7d]",
    "/takomi-reset",
  ].join("\n");
}

export function workflowPrompt(stage: VibeLifecycleStage, suppliedPrompt?: string): string {
  const suffix = suppliedPrompt?.trim() ? `\n\nPrompt: ${suppliedPrompt.trim()}` : "";
  const lines = {
    genesis: [
      "Takomi Genesis is active.",
      "Use existing markdown/project context when no extra prompt is supplied.",
      "Strictly follow the Genesis playbook: clarify scope, create or update planning docs, and do not implement code yet.",
    ],
    design: [
      "Takomi Design is active.",
      "Focus on UI/UX only: agreed screens, visual direction, interaction states, mockups, and build constraints.",
      "Do not drift into route/API architecture unless the user explicitly asks.",
    ],
    build: [
      "Takomi Build is active.",
      "Implement against the approved UI and continuously cross-check code against design artifacts and acceptance criteria.",
    ],
  }[stage];
  return [...lines, suffix].filter(Boolean).join("\n");
}

export function statusText(state: TakomiRuntimeCommandState, subagentController: TakomiSubagentController): string {
  return [
    `Takomi: ${state.enabled ? "on" : "off"}`,
    `Mode: ${state.role}`,
    `Source: ${state.modeSource ?? "idle"}${state.modeReason ? ` (${state.modeReason})` : ""}`,
    `Stage: ${state.stage ?? "-"}`,
    `Workflow: ${state.workflow ?? "-"}`,
    `Plan bias: ${state.planMode ? "on" : "off"}`,
    `Execution gate: ${state.launchMode === "manual" ? "review" : "auto"}`,
    `Subagents: ${state.subagentsEnabled ? "on" : "off"}`,
    state.activeSessionId ? `Session: ${state.activeSessionId}` : "",
    "",
    subagentController.getStatusSummary(),
  ].filter(Boolean).join("\n");
}

export function completions(argumentPrefix: string): TakomiCompletion[] {
  const input = argumentPrefix.trimStart();
  const parts = input.split(/\s+/).filter(Boolean);
  const hasTrailingSpace = /\s$/.test(input);

  if (parts.length === 0) return ROOT_COMPLETIONS;
  if (parts.length === 1 && !hasTrailingSpace) {
    return ROOT_COMPLETIONS.filter((completion) => matchesToken(completion, parts[0]));
  }

  const parent = normalizeSubcommand(parts[0]);
  const nested = SUBCOMMAND_COMPLETIONS[parent] ?? [];
  const token = hasTrailingSpace ? "" : parts[parts.length - 1] ?? "";
  return withArgumentPrefix(parent, nested, token);
}
