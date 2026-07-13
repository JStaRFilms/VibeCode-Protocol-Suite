import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import {
  buildSessionState,
  createSessionId,
  createLifecycleStarterSession,
  createTask,
  decideRoute,
  getSessionPaths,
  getNextTaskId,
  getWorkflowDefinition,
  listWorkflowDefinitions,
  markStageExpanded,
  normalizeSessionState,
  renderMasterPlan,
  renderTaskFile,
  renderValidationReport,
  serializeSessionState,
  slugifyTaskTitle,
  validateSessionState,
  type OrchestratorTask,
  type OrchestratorSessionState,
  type OrchestratorTaskStatus,
  type TakomiDispatchPolicy,
  type TakomiLaunchMode,
  type TakomiProfile,
  type TakomiRole,
  type TakomiThinkingLevel,
  type TakomiWorkflowId,
  type VibeLifecycleStage,
} from "../../../src/pi-takomi-core";
import {
  renderRuntimeWidget,
  renderTakomiHeader,
  TakomiFooterComponent,
} from "./ui";
import { getTakomiSubagentController } from "./subagent-controller";
import {
  TAKOMI_SUBAGENT_EVENT_CHANNEL,
  type TakomiSubagentRunPatch,
  type TakomiSubagentRuntimeEvent,
} from "./subagent-types";
import {
  buildTaskPrompt,
  resolvePreferredModel,
} from "./shared";
import { TakomiContextPanel, wireContextPanel } from "./context-panel";
import { registerTakomiCommands } from "./commands";
import { USER_GATE_AUTO_PROVENANCE_ENTRY } from "./gate-provenance";
import {
  DEFAULT_TAKOMI_PROFILE,
  getProfileDefaults,
  loadTakomiProfile,
} from "./profile";
import { installTakomiRoutingPolicy, previewTakomiRoutingPolicy, renderRoutingPolicyPreview, resolveTakomiRoutingPolicy } from "./routing-policy";
import {
  renderTakomiBoardCall,
  renderTakomiBoardResult,
  renderTakomiModeCall,
  renderTakomiModeResult,
  renderTakomiRoutingCall,
  renderTakomiRoutingResult,
  renderTakomiWorkflowCall,
  renderTakomiWorkflowResult,
} from "./tool-renderers";

type TakomiModeSource = "idle" | "manual" | "model" | "board";

type TakomiState = {
  enabled: boolean;
  autoOrch: boolean;
  launchMode: TakomiLaunchMode;
  planMode: boolean;
  role: TakomiRole;
  stage?: VibeLifecycleStage;
  workflow?: TakomiWorkflowId;
  activeSessionId?: string;
  subagentsEnabled: boolean;
  lastFullPromptKey?: string;
  modeSource?: TakomiModeSource;
  modeReason?: string;
};

const DEFAULT_STATE: TakomiState = {
  enabled: true,
  autoOrch: false,
  launchMode: "auto",
  planMode: false,
  role: "general",
  subagentsEnabled: true,
  modeSource: "idle",
};

const STATE_ENTRY = "takomi-runtime-state";

let activeProfile: TakomiProfile = DEFAULT_TAKOMI_PROFILE;
let activeSubagentLabel: string | undefined;
let activeSubagentAgent: string | undefined;
let activeSubagentTask: string | undefined;
let activeSubagentStatus: string | undefined;
let delayedPiVersionCheckStarted = false;

const PI_LATEST_VERSION_URL = "https://pi.dev/api/latest-version";

function parseVersionParts(version: string): number[] | undefined {
  const core = version.trim().replace(/^v/, "").split("-")[0];
  if (!/^\d+(?:\.\d+)*$/.test(core)) return undefined;
  return core.split(".").map((part) => Number.parseInt(part, 10) || 0);
}

function isNewerVersion(candidate: string, current: string): boolean {
  const left = parseVersionParts(candidate);
  const right = parseVersionParts(current);
  if (!left || !right) return candidate.trim() !== current.trim();
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }
  return false;
}

async function readCurrentPiVersion(): Promise<string | undefined> {
  const candidates = [
    path.resolve(path.dirname(process.argv[1] ?? ""), "..", "package.json"),
    path.resolve(path.dirname(process.argv[1] ?? ""), "package.json"),
  ];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(await readFile(candidate, "utf8")) as { name?: string; version?: string };
      if (parsed.name === "@earendil-works/pi-coding-agent" && typeof parsed.version === "string") return parsed.version;
    } catch { }
  }
  return undefined;
}

function scheduleDelayedPiVersionCheck(ctx: ExtensionContext): void {
  if (delayedPiVersionCheckStarted) return;
  if (process.env.TAKOMI_DELAYED_PI_VERSION_CHECK !== "1") return;
  if (process.env.TAKOMI_SKIP_DELAYED_PI_VERSION_CHECK === "1" || process.env.PI_OFFLINE === "1") return;
  delayedPiVersionCheckStarted = true;

  const delayMs = Math.max(0, Number(process.env.TAKOMI_PI_VERSION_CHECK_DELAY_MS || 3000) || 3000);
  const timeoutMs = Math.max(500, Number(process.env.TAKOMI_PI_VERSION_CHECK_TIMEOUT_MS || 2500) || 2500);
  setTimeout(() => {
    void (async () => {
      try {
        const currentVersion = await readCurrentPiVersion();
        if (!currentVersion) return;
        const response = await fetch(PI_LATEST_VERSION_URL, {
          headers: { accept: "application/json", "user-agent": `takomi-delayed-pi-version-check/${currentVersion}` },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) return;
        const data = await response.json() as { version?: unknown; note?: unknown };
        if (typeof data.version !== "string" || !isNewerVersion(data.version, currentVersion)) return;
        if (ctx.hasUI) {
          const note = typeof data.note === "string" && data.note.trim() ? ` ${data.note.trim()}` : "";
          ctx.ui.notify(`Pi ${data.version} is available (installed: ${currentVersion}). Run: takomi refresh pi.${note}`, "info");
        }
      } catch {
        // Best-effort only. Delayed version checks must never affect startup or usage.
      }
    })();
  }, delayMs).unref?.();
}

const ThinkingSchema = Type.Union([
  Type.Literal("off"),
  Type.Literal("minimal"),
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("xhigh"),
]);

const TakomiModeSchema = StringEnum(["idle", "code", "orchestrate", "review", "genesis", "design", "build"] as const);

function cloneState(state: TakomiState): TakomiState {
  return { ...state };
}

function formatState(state: TakomiState): string {
  return [
    `Takomi ${state.enabled ? "on" : "off"}`,
    `role=${state.role}`,
    `stage=${state.stage ?? "-"}`,
    `workflow=${state.workflow ?? "-"}`,
    `autoOrch=${state.autoOrch ? "on" : "off"}`,
    `launch=${state.launchMode}`,
    `plan=${state.planMode ? "on" : "off"}`,
    `subagents=${state.subagentsEnabled ? "on" : "off"}`,
    `source=${state.modeSource ?? "idle"}`,
    state.modeReason ? `reason=${state.modeReason}` : "",
    state.activeSessionId ? `session=${state.activeSessionId}` : "",
  ].filter(Boolean).join(" | ");
}

function setStageAndWorkflow(state: TakomiState, stage: VibeLifecycleStage, options?: { preserveRole?: boolean }) {
  state.stage = stage;
  state.workflow = stage === "genesis" ? "vibe-genesis" : stage === "design" ? "vibe-design" : "vibe-build";
  if (!options?.preserveRole) {
    state.role = stage === "design" ? "design" : stage === "build" ? "orchestrator" : "architect";
  }
  state.enabled = true;
}

function fallbackRolePrompt(role: TakomiRole): string {
  switch (role) {
    case "orchestrator":
      return [
        "You are operating in Takomi orchestrator mode.",
        "Break work into tasks, delegate with specialist agents, review outputs, and route revisions intelligently.",
        "When a task needs more work, you may send it back to the same agent using the same conversation continuity if that is most efficient.",
      ].join("\n");
    case "architect":
      return [
        "You are operating in Takomi architect mode.",
        "Clarify scope, define acceptance criteria, and build the project foundation before design or implementation.",
      ].join("\n");
    case "design":
      return [
        "You are operating in Takomi design mode.",
        "Translate genesis context into build-ready UX and visual direction.",
      ].join("\n");
    case "code":
      return [
        "You are operating in Takomi code mode.",
        "Implement directly, keep scope controlled, and verify after changes.",
      ].join("\n");
    case "review":
      return [
        "You are operating in Takomi review mode.",
        "Focus on correctness, risk, omissions, and actionable review feedback.",
      ].join("\n");
    default:
      return [
        "You are operating in Takomi general mode.",
        "Choose the correct lifecycle stage and specialist behavior based on the request.",
      ].join("\n");
  }
}

function agentFileNameForRole(role: TakomiRole): string | undefined {
  switch (role) {
    case "orchestrator": return "orchestrator.md";
    case "architect": return "architect.md";
    case "design": return "designer.md";
    case "code": return "coder.md";
    case "review": return "reviewer.md";
    default: return undefined;
  }
}

async function loadRolePrompt(cwd: string, role: TakomiRole): Promise<string> {
  const fileName = agentFileNameForRole(role);
  if (!fileName) return fallbackRolePrompt(role);

  const candidates = [
    path.join(cwd, ".pi", "agents", fileName),
    path.join(installedAssetRoot("agents"), fileName),
  ];

  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, "utf8");
      const cleaned = stripPromptFrontmatter(raw);
      if (cleaned) {
        return [
          fallbackRolePrompt(role),
          `Canonical Takomi role mirror loaded from ${candidate}:`,
          cleaned,
        ].join("\n\n");
      }
    } catch { }
  }

  return fallbackRolePrompt(role);
}

function planPrompt(): string {
  return [
    "Takomi planning mode is active.",
    "Before major implementation, produce a short numbered plan.",
    "If the request is broad, explicitly identify whether the user is in genesis, design, or build.",
  ].join("\n");
}

function stripPromptFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

function stripTemplateOnlyRequestPlaceholder(content: string): string {
  return content
    .replace(/\n?---\s*\r?\n\s*## Current User Request\s*\r?\n\s*(?:\$@|\$ARGUMENTS)\s*$/i, "")
    .replace(/\n?## Current User Request\s*\r?\n\s*(?:\$@|\$ARGUMENTS)\s*$/i, "")
    .trim();
}

function installedAssetRoot(kind: "agents" | "prompts"): string {
  return path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    kind,
  );
}

async function loadWorkflowPrompt(cwd: string, workflow: TakomiWorkflowId): Promise<string | undefined> {
  const fileName = workflow === "vibe-genesis"
    ? "genesis-prompt.md"
    : workflow === "vibe-design"
      ? "design-prompt.md"
      : "build-prompt.md";
  const candidates = [
    path.join(cwd, ".pi", "prompts", fileName),
    path.join(installedAssetRoot("prompts"), fileName),
  ];

  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate, "utf8");
      const cleaned = stripTemplateOnlyRequestPlaceholder(stripPromptFrontmatter(raw));
      if (cleaned) return cleaned;
    } catch { }
  }

  return undefined;
}

async function getInjectedPlaybook(cwd: string, state: TakomiState, includeFullWorkflow: boolean): Promise<string | undefined> {
  if (!state.workflow) return undefined;
  const workflow = getWorkflowDefinition(state.workflow);
  const prompt = includeFullWorkflow ? await loadWorkflowPrompt(cwd, state.workflow) : undefined;

  if (includeFullWorkflow) {
    return [
      `Active Takomi workflow: ${workflow.title} (${workflow.id}).`,
      prompt ?? workflow.playbook,
      workflow.nextStage ? `After this stage, recommend ${workflow.nextStage}.` : "",
    ].filter(Boolean).join("\n\n");
  }

  return [
    `Active Takomi workflow: ${workflow.title} (${workflow.id}).`,
    workflow.purpose,
    workflow.preferredModelHint ?? "",
    `Compact reminder: follow the ${workflow.id} stage. Full workflow was injected when this role/workflow became active; reload the markdown prompt only if behavior degrades or the task is complex.`,
    workflow.nextStage ? `After this stage, recommend ${workflow.nextStage}.` : "",
  ].filter(Boolean).join("\n\n");
}

function shouldAutoRoute(text: string): boolean {
  const lowered = text.toLowerCase();
  const broadSignal = ["use takomi", "orchestrate", "plan and build", "full workflow", "break this down", "coordinate"].some((signal) => lowered.includes(signal));
  const multiClause = (lowered.match(/\b(and|then|also|after|while)\b/g) ?? []).length >= 2;
  return broadSignal || (lowered.length > 220 && multiClause);
}

function buildTaskRows(tasks: OrchestratorTask[]): string {
  return tasks.map((task) => `${task.id}: ${task.stage ?? "-"} | ${task.title} [${task.status}] -> ${task.preferredAgent ?? task.role}${task.conversationId ? ` (${task.conversationId})` : ""}${task.workflow ? ` | workflow=${task.workflow}` : ""}${task.preferredModel ? ` | model=${task.preferredModel}` : ""}${task.preferredThinking ? ` | thinking=${task.preferredThinking}` : ""}${task.dispatchPolicy ? ` | execution=${task.dispatchPolicy}` : ""}${task.skills?.length ? ` | skills=${task.skills.join(",")}` : ""}`).join("\n");
}

function appendTaskNote(existing: string | undefined, heading: string, body?: string): string {
  if (!body?.trim()) return existing ?? "";
  return [existing, "", `${heading}:`, body.trim()].filter(Boolean).join("\n").trim();
}

function applyChecklistUpdates(
  current: OrchestratorTask["checklist"],
  updates?: Array<{ text?: string; index?: number; done?: boolean }>,
): OrchestratorTask["checklist"] {
  if (!current?.length || !updates?.length) return current;
  const next = current.map((item: NonNullable<OrchestratorTask["checklist"]>[number]) => ({ ...item }));
  for (const update of updates) {
    const idx = typeof update.index === "number"
      ? update.index
      : typeof update.text === "string"
        ? next.findIndex((item: NonNullable<OrchestratorTask["checklist"]>[number]) => item.text === update.text)
        : -1;
    if (idx >= 0 && next[idx]) next[idx] = { ...next[idx], done: update.done ?? next[idx].done };
  }
  return next;
}

function normalizeChecklistInput(
  checklist?: Array<string | { text: string; done?: boolean }>,
): OrchestratorTask["checklist"] {
  if (!checklist?.length) return undefined;
  return checklist.map((item) => typeof item === "string" ? { text: item, done: false } : { text: item.text, done: item.done ?? false });
}

function resolveChecklistState(
  current: OrchestratorTask["checklist"],
  nextChecklist?: Array<string | { text: string; done?: boolean }>,
  updates?: Array<{ text?: string; index?: number; done?: boolean }>,
): OrchestratorTask["checklist"] {
  const baseChecklist = nextChecklist ? normalizeChecklistInput(nextChecklist) : current;
  return applyChecklistUpdates(baseChecklist, updates);
}

function getIncompleteChecklistItems(checklist?: OrchestratorTask["checklist"]): string[] {
  return (checklist ?? [])
    .filter((item) => !item.done)
    .map((item) => item.text);
}

type BoardErrorSeverity = "warning" | "error";

function createBoardErrorResult(
  text: string,
  code: string,
  severity: BoardErrorSeverity,
  details: Record<string, unknown> = {},
) {
  return {
    content: [{ type: "text" as const, text }],
    // Keep this semantic error independent of Pi's transport-level isError.
    // Renderers use it to retain warning/error meaning even when Pi does not
    // pass top-level result flags back into renderResult.
    details: { ...details, error: { code, message: text, severity } },
    isError: true,
  };
}

function getCompletionGateError(task: Pick<OrchestratorTask, "id" | "title" | "checklist">): string | undefined {
  if (!task.checklist?.length) {
    return `Task ${task.id} cannot be marked completed until it has a checklist.`;
  }
  const incompleteItems = getIncompleteChecklistItems(task.checklist);
  if (incompleteItems.length === 0) return undefined;
  return [
    `Task ${task.id} cannot be marked completed until every checklist item is done.`,
    "",
    "Incomplete checklist items:",
    ...incompleteItems.map((item) => `- ${item}`),
  ].join("\n");
}

function assertSafeSessionId(sessionId: string): void {
  if (!/^orch-\d{8}-\d{6}$/.test(sessionId)) {
    throw new Error(`Invalid Takomi sessionId '${sessionId}'. Expected canonical format orch-YYYYMMDD-HHMMSS.`);
  }
}

function assertSafeTaskId(taskId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(taskId)) {
    throw new Error(`Invalid Takomi task id '${taskId}'. Use only letters, numbers, '_' or '-' and do not include path separators.`);
  }
}

function assertSafeTasks(tasks: OrchestratorTask[]): void {
  for (const task of tasks) assertSafeTaskId(task.id);
}

function getTaskFolder(paths: ReturnType<typeof getSessionPaths>, status: OrchestratorTask["status"]) {
  switch (status) {
    case "in-progress":
      return paths.inProgress;
    case "completed":
      return paths.completed;
    case "blocked":
      return paths.blocked;
    case "pending":
    default:
      return paths.pending;
  }
}

function getTaskFileName(task: OrchestratorTask): string {
  return `${task.id}_${slugifyTaskTitle(task.title)}.task.md`;
}

function buildSubagentTaskPrompt(task: OrchestratorTask, extraInstructions?: string): string {
  return buildTaskPrompt({
    task: extraInstructions?.trim() || task.notes || task.title,
    workflow: task.workflow,
    skills: task.skills,
    checklist: task.checklist,
    stage: task.stage,
  });
}

async function hasGenesisArtifacts(cwd: string): Promise<boolean> {
  try {
    await readFile(path.join(cwd, "docs", "Project_Requirements.md"), "utf8");
    await readFile(path.join(cwd, "docs", "Coding_Guidelines.md"), "utf8");
    const issues = await readdir(path.join(cwd, "docs", "issues"));
    return issues.some((entry) => entry.endsWith(".md"));
  } catch {
    return false;
  }
}

async function loadSessionState(cwd: string, sessionId: string): Promise<{ state: OrchestratorSessionState; paths: ReturnType<typeof getSessionPaths> }> {
  assertSafeSessionId(sessionId);
  const paths = getSessionPaths(cwd, sessionId);
  const raw = await readFile(paths.stateFile, "utf8");
  const parsed = JSON.parse(raw) as Partial<OrchestratorSessionState>;
  const state = normalizeSessionState({
    sessionId,
    title: parsed.title ?? "Takomi Session",
    ...parsed,
  });
  return { state, paths };
}

function repairTaskMarkdown(content: string): string {
  return content
    .replace(/### Required Skills/g, "### Optional Skill / Context Overlays")
    .replace(/Required Skills/g, "Optional Skill / Context Overlays")
    .replace(/Load ALL required skills/g, "Use relevant optional skill/context overlays only when available and genuinely helpful")
    .replace(/Required skills/g, "Optional skill/context overlays")
    .replace(/required skills/g, "optional skill/context overlays");
}

async function findExistingTaskFile(paths: ReturnType<typeof getSessionPaths>, task: OrchestratorTask): Promise<string | undefined> {
  for (const folder of [paths.pending, paths.inProgress, paths.completed, paths.blocked]) {
    const entries = await readdir(folder).catch(() => [] as string[]);
    const match = entries.find((entry) => entry.endsWith(".task.md") && entry.startsWith(`${task.id}_`));
    if (match) return path.join(folder, match);
  }
  return undefined;
}

function markdownPreservationScore(content: string): number {
  const trimmed = content.trim();
  if (!trimmed) return 0;
  const lines = trimmed.split(/\r?\n/);
  const headingCount = lines.filter((line) => /^#{1,6}\s+/.test(line)).length;
  const checklistCount = lines.filter((line) => /^\s*- \[[ xX]\]/.test(line)).length;
  const fencedBlockCount = lines.filter((line) => /^```/.test(line)).length;
  return trimmed.length + headingCount * 500 + checklistCount * 120 + fencedBlockCount * 80 + Math.min(lines.length, 200) * 10;
}

function shouldPreserveExistingTaskMarkdown(existing: string, incoming: string): boolean {
  const existingTrimmed = existing.trim();
  const incomingTrimmed = incoming.trim();
  if (!existingTrimmed || !incomingTrimmed) return false;
  if (existingTrimmed === incomingTrimmed) return true;

  const existingScore = markdownPreservationScore(existingTrimmed);
  const incomingScore = markdownPreservationScore(incomingTrimmed);
  const incomingLooksLikeShortPrompt = incomingTrimmed.length < 500 && !/^#{1,6}\s+/m.test(incomingTrimmed);

  return existingScore > incomingScore * 1.5 || incomingLooksLikeShortPrompt;
}

async function writeTaskMarkdownSafely(filePath: string, incomingMarkdown: string): Promise<boolean> {
  const incoming = repairTaskMarkdown(incomingMarkdown).trimEnd() + "\n";
  const existing = await readFile(filePath, "utf8").catch(() => "");
  if (existing && shouldPreserveExistingTaskMarkdown(existing, incoming)) {
    return false;
  }
  await writeFile(filePath, incoming, "utf8");
  return true;
}

async function writeTaskArtifact(paths: ReturnType<typeof getSessionPaths>, state: OrchestratorSessionState, task: OrchestratorTask) {
  const targetPath = path.join(getTaskFolder(paths, task.status), getTaskFileName(task));
  const existingPath = await findExistingTaskFile(paths, task);
  if (!existingPath) {
    await writeFile(targetPath, renderTaskFile(task, `Parent session: ${state.sessionId}\n\nTask title: ${task.title}`), "utf8");
    return;
  }

  const existing = repairTaskMarkdown(await readFile(existingPath, "utf8"));
  await writeFile(targetPath, existing, "utf8");
  if (existingPath !== targetPath) await rm(existingPath, { force: true });
}

async function syncTaskArtifacts(cwd: string, session: OrchestratorSessionState) {
  const normalizedState = normalizeSessionState(session);
  assertSafeSessionId(normalizedState.sessionId);
  assertSafeTasks(normalizedState.tasks);
  const paths = getSessionPaths(cwd, normalizedState.sessionId);
  await mkdir(paths.pending, { recursive: true });
  await mkdir(paths.inProgress, { recursive: true });
  await mkdir(paths.completed, { recursive: true });
  await mkdir(paths.blocked, { recursive: true });
  await mkdir(paths.stateDir, { recursive: true });
  const existingMasterPlan = await readFile(paths.masterPlan, "utf8").catch(() => "");
  if (!existingMasterPlan || existingMasterPlan.includes("takomi-generated-master-plan")) {
    await writeFile(paths.masterPlan, renderMasterPlan(normalizedState), "utf8");
  }
  const validation = validateSessionState(normalizedState);
  await writeFile(paths.summary, [
    `# Orchestrator Summary: ${normalizedState.title}`,
    "",
    `- Session ID: ${normalizedState.sessionId}`,
    `- Human docs: ${paths.root}`,
    `- Machine state: ${paths.stateFile}`,
    `- Runtime mode: ${normalizedState.mode}`,
    `- Session intent: ${normalizedState.sessionIntent ?? "full-project"}`,
    `- Validation: ${validation.ok ? "PASS" : "ERRORS"} (${validation.errors.length} errors, ${validation.warnings.length} warnings)`,
    "",
    "## Validation",
    "",
    renderValidationReport(validation),
  ].join("\n"), "utf8");
  await writeFile(paths.stateFile, serializeSessionState(normalizedState), "utf8");

  for (const task of normalizedState.tasks) {
    await writeTaskArtifact(paths, normalizedState, task);
  }

  return paths;
}

async function writeOrchestratorSession(cwd: string, session: OrchestratorSessionState) {
  return syncTaskArtifacts(cwd, session);
}

type IncomingTask = {
  id?: string;
  title: string;
  taskMarkdown?: string;
  status?: OrchestratorTaskStatus;
  role: TakomiRole;
  stage?: VibeLifecycleStage;
  workflow?: TakomiWorkflowId;
  parentTaskId?: string;
  preferredAgent?: string;
  preferredModel?: string;
  preferredModelHint?: string;
  preferredThinking?: TakomiThinkingLevel;
  fallbackModels?: string[];
  executionHint?: TakomiDispatchPolicy;
  dispatchPolicy?: TakomiDispatchPolicy;
  skills?: string[];
  checklist?: Array<string | { text: string; done?: boolean }>;
  objective?: string;
  scope?: string[];
  definitionOfDone?: string[];
  expectedArtifacts?: string[];
  dependencies?: string[];
  reviewCheckpoint?: string;
  instructions?: string[];
  conversationId?: string;
};

async function materializeTasksFromInput(
  ctx: ExtensionContext,
  currentTasks: OrchestratorTask[],
  incoming: IncomingTask[],
  stageOverride?: VibeLifecycleStage,
): Promise<OrchestratorTask[]> {
  const nextTasks = [...currentTasks];

  for (const task of incoming) {
    if (task.id) assertSafeTaskId(task.id);
    const stage = task.stage ?? stageOverride;
    const defaults = getProfileDefaults(activeProfile, task.role, stage);
    const fallbackModels = [
      ...(task.fallbackModels ?? []),
      ...(defaults.fallbackModels ?? []),
    ];
    const requestedModel = task.preferredModel ?? defaults.model;
    const resolvedModel = await resolvePreferredModel(ctx, requestedModel, fallbackModels);
    const id = task.id ?? getNextTaskId(nextTasks);
    nextTasks.push(createTask(id, task.title, task.role, {
      stage,
      workflow: task.workflow,
      parentTaskId: task.parentTaskId,
      preferredAgent: task.preferredAgent ?? defaults.agent,
      preferredModel: resolvedModel.model,
      preferredModelHint: [task.preferredModelHint, resolvedModel.warning].filter(Boolean).join(" ").trim() || undefined,
      preferredThinking: task.preferredThinking ?? defaults.thinking,
      fallbackModels: fallbackModels.length ? fallbackModels : undefined,
      status: task.status ?? "pending",
      dispatchPolicy: task.executionHint ?? task.dispatchPolicy ?? defaults.dispatchPolicy,
      skills: task.skills,
      checklist: (task.checklist ?? []).map((item) => typeof item === "string" ? { text: item } : item),
      objective: task.objective,
      scope: task.scope,
      definitionOfDone: task.definitionOfDone,
      expectedArtifacts: task.expectedArtifacts,
      dependencies: task.dependencies,
      reviewCheckpoint: task.reviewCheckpoint,
      instructions: task.instructions,
      conversationId: task.conversationId,
    }));
  }

  return nextTasks;
}

async function applyProfileDefaultsToTasks(ctx: ExtensionContext, tasks: OrchestratorTask[]): Promise<OrchestratorTask[]> {
  const nextTasks: OrchestratorTask[] = [];
  for (const task of tasks) {
    const defaults = getProfileDefaults(activeProfile, task.role, task.stage);
    const fallbackModels = [
      ...(task.fallbackModels ?? []),
      ...(defaults.fallbackModels ?? []),
    ];
    const requestedModel = task.preferredModel ?? defaults.model;
    const resolvedModel = await resolvePreferredModel(ctx, requestedModel, fallbackModels);
    nextTasks.push({
      ...task,
      preferredAgent: task.preferredAgent ?? defaults.agent,
      preferredModel: resolvedModel.model,
      preferredModelHint: [task.preferredModelHint, resolvedModel.warning].filter(Boolean).join(" ").trim() || undefined,
      preferredThinking: task.preferredThinking ?? defaults.thinking,
      fallbackModels: fallbackModels.length ? fallbackModels : undefined,
      dispatchPolicy: task.dispatchPolicy ?? defaults.dispatchPolicy,
    });
  }
  return nextTasks;
}

function installTakomiFooter(ctx: ExtensionContext, stateRef: { current: TakomiState }): void {
  ctx.ui.setFooter((tui, theme, footerData) => new TakomiFooterComponent(tui, theme, footerData, ctx, () => stateRef.current));
}

function hasVisibleRuntimeWidget(state: TakomiState): boolean {
  return state.enabled && (state.modeSource ?? "idle") !== "idle";
}

async function refreshUi(
  ctx: ExtensionContext,
  state: TakomiState,
  footerStateRef: { current: TakomiState; context?: ExtensionContext },
) {
  if (!ctx.hasUI) return;
  ctx.ui.setTitle("Takomi");
  ctx.ui.setHeader((_tui, theme) => ({
    invalidate() { },
    render() {
      return renderTakomiHeader(theme);
    },
  }));
  footerStateRef.current = state;

  // The mode indicator belongs in the widget above the editor. Keeping a
  // second setStatus copy makes Pi's default footer duplicate it whenever a
  // custom footer is replaced or a session is rebound.
  ctx.ui.setStatus("takomi-runtime", undefined);
  const widget = renderRuntimeWidget(ctx.ui.theme, state);
  ctx.ui.setWidget("takomi-runtime", widget.length > 0 ? widget : undefined);

  // A replacement session receives a fresh UI context even when extension
  // modules remain cached. Install once per context, not once per module.
  if (footerStateRef.context !== ctx) {
    installTakomiFooter(ctx, footerStateRef);
    footerStateRef.context = ctx;
  }
}

export default function takomiRuntime(pi: ExtensionAPI) {
  let state = cloneState(DEFAULT_STATE);
  const footerStateRef: { current: TakomiState; context?: ExtensionContext } = { current: state };
  const subagentController = getTakomiSubagentController();
  const contextPanel = new TakomiContextPanel();
  let runtimeCtx: ExtensionContext | undefined;
  const pendingSubagentEvents: TakomiSubagentRuntimeEvent[] = [];

  // Wire context panel events and commands (Alt+C, /takomi-context)
  wireContextPanel(pi, contextPanel);

  pi.events.on(TAKOMI_SUBAGENT_EVENT_CHANNEL, (payload) => {
    const event = payload as TakomiSubagentRuntimeEvent;
    if (!runtimeCtx) {
      pendingSubagentEvents.push(event);
      return;
    }
    void applySubagentRuntimeEvent(event, runtimeCtx);
  });

  function persistState() {
    pi.appendEntry(STATE_ENTRY, state);
  }

  // This is intentionally separate from generic runtime-state persistence.
  // Only user slash-command handlers receive the recorder below.
  function recordUserGateAutoProvenance(authorized: boolean): void {
    pi.appendEntry(USER_GATE_AUTO_PROVENANCE_ENTRY, { authorized });
  }

  function syncContextPanelState() {
    contextPanel.setRuntimeState({
      role: state.role,
      stage: state.stage,
      workflow: state.workflow,
      activeSessionId: state.activeSessionId,
      autoOrch: state.autoOrch,
      launchMode: state.launchMode,
      planMode: state.planMode,
      activeSubagent: activeSubagentLabel,
      activeSubagentAgent,
      activeSubagentTask,
      activeSubagentStatus,
    });
  }

  async function applySubagentRuntimeEvent(event: TakomiSubagentRuntimeEvent, ctx: ExtensionContext): Promise<void> {
    if (event.type === "start") {
      activeSubagentLabel = `${event.state.agent}: ${event.state.taskLabel}`;
      activeSubagentAgent = event.state.agent;
      activeSubagentTask = event.state.taskLabel;
      activeSubagentStatus = event.state.status ?? "running";
      syncContextPanelState();
    } else if ((event.type === "update" || event.type === "complete" || event.type === "block") && event.patch) {
      const model = event.patch.model ? ` @ ${event.patch.model}` : "";
      const thinking = event.patch.thinking ? ` (${event.patch.thinking})` : "";
      const label = event.patch.summary?.split(/\r?\n/).find(Boolean);
      if (label) activeSubagentLabel = `${label}${model}${thinking}`;
      if (event.patch.agent) activeSubagentAgent = event.patch.agent;
      if (event.patch.taskLabel) activeSubagentTask = event.patch.taskLabel;
      activeSubagentStatus = event.type === "complete" ? "completed" : event.type === "block" ? "blocked" : event.patch.status ?? activeSubagentStatus;
      syncContextPanelState();
    }
    switch (event.type) {
      case "start":
        await subagentController.start(ctx, event.state, event.runKey);
        break;
      case "update":
        await subagentController.update(ctx, event.patch, event.runKey);
        break;
      case "appendLog":
        await subagentController.appendLog(ctx, event.chunk, event.runKey);
        break;
      case "complete":
        await subagentController.complete(ctx, event.patch, event.runKey);
        break;
      case "block":
        await subagentController.block(ctx, event.patch, event.runKey);
        break;
    }
  }

  function flushPendingSubagentEvents(): void {
    if (!runtimeCtx || pendingSubagentEvents.length === 0) return;
    const queued = pendingSubagentEvents.splice(0, pendingSubagentEvents.length);
    for (const event of queued) {
      void applySubagentRuntimeEvent(event, runtimeCtx);
    }
  }

  async function updateState(ctx: ExtensionContext, mutator: () => void, message?: string | (() => string)) {
    mutator();
    persistState();
    syncContextPanelState();
    await refreshUi(ctx, state, footerStateRef);
    const resolvedMessage = typeof message === "function" ? message() : message;
    if (resolvedMessage) ctx.ui.notify(resolvedMessage, "info");
  }

  async function syncBoardTaskRunState(
    ctx: ExtensionContext,
    task: Pick<OrchestratorTask, "conversationId" | "status" | "checklist">,
    summary?: string,
  ): Promise<void> {
    if (!task.conversationId) return;
    const patch: TakomiSubagentRunPatch = {
      conversationId: task.conversationId,
      boardTaskStatus: task.status,
      checklist: task.checklist,
    };
    if (summary) patch.summary = summary;
    await subagentController.update(ctx, patch, task.conversationId);
  }

  registerTakomiCommands(pi, {
    getState: () => state,
    updateState,
    recordUserGateAutoProvenance,
    setStageAndWorkflow: (stage, options) => setStageAndWorkflow(state, stage, options),
    hasGenesisArtifacts,
    subagentController,
    createPlanSession: async (ctx, title) => {
      const starter = createLifecycleStarterSession(title?.trim() || "Takomi Project");
      const session = buildSessionState(
        starter.sessionId,
        starter.title,
        await applyProfileDefaultsToTasks(ctx, starter.tasks),
        new Date(),
        { sessionIntent: starter.sessionIntent, lifecycle: starter.lifecycle },
      );
      const paths = await writeOrchestratorSession(ctx.cwd, session);
      await updateState(ctx, () => {
        state.enabled = true;
        state.autoOrch = true;
        state.planMode = true;
        state.activeSessionId = session.sessionId;
        state.stage = "genesis";
        state.workflow = "vibe-genesis";
        state.role = "orchestrator";
        state.modeSource = "manual";
        state.modeReason = "/takomi plan";
      });
      return `Takomi plan created session ${session.sessionId}\nMaster plan: ${paths.masterPlan}`;
    },
    resetRuntime: async (ctx) => {
      await updateState(ctx, () => {
        recordUserGateAutoProvenance(false);
        state = cloneState(DEFAULT_STATE);
        activeSubagentLabel = undefined;
        activeSubagentAgent = undefined;
        activeSubagentTask = undefined;
        activeSubagentStatus = undefined;
      }, () => hasVisibleRuntimeWidget(state) ? "" : "Takomi runtime state reset");
      subagentController.reset(ctx);
      contextPanel.resetSession();
      contextPanel.show(ctx);
    },
  });


  async function applyTakomiMode(ctx: ExtensionContext, mode: string, source: TakomiModeSource, reason?: string): Promise<string> {
    const hasGenesis = await hasGenesisArtifacts(ctx.cwd);
    state.enabled = true;
    state.modeSource = source;
    state.modeReason = reason?.trim() || undefined;

    switch (mode) {
      case "idle":
        state.modeSource = "idle";
        state.modeReason = undefined;
        state.autoOrch = false;
        state.planMode = false;
        state.role = "general";
        state.stage = undefined;
        state.workflow = undefined;
        break;
      case "code":
        state.autoOrch = false;
        state.planMode = false;
        state.role = "code";
        state.stage = undefined;
        state.workflow = undefined;
        break;
      case "review":
        state.autoOrch = false;
        state.planMode = true;
        state.role = "review";
        state.stage = undefined;
        state.workflow = undefined;
        break;
      case "orchestrate":
        state.autoOrch = true;
        state.planMode = true;
        state.role = "orchestrator";
        state.stage = hasGenesis ? "build" : "genesis";
        state.workflow = hasGenesis ? "vibe-build" : "vibe-genesis";
        break;
      case "genesis":
      case "design":
      case "build":
        setStageAndWorkflow(state, mode);
        state.autoOrch = mode === "build";
        state.planMode = mode !== "build";
        break;
    }

    persistState();
    syncContextPanelState();
    await refreshUi(ctx, state, footerStateRef);
    const label = state.modeSource === "idle" ? "idle" : `${state.modeSource}:${state.stage ?? state.role}`;
    const text = `Takomi mode set to ${label}${state.modeReason ? ` (${state.modeReason})` : ""}.`;
    if (!hasVisibleRuntimeWidget(state)) ctx.ui.notify(text, "info");
    return text;
  }

  pi.registerTool({
    name: "takomi_mode",
    label: "Takomi Mode",
    description: "Set or clear the visible Takomi runtime mode after the active model decides a task benefits from code, review, lifecycle, or orchestration handling.",
    promptSnippet: "Optional: call takomi_mode when you decide the current request should visibly enter Takomi code/review/orchestration/lifecycle mode. Do not call it for normal creative/general conversation. Use mode=idle to clear Takomi mode.",
    promptGuidelines: [
      "Let the user's request drive the choice; do not switch modes just because a vague word like code/review/build appears alone.",
      "Prefer mode=code for direct coding in the current chat, mode=orchestrate only for broad/multi-step durable work, and mode=review for critique/audit/QA.",
      "Use mode=idle when the user asks normal non-coding/non-Takomi questions and Takomi should get out of the way.",
    ],
    parameters: Type.Object({
      mode: TakomiModeSchema,
      reason: Type.Optional(Type.String({ description: "Short human-readable reason for the switch" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const text = await applyTakomiMode(ctx, params.mode, "model", params.reason);
      return {
        content: [{ type: "text", text }],
        details: { mode: params.mode, source: state.modeSource, reason: state.modeReason, role: state.role, stage: state.stage, workflow: state.workflow },
      };
    },
    renderCall: renderTakomiModeCall,
    renderResult: (result, options, theme) => renderTakomiModeResult(result, options, theme),
  });

  pi.registerTool({
    name: "takomi_apply_routing_policy",
    label: "Takomi Routing",
    description: "Apply a Takomi model-routing policy after deterministic extraction and active-model review.",
    promptSnippet: "Save reviewed Takomi model routing policy text to the active global or project policy file.",
    promptGuidelines: [
      "Use takomi_apply_routing_policy only after reviewing the deterministic extraction against the original routing policy text.",
      "Do not call takomi_apply_routing_policy if the policy is ambiguous, invents providers, or maps to non-Takomi roles.",
    ],
    parameters: Type.Object({
      policyText: Type.String({ description: "Original routing policy text to save" }),
      scope: Type.Optional(StringEnum(["global", "project"] as const)),
      reviewNotes: Type.Optional(Type.String({ description: "Brief notes from the active-model review" })),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const scope = params.scope ?? "global";
      const availableModels = (() => {
        try {
          const available = (ctx as typeof ctx & { modelRegistry?: { getAvailable?: () => Array<{ provider?: string; id?: string; name?: string }> } }).modelRegistry?.getAvailable?.() ?? [];
          return available.map((model) => `${model.provider ? `${model.provider}/` : ""}${model.id ?? model.name ?? ""}`).filter(Boolean);
        } catch {
          return [];
        }
      })();
      const preview = previewTakomiRoutingPolicy(ctx.cwd, params.policyText, { scope, availableModels });
      const result = await installTakomiRoutingPolicy(ctx.cwd, params.policyText, { scope });
      const scopeNote = scope === "global"
        ? "This global policy applies unless a project-local override exists."
        : "This project-local policy overrides the global policy for the current project.";
      return {
        content: [{
          type: "text",
          text: [
            `Takomi routing policy saved (${scope}).`,
            "",
            `Policy: ${result.policyPath}`,
            `Settings: ${result.settingsPath}`,
            "",
            renderRoutingPolicyPreview(preview),
            params.reviewNotes ? `\nReview notes:\n${params.reviewNotes}` : "",
            "",
            scopeNote,
          ].filter(Boolean).join("\n"),
        }],
        details: { result, preview, reviewNotes: params.reviewNotes },
      };
    },
    renderCall: renderTakomiRoutingCall,
    renderResult: (result, options, theme) => renderTakomiRoutingResult(result, options, theme),
  });

  pi.registerTool({
    name: "takomi_workflow",
    label: "Takomi Workflow",
    description: "Return embedded Takomi workflow playbooks for genesis, design, and build.",
    promptSnippet: "Get embedded Takomi lifecycle playbooks without relying on external skill files.",
    parameters: Type.Object({
      workflow: Type.Optional(StringEnum(["vibe-genesis", "vibe-design", "vibe-build"] as const)),
    }),
    async execute(_toolCallId, params) {
      if (params.workflow) {
        const workflow = getWorkflowDefinition(params.workflow);
        return {
          content: [{ type: "text", text: `${workflow.title}\n\n${workflow.playbook}` }],
          details: workflow,
        };
      }

      const workflows = listWorkflowDefinitions();
      return {
        content: [{ type: "text", text: workflows.map((workflow) => `${workflow.id}: ${workflow.purpose}`).join("\n") }],
        details: undefined,
      };
    },
    renderCall: renderTakomiWorkflowCall,
    renderResult: (result, options, theme) => renderTakomiWorkflowResult(result, options, theme),
  });

  pi.registerTool({
    name: "takomi_board",
    label: "Takomi Board",
    description: "Create and manage lifecycle-aware Takomi orchestration session artifacts.",
    promptSnippet: "Register or update Takomi session/state/markdown artifacts; subagent execution happens elsewhere.",
    promptGuidelines: [
      "Use this when you need a concrete orchestrator session directory and task artifacts on disk.",
      "takomi_board never runs subagents. Author the human-facing markdown first, use takomi_subagent for execution, then return here with takomi_board update_task to record the outcome.",
      "Session IDs must use the canonical timestamp format orch-YYYYMMDD-HHMMSS. Use the same sessionId for the authored docs folder and the board JSON state.",
      "For high-quality orchestration sessions, provide sessionId, masterPlanMarkdown, and taskMarkdown values that match the authored session folder. If you already wrote docs/tasks/orchestrator-sessions/<id>, call this tool with sessionId=<id>; do not create a second session id.",
      "JSON fields should carry IDs/status/roles/workflow/dependencies/checklists for tracking, not replace expressive markdown.",
      "Do not use expand_stage as a placeholder generator. For Design/Build expansions, provide full taskMarkdown or complete objective/scope/definitionOfDone/expectedArtifacts/instructions for every task.",
      "If a task packet would render with Scope/Definition Of Done/Expected Artifacts as None specified, repair it before launching subagents.",
      "A new session should normally begin Genesis-first, then expand Design and Build into as many tasks as the scope actually needs.",
      "If the request is small enough, do not force orchestration just because the tool exists.",
      "If a reviewed task needs more work, reuse the task conversationId when you call takomi_subagent again, then update the board with the new result.",
    ],
    parameters: Type.Object({
      action: StringEnum(["init_session", "expand_stage", "show_workflows", "show_session", "update_task"] as const),
      title: Type.Optional(Type.String()),
      sessionId: Type.Optional(Type.String()),
      taskId: Type.Optional(Type.String()),
      stage: Type.Optional(StringEnum(["genesis", "design", "build"] as const)),
      status: Type.Optional(StringEnum(["pending", "in-progress", "completed", "blocked"] as const)),
      notes: Type.Optional(Type.String()),
      checklist: Type.Optional(Type.Array(Type.Union([
        Type.String(),
        Type.Object({ text: Type.String(), done: Type.Optional(Type.Boolean()) }),
      ]))),
      checklistUpdates: Type.Optional(Type.Array(Type.Object({
        text: Type.Optional(Type.String()),
        index: Type.Optional(Type.Number()),
        done: Type.Optional(Type.Boolean()),
      }))),
      masterPlanMarkdown: Type.Optional(Type.String()),
      tasks: Type.Optional(Type.Array(Type.Object({
        id: Type.Optional(Type.String()),
        title: Type.String(),
        taskMarkdown: Type.Optional(Type.String()),
        status: Type.Optional(StringEnum(["pending", "in-progress", "completed", "blocked"] as const)),
        role: StringEnum(["general", "orchestrator", "architect", "design", "code", "review"] as const),
        stage: Type.Optional(StringEnum(["genesis", "design", "build"] as const)),
        workflow: Type.Optional(StringEnum(["vibe-genesis", "vibe-design", "vibe-build"] as const)),
        parentTaskId: Type.Optional(Type.String()),
        preferredAgent: Type.Optional(Type.String()),
        preferredModel: Type.Optional(Type.String()),
        preferredModelHint: Type.Optional(Type.String()),
        preferredThinking: Type.Optional(ThinkingSchema),
        fallbackModels: Type.Optional(Type.Array(Type.String())),
        executionHint: Type.Optional(StringEnum(["direct", "subagent", "review-first"] as const)),
        skills: Type.Optional(Type.Array(Type.String())),
        checklist: Type.Optional(Type.Array(Type.Union([
          Type.String(),
          Type.Object({ text: Type.String(), done: Type.Optional(Type.Boolean()) }),
        ]))),
        objective: Type.Optional(Type.String()),
        scope: Type.Optional(Type.Array(Type.String())),
        definitionOfDone: Type.Optional(Type.Array(Type.String())),
        expectedArtifacts: Type.Optional(Type.Array(Type.String())),
        dependencies: Type.Optional(Type.Array(Type.String())),
        reviewCheckpoint: Type.Optional(Type.String()),
        instructions: Type.Optional(Type.Array(Type.String())),
        conversationId: Type.Optional(Type.String()),
      }))),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      if (params.action === "show_workflows") {
        const workflows = listWorkflowDefinitions();
        return {
          content: [{ type: "text", text: workflows.map((workflow) => `${workflow.id}: ${workflow.playbook}`).join("\n\n") }],
          details: { workflows },
        };
      }

      if (params.action === "show_session") {
        if (!params.sessionId) {
          return createBoardErrorResult("sessionId is required for show_session", "missing-session-id", "warning");
        }
        assertSafeSessionId(params.sessionId);
        const paths = getSessionPaths(ctx.cwd, params.sessionId);
        const [masterPlan, stateJson] = await Promise.all([
          readFile(paths.masterPlan, "utf8").catch(() => "Master plan not found."),
          readFile(paths.stateFile, "utf8").catch(() => "{}"),
        ]);
        return {
          content: [{
            type: "text", text: `${masterPlan}\n\n---\n\nMachine state\n\n\
${stateJson}`
          }],
          details: { paths, state: normalizeSessionState({ sessionId: params.sessionId, title: "Takomi Session", ...(JSON.parse(stateJson) as Partial<OrchestratorSessionState>) }) },
        };
      }

      if (params.action === "update_task") {
        if (!params.sessionId || !params.taskId) {
          return createBoardErrorResult("sessionId and taskId are required for update_task", "missing-task-context", "warning");
        }
        assertSafeTaskId(params.taskId);
        const { state: sessionState } = await loadSessionState(ctx.cwd, params.sessionId);
        const idx = sessionState.tasks.findIndex((task) => task.id === params.taskId);
        if (idx === -1) {
          return createBoardErrorResult(
            `Task ${params.taskId} not found in session ${params.sessionId}`,
            "task-not-found",
            "error",
            { sessionId: params.sessionId, taskId: params.taskId },
          );
        }
        const current = sessionState.tasks[idx];
        const checklist = resolveChecklistState(current.checklist, params.checklist, params.checklistUpdates);
        const nextTask = {
          ...current,
          status: (params.status ?? current.status) as OrchestratorTaskStatus,
          notes: params.notes ?? current.notes,
          checklist,
        };
        if (params.status === "completed") {
          const completionGateError = getCompletionGateError(nextTask);
          if (completionGateError) {
            return createBoardErrorResult(completionGateError, "completion-gate", "warning", {
              sessionId: params.sessionId,
              taskId: current.id,
              incompleteChecklistItems: getIncompleteChecklistItems(nextTask.checklist),
              checklist: nextTask.checklist,
            });
          }
        }
        sessionState.tasks[idx] = nextTask;
        state.activeSessionId = params.sessionId;
        state.modeSource = state.modeSource === "idle" ? "board" : state.modeSource;
        state.modeReason = state.modeReason ?? "board task update";
        persistState();
        syncContextPanelState();
        await refreshUi(ctx, state, footerStateRef);
        const nextState = buildSessionState(
          sessionState.sessionId,
          sessionState.title,
          sessionState.tasks,
          new Date(),
          {
            sessionIntent: sessionState.sessionIntent,
            lifecycle: sessionState.lifecycle,
          },
        );
        const paths = await syncTaskArtifacts(ctx.cwd, nextState);
        await syncBoardTaskRunState(
          ctx,
          nextState.tasks[idx],
          nextTask.status === "completed"
            ? "Board task completed."
            : nextTask.status === "blocked"
              ? "Board task blocked."
              : undefined,
        );
        return {
          content: [{ type: "text", text: `Updated task ${params.taskId} in session ${params.sessionId}.\nStatus: ${nextState.tasks[idx].status}` }],
          details: { sessionId: params.sessionId, task: nextState.tasks[idx], paths, lifecycle: nextState.lifecycle },
        };
      }

      if (params.action === "expand_stage") {
        if (!params.sessionId || !params.stage || !params.tasks?.length) {
          return createBoardErrorResult(
            "sessionId, stage, and at least one task are required for expand_stage",
            "invalid-expansion",
            "warning",
          );
        }

        const { state: sessionState } = await loadSessionState(ctx.cwd, params.sessionId);
        const tasks = await materializeTasksFromInput(ctx, sessionState.tasks, params.tasks as IncomingTask[], params.stage);
        let nextState = buildSessionState(
          sessionState.sessionId,
          sessionState.title,
          tasks,
          new Date(),
          {
            sessionIntent: sessionState.sessionIntent,
            lifecycle: sessionState.lifecycle,
          },
        );
        nextState = markStageExpanded(nextState, params.stage, params.notes);
        const paths = await writeOrchestratorSession(ctx.cwd, nextState);
        if (params.masterPlanMarkdown?.trim()) {
          await writeFile(paths.masterPlan, params.masterPlanMarkdown.trimEnd() + "\n", "utf8");
        }
        for (const task of nextState.tasks) {
          const authored = (params.tasks as IncomingTask[] | undefined)?.find((input) => (input.id ?? task.id) === task.id)?.taskMarkdown;
          if (authored?.trim()) {
            await writeTaskMarkdownSafely(path.join(getTaskFolder(paths, task.status), getTaskFileName(task)), authored);
          }
        }
        state.activeSessionId = nextState.sessionId;
        state.modeSource = "board";
        state.modeReason = `expanded ${params.stage} stage`;
        persistState();
        syncContextPanelState();
        await refreshUi(ctx, state, footerStateRef);

        return {
          content: [{ type: "text", text: `Expanded ${params.stage} stage in session ${nextState.sessionId}.\n\nDocs: ${paths.root}\nState: ${paths.stateFile}\n\n${buildTaskRows(nextState.tasks)}` }],
          details: { sessionId: nextState.sessionId, paths, tasks: nextState.tasks, lifecycle: nextState.lifecycle, mode: nextState.mode },
        };
      }

      const sessionId = params.sessionId || createSessionId();
      assertSafeSessionId(sessionId);
      const title = params.title || "Takomi Session";
      const baseState = params.tasks?.length
        ? buildSessionState(sessionId, title, [], new Date())
        : createLifecycleStarterSession(title, { sessionId });
      const tasks = params.tasks?.length
        ? await materializeTasksFromInput(ctx, baseState.tasks, params.tasks as IncomingTask[], params.stage)
        : await applyProfileDefaultsToTasks(ctx, baseState.tasks);
      const nextState = buildSessionState(
        baseState.sessionId,
        baseState.title,
        tasks,
        new Date(),
        {
          sessionIntent: baseState.sessionIntent,
          lifecycle: baseState.lifecycle,
        },
      );
      const paths = await writeOrchestratorSession(ctx.cwd, nextState);
      if (params.masterPlanMarkdown?.trim()) {
        await writeFile(paths.masterPlan, params.masterPlanMarkdown.trimEnd() + "\n", "utf8");
      }
      for (const task of nextState.tasks) {
        const authored = (params.tasks as IncomingTask[] | undefined)?.find((input) => (input.id ?? task.id) === task.id)?.taskMarkdown;
        if (authored?.trim()) {
          await writeTaskMarkdownSafely(path.join(getTaskFolder(paths, task.status), getTaskFileName(task)), authored);
        }
      }
      state.activeSessionId = nextState.sessionId;
      state.role = "orchestrator";
      state.stage = nextState.lifecycle.genesis.status === "completed" ? "build" : "genesis";
      state.workflow = state.stage === "genesis" ? "vibe-genesis" : "vibe-build";
      state.modeSource = "board";
      state.modeReason = "orchestrator session";
      persistState();
      syncContextPanelState();
      await refreshUi(ctx, state, footerStateRef);

      return {
        content: [{ type: "text", text: `Created Takomi orchestrator session ${nextState.sessionId} in hybrid mode\n\nDocs: ${paths.root}\nState: ${paths.stateFile}\n\n${buildTaskRows(nextState.tasks) || "No tasks provided."}` }],
        details: { sessionId: nextState.sessionId, paths, tasks: nextState.tasks, lifecycle: nextState.lifecycle, mode: nextState.mode },
      };
    },
    renderCall: renderTakomiBoardCall,
    renderResult: (result, options, theme, context) => renderTakomiBoardResult(result, options, theme, context?.args),
  });

  pi.on("input", async (event) => {
    if (event.source === "extension") return { action: "continue" };

    const text = event.text.trim();
    const lowered = text.toLowerCase();

    const routingUpdateMatch = text.match(/^update\s+(?:takomi\s+|our\s+)?(?:model\s+)?routing\s+(?:logic|policy|philosophy)\s*:?\s*([\s\S]*)$/i)
      ?? text.match(/^set\s+(?:takomi\s+|our\s+)?(?:model\s+)?routing\s+(?:logic|policy|philosophy)\s*:?\s*([\s\S]*)$/i);
    if (routingUpdateMatch) {
      state.enabled = true;
      try {
        const cwd = runtimeCtx?.cwd ?? process.cwd();
        const availableModels = (() => {
          try {
            const available = (runtimeCtx as typeof runtimeCtx & { modelRegistry?: { getAvailable?: () => Array<{ provider?: string; id?: string; name?: string }> } })?.modelRegistry?.getAvailable?.() ?? [];
            return available.map((model) => `${model.provider ? `${model.provider}/` : ""}${model.id ?? model.name ?? ""}`).filter(Boolean);
          } catch {
            return [];
          }
        })();
        const preview = previewTakomiRoutingPolicy(cwd, text, { scope: "global", availableModels });
        const activePolicy = await resolveTakomiRoutingPolicy(cwd);
        const replacementWarning = activePolicy.text && activePolicy.text.trim().length > preview.policy.trim().length * 2
          ? `WARNING: This input is much shorter than the active policy (${preview.policy.length} vs ${activePolicy.text.length} characters). It will replace the file, not merge into it. Inspect any referenced full source before applying.`
          : "The supplied text replaces the policy file exactly; it is not merged with the current policy.";
        return { action: "transform", text: [
          "Review this Takomi routing policy extraction before it is saved.",
          "",
          "Rules:",
          "- Do not invent providers or model IDs not grounded in the policy.",
          "- Providerless names are valid routing intent. Require a provider only for executable model overrides.",
          "- Check the available Pi model registry below before asking whether a named model exists or what its exact ID is.",
          "- Conditional task routes need not be forced into role-wide agentOverrides.",
          "- Valid role-wide Takomi overrides are: general, orchestrator, architect, designer, coder, reviewer. Other headings may be policy concepts or execution routes.",
          "- Preserve the user's complete authored policy. If this is a summary/excerpt and a referenced full source exists, inspect and apply that source rather than overwriting it with the excerpt.",
          "- If correct and safe, call takomi_apply_routing_policy with scope=global and the complete intended policy text.",
          "- Ask only for unresolved provider/account choices or genuine ambiguity; do not ask for facts available in registry or files.",
          "",
          "Deterministic extraction:",
          renderRoutingPolicyPreview(preview),
          "",
          replacementWarning,
          "",
          availableModels.length ? `Available Pi models:\n${availableModels.map((model) => `- ${model}`).join("\n")}` : "Available Pi models: registry unavailable; inspect it before asking the user if possible.",
          "",
          "Original policy text:",
          "```",
          preview.policy,
          "```",
        ].join("\n") };
      } catch (error) {
        return { action: "transform", text: `Takomi routing policy review failed: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    if (lowered === "use takomi") {
      state.enabled = true;
      state.modeSource = "manual";
      state.modeReason = "explicit user request";
      return { action: "transform", text: "Use the Takomi runtime, identify the correct lifecycle stage, and proceed accordingly." };
    }

    if (lowered.startsWith("use takomi ")) {
      state.enabled = true;
      state.modeSource = "manual";
      state.modeReason = "explicit user request";
      const route = decideRoute(text.slice("use takomi ".length));
      if (route.stage) setStageAndWorkflow(state, route.stage, { preserveRole: state.role === "orchestrator" && route.stage === "genesis" });
      else if (route.role !== "general") state.role = route.role;
      return { action: "transform", text: `Use the Takomi runtime for this request: ${text.slice("use takomi ".length)}` };
    }

    if (/\bvibe genesis\b/i.test(text)) {
      state.modeSource = "manual";
      state.modeReason = "vibe genesis";
      setStageAndWorkflow(state, "genesis", { preserveRole: state.role === "orchestrator" });
      return { action: "transform", text };
    }
    if (/\bvibe design\b/i.test(text)) {
      state.modeSource = "manual";
      state.modeReason = "vibe design";
      setStageAndWorkflow(state, "design");
      return { action: "transform", text };
    }
    if (/\bvibe build\b/i.test(text)) {
      state.modeSource = "manual";
      state.modeReason = "vibe build";
      setStageAndWorkflow(state, "build");
      return { action: "transform", text };
    }

    return { action: "continue" };
  });

  pi.on("before_agent_start", async (event, ctx) => {
    if (!state.enabled || (state.modeSource ?? "idle") === "idle") return;

    let effectiveState = cloneState(state);
    const runtimeCwd = ctx.cwd;
    const genesisExists = await hasGenesisArtifacts(runtimeCwd);
    const route = decideRoute(event.prompt);
    let routingNote = state.modeReason
      ? `Takomi mode selected by ${state.modeSource}: ${state.modeReason}.`
      : `Takomi mode selected by ${state.modeSource ?? "runtime"}.`;
    const explicitLifecycleWaiver = /skip genesis|waive genesis|genesis complete|already have (a )?(prd|requirements)|design complete|jump straight to build/i.test(event.prompt);
    const orchestrationActive = effectiveState.role === "orchestrator";
    if (!genesisExists && orchestrationActive && !explicitLifecycleWaiver) {
      effectiveState.stage = "genesis";
      effectiveState.workflow = "vibe-genesis";
      routingNote = "Blank project detected; orchestrator remains in control and must honor Genesis → Design → Build.";
    }
    if (effectiveState.stage !== state.stage || effectiveState.workflow !== state.workflow || effectiveState.role !== state.role) {
      state.role = effectiveState.role;
      state.stage = effectiveState.stage;
      state.workflow = effectiveState.workflow;
    }

    const promptKey = `${effectiveState.role}:${effectiveState.workflow ?? "none"}`;
    const includeFullWorkflow = Boolean(effectiveState.workflow && effectiveState.lastFullPromptKey !== promptKey);
    if (includeFullWorkflow) {
      state.lastFullPromptKey = promptKey;
    }
    persistState();
    syncContextPanelState();
    await refreshUi(ctx, state, footerStateRef);

    const routingPolicy = await resolveTakomiRoutingPolicy(runtimeCwd);
    const optionalFeatureContext = (() => {
      try {
        const tools = typeof (pi as { getAllTools?: () => Array<{ name?: string }> }).getAllTools === "function"
          ? (pi as { getAllTools: () => Array<{ name?: string }> }).getAllTools()
          : [];
        const toolNames = new Set(tools.map((tool) => tool.name).filter(Boolean));
        const guidance: string[] = [];
        if (toolNames.has("ask_user_question")) {
          guidance.push("Takomi Interview is available: when Genesis, Design, or ambiguous planning would otherwise require guessing, use ask_user_question to ask concise structured questions before proceeding.");
        }
        if (toolNames.has("todo")) {
          guidance.push("Takomi Todo is available as an optional live overlay. You may use todo for short-lived execution visibility, but takomi_board remains the durable lifecycle/task source of truth.");
        }
        return guidance.join("\n");
      } catch {
        return "";
      }
    })();
    const modelPreflightContext = (() => {
      try {
        const available = typeof (ctx as { modelRegistry?: { getAvailable?: () => Array<{ provider?: string; id?: string; name?: string }> } }).modelRegistry?.getAvailable === "function"
          ? (ctx as { modelRegistry: { getAvailable: () => Array<{ provider?: string; id?: string; name?: string }> } }).modelRegistry.getAvailable()
          : [];
        if (!available.length) return "";
        return `Available model context from Pi registry: ${available.map((m) => `${m.provider ? `${m.provider}/` : ""}${m.id ?? m.name ?? "unknown"}`).slice(0, 80).join(", ")}`;
      } catch {
        return "";
      }
    })();

    const parts = [
      "Takomi runtime is active for this turn.",
      await loadRolePrompt(runtimeCwd, effectiveState.role),
      effectiveState.planMode ? planPrompt() : "",
      await getInjectedPlaybook(runtimeCwd, effectiveState, includeFullWorkflow),
      `Routing note: ${routingNote}`,
      routingPolicy.text
        ? `${routingPolicy.source === "bundled" ? "Bundled" : "Project"} Takomi model routing policy is active. Apply it when choosing parent/subagent models and escalation levels:\n\n${routingPolicy.text}`
        : "No Takomi routing policy file was found. Users can install one with `/takomi routing <policy>` or by saying `Update Takomi routing logic: \"\"\"...\"\"\"`.",
      optionalFeatureContext,
      modelPreflightContext,
      `Execution mode: ${route.executionMode}. Session recommendation: ${route.sessionRecommendation}.`,
      `Takomi execution gate: ${effectiveState.launchMode === "manual" ? "review" : "auto"}. In review gate mode, show the delegation plan before launching and return to the user after each task with results, verification guidance, and the recommended next step.`,
      !effectiveState.subagentsEnabled ? "Takomi subagents are disabled for this session. Do not call takomi_subagent or subagent until the user enables subagents." : "",
      orchestrationActive && !genesisExists ? "Project foundation is missing or incomplete. Do not skip Genesis unless the user explicitly waives it." : "",
      "Do not escalate to orchestration or review just because this is coding-related; stay in the selected Takomi mode unless the user asks or a durable board/session is genuinely needed.",
      orchestrationActive ? "Task fan-out is flexible. Do not force exactly three tasks; decompose Genesis, Design, and Build work to fit the actual scope." : "",
      orchestrationActive ? "A new orchestration session should usually begin with one Genesis foundation task that creates or updates the required markdown artifacts, then expand later stages only when the scope justifies it." : "",
      orchestrationActive ? "If a follow-up request is small, one-shot it. If it is multi-part or large, create or expand an orchestration session instead of pretending it is a single task." : "",
      "Before any Takomi subagent dispatch or model override, use the injected Pi model-registry context and project routing policy. Prefer provider-qualified model IDs. Do not run `pi --list-models` unless the registry context is missing or the user asks for a visible diagnostic.",
      "When useful, state the current Takomi mode/stage and the recommended next step.",
      orchestrationActive && effectiveState.stage === "build"
        ? "For build orchestration, use takomi_subagent to dispatch work to specialist subagents, then record the result on takomi_board; reuse the same conversation id when sending fixes back to the agent."
        : "",
    ].filter(Boolean);

    return {
      systemPrompt: `${event.systemPrompt}\n\n${parts.join("\n\n")}`,
    };
  });

  pi.on("tool_call", async (event) => {
    if (event.toolName !== "takomi_subagent") return;
    if (state.subagentsEnabled) return;
    return {
      block: true,
      reason: "Takomi subagents are disabled for this session. Run /takomi subagents on before calling takomi_subagent.",
    };
  });

  pi.on("session_start", async (_event, ctx) => {
    runtimeCtx = ctx;
    scheduleDelayedPiVersionCheck(ctx);
    activeProfile = await loadTakomiProfile(ctx.cwd);
    activeSubagentLabel = undefined;
    activeSubagentAgent = undefined;
    activeSubagentTask = undefined;
    activeSubagentStatus = undefined;
    subagentController.reset(ctx);
    const entries = ctx.sessionManager.getEntries();
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i] as { type: string; customType?: string; data?: TakomiState };
      if (entry.type === "custom" && entry.customType === STATE_ENTRY && entry.data) {
        state = { ...DEFAULT_STATE, ...entry.data };
        break;
      }
    }
    if (!entries.some((entry) => {
      const item = entry as { type: string; customType?: string };
      return item.type === "custom" && item.customType === STATE_ENTRY;
    })) {
      state.autoOrch = activeProfile.autoOrchestrate;
      state.launchMode = activeProfile.launchMode ?? (activeProfile.autoOrchestrate ? "auto" : "manual");
    } else {
      state.launchMode = state.launchMode ?? activeProfile.launchMode ?? "auto";
    }

    syncContextPanelState();
    contextPanel.rebuildFromSession(ctx);
    await refreshUi(ctx, state, footerStateRef);
    contextPanel.show(ctx);
    flushPendingSubagentEvents();
  });
}
