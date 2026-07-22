import path from "node:path";
import type {
  LifecycleStageState,
  OrchestratorSessionState,
  OrchestratorTask,
  OrchestratorTaskStatus,
  SessionIntent,
  LegacyTakomiRole,
  TakomiPersona,
  TaskChecklistItem,
  VibeLifecycleStage,
} from "./types";

export function createSessionId(now = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `orch-${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

export function slugifyTaskTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function getSessionPaths(cwd: string, sessionId: string) {
  const docsRoot = path.join(cwd, "docs", "tasks", "orchestrator-sessions", sessionId);
  const machineRoot = path.join(cwd, ".pi", "takomi", "orchestrator");
  return {
    root: docsRoot,
    pending: path.join(docsRoot, "pending"),
    inProgress: path.join(docsRoot, "in-progress"),
    completed: path.join(docsRoot, "completed"),
    blocked: path.join(docsRoot, "blocked"),
    masterPlan: path.join(docsRoot, "master_plan.md"),
    summary: path.join(docsRoot, "Orchestrator_Summary.md"),
    stateDir: machineRoot,
    stateFile: path.join(machineRoot, `${sessionId}.json`),
  };
}

export function createConversationId(agent: string, taskId: string): string {
  return `${agent}-${taskId}`;
}

export function workflowToStage(workflow?: OrchestratorTask["workflow"]): VibeLifecycleStage | undefined {
  switch (workflow) {
    case "vibe-genesis":
      return "genesis";
    case "vibe-design":
      return "design";
    case "vibe-build":
      return "build";
    default:
      return undefined;
  }
}

export function canonicalizeTakomiPersona(role: TakomiPersona | LegacyTakomiRole): TakomiPersona {
  switch (role) {
    case "design": return "designer";
    case "code": return "coder";
    case "review": return "reviewer";
    case "general": return "worker";
    default: return role;
  }
}

function defaultStageForRole(role: TakomiPersona): VibeLifecycleStage | undefined {
  switch (role) {
    case "architect": return "genesis";
    case "designer": return "design";
    case "coder":
    case "worker":
    case "reviewer":
    case "orchestrator": return "build";
  }
}

function emptyStageState(): LifecycleStageState {
  return {
    status: "pending",
    taskIds: [],
    canExpand: true,
  };
}

export function createEmptyLifecycle(): Record<VibeLifecycleStage, LifecycleStageState> {
  return {
    genesis: emptyStageState(),
    design: emptyStageState(),
    build: emptyStageState(),
  };
}

function stageStatusFromTasks(tasks: OrchestratorTask[]): OrchestratorTaskStatus {
  if (!tasks.length) return "pending";
  if (tasks.every((task) => task.status === "completed")) return "completed";
  if (tasks.some((task) => task.status === "in-progress")) return "in-progress";
  if (tasks.some((task) => task.status === "blocked") && !tasks.some((task) => task.status === "completed")) return "blocked";
  if (tasks.some((task) => task.status === "completed")) return "in-progress";
  return "pending";
}

export function deriveLifecycleFromTasks(
  tasks: OrchestratorTask[],
  previous?: Partial<Record<VibeLifecycleStage, LifecycleStageState>>,
): Record<VibeLifecycleStage, LifecycleStageState> {
  const lifecycle = createEmptyLifecycle();

  for (const stage of Object.keys(lifecycle) as VibeLifecycleStage[]) {
    const stageTasks = tasks.filter((task) => task.stage === stage || workflowToStage(task.workflow) === stage);
    const prev = previous?.[stage];
    lifecycle[stage] = {
      status: stageStatusFromTasks(stageTasks),
      taskIds: stageTasks.map((task) => task.id),
      canExpand: prev?.canExpand ?? true,
      expandedAt: prev?.expandedAt,
      notes: prev?.notes,
    };
  }

  return lifecycle;
}

export function normalizeChecklist(checklist?: Array<string | TaskChecklistItem>): TaskChecklistItem[] | undefined {
  if (!checklist?.length) return undefined;
  return checklist.map((item) => typeof item === "string" ? { text: item, done: false } : { text: item.text, done: item.done ?? false });
}

export function createTask(id: string, title: string, role: TakomiPersona | LegacyTakomiRole, extras?: Partial<OrchestratorTask>): OrchestratorTask {
  const persona = canonicalizeTakomiPersona(role);
  const preferredAgent = extras?.preferredAgent ?? persona;
  const stage = extras?.stage ?? workflowToStage(extras?.workflow) ?? defaultStageForRole(persona);
  return {
    id,
    title,
    role: persona,
    status: "pending",
    ...extras,
    stage,
    preferredAgent,
    conversationId: extras?.conversationId ?? createConversationId(preferredAgent, id),
    preferredModel: extras?.preferredModel,
    preferredModelConfirmed: extras?.preferredModelConfirmed,
    preferredModelHint: extras?.preferredModelHint,
    preferredThinking: extras?.preferredThinking,
    fallbackModels: extras?.fallbackModels,
    dispatchPolicy: extras?.dispatchPolicy,
    skills: extras?.skills,
    checklist: normalizeChecklist(extras?.checklist),
  };
}

export function getNextTaskId(tasks: OrchestratorTask[]): string {
  const max = tasks.reduce((current, task) => {
    const parsed = Number.parseInt(task.id, 10);
    return Number.isFinite(parsed) ? Math.max(current, parsed) : current;
  }, 0);
  return String(max + 1).padStart(2, "0");
}

export function moveTaskStatus(tasks: OrchestratorTask[], id: string, status: OrchestratorTaskStatus): OrchestratorTask[] {
  return tasks.map((task) => (task.id === id ? { ...task, status } : task));
}

function renderChecklist(checklist?: TaskChecklistItem[]): string[] {
  if (!checklist?.length) return ["- No checklist yet."];
  return checklist.map((item) => `- [${item.done ? "x" : " "}] ${item.text}`);
}

function renderBullets(items?: string[], empty = "- None specified."): string[] {
  if (!items?.length) return [empty];
  return items.map((item) => `- ${item}`);
}

function formatCodeList(items?: string[], empty = "none"): string {
  if (!items?.length) return empty;
  return items.map((item) => `\`${item}\``).join(", ");
}

function formatTaskDependencies(task: OrchestratorTask): string {
  return task.dependencies?.length ? task.dependencies.join(", ") : "none";
}

function describeWorkflowPhase(workflow?: OrchestratorTask["workflow"]): string {
  switch (workflow) {
    case "vibe-genesis":
      return "Product framing and blueprint generation";
    case "vibe-design":
      return "UI/UX design, visual system, and interaction definition";
    case "vibe-build":
      return "Implementation and delivery";
    default:
      return "Task-specific execution";
  }
}

function renderSkillRegistry(tasks: OrchestratorTask[]): string[] {
  const seen = new Set<string>();
  const skills = tasks.flatMap((task) => task.skills ?? []).filter((skill) => {
    if (seen.has(skill)) return false;
    seen.add(skill);
    return true;
  });

  if (!skills.length) {
    return [
      "| Skill | Why It Applies |",
      "| --- | --- |",
      "| - | No explicit skill/context overlays recorded for this session; rely on harness defaults and repo docs. |",
    ];
  }

  return [
    "| Skill | Why It Applies |",
    "| --- | --- |",
    ...skills.map((skill) => `| \`${skill}\` | Optional overlay named by the session plan; use it only if installed and genuinely helpful. |`),
  ];
}

function renderWorkflowRegistry(tasks: OrchestratorTask[]): string[] {
  const seen = new Set<string>();
  const workflows = tasks
    .map((task) => task.workflow)
    .filter((workflow): workflow is NonNullable<OrchestratorTask["workflow"]> => Boolean(workflow))
    .filter((workflow) => {
      if (seen.has(workflow)) return false;
      seen.add(workflow);
      return true;
    });

  if (!workflows.length) {
    return [
      "| Workflow | Phase |",
      "| --- | --- |",
      "| - | No explicit workflows recorded for this session. |",
    ];
  }

  return [
    "| Workflow | Phase |",
    "| --- | --- |",
    ...workflows.map((workflow) => `| \`${workflow}\` | ${describeWorkflowPhase(workflow)} |`),
  ];
}

function deriveCurrentPhase(state: OrchestratorSessionState): string {
  const ordered = Object.keys(state.lifecycle) as VibeLifecycleStage[];
  const inProgress = ordered.find((stage) => state.lifecycle[stage].status === "in-progress");
  if (inProgress) return `${inProgress} in progress`;
  const pending = ordered.find((stage) => state.lifecycle[stage].taskIds.length > 0 && state.lifecycle[stage].status === "pending");
  if (pending) return `${pending} queued`;
  const blocked = ordered.find((stage) => state.lifecycle[stage].status === "blocked");
  if (blocked) return `${blocked} blocked`;
  return "all planned stages completed";
}

function renderProgressChecklist(state: OrchestratorSessionState): string[] {
  const initialized = state.tasks.length > 0;
  const genesisDone = state.lifecycle.genesis.status === "completed";
  const designDone = state.lifecycle.design.status === "completed";
  const buildDone = state.lifecycle.build.status === "completed";

  return [
    `- [${initialized ? "x" : " "}] Initialize orchestration session structure`,
    `- [${genesisDone ? "x" : " "}] Complete Genesis tasks`,
    `- [${genesisDone ? "x" : " "}] Review and approve Genesis outputs`,
    `- [${designDone ? "x" : " "}] Complete Design tasks`,
    `- [${designDone ? "x" : " "}] Review and approve Design outputs`,
    `- [${buildDone ? "x" : " "}] Complete Build tasks`,
    `- [${buildDone ? "x" : " "}] Complete verification and handoff`,
  ];
}

export function renderMasterPlan(sessionOrId: OrchestratorSessionState | string, title?: string, tasks?: OrchestratorTask[]): string {
  const state = typeof sessionOrId === "string"
    ? buildSessionState(sessionOrId, title ?? "Takomi Session", tasks ?? [])
    : normalizeSessionState(sessionOrId);

  const rows = state.tasks
    .map((task) => `| ${task.id} | ${task.title} | ${task.role} | \`${task.workflow ?? "-"}\` | ${formatCodeList(task.skills)} | ${formatTaskDependencies(task)} | ${task.status} |`)
    .join("\n");

  return [
    "<!-- takomi-generated-master-plan -->",
    "# Orchestrator Master Plan",
    "",
    "## Overview",
    "",
    `- Session ID: \`${state.sessionId}\``,
    `- Title: ${state.title}`,
    `- Runtime mode: ${state.mode}`,
    `- Session intent: ${state.sessionIntent ?? "full-project"}`,
    `- Current phase: ${deriveCurrentPhase(state)}`,
    "",
    "## Context Intake",
    "",
    "- Vision brief: not captured in machine state",
    "- Source of truth: current project docs, feature docs, and the approved session plan",
    "- Constraint summary: see task packets, feature blueprints, and lifecycle stage notes",
    "",
    "## Skills Registry",
    "",
    ...renderSkillRegistry(state.tasks),
    "",
    "## Workflows Registry",
    "",
    ...renderWorkflowRegistry(state.tasks),
    "",
    "## Task Table",
    "",
    "| # | Subtask | Mode | Workflow | Skills | Dependency | Status |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    rows || "| - | No tasks yet | - | - | - | - | - |",
    "",
    "## Progress Checklist",
    "",
    ...renderProgressChecklist(state),
    "",
    "## Notes",
    "",
    "- Human-readable task docs live in this session folder.",
    "- Machine state lives in `.pi/takomi/orchestrator/<sessionId>.json`.",
    "- Sessions follow the Genesis -> Design -> Build lifecycle, but each stage may stay compact or expand into more tasks.",
    "- Rich runtime metadata such as conversation continuity, model overrides, and execution hints remains in JSON rather than cluttering the markdown surface.",
  ].join("\n");
}

export function renderTaskFile(task: OrchestratorTask, context?: string): string {
  const skillLines = task.skills?.length
    ? [
        "| Skill | Why |",
        "| --- | --- |",
        ...task.skills.map((skill) => `| \`${skill}\` | Optional overlay for this task; use it only if installed and genuinely helpful |`),
      ]
    : ["No explicit skill/context overlays are required for this task; rely on the harness defaults and repo source of truth."];

  return [
    `# Task ${task.id}: ${task.title}`,
    "",
    "## 🔧 Agent Setup (DO THIS FIRST)",
    "",
    "### Workflow to Follow",
    "",
    task.workflow
      ? `Read the \`${task.workflow}\` workflow before starting this task.`
      : "Read the relevant assigned workflow before starting this task.",
    "",
    "### Prime Agent Context",
    "",
    "Prime the task with the current session plan, related feature docs, and the context below before taking action.",
    "",
    "### Optional Skill / Context Overlays",
    "",
    ...skillLines,
    "",
    "## Objective",
    "",
    task.objective ?? task.title,
    "",
    "## Scope",
    "",
    ...renderBullets(task.scope),
    "",
    "## Context",
    "",
    context ?? "Add task-specific context here.",
    "",
    "## Definition Of Done",
    "",
    ...renderBullets(task.definitionOfDone),
    "",
    "## Expected Artifacts",
    "",
    ...renderBullets(task.expectedArtifacts),
    "",
    "## Dependencies",
    "",
    ...renderBullets(task.dependencies, "- none"),
    "",
    "## Constraints",
    "",
    ...renderBullets(task.instructions ?? [
      "Complete the task within scope.",
      "Use the assigned workflow and any listed skill/context overlays when they are available; otherwise rely on the harness defaults and repo source of truth.",
      "Report blockers clearly.",
      "Summarize what changed and what remains.",
    ]),
    task.notes ? "" : "",
    task.notes ? "## Notes" : "",
    task.notes ? "" : "",
    task.notes ?? "",
  ].filter(Boolean).join("\n");
}

export function buildSessionState(
  sessionId: string,
  title: string,
  tasks: OrchestratorTask[],
  now = new Date(),
  extras?: Partial<Pick<OrchestratorSessionState, "sessionIntent" | "lifecycle" | "artifacts">>,
): OrchestratorSessionState {
  const stamp = now.toISOString();
  const normalizedTasks = tasks.map((task) => {
    const role = canonicalizeTakomiPersona(task.role as TakomiPersona | LegacyTakomiRole);
    return { ...task, role, preferredAgent: task.preferredAgent ?? role, stage: task.stage ?? workflowToStage(task.workflow) ?? defaultStageForRole(role) };
  });
  return {
    sessionId,
    title,
    createdAt: stamp,
    updatedAt: stamp,
    mode: "hybrid",
    lifecycle: deriveLifecycleFromTasks(normalizedTasks, extras?.lifecycle),
    sessionIntent: extras?.sessionIntent ?? "full-project",
    artifacts: extras?.artifacts,
    tasks: normalizedTasks,
  };
}

export function normalizeSessionState(
  session: Partial<OrchestratorSessionState> & Pick<OrchestratorSessionState, "sessionId" | "title">,
): OrchestratorSessionState {
  const tasks = (session.tasks ?? []).map((task) => {
    const role = canonicalizeTakomiPersona(task.role as TakomiPersona | LegacyTakomiRole);
    return { ...task, role, preferredAgent: task.preferredAgent ?? role, stage: task.stage ?? workflowToStage(task.workflow) ?? defaultStageForRole(role) };
  });
  const normalized = buildSessionState(
    session.sessionId,
    session.title,
    tasks,
    session.updatedAt ? new Date(session.updatedAt) : new Date(),
    {
      sessionIntent: session.sessionIntent ?? "full-project",
      lifecycle: session.lifecycle,
      artifacts: session.artifacts,
    },
  );

  return {
    ...normalized,
    createdAt: session.createdAt ?? normalized.createdAt,
    updatedAt: session.updatedAt ?? normalized.updatedAt,
    mode: "hybrid",
    artifacts: session.artifacts ?? normalized.artifacts,
  };
}

export function markStageExpanded(
  state: OrchestratorSessionState,
  stage: VibeLifecycleStage,
  notes?: string,
  now = new Date(),
): OrchestratorSessionState {
  const lifecycle = {
    ...state.lifecycle,
    [stage]: {
      ...state.lifecycle[stage],
      expandedAt: now.toISOString(),
      notes: notes ?? state.lifecycle[stage].notes,
    },
  };
  return normalizeSessionState({
    ...state,
    updatedAt: now.toISOString(),
    lifecycle,
  });
}

export function createLifecycleStarterSession(
  title: string,
  options?: { sessionId?: string; now?: Date; sessionIntent?: SessionIntent },
): OrchestratorSessionState {
  const sessionId = options?.sessionId ?? createSessionId(options?.now);
  const tasks = [
    createTask("01", "Genesis foundation", "architect", {
      stage: "genesis",
      workflow: "vibe-genesis",
      preferredAgent: "architect",
      objective: "Establish the project foundation, produce the required planning docs, and decide what should split next.",
      scope: [
        "Clarify scope and mission",
        "Create or update the core markdown artifacts",
        "Lock acceptance criteria and boundaries",
        "Recommend whether Design and Build should stay compact or expand",
      ],
      checklist: [
        { text: "Create or update requirements docs" },
        { text: "Capture acceptance criteria" },
        { text: "Define boundaries and non-goals" },
        { text: "Recommend next-stage task breakdown" },
      ],
      definitionOfDone: [
        "Required planning markdown files exist or are updated",
        "Minimum usable state is explicit",
        "Genesis recommends the correct next Design and Build structure",
      ],
      expectedArtifacts: [
        "Requirements and feature docs",
        "Genesis brief",
        "Recommended task breakdown for later stages",
      ],
      reviewCheckpoint: "User or orchestrator approves the foundation before expanding later stages.",
      instructions: [
        "treat this as the root task for the whole Genesis -> Design -> Build lifecycle",
        "create the required markdown artifacts before implementation begins",
        "split later-stage work only when the scope justifies it",
        "leave a clear recommendation for how Design and Build should fan out",
      ],
    }),
  ];

  return buildSessionState(sessionId, title, tasks, options?.now, {
    sessionIntent: options?.sessionIntent ?? "full-project",
  });
}

export function serializeSessionState(state: OrchestratorSessionState): string {
  return `${JSON.stringify(normalizeSessionState(state), null, 2)}\n`;
}
