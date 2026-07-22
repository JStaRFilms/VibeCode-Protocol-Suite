import type { TakomiWorkflowId, WorkflowCatalogEntry, WorkflowDefinition } from "./types";

const VIBE_GENESIS_PLAYBOOK = `Genesis fallback summary: author the project foundation in markdown, with PRD, FR issues, coding guidelines, architecture decisions, data models, API contracts, implementation strategy, and a clean handoff. For broad projects, Genesis may also create the orchestration session that carries the work into UI/UX Design and Build. The runtime should prefer .pi/prompts/genesis-prompt.md; this string exists only as a compatibility fallback.`;
const VIBE_DESIGN_PLAYBOOK = `Design fallback summary: define UI/UX only: visual system, user journeys, interaction flows, mockups, accessibility expectations, and frontend builder constraints in markdown. Technical architecture, data models, and API contracts belong in Genesis or Architect planning. The runtime should prefer .pi/prompts/design-prompt.md; this string exists only as a compatibility fallback.`;
const VIBE_BUILD_PLAYBOOK = `Build fallback summary: implement the approved plan with FR-driven work, strict verification, mockup adherence, and explicit handoff reporting. The runtime should prefer .pi/prompts/build-prompt.md; this string exists only as a compatibility fallback.`;

/**
 * Canonical model-facing lifecycle metadata. Runtime tools may frame this
 * catalog differently, but must not maintain their own workflow wording.
 */
export const WORKFLOW_CATALOG: readonly WorkflowCatalogEntry[] = [
  {
    id: "vibe-genesis",
    stage: "genesis",
    name: "Vibe Genesis",
    description: "Initialize a project with markdown blueprints, technical planning, and a clean handoff into UI/UX Design or Build. See .pi/prompts/genesis-prompt.md for the canonical behavior.",
    availability: "embedded",
  },
  {
    id: "vibe-design",
    stage: "design",
    name: "Vibe Design",
    description: "Define UI/UX only: visual system, user journeys, interaction flows, mockups, accessibility expectations, and frontend builder constraints before implementation begins. See .pi/prompts/design-prompt.md for the canonical behavior.",
    availability: "embedded",
  },
  {
    id: "vibe-build",
    stage: "build",
    name: "Vibe Build",
    description: "Execute the approved plan with FR-based implementation, strict verification, mockup adherence, and explicit handoff reporting. See .pi/prompts/build-prompt.md for the canonical behavior.",
    availability: "embedded",
  },
] as const;

const WORKFLOW_IMPLEMENTATIONS: Record<TakomiWorkflowId, Omit<WorkflowDefinition, "id" | "stage" | "title" | "purpose">> = {
  "vibe-genesis": {
    preferredRole: "architect",
    preferredAgent: "architect",
    nextStage: "design",
    playbook: VIBE_GENESIS_PLAYBOOK,
  },
  "vibe-design": {
    preferredRole: "designer",
    preferredAgent: "designer",
    preferredModelHint: "Prefer Gemini 3.1 Pro Preview or another strong design-capable model actually available in Pi.",
    nextStage: "build",
    playbook: VIBE_DESIGN_PLAYBOOK,
  },
  "vibe-build": {
    preferredRole: "coder",
    preferredAgent: "coder",
    playbook: VIBE_BUILD_PLAYBOOK,
  },
};

export const WORKFLOWS: Record<TakomiWorkflowId, WorkflowDefinition> = Object.fromEntries(
  WORKFLOW_CATALOG.map((workflow) => [
    workflow.id,
    {
      ...WORKFLOW_IMPLEMENTATIONS[workflow.id],
      id: workflow.id,
      stage: workflow.stage,
      title: workflow.name,
      purpose: workflow.description,
    },
  ]),
) as Record<TakomiWorkflowId, WorkflowDefinition>;

export function listWorkflowCatalog(): readonly WorkflowCatalogEntry[] {
  return WORKFLOW_CATALOG;
}

export function listWorkflowDefinitions(): WorkflowDefinition[] {
  return Object.values(WORKFLOWS);
}

export function getWorkflowCatalogEntry(id: TakomiWorkflowId): WorkflowCatalogEntry {
  const workflow = WORKFLOW_CATALOG.find((entry) => entry.id === id);
  if (!workflow) throw new Error(`Unknown Takomi workflow: ${id}`);
  return workflow;
}

/** Loads the direct-playbook payload for takomi_workflow without board framing. */
export function getWorkflowDefinition(id: TakomiWorkflowId): WorkflowDefinition {
  return WORKFLOWS[id];
}
