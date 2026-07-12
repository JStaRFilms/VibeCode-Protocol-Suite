import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { renderTakomiSubagentCall, renderTakomiSubagentResult } from "./native-render";
import { loadPiSubagentsInternals } from "./pi-subagents-internal";
import { clearAllTakomiSubagentResultHeartbeats } from "./result-heartbeat";
import { executeTakomiSubagentTool } from "./tool-runner";

const ChecklistItemSchema = Type.Object({
  text: Type.String(),
  done: Type.Optional(Type.Boolean()),
});

const ThinkingSchema = Type.Union([
  Type.Literal("off"),
  Type.Literal("minimal"),
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("xhigh"),
]);

const TaskSchema = Type.Object({
  agent: Type.String(),
  task: Type.String(),
  workflow: Type.Optional(Type.String()),
  skills: Type.Optional(Type.Array(Type.String())),
  model: Type.Optional(Type.String()),
  fallbackModels: Type.Optional(Type.Array(Type.String())),
  thinking: Type.Optional(ThinkingSchema),
  conversationId: Type.Optional(Type.String()),
  cwd: Type.Optional(Type.String()),
  checklist: Type.Optional(Type.Array(Type.Union([Type.String(), ChecklistItemSchema]))),
});

const ContextSchema = Type.Union([
  Type.Literal("fresh"),
  Type.Literal("fork"),
]);

const ActionSchema = Type.Union([
  Type.Literal("list"),
  Type.Literal("get"),
  Type.Literal("models"),
  Type.Literal("status"),
  Type.Literal("interrupt"),
  Type.Literal("resume"),
  Type.Literal("doctor"),
]);

const SubagentParameters = Type.Object({
  action: Type.Optional(ActionSchema),
  agent: Type.Optional(Type.String({ description: "Agent name for single execution, or target agent for get/models actions" })),
  task: Type.Optional(Type.String({ description: "Task for single execution" })),
  workflow: Type.Optional(Type.String({ description: "Workflow or playbook overlay for this task" })),
  skills: Type.Optional(Type.Array(Type.String(), { description: "Extra skills to apply during the task" })),
  model: Type.Optional(Type.String({ description: "Optional per-run model override" })),
  fallbackModels: Type.Optional(Type.Array(Type.String(), { description: "Optional ordered model fallback list" })),
  thinking: Type.Optional(ThinkingSchema),
  conversationId: Type.Optional(Type.String({ description: "Persistent conversation id to resume the same subagent session" })),
  cwd: Type.Optional(Type.String({ description: "Working directory override" })),
  checklist: Type.Optional(Type.Array(Type.Union([Type.String(), ChecklistItemSchema]), { description: "Optional checklist for the subagent" })),
  tasks: Type.Optional(Type.Array(TaskSchema, { description: "Parallel subagent tasks" })),
  confirmLaunch: Type.Optional(Type.Boolean({ description: "Required to launch immediately in manual Takomi launch mode" })),
  previewOnly: Type.Optional(Type.Boolean({ description: "Return the delegation plan without launching" })),
  clarify: Type.Optional(Type.Boolean({ description: "Show the native pi-subagents TUI to preview/edit before execution. Especially useful for chains; requires an interactive Pi TUI." })),
  chain: Type.Optional(Type.Array(TaskSchema, { description: "Sequential chain of subagent tasks" })),
  context: Type.Optional(ContextSchema),
  async: Type.Optional(Type.Boolean({ description: "Run through native pi-subagents background/async mode" })),
  concurrency: Type.Optional(Type.Number({ description: "Maximum concurrency for parallel task groups" })),
  worktree: Type.Optional(Type.Boolean({ description: "Use native pi-subagents worktree isolation where supported" })),
  id: Type.Optional(Type.String({ description: "Native async/control run id for status, interrupt, or resume actions" })),
  message: Type.Optional(Type.String({ description: "Follow-up message for resume actions" })),
  index: Type.Optional(Type.Number({ description: "Child index for resume actions when needed" })),
  chainName: Type.Optional(Type.String({ description: "Saved chain name for get actions" })),
  agentScope: Type.Optional(Type.Union([Type.Literal("user"), Type.Literal("project"), Type.Literal("both")])),
  // Project-agent confirmation and hard-stop overrides are enforced server-side;
  // they are intentionally not model-callable parameters.
});

function registerSubagentTool(pi: ExtensionAPI): void {
  pi.registerTool({
    name: "takomi_subagent",
    label: "Takomi",
    description: "Run subagents with Pi-style single, parallel, chain, async, fork, and management/status modes plus Takomi lifecycle metadata.",
    promptSnippet: "Delegate lifecycle-aware Takomi work to specialist subagents. Use single, tasks, chain, or action=list/status/doctor; reuse conversationId for review loops.",
    promptGuidelines: [
      "Use this tool during orchestration when a specialist should handle a task.",
      "Use action=list to discover agents and action=status/doctor for native pi-subagents diagnostics/control instead of raw subagent.",
      "Use tasks for independent parallel work and chain for dependent handoffs with {previous}.",
      "Set context=fork only when inherited parent-session history is needed; otherwise prefer fresh or the agent default.",
      "Set async=true for long-running work when the parent can continue safely; keep active worktree writes single-threaded unless worktree isolation is enabled.",
      "Set clarify=true when the user asks to preview/edit a subagent run in the native Pi TUI before launch.",
      "Use model, fallbackModels, and thinking only when deliberate; otherwise let the agent/profile defaults apply.",
      "If review sends work back to the same agent, reuse the same conversationId for continuity.",
      "If a launch is blocked, cancelled, paused, or review-gated, do not retry automatically; wait for the user's next prompt."
    ],
    parameters: SubagentParameters,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      return executeTakomiSubagentTool(pi, params, signal, onUpdate as any, ctx);
    },
    renderCall: renderTakomiSubagentCall,
    renderResult: renderTakomiSubagentResult,
  });
}

export default async function takomiSubagents(pi: ExtensionAPI) {
  // Preload the native pi-subagents renderer before tool registration. Rendering
  // callbacks are synchronous, so if we only lazy-load internals during execution
  // a completed takomi_subagent result can fall back to Takomi's plain text
  // renderer and lose the native compact/expanded details shown by `subagent`.
  await loadPiSubagentsInternals();
  registerSubagentTool(pi);

  // Tool rows normally settle and clear their own heartbeat. A turn can also end
  // without Pi rendering a final result (for example, after an abnormal tool
  // interruption), so clear abandoned same-session rows at agent_end as well as
  // stale rows at session replacement/shutdown boundaries.
  pi.on("agent_end", () => clearAllTakomiSubagentResultHeartbeats());
  pi.on("session_start", () => clearAllTakomiSubagentResultHeartbeats());
  pi.on("session_shutdown", () => clearAllTakomiSubagentResultHeartbeats());
}
