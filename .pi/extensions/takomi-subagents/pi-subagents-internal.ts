// Centralizes Takomi's current pi-subagents internal imports.
// pi-subagents ships TS internals rather than a stable public JS API. Import them
// dynamically with computed specifiers so Takomi's own tsc does not type-check
// dependency source, while Pi's runtime TS loader can still load them.
// Do not hide import() inside Function/eval: Pi's extension VM does not provide
// a dynamic import callback for that path and fails with
// "A dynamic import callback was not specified."

const dynamicImport = async <T = any>(specifier: string): Promise<T> => import(specifier) as Promise<T>;
const spec = (path: string) => `pi-subagents/${path}.ts`;

let cachedInternals: any | null = null;

export async function loadPiSubagentsInternals() {
  if (cachedInternals) return cachedInternals;

  const [executorModule, agentsModule, sharedTypesModule, renderModule] = await Promise.all([
    dynamicImport(spec("src/runs/foreground/subagent-executor")),
    dynamicImport(spec("src/agents/agents")),
    dynamicImport(spec("src/shared/types")),
    dynamicImport(spec("src/tui/render")),
  ]);

  cachedInternals = {
    createSubagentExecutor: executorModule.createSubagentExecutor,
    discoverPiAgents: agentsModule.discoverAgents,
    DEFAULT_ARTIFACT_CONFIG: sharedTypesModule.DEFAULT_ARTIFACT_CONFIG,
    ASYNC_DIR: sharedTypesModule.ASYNC_DIR,
    RESULTS_DIR: sharedTypesModule.RESULTS_DIR,
    TEMP_ARTIFACTS_DIR: sharedTypesModule.TEMP_ARTIFACTS_DIR,
    renderSubagentResult: renderModule.renderSubagentResult,
  };
  return cachedInternals;
}

export function renderNativeSubagentResult(result: unknown, options: unknown, theme: unknown, frame?: number): unknown | undefined {
  if (!cachedInternals?.renderSubagentResult) return undefined;
  return cachedInternals.renderSubagentResult(result, options, theme, frame);
}

export type SubagentParamsLike = any;
export type AgentConfig = any;
export type AgentScope = "user" | "project" | "both";
export type Details = any;
export type ExtensionConfig = any;
export type SubagentState = any;
