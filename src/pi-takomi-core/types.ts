export type TakomiPersona = "orchestrator" | "architect" | "designer" | "coder" | "worker" | "reviewer";

/** @deprecated Runtime and persisted tasks should use TakomiPersona names. */
export type LegacyTakomiRole = "general" | "design" | "code" | "review";

export type TakomiRole = TakomiPersona | "general";

export type TakomiMainMode = "idle" | "code" | "review" | "orchestrate";

export type TakomiWorkflowId = "vibe-genesis" | "vibe-design" | "vibe-build";

export type VibeLifecycleStage = "genesis" | "design" | "build";

export type TakomiThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type TakomiDispatchPolicy = "direct" | "subagent" | "review-first";

export type TakomiLaunchMode = "auto" | "manual";

export type TakomiRunPlacement = "foreground" | "background";

export type TakomiAgentScope = "user" | "project" | "both";

export type TakomiSubagentMode = "single" | "parallel" | "chain";

export type TakomiDispatchDefaults = {
  agent?: string;
  model?: string;
  fallbackModels?: string[];
  thinking?: TakomiThinkingLevel;
  dispatchPolicy?: TakomiDispatchPolicy;
};

export type TakomiReviewProfile = {
  enabled: boolean;
  agent?: string;
  maxIterations?: number;
  sameConversation: boolean;
};

export type TakomiProfile = {
  version: 1;
  autoOrchestrate: boolean;
  launchMode?: TakomiLaunchMode;
  foreground?: boolean;
  background?: boolean;
  reviewAfterImplementation?: boolean;
  roles?: Partial<Record<TakomiPersona, TakomiDispatchDefaults>>;
  stages?: Partial<Record<VibeLifecycleStage, TakomiDispatchDefaults>>;
  review?: TakomiReviewProfile;
};

export type TakomiDelegationPlanTaskStatus = "planned" | "running" | "completed" | "blocked" | "cancelled";

export type TakomiDelegationPlanTask = {
  id: string;
  title: string;
  agent: string;
  task: string;
  role?: TakomiRole;
  stage?: VibeLifecycleStage;
  workflow?: TakomiWorkflowId | string;
  model?: string;
  fallbackModels?: string[];
  thinking?: TakomiThinkingLevel;
  conversationId?: string;
  checklist?: TaskChecklistItem[];
  dispatchPolicy?: TakomiDispatchPolicy;
  review: boolean;
  status: TakomiDelegationPlanTaskStatus;
};

export type TakomiDelegationPlan = {
  planId: string;
  source: "runtime-board" | "takomi-tool";
  launchMode: TakomiLaunchMode;
  placement: TakomiRunPlacement;
  reviewAfterImplementation: boolean;
  createdAt: string;
  sessionId?: string;
  tasks: TakomiDelegationPlanTask[];
};

export type TakomiSubagentTask = {
  agent: string;
  task: string;
  cwd?: string;
  workflow?: string;
  skills?: string[];
  model?: string;
  fallbackModels?: string[];
  thinking?: TakomiThinkingLevel;
  conversationId?: string;
  checklist?: TaskChecklistItem[];
};

export type TakomiSubagentRunGroup = {
  mode: TakomiSubagentMode;
  agentScope: TakomiAgentScope;
  tasks: TakomiSubagentTask[];
  confirmProjectAgents: boolean;
  launchMode: TakomiLaunchMode;
  sessionId?: string;
};

export type WorkflowAvailability = "embedded";

export type WorkflowCatalogEntry = {
  id: TakomiWorkflowId;
  stage: VibeLifecycleStage;
  name: string;
  description: string;
  availability: WorkflowAvailability;
};

export type WorkflowDefinition = {
  id: TakomiWorkflowId;
  stage: VibeLifecycleStage;
  title: string;
  purpose: string;
  preferredRole: TakomiPersona;
  preferredAgent?: string;
  preferredModelHint?: string;
  nextStage?: VibeLifecycleStage;
  playbook: string;
};

export type RouteDecision = {
  role: TakomiPersona;
  workflow?: TakomiWorkflowId;
  stage?: VibeLifecycleStage;
  executionMode: "direct" | "orchestrate";
  sessionRecommendation: "none" | "consider" | "create";
  reason: string;
};

export type OrchestratorTaskStatus = "pending" | "in-progress" | "completed" | "blocked";

export type TaskChecklistItem = {
  text: string;
  done?: boolean;
};

export type OrchestratorTask = {
  id: string;
  title: string;
  role: TakomiPersona;
  stage?: VibeLifecycleStage;
  workflow?: TakomiWorkflowId;
  parentTaskId?: string;
  preferredAgent?: string;
  preferredModelHint?: string;
  preferredModel?: string;
  preferredModelConfirmed?: boolean;
  preferredThinking?: TakomiThinkingLevel;
  fallbackModels?: string[];
  dispatchPolicy?: TakomiDispatchPolicy;
  skills?: string[];
  checklist?: TaskChecklistItem[];
  objective?: string;
  scope?: string[];
  definitionOfDone?: string[];
  expectedArtifacts?: string[];
  requiredCapabilities?: string[];
  dependencies?: string[];
  reviewCheckpoint?: string;
  instructions?: string[];
  status: OrchestratorTaskStatus;
  notes?: string;
  conversationId?: string;
};

export type LifecycleStageState = {
  status: OrchestratorTaskStatus;
  taskIds: string[];
  canExpand?: boolean;
  expandedAt?: string;
  notes?: string;
};

export type SessionIntent = "full-project" | "feature-scope" | "follow-up-task";

export type MasterPlanOwner = "human" | "board" | "caller";

export type MasterPlanArtifactProvenance = {
  owner: MasterPlanOwner;
  sha256: string;
  lastSeenAt: string;
};

export type OrchestratorSessionState = {
  sessionId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  mode: "hybrid";
  lifecycle: Record<VibeLifecycleStage, LifecycleStageState>;
  sessionIntent?: SessionIntent;
  artifacts?: {
    masterPlan?: MasterPlanArtifactProvenance;
  };
  tasks: OrchestratorTask[];
};
