import {
  getWorkflowDefinition,
  listWorkflowCatalog,
  type TakomiWorkflowId,
  type WorkflowCatalogEntry,
  type WorkflowDefinition,
} from "../../../src/pi-takomi-core";

type WorkflowCatalogPayload = {
  content: Array<{ type: "text"; text: string }>;
  details: { workflows: readonly WorkflowCatalogEntry[] };
};

type WorkflowPlaybookPayload = {
  content: Array<{ type: "text"; text: string }>;
  details: WorkflowDefinition & { workflows: readonly WorkflowCatalogEntry[] };
};

function formatCatalogEntry(workflow: WorkflowCatalogEntry): string {
  return `${workflow.id} (${workflow.stage}) — ${workflow.name}: ${workflow.description} [${workflow.availability}]`;
}

/** Discovery/load adapter for the direct workflow API. */
export function discoverWorkflowPlaybooks(workflowId?: TakomiWorkflowId): WorkflowPlaybookPayload | WorkflowCatalogPayload {
  if (workflowId) {
    const workflow = getWorkflowDefinition(workflowId);
    return {
      content: [{ type: "text", text: `${workflow.title}\n\n${workflow.playbook}` }],
      details: { ...workflow, workflows: listWorkflowCatalog() },
    };
  }

  const workflows = listWorkflowCatalog();
  return {
    content: [{ type: "text", text: workflows.map(formatCatalogEntry).join("\n") }],
    details: { workflows },
  };
}

/** Lifecycle-board adapter; intentionally catalog-oriented and playbook-free. */
export function showWorkflowCatalogForBoard(): WorkflowCatalogPayload {
  const workflows = listWorkflowCatalog();
  return {
    content: [{
      type: "text",
      text: [
        "Takomi lifecycle workflow catalog",
        "",
        ...workflows.map((workflow) => `- ${formatCatalogEntry(workflow)}`),
      ].join("\n"),
    }],
    details: { workflows },
  };
}
