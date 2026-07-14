import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadPiSubagentsInternals, type SubagentState } from "./pi-subagents-internal";

const NATIVE_RUNTIME_CLEANUP_KEY = "__piSubagentRuntimeCleanup";
const TAKOMI_RUNTIME_CLEANUP_KEY = "__takomiPiSubagentRuntimeCleanup";
const LIFECYCLE_GENERATION_KEY = "__takomiPiSubagentLifecycleGeneration";
const STARTED_EVENT = "subagent:async-started";
const COMPLETE_EVENT = "subagent:async-complete";
const COMPLETION_TTL_MS = 10 * 60 * 1000;
export const TAKOMI_ASYNC_WIDGET_HEARTBEAT_MS = 125;

type LifecycleOwnership = "takomi" | "native";

export type TakomiAsyncLifecycleSnapshot = {
  state: SubagentState;
  generation: number;
  ownership: LifecycleOwnership;
};

type LifecycleRecord = TakomiAsyncLifecycleSnapshot & {
  internals: any;
  nativeCleanupIdentity?: () => void;
  animationFrame: number;
  animationTimer: ReturnType<typeof setInterval> | null;
  activate: (ctx: ExtensionContext) => void;
  prime: () => void;
  cleanup: () => void;
};

const lifecycles = new WeakMap<ExtensionAPI, LifecycleRecord>();
const lifecycleCreations = new WeakMap<ExtensionAPI, Promise<LifecycleRecord>>();

function nextGeneration(globalStore: Record<string, unknown>): number {
  const previous = typeof globalStore[LIFECYCLE_GENERATION_KEY] === "number"
    ? globalStore[LIFECYCLE_GENERATION_KEY] as number
    : 0;
  const generation = previous + 1;
  globalStore[LIFECYCLE_GENERATION_KEY] = generation;
  return generation;
}

function createState(): SubagentState {
  return {
    // Match native startup isolation: do not claim cwd-only result files until
    // a real Pi session context has activated this lifecycle.
    baseCwd: "",
    currentSessionId: null,
    subagentInProgress: false,
    asyncJobs: new Map(),
    foregroundRuns: new Map(),
    foregroundControls: new Map(),
    lastForegroundControlId: null,
    pendingForegroundControlNotices: new Map(),
    cleanupTimers: new Map(),
    lastUiContext: null,
    poller: null,
    completionSeen: new Map(),
    watcher: null,
    watcherRestartTimer: null,
    resultFileCoalescer: { schedule: () => false, clear: () => {} },
  };
}

function isStaleExtensionContextError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("Extension context no longer active");
}

function renderedJobs(record: LifecycleRecord): any[] {
  return Array.from(record.state.asyncJobs.values()).map((job: any) => {
    if (job.status !== "running") return job;
    // pi-subagents@0.31.0 derives native widget spinner glyphs from status
    // timestamps and snapshots the widget component at setWidget(). Give the
    // renderer a frame-adjusted copy so animation never mutates lifecycle data.
    return { ...job, updatedAt: (job.updatedAt ?? 0) + record.animationFrame };
  });
}

function stopAnimationHeartbeat(record: LifecycleRecord): void {
  if (!record.animationTimer) return;
  clearInterval(record.animationTimer);
  record.animationTimer = null;
}

function renderJobs(record: LifecycleRecord): boolean {
  const ctx = record.state.lastUiContext;
  if (!ctx) return false;
  try {
    record.internals.renderWidget(ctx, renderedJobs(record));
    ctx.ui.requestRender?.();
    return true;
  } catch (error) {
    if (!isStaleExtensionContextError(error)) throw error;
    return false;
  }
}

function syncAnimationHeartbeat(record: LifecycleRecord): void {
  if (record.state.asyncJobs.size === 0) {
    stopAnimationHeartbeat(record);
    record.animationFrame = 0;
    return;
  }
  if (record.animationTimer || !record.state.lastUiContext?.hasUI) return;
  record.animationTimer = setInterval(() => {
    if (record.state.asyncJobs.size === 0) {
      stopAnimationHeartbeat(record);
      return;
    }
    record.animationFrame = (record.animationFrame + 1) % 10;
    if (!renderJobs(record)) stopAnimationHeartbeat(record);
  }, TAKOMI_ASYNC_WIDGET_HEARTBEAT_MS);
  record.animationTimer.unref?.();
}

function clearWidget(record: LifecycleRecord): void {
  if (record.ownership !== "takomi") return;
  const ctx = record.state.lastUiContext;
  if (!ctx?.hasUI) return;
  try {
    ctx.ui.setWidget(record.internals.WIDGET_KEY, undefined);
    ctx.ui.requestRender?.();
  } catch (error) {
    if (!isStaleExtensionContextError(error)) throw error;
  }
}

function clearState(record: LifecycleRecord): void {
  stopAnimationHeartbeat(record);
  record.animationFrame = 0;
  for (const timer of record.state.cleanupTimers.values()) clearTimeout(timer);
  record.state.cleanupTimers.clear();
  for (const timer of record.state.pendingForegroundControlNotices?.values() ?? []) clearTimeout(timer);
  record.state.pendingForegroundControlNotices?.clear();
  if (record.state.poller) clearInterval(record.state.poller);
  record.state.poller = null;
  record.state.asyncJobs.clear();
  record.state.foregroundRuns?.clear();
  record.state.foregroundControls.clear();
  record.state.completionSeen.clear();
  record.state.resultFileCoalescer.clear();
  record.state.lastForegroundControlId = null;
  record.state.currentSessionId = null;
  record.state.baseCwd = "";
  record.state.lastUiContext = null;
}

function lifecycleMatchesNativeSlot(record: LifecycleRecord, nativeSlot: unknown): boolean {
  return record.ownership === "takomi"
    ? nativeSlot === record.cleanup
    : nativeSlot === record.nativeCleanupIdentity;
}

async function createLifecycleRecord(pi: ExtensionAPI): Promise<LifecycleRecord> {
  const internals = await loadPiSubagentsInternals();
  // Ownership must be sampled after the only asynchronous initialization step;
  // otherwise standalone can take over while internals load and Takomi would
  // incorrectly start a second watcher from the stale pre-await snapshot.
  const globalStore = globalThis as Record<string, unknown>;
  const nativeCleanup = globalStore[NATIVE_RUNTIME_CLEANUP_KEY];
  const ownership: LifecycleOwnership = typeof nativeCleanup === "function" ? "native" : "takomi";
  const state = createState();
  const watcher = ownership === "takomi"
    ? internals.createResultWatcher(pi, state, internals.RESULTS_DIR, COMPLETION_TTL_MS)
    : undefined;

  if (ownership === "takomi") {
    fs.mkdirSync(internals.RESULTS_DIR, { recursive: true });
    fs.mkdirSync(internals.ASYNC_DIR, { recursive: true });
    watcher.startResultWatcher();
    watcher.primeExistingResults();
  }

  const record = {
    state,
    internals,
    generation: nextGeneration(globalStore),
    ownership,
    ...(ownership === "native" ? { nativeCleanupIdentity: nativeCleanup as () => void } : {}),
    animationFrame: 0,
    animationTimer: null,
    activate(ctx: ExtensionContext) {
      state.baseCwd = ctx.cwd;
      state.currentSessionId = internals.resolveCurrentSessionId(ctx.sessionManager);
      state.lastUiContext = ctx;
    },
    prime: () => watcher?.primeExistingResults(),
    cleanup: () => {},
  } as LifecycleRecord;

  const handleStarted = (payload: unknown) => {
    const info = payload as Record<string, any>;
    if (typeof info.id !== "string" || !info.id) return;
    const now = Date.now();
    const agents = Array.isArray(info.agents) && info.agents.length
      ? info.agents
      : Array.isArray(info.chain) && info.chain.length ? info.chain : info.agent ? [info.agent] : undefined;
    const parallelGroups = Array.isArray(info.parallelGroups) ? info.parallelGroups : [];
    const firstParallelGroup = parallelGroups.find((group: any) => group?.start === 0);
    const runningStepCount = Math.min(
      agents?.length ?? 0,
      typeof firstParallelGroup?.count === "number" && firstParallelGroup.count > 0 ? firstParallelGroup.count : 1,
    );
    const steps = agents?.map((agent: string, index: number) => ({
      agent,
      index,
      status: index < runningStepCount ? "running" : "pending",
      startedAt: index < runningStepCount ? now : undefined,
    }));
    // The background process has detached. Do not leave the foreground/global
    // single-dispatch guard asserted while its independent widget is active.
    state.subagentInProgress = false;
    state.asyncJobs.set(info.id, {
      asyncId: info.id,
      asyncDir: typeof info.asyncDir === "string" ? info.asyncDir : path.join(internals.ASYNC_DIR, info.id),
      // Native emits async-started only after the background process has spawned.
      status: "running",
      pid: typeof info.pid === "number" ? info.pid : undefined,
      sessionId: typeof info.sessionId === "string" ? info.sessionId : undefined,
      mode: info.mode ?? (info.chain ? "chain" : "single"),
      agents,
      chainStepCount: info.chainStepCount,
      parallelGroups,
      nestedRoute: info.nestedRoute,
      steps,
      stepsTotal: agents?.length,
      runningSteps: runningStepCount,
      completedSteps: 0,
      currentStep: 0,
      hasParallelGroups: parallelGroups.length > 0,
      activeParallelGroup: runningStepCount > 1,
      startedAt: now,
      updatedAt: now,
      controlEventCursor: 0,
    });
    renderJobs(record);
    syncAnimationHeartbeat(record);
  };
  const handleComplete = (payload: unknown) => {
    const result = payload as { id?: unknown; runId?: unknown };
    const id = typeof result.id === "string" ? result.id : typeof result.runId === "string" ? result.runId : undefined;
    if (!id) return;
    state.asyncJobs.delete(id);
    syncAnimationHeartbeat(record);
    renderJobs(record);
  };
  const eventUnsubscribes = [
    pi.events.on(STARTED_EVENT, handleStarted),
    pi.events.on(COMPLETE_EVENT, handleComplete),
  ];

  let active = true;
  record.cleanup = () => {
    if (!active) return;
    active = false;
    for (const unsubscribe of eventUnsubscribes) {
      try { unsubscribe(); } catch {}
    }
    watcher?.stopResultWatcher();
    clearWidget(record);
    clearState(record);
    if (lifecycles.get(pi) === record) lifecycles.delete(pi);
    if (globalStore[NATIVE_RUNTIME_CLEANUP_KEY] === record.cleanup) delete globalStore[NATIVE_RUNTIME_CLEANUP_KEY];
    if (globalStore[TAKOMI_RUNTIME_CLEANUP_KEY] === record.cleanup) delete globalStore[TAKOMI_RUNTIME_CLEANUP_KEY];
  };

  lifecycles.set(pi, record);
  if (ownership === "takomi") globalStore[NATIVE_RUNTIME_CLEANUP_KEY] = record.cleanup;
  globalStore[TAKOMI_RUNTIME_CLEANUP_KEY] = record.cleanup;
  return record;
}

function getOrCreateLifecycleRecord(pi: ExtensionAPI): Promise<LifecycleRecord> {
  const existing = lifecycleCreations.get(pi);
  if (existing) return existing;
  const creation = createLifecycleRecord(pi);
  lifecycleCreations.set(pi, creation);
  void creation.then(
    () => { if (lifecycleCreations.get(pi) === creation) lifecycleCreations.delete(pi); },
    () => { if (lifecycleCreations.get(pi) === creation) lifecycleCreations.delete(pi); },
  );
  return creation;
}

/**
 * Ensure Takomi always has its own executor state. When standalone pi-subagents
 * owns the native watcher, this record only subscribes to events and tracks
 * state. Rendering reuses the native WIDGET_KEY, so post-spawn running state
 * replaces (rather than duplicates) the standalone queued surface.
 */
export async function ensureTakomiAsyncLifecycle(
  pi: ExtensionAPI,
  ctx?: ExtensionContext,
): Promise<TakomiAsyncLifecycleSnapshot> {
  const globalStore = globalThis as Record<string, unknown>;
  for (;;) {
    let record = lifecycles.get(pi);
    if (record && !lifecycleMatchesNativeSlot(record, globalStore[NATIVE_RUNTIME_CLEANUP_KEY])) {
      record.cleanup();
      record = undefined;
    }
    if (!record) record = await getOrCreateLifecycleRecord(pi);
    // Revalidate after awaiting shared initialization so a native takeover queued
    // in the same turn cannot expose a just-disposed state to an executor.
    if (!lifecycleMatchesNativeSlot(record, globalStore[NATIVE_RUNTIME_CLEANUP_KEY])) {
      record.cleanup();
      continue;
    }
    if (ctx) record.activate(ctx);
    return { state: record.state, generation: record.generation, ownership: record.ownership };
  }
}

export async function initializeTakomiAsyncLifecycle(pi: ExtensionAPI): Promise<() => void> {
  const globalStore = globalThis as Record<string, unknown>;
  const staleTakomiCleanup = globalStore[TAKOMI_RUNTIME_CLEANUP_KEY];
  if (typeof staleTakomiCleanup === "function") {
    try { staleTakomiCleanup(); } catch {}
  }
  await ensureTakomiAsyncLifecycle(pi);
  // Resolve the current record at cleanup time: native takeover can replace the
  // record after registration, and shutdown must not leave that replacement live.
  return () => cleanupTakomiAsyncLifecycle(pi);
}

export function cleanupTakomiAsyncLifecycle(pi: ExtensionAPI): void {
  lifecycles.get(pi)?.cleanup();
}

export async function resetTakomiAsyncLifecycle(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  const snapshot = await ensureTakomiAsyncLifecycle(pi, ctx);
  const record = lifecycles.get(pi);
  if (!record || record.state !== snapshot.state) return;
  record.state.resultFileCoalescer.clear();
  record.state.asyncJobs.clear();
  syncAnimationHeartbeat(record);
  clearWidget(record);
  record.prime();
}

export function getTakomiAsyncLifecycleSnapshot(pi: ExtensionAPI): TakomiAsyncLifecycleSnapshot | undefined {
  const record = lifecycles.get(pi);
  if (!record) return undefined;
  return { state: record.state, generation: record.generation, ownership: record.ownership };
}

export function getTakomiAsyncLifecycleState(pi: ExtensionAPI): SubagentState | undefined {
  return lifecycles.get(pi)?.state;
}
