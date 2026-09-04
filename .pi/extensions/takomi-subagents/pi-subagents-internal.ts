// Centralizes Takomi's current pi-subagents internal imports.
// pi-subagents ships TS internals rather than a stable public JS API. Import them
// dynamically with computed specifiers so Takomi's own tsc does not type-check
// dependency source, while Pi's runtime TS loader can still load them.
// Do not hide import() inside Function/eval: Pi's extension VM does not provide
// a dynamic import callback for that path and fails with
// "A dynamic import callback was not specified."

const dynamicImport = async <T = any>(specifier: string): Promise<T> => import(specifier) as Promise<T>;
const spec = (path: string) => `pi-subagents/${path}.ts`;

function requireExports(moduleName: string, module: Record<string, unknown>, names: readonly string[]): void {
  const missing = names.filter((name) => module[name] === undefined);
  if (missing.length > 0) {
    throw new Error(
      `Unsupported pi-subagents private API in ${moduleName}: missing ${missing.join(", ")}. ` +
        "Run the Takomi compatibility check before starting Pi.",
    );
  }
}

let cachedInternals: any | null = null;

export async function loadPiSubagentsInternals() {
  if (cachedInternals) return cachedInternals;

  const [executorModule, agentsModule, sharedTypesModule, renderModule, watcherModule, sessionModule] = await Promise.all([
    dynamicImport<Record<string, unknown>>(spec("src/runs/foreground/subagent-executor")),
    dynamicImport<Record<string, unknown>>(spec("src/agents/agents")),
    dynamicImport<Record<string, unknown>>(spec("src/shared/types")),
    dynamicImport<Record<string, unknown>>(spec("src/tui/render")),
    dynamicImport<Record<string, unknown>>(spec("src/runs/background/result-watcher")),
    dynamicImport<Record<string, unknown>>(spec("src/shared/session-identity")),
  ]);

  requireExports("subagent-executor", executorModule, ["createSubagentExecutor"]);
  requireExports("agents", agentsModule, ["discoverAgents"]);
  requireExports("types", sharedTypesModule, [
    "DEFAULT_ARTIFACT_CONFIG",
    "ASYNC_DIR",
    "RESULTS_DIR",
    "TEMP_ARTIFACTS_DIR",
    "WIDGET_KEY",
  ]);
  requireExports("render", renderModule, ["renderSubagentResult", "renderWidget"]);
  requireExports("result-watcher", watcherModule, ["createResultWatcher"]);
  requireExports("session-identity", sessionModule, ["resolveCurrentSessionId"]);

  cachedInternals = {
    createSubagentExecutor: executorModule.createSubagentExecutor,
    createResultWatcher: watcherModule.createResultWatcher,
    discoverPiAgents: agentsModule.discoverAgents,
    resolveCurrentSessionId: sessionModule.resolveCurrentSessionId,
    DEFAULT_ARTIFACT_CONFIG: sharedTypesModule.DEFAULT_ARTIFACT_CONFIG,
    ASYNC_DIR: sharedTypesModule.ASYNC_DIR,
    RESULTS_DIR: sharedTypesModule.RESULTS_DIR,
    TEMP_ARTIFACTS_DIR: sharedTypesModule.TEMP_ARTIFACTS_DIR,
    WIDGET_KEY: sharedTypesModule.WIDGET_KEY,
    renderSubagentResult: renderModule.renderSubagentResult,
    renderWidget: renderModule.renderWidget,
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
