import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TakomiSubagentToolParams } from "./tool-runner";
import { loadPiSubagentsInternals } from "./pi-subagents-internal";
import {
  finalAnswer,
  resolvedChecklist,
  sanitizeUntrustedText,
  sanitizeUntrustedValue,
  type TakomiUxTask,
  withTakomiUxDetails,
} from "./subagent-ux";

const SESSION_ENTRY_TYPE = "takomi-detached-launch";
const SESSION_ENTRY_VERSION = 2;
const MAX_PROVENANCE_BYTES = 4 * 1024;
const MAX_RESTORED_LAUNCHES = 32;
const MAX_RESULT_BYTES = 1024 * 1024;
const MAX_ARTIFACT_BYTES = 64 * 1024;
const MAX_PENDING_COMPLETIONS = 32;
const MAX_PENDING_COMPLETION_BYTES = 1024 * 1024;
const PENDING_COMPLETION_TTL_MS = 30 * 1000;
const NATIVE_NOTIFY_UNSUBSCRIBE_KEY = "__pi_subagents_notify_unsubscribe__";
const NATIVE_NOTIFY_SEEN_KEY = "__pi_subagents_notify_seen__";
const TAKOMI_NOTIFY_HANDLER_KEY = "__takomi_detached_notify_handler__";
const TRUSTED_LAUNCHES_KEY = "__takomi_detached_trusted_launches__";
const NOTIFY_TTL_MS = 10 * 60 * 1000;

type NativeResult = {
  content?: Array<{ type?: string; text?: string }>;
  details?: Record<string, any>;
  isError?: boolean;
};

type DetachedResultChild = {
  agent?: string;
  output?: string;
  error?: string;
  success?: boolean;
  exitCode?: number | null;
  sessionFile?: string;
  sessionPath?: string;
  model?: string;
  attemptedModels?: string[];
  modelAttempts?: unknown[];
  artifactPaths?: {
    inputPath?: string;
    outputPath?: string;
    jsonlPath?: string;
    metadataPath?: string;
  };
  acceptance?: Record<string, any>;
};

export type DetachedCompletionPayload = {
  id?: string;
  runId?: string;
  mode?: "single" | "parallel" | "chain";
  state?: "complete" | "failed" | "paused";
  success?: boolean;
  summary?: string;
  results?: DetachedResultChild[];
  asyncDir?: string;
  sessionId?: string;
  cwd?: string;
  sessionFile?: string;
  artifactsDir?: string;
  workflowGraph?: unknown;
  outputs?: unknown;
  durationMs?: number;
  exitCode?: number;
  agent?: string;
  taskIndex?: number;
  totalTasks?: number;
};

type SessionIdentity = {
  id: string;
  nativeId: string;
  file?: string;
  parent?: string;
};

type ChecklistProvenance = "trusted-launch" | "unavailable-after-restart";

type DetachedLaunch = {
  id: string;
  asyncDir: string;
  asyncRoot: string;
  resultRoot: string;
  artifactRoots: string[];
  sessionRoots: string[];
  workspaceRoot: string;
  runCwd: string;
  session: SessionIdentity;
  mode: "single" | "parallel" | "chain";
  tasks: TakomiUxTask[];
  checklistProvenance: ChecklistProvenance;
};

type PendingCompletion = { id: string; payload: DetachedCompletionPayload; receivedAt: number };
type DetachedLaunchRoots = { asyncRoot: string; resultRoot: string; artifactRoots: string[] };

type DetachedStore = {
  identity?: { workspaceRoot: string; session: SessionIdentity };
  launches: Map<string, DetachedLaunch>;
  completions: Map<string, DetachedCompletionPayload>;
  pending: PendingCompletion[];
  notified: Set<string>;
};

export type ProvenanceState = "not-needed" | "complete" | "missing" | "permission" | "io" | "oversized" | "truncated" | "corrupt" | "rejected";

export type DetachedOutputProvenance = {
  source: "payload" | "artifact" | "summary" | "none";
  fallbackState: ProvenanceState;
  path?: string;
  bytesRead?: number;
  error?: string;
};

type PathProvenance = { state: ProvenanceState; path?: string; error?: string };

const stores = new WeakMap<object, DetachedStore>();

function storeFor(pi: object): DetachedStore {
  const existing = stores.get(pi);
  if (existing) return existing;
  const created: DetachedStore = { launches: new Map(), completions: new Map(), pending: [], notified: new Set() };
  stores.set(pi, created);
  return created;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function trustedLaunches(): Map<string, DetachedLaunch> {
  const globalStore = globalThis as Record<string, unknown>;
  const existing = globalStore[TRUSTED_LAUNCHES_KEY];
  if (existing instanceof Map) return existing as Map<string, DetachedLaunch>;
  const created = new Map<string, DetachedLaunch>();
  globalStore[TRUSTED_LAUNCHES_KEY] = created;
  return created;
}

function trustedLaunchKey(workspaceRoot: string, session: SessionIdentity, id: string): string {
  return JSON.stringify([workspaceRoot, session.id, session.nativeId, session.file, session.parent, id]);
}

export function classifyPathError(error: unknown): "missing" | "permission" | "io" {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as NodeJS.ErrnoException).code ?? "")
    : "";
  if (code === "ENOENT" || code === "ENOTDIR") return "missing";
  if (code === "EACCES" || code === "EPERM") return "permission";
  return "io";
}

function completionId(payload: DetachedCompletionPayload): string | undefined {
  const id = typeof payload.id === "string" && payload.id.trim() ? payload.id.trim() : undefined;
  const runId = typeof payload.runId === "string" && payload.runId.trim() ? payload.runId.trim() : undefined;
  if (id && runId && id !== runId) return undefined;
  return runId ?? id;
}

function isPathInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function canonicalPotentialPath(value: string): Promise<string> {
  const absolute = path.resolve(value);
  let cursor = absolute;
  const suffix: string[] = [];
  while (true) {
    try {
      const real = await fs.realpath(cursor);
      return path.resolve(real, ...suffix.reverse());
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw error;
      const parent = path.dirname(cursor);
      if (parent === cursor) return absolute;
      suffix.push(path.basename(cursor));
      cursor = parent;
    }
  }
}

async function canonicalExistingDirectory(value: string, label: string): Promise<string> {
  const real = await fs.realpath(path.resolve(value));
  const stat = await fs.stat(real);
  if (!stat.isDirectory()) throw new Error(`${label} is not a directory.`);
  return real;
}

async function canonicalSessionIdentity(ctx: ExtensionContext): Promise<SessionIdentity> {
  const id = ctx.sessionManager.getSessionId();
  const rawFile = ctx.sessionManager.getSessionFile();
  const header = ctx.sessionManager.getHeader?.() as { parentSession?: unknown } | undefined;
  const file = rawFile ? await canonicalPotentialPath(rawFile) : undefined;
  const parent = typeof header?.parentSession === "string" && header.parentSession.trim()
    ? await canonicalPotentialPath(header.parentSession)
    : undefined;
  return {
    id,
    nativeId: file ?? id,
    ...(file ? { file } : {}),
    ...(parent ? { parent } : {}),
  };
}

function sameSession(a: SessionIdentity, b: SessionIdentity): boolean {
  return a.id === b.id && a.nativeId === b.nativeId && a.file === b.file && a.parent === b.parent;
}

async function currentRoots(session: SessionIdentity, workspaceRoot: string): Promise<DetachedLaunchRoots & { sessionRoots: string[] }> {
  const internals = await loadPiSubagentsInternals();
  const nativeSessionRoot = session.file
    ? await canonicalPotentialPath(path.join(path.dirname(session.file), path.basename(session.file, ".jsonl")))
    : undefined;
  const conversationSessionRoot = await validatePathWithin(
    workspaceRoot,
    path.join(workspaceRoot, ".pi", "takomi", "subagent-conversations"),
    { mustExist: false, label: "conversation session root" },
  );
  return {
    asyncRoot: await canonicalPotentialPath(internals.ASYNC_DIR),
    resultRoot: await canonicalPotentialPath(internals.RESULTS_DIR),
    artifactRoots: [await canonicalPotentialPath(internals.TEMP_ARTIFACTS_DIR)],
    sessionRoots: [nativeSessionRoot, conversationSessionRoot].filter((root): root is string => Boolean(root)),
  };
}

function exactOrUniqueLaunch(entries: Map<string, DetachedLaunch>, requested: string): DetachedLaunch | undefined {
  const exact = entries.get(requested);
  if (exact) return exact;
  const matches = [...entries.values()].filter((launch) => launch.id.startsWith(requested));
  return matches.length === 1 ? matches[0] : undefined;
}

function textContent(result: NativeResult): string {
  return result.content?.filter((part) => part?.type === "text").map((part) => part.text ?? "").join("\n") ?? "";
}

function fieldFromContent(result: NativeResult, label: string): string | undefined {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return textContent(result).match(new RegExp(`^${escaped}:\\s+(.+)$`, "m"))?.[1]?.trim();
}

function resultPathForLaunch(launch: DetachedLaunch, result: NativeResult): string {
  return fieldFromContent(result, "Result") ?? path.join(launch.resultRoot, `${launch.id}.json`);
}

async function validatePathWithin(root: string, candidate: string, options: { mustExist: boolean; label: string }): Promise<string> {
  const canonicalRoot = await canonicalPotentialPath(root);
  const lexical = path.resolve(candidate);
  if (!isPathInside(canonicalRoot, lexical)) throw new Error(`${options.label} escapes its approved root.`);
  const canonical = options.mustExist ? await fs.realpath(lexical) : await canonicalPotentialPath(lexical);
  if (!isPathInside(canonicalRoot, canonical)) throw new Error(`${options.label} escapes its approved root through a symlink.`);
  return canonical;
}

async function validateAgainstRoots(roots: string[], candidate: string, options: { mustExist: boolean; label: string }): Promise<string> {
  let firstError: unknown;
  for (const root of roots) {
    try {
      return await validatePathWithin(root, candidate, options);
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError) throw firstError;
  throw new Error(`${options.label} has no approved root.`);
}

async function readBounded(filePath: string, maxBytes: number): Promise<{ text?: string; bytesRead: number; truncated: boolean; error?: string; errorState?: ProvenanceState }> {
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(filePath, "r");
    const stat = await handle.stat();
    if (!stat.isFile()) return { bytesRead: 0, truncated: false, error: "not a regular file", errorState: "io" };
    const bytesToRead = Math.min(stat.size, maxBytes + 1);
    const buffer = Buffer.alloc(bytesToRead);
    const { bytesRead } = await handle.read(buffer, 0, bytesToRead, 0);
    const truncated = stat.size > maxBytes || bytesRead > maxBytes;
    const usable = buffer.subarray(0, Math.min(bytesRead, maxBytes));
    try {
      const decoder = new TextDecoder("utf-8", { fatal: true });
      // When the byte bound cuts through a multibyte scalar, streaming decode
      // intentionally retains that incomplete suffix instead of calling it corrupt.
      const text = truncated ? decoder.decode(usable, { stream: true }) : decoder.decode(usable);
      return { text, bytesRead: usable.length, truncated };
    } catch {
      return { bytesRead: usable.length, truncated, error: "invalid UTF-8", errorState: "corrupt" };
    }
  } catch (error) {
    return {
      bytesRead: 0,
      truncated: false,
      error: error instanceof Error ? error.message : String(error),
      errorState: classifyPathError(error),
    };
  } finally {
    await handle?.close().catch(() => {});
  }
}

async function readResultPayload(launch: DetachedLaunch, candidate: string): Promise<{ payload?: DetachedCompletionPayload; state: DetachedOutputProvenance["fallbackState"]; error?: string }> {
  let canonical: string;
  try {
    canonical = await validatePathWithin(launch.resultRoot, candidate, { mustExist: true, label: "result path" });
    if (path.basename(canonical) !== `${launch.id}.json`) {
      return { state: "rejected", error: "result filename does not exactly match the launched run id" };
    }
  } catch (error) {
    const state = classifyPathError(error);
    return { state: state === "io" ? "rejected" : state, error: error instanceof Error ? error.message : String(error) };
  }
  const read = await readBounded(canonical, MAX_RESULT_BYTES);
  if (read.error) return { state: read.errorState ?? "io", error: read.error };
  if (read.truncated) return { state: "oversized", error: `result exceeds ${MAX_RESULT_BYTES} bytes` };
  try {
    const parsed = JSON.parse(read.text ?? "");
    return parsed && typeof parsed === "object"
      ? { payload: sanitizeUntrustedValue(parsed) as DetachedCompletionPayload, state: "complete" }
      : { state: "corrupt", error: "result JSON is not an object" };
  } catch (error) {
    return { state: "corrupt", error: error instanceof Error ? error.message : String(error) };
  }
}

async function validatePayloadIdentity(launch: DetachedLaunch, payload: DetachedCompletionPayload): Promise<string | undefined> {
  const id = completionId(payload);
  if (!id || id !== launch.id) return "completion run id does not exactly match a known launch";
  if (typeof payload.sessionId !== "string") return "completion session identity is missing";
  const payloadSessionId = launch.session.file ? await canonicalPotentialPath(payload.sessionId) : payload.sessionId;
  if (payloadSessionId !== launch.session.nativeId) return "completion session identity does not match the launch session";
  if (typeof payload.cwd !== "string") return "completion workspace identity is missing";
  try {
    const cwd = await canonicalExistingDirectory(payload.cwd, "completion cwd");
    if (cwd !== launch.runCwd) return "completion cwd identity does not match the launched run";
    if (!isPathInside(launch.workspaceRoot, cwd)) return "completion cwd escapes the launch workspace";
    if (typeof payload.asyncDir !== "string") return "completion asyncDir identity is missing";
    const asyncDir = await validatePathWithin(launch.asyncRoot, payload.asyncDir, { mustExist: true, label: "completion asyncDir" });
    if (asyncDir !== launch.asyncDir) return "completion asyncDir does not match the launched run";
    if (payload.artifactsDir) {
      const artifactsDir = await validateAgainstRoots(launch.artifactRoots, payload.artifactsDir, { mustExist: false, label: "completion artifactsDir" });
      if (!launch.artifactRoots.includes(artifactsDir)) return "completion artifact root does not match an approved launch root";
    }
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return undefined;
}

async function validatedChildSession(payload: DetachedCompletionPayload, child: DetachedResultChild, launch: DetachedLaunch): Promise<{ sessionFile?: string; sessionPath?: string; provenance: PathProvenance }> {
  const fallback = payload.results?.length === 1 ? payload.sessionFile : undefined;
  const candidates = [child.sessionFile, child.sessionPath, fallback].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (!candidates.length) return { provenance: { state: "missing", error: "child session path is missing" } };
  if (!launch.sessionRoots.length) return { provenance: { state: "rejected", error: "no approved child session root is available" } };
  let firstError: unknown;
  for (const candidate of candidates) {
    try {
      const canonical = await validateAgainstRoots(launch.sessionRoots, candidate, { mustExist: true, label: "child session path" });
      return { sessionFile: canonical, sessionPath: canonical, provenance: { state: "complete", path: canonical } };
    } catch (error) {
      firstError ??= error;
    }
  }
  const classified = classifyPathError(firstError);
  const message = firstError instanceof Error ? firstError.message : String(firstError);
  return { provenance: { state: classified === "io" ? "rejected" : classified, error: message } };
}

async function outputForChild(
  payload: DetachedCompletionPayload,
  child: DetachedResultChild,
  launch: DetachedLaunch,
): Promise<{ output: string; provenance: DetachedOutputProvenance; artifactPaths?: DetachedResultChild["artifactPaths"] }> {
  const direct = typeof child.output === "string" ? sanitizeUntrustedText(child.output).trim() : "";
  const safeArtifactPaths: DetachedResultChild["artifactPaths"] = {};
  let rejectedPathError: string | undefined;
  let rejectedPathState: ProvenanceState = "rejected";
  for (const [name, value] of Object.entries(child.artifactPaths ?? {})) {
    if (typeof value !== "string") continue;
    try {
      (safeArtifactPaths as Record<string, string>)[name] = await validateAgainstRoots(launch.artifactRoots, value, {
        mustExist: false,
        label: `artifact ${name}`,
      });
    } catch (error) {
      if (!rejectedPathError) {
        rejectedPathError = error instanceof Error ? error.message : String(error);
        const code = typeof error === "object" && error !== null && "code" in error;
        rejectedPathState = code ? classifyPathError(error) : "rejected";
      }
    }
  }
  if (direct) {
    return {
      output: direct,
      provenance: { source: "payload", fallbackState: "not-needed" },
      ...(Object.keys(safeArtifactPaths).length ? { artifactPaths: safeArtifactPaths } : {}),
    };
  }

  const outputPath = safeArtifactPaths.outputPath;
  if (outputPath) {
    let canonical: string;
    try {
      canonical = await validateAgainstRoots(launch.artifactRoots, outputPath, { mustExist: true, label: "output artifact" });
    } catch (error) {
      const summary = typeof payload.summary === "string" ? sanitizeUntrustedText(payload.summary).trim() : "";
      const classified = classifyPathError(error);
      return {
        output: summary,
        provenance: {
          source: summary ? "summary" : "none",
          fallbackState: classified === "io" ? "rejected" : classified,
          path: outputPath,
          error: error instanceof Error ? error.message : String(error),
        },
        artifactPaths: safeArtifactPaths,
      };
    }
    const read = await readBounded(canonical, MAX_ARTIFACT_BYTES);
    const artifactText = sanitizeUntrustedText(read.text ?? "").trim();
    if (!read.error && artifactText) {
      return {
        output: artifactText,
        provenance: {
          source: "artifact",
          fallbackState: read.truncated ? "truncated" : "complete",
          path: canonical,
          bytesRead: read.bytesRead,
          ...(read.truncated ? { error: `output artifact exceeds ${MAX_ARTIFACT_BYTES} bytes` } : {}),
        },
        artifactPaths: safeArtifactPaths,
      };
    }
    const summary = typeof payload.summary === "string" ? sanitizeUntrustedText(payload.summary).trim() : "";
    return {
      output: summary,
      provenance: {
        source: summary ? "summary" : "none",
        fallbackState: read.errorState ?? "corrupt",
        path: canonical,
        bytesRead: read.bytesRead,
        error: read.error ?? "output artifact is empty or invalid text",
      },
      artifactPaths: safeArtifactPaths,
    };
  }

  const summary = typeof payload.summary === "string" ? sanitizeUntrustedText(payload.summary).trim() : "";
  return {
    output: summary,
    provenance: {
      source: summary ? "summary" : "none",
      fallbackState: rejectedPathError ? rejectedPathState : "missing",
      ...(rejectedPathError ? { error: rejectedPathError } : { error: "no output artifact path was provided" }),
    },
    ...(Object.keys(safeArtifactPaths).length ? { artifactPaths: safeArtifactPaths } : {}),
  };
}

function resultStatus(payload: DetachedCompletionPayload, child: DetachedResultChild): "completed" | "failed" {
  if (child.success === false || child.exitCode !== undefined && child.exitCode !== null && child.exitCode !== 0) return "failed";
  if (child.success === true || child.exitCode === 0) return "completed";
  return payload.state === "failed" ? "failed" : "completed";
}

/** Convert an authenticated native completion into the foreground Details shape. */
export async function normalizeDetachedCompletion(
  payload: DetachedCompletionPayload,
  launch: DetachedLaunch,
): Promise<Record<string, unknown> | undefined> {
  if (!Array.isArray(payload.results) || payload.results.length === 0) return undefined;
  const durationMs = typeof payload.durationMs === "number" ? payload.durationMs : 0;
  const results = await Promise.all(payload.results.map(async (rawChild, index) => {
    const child = sanitizeUntrustedValue(rawChild);
    const task = launch.tasks[index];
    const [resolvedOutput, resolvedSession] = await Promise.all([
      outputForChild(payload, child, launch),
      validatedChildSession(payload, child, launch),
    ]);
    const status = resultStatus(payload, child);
    const exitCode = typeof child.exitCode === "number" ? child.exitCode : status === "completed" ? 0 : 1;
    return {
      agent: child.agent ?? task?.agent ?? `step-${index + 1}`,
      task: task?.task ?? "Detached async task",
      exitCode,
      error: child.error,
      ...(resolvedSession.sessionFile ? { sessionFile: resolvedSession.sessionFile, sessionPath: resolvedSession.sessionPath } : {}),
      takomiDetachedSession: resolvedSession.provenance,
      model: child.model,
      attemptedModels: child.attemptedModels,
      modelAttempts: child.modelAttempts,
      artifactPaths: resolvedOutput.artifactPaths,
      acceptance: child.acceptance,
      finalOutput: resolvedOutput.output,
      takomiDetachedOutput: resolvedOutput.provenance,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, turns: 0 },
      progress: {
        index,
        agent: child.agent ?? task?.agent ?? `step-${index + 1}`,
        task: task?.task ?? "Detached async task",
        status,
        recentTools: [],
        recentOutput: [],
        toolCount: 0,
        tokens: 0,
        durationMs,
        ...(child.error ? { error: child.error } : {}),
      },
    };
  }));
  return withTakomiUxDetails({
    mode: payload.mode ?? launch.mode,
    runId: launch.id,
    results,
    asyncDir: launch.asyncDir,
    ...(payload.workflowGraph ? { workflowGraph: payload.workflowGraph } : {}),
    ...(payload.outputs ? { outputs: payload.outputs } : {}),
    ...(payload.artifactsDir ? { artifacts: { dir: payload.artifactsDir, files: results.map((row) => row.artifactPaths).filter(Boolean) } } : {}),
    takomiDetached: {
      workspaceRoot: launch.workspaceRoot,
      runCwd: launch.runCwd,
      sessionId: launch.session.id,
      sessionNativeId: launch.session.nativeId,
      runId: launch.id,
      asyncDir: launch.asyncDir,
      resultRoot: launch.resultRoot,
      checklistProvenance: launch.checklistProvenance,
    },
  }, launch.tasks);
}

type PersistedLaunchLookup = { version: number; id: string };

function launchEntryData(launch: DetachedLaunch): PersistedLaunchLookup {
  return { version: SESSION_ENTRY_VERSION, id: launch.id };
}

function boundedLaunchEntry(launch: DetachedLaunch): boolean {
  return Buffer.byteLength(JSON.stringify(launchEntryData(launch)), "utf8") <= MAX_PROVENANCE_BYTES;
}

export async function initializeDetachedSession(pi: ExtensionAPI, ctx: ExtensionContext): Promise<void> {
  const store = storeFor(pi);
  store.launches.clear();
  store.completions.clear();
  store.pending = [];
  store.notified.clear();
  const workspaceRoot = await canonicalExistingDirectory(ctx.cwd, "workspace root");
  const session = await canonicalSessionIdentity(ctx);
  const roots = await currentRoots(session, workspaceRoot);
  store.identity = { workspaceRoot, session };

  const entries = ctx.sessionManager.getBranch?.() ?? ctx.sessionManager.getEntries();
  const ids: string[] = [];
  for (const entry of entries) {
    const record = asRecord(entry);
    if (record.type !== "custom" || record.customType !== SESSION_ENTRY_TYPE) continue;
    const data = asRecord(record.data);
    if (data.version !== SESSION_ENTRY_VERSION || typeof data.id !== "string") continue;
    const id = data.id.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) continue;
    if (Buffer.byteLength(JSON.stringify(data), "utf8") > MAX_PROVENANCE_BYTES) continue;
    ids.push(id);
  }

  for (const id of ids.slice(-MAX_RESTORED_LAUNCHES)) {
    try {
      const asyncDir = await validatePathWithin(roots.asyncRoot, path.join(roots.asyncRoot, id), { mustExist: true, label: "restored asyncDir" });
      if (path.basename(asyncDir) !== id) continue;
      const trusted = trustedLaunches().get(trustedLaunchKey(workspaceRoot, session, id));
      if (trusted) {
        const rootsMatch = trusted.asyncRoot === roots.asyncRoot
          && trusted.resultRoot === roots.resultRoot
          && trusted.artifactRoots.length === roots.artifactRoots.length
          && trusted.artifactRoots.every((root, index) => root === roots.artifactRoots[index])
          && trusted.sessionRoots.length === roots.sessionRoots.length
          && trusted.sessionRoots.every((root, index) => root === roots.sessionRoots[index]);
        if (rootsMatch && trusted.workspaceRoot === workspaceRoot && sameSession(trusted.session, session) && trusted.asyncDir === asyncDir) {
          store.launches.set(id, trusted);
          await flushPendingForLaunch(pi, id);
          continue;
        }
      }
      // Session files are not integrity protected. A restart may restore only the
      // lookup id; roots and workspace are re-derived, and checklist/task claims
      // deliberately remain unavailable rather than trusted from persisted data.
      store.launches.set(id, {
        id,
        asyncDir,
        asyncRoot: roots.asyncRoot,
        resultRoot: roots.resultRoot,
        artifactRoots: roots.artifactRoots,
        sessionRoots: roots.sessionRoots,
        workspaceRoot,
        runCwd: workspaceRoot,
        session,
        mode: "single",
        tasks: [],
        checklistProvenance: "unavailable-after-restart",
      });
      await flushPendingForLaunch(pi, id);
    } catch {
      // Missing, escaped, or stale native run directories fail closed.
    }
  }
}

export async function rememberDetachedLaunch(
  pi: ExtensionAPI,
  result: NativeResult,
  tasks: TakomiUxTask[],
  ctx: ExtensionContext,
  workspaceRoot: string,
  expectedRunCwd: string = workspaceRoot,
): Promise<void> {
  const id = typeof result.details?.asyncId === "string"
    ? result.details.asyncId.trim()
    : typeof result.details?.runId === "string" ? result.details.runId.trim() : "";
  if (!id || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) throw new Error("Native async launch returned an invalid run id.");
  if (result.details?.runId && result.details.runId !== id) throw new Error("Native async launch returned conflicting run ids.");
  if (typeof result.details?.asyncDir !== "string") throw new Error("Native async launch did not return asyncDir provenance.");

  const canonicalWorkspace = await canonicalExistingDirectory(workspaceRoot, "workspace root");
  const runCwd = await canonicalExistingDirectory(expectedRunCwd, "run cwd");
  if (!isPathInside(canonicalWorkspace, runCwd)) throw new Error("Native run cwd escapes the canonical workspace root.");
  const session = await canonicalSessionIdentity(ctx);
  const roots = await currentRoots(session, canonicalWorkspace);
  const asyncRoot = roots.asyncRoot;
  const resultRoot = roots.resultRoot;
  const asyncDir = await validatePathWithin(asyncRoot, result.details.asyncDir, { mustExist: true, label: "launch asyncDir" });
  if (path.basename(asyncDir) !== id) throw new Error("Native asyncDir does not exactly match the launched run id.");
  const artifactRoots = roots.artifactRoots;
  const launch: DetachedLaunch = {
    id,
    asyncDir,
    asyncRoot,
    resultRoot,
    artifactRoots,
    sessionRoots: roots.sessionRoots,
    workspaceRoot: canonicalWorkspace,
    runCwd,
    session,
    mode: result.details?.mode === "parallel" || result.details?.mode === "chain" ? result.details.mode : "single",
    tasks: sanitizeUntrustedValue(tasks),
    checklistProvenance: "trusted-launch",
  };
  if (!boundedLaunchEntry(launch)) throw new Error(`Detached launch provenance exceeds ${MAX_PROVENANCE_BYTES} bytes.`);
  const store = storeFor(pi);
  if (!store.identity || store.identity.workspaceRoot !== canonicalWorkspace || !sameSession(store.identity.session, session)) {
    store.launches.clear();
    store.completions.clear();
    store.identity = { workspaceRoot: canonicalWorkspace, session };
  }
  store.launches.set(id, launch);
  trustedLaunches().set(trustedLaunchKey(canonicalWorkspace, session, id), launch);
  pi.appendEntry(SESSION_ENTRY_TYPE, launchEntryData(launch));
  await flushPendingForLaunch(pi, id);
}

async function captureForKnownLaunch(pi: ExtensionAPI, data: unknown): Promise<{ launch?: DetachedLaunch; payload?: DetachedCompletionPayload; error?: string }> {
  if (!data || typeof data !== "object") return { error: "completion payload is not an object" };
  const payload = sanitizeUntrustedValue(data) as DetachedCompletionPayload;
  const id = completionId(payload);
  if (!id) return { error: "completion payload has missing or conflicting run ids" };
  const launch = storeFor(pi).launches.get(id);
  if (!launch) return { error: "completion run id is not an exact known launch" };
  const identityError = await validatePayloadIdentity(launch, payload);
  if (identityError) return { launch, error: identityError };
  storeFor(pi).completions.set(id, payload);
  return { launch, payload };
}

export async function captureDetachedCompletion(pi: ExtensionAPI, data: unknown): Promise<boolean> {
  const captured = await captureForKnownLaunch(pi, data);
  return Boolean(captured.payload);
}

function prunePending(store: DetachedStore, now = Date.now()): void {
  store.pending = store.pending.filter((item) => now - item.receivedAt <= PENDING_COMPLETION_TTL_MS);
  if (store.pending.length > MAX_PENDING_COMPLETIONS) store.pending.splice(0, store.pending.length - MAX_PENDING_COMPLETIONS);
}

function queuePendingCompletion(pi: ExtensionAPI, data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  try {
    if (Buffer.byteLength(JSON.stringify(data), "utf8") > MAX_PENDING_COMPLETION_BYTES) return false;
  } catch {
    return false;
  }
  const payload = sanitizeUntrustedValue(data) as DetachedCompletionPayload;
  const id = completionId(payload);
  if (!id || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) return false;
  if (!Array.isArray(payload.results) || payload.results.length === 0) return false;
  if (typeof payload.sessionId !== "string" || typeof payload.cwd !== "string" || typeof payload.asyncDir !== "string") return false;
  const store = storeFor(pi);
  prunePending(store);
  store.pending.push({ id, payload, receivedAt: Date.now() });
  prunePending(store);
  return true;
}

async function flushPendingForLaunch(pi: ExtensionAPI, id: string): Promise<void> {
  const store = storeFor(pi);
  prunePending(store);
  const matches = store.pending.filter((item) => item.id === id);
  store.pending = store.pending.filter((item) => item.id !== id);
  for (const item of matches) await notifyDetachedCompletion(pi, item.payload, false);
}

export function clearDetachedResults(pi: ExtensionAPI): void {
  const store = stores.get(pi);
  if (store) {
    for (const launch of store.launches.values()) {
      const key = trustedLaunchKey(launch.workspaceRoot, launch.session, launch.id);
      if (trustedLaunches().get(key) === launch) trustedLaunches().delete(key);
    }
    store.launches.clear();
    store.completions.clear();
    store.pending = [];
    store.notified.clear();
  }
  stores.delete(pi);
}

function statusIdentityError(result: NativeResult, launch: DetachedLaunch): string | undefined {
  const run = fieldFromContent(result, "Run");
  if (!run || run !== launch.id) return "status payload run id does not exactly match the known launch";
  const dir = fieldFromContent(result, "Dir");
  if (dir && path.resolve(dir) !== launch.asyncDir) return "status payload asyncDir does not match the known launch";
  return undefined;
}

function withHydrationState(nativeResult: NativeResult, launch: DetachedLaunch | undefined, state: string, error?: string): NativeResult {
  return {
    ...nativeResult,
    details: {
      ...(nativeResult.details ?? {}),
      takomiDetachedHydration: {
        state,
        ...(launch ? { runId: launch.id } : {}),
        ...(error ? { error: sanitizeUntrustedText(error) } : {}),
      },
    },
  };
}

export async function resolveDetachedStatusResult(
  pi: ExtensionAPI,
  params: TakomiSubagentToolParams,
  nativeResult: NativeResult,
): Promise<NativeResult> {
  const requested = params.id?.trim();
  if (!requested) return nativeResult;
  const store = storeFor(pi);
  const launch = exactOrUniqueLaunch(store.launches, requested);
  if (!launch) return withHydrationState(nativeResult, undefined, "rejected", "status id is unknown or prefix-ambiguous");
  const statusError = statusIdentityError(nativeResult, launch);
  if (statusError) return withHydrationState(nativeResult, launch, "rejected", statusError);

  let payload = store.completions.get(launch.id);
  if (!payload) {
    const read = await readResultPayload(launch, resultPathForLaunch(launch, nativeResult));
    if (!read.payload) return withHydrationState(nativeResult, launch, read.state, read.error);
    const identityError = await validatePayloadIdentity(launch, read.payload);
    if (identityError) return withHydrationState(nativeResult, launch, "rejected", identityError);
    payload = read.payload;
    store.completions.set(launch.id, payload);
  }

  const details = await normalizeDetachedCompletion(payload, launch);
  if (!details) return withHydrationState(nativeResult, launch, "corrupt", "completion has no result children");
  const rows = (details as any).results ?? [];
  if (!rows.some((row: any) => finalAnswer(row).trim().length > 0)) {
    return withHydrationState(nativeResult, launch, "missing", "completion has no useful final output");
  }
  return { ...nativeResult, details };
}

function notificationChecklist(details: Record<string, any>): string {
  if (details.takomiDetached?.checklistProvenance === "unavailable-after-restart") {
    return "Checklist unavailable after restart";
  }
  const rows = Array.isArray(details.results) ? details.results : [];
  const tasks = Array.isArray(details.takomiUx?.tasks) ? details.takomiUx.tasks as TakomiUxTask[] : [];
  const all = rows.flatMap((row: any, index: number) => resolvedChecklist(tasks[index]?.checklist ?? [], [row.finalOutput ?? ""]));
  const done = all.filter((item) => item.done).length;
  return `Checklist provenance: ${done}/${all.length}`;
}

function boundNotificationLine(value: string, maxCharacters: number): string {
  const normalized = sanitizeUntrustedText(value).replace(/\s+/g, " ").trim();
  const characters = [...normalized];
  return characters.length <= maxCharacters ? normalized : `${characters.slice(0, Math.max(1, maxCharacters - 1)).join("")}…`;
}

function notificationAnswerParts(answers: string[]): { opening: string; remaining: string[] } {
  const firstLines = answers[0]!.split(/\r?\n/);
  const openingIndex = firstLines.findIndex((line) => line.trim().length > 0);
  const rawOpening = openingIndex >= 0 ? firstLines[openingIndex]!.trim() : answers[0]!.trim();
  const opening = boundNotificationLine(rawOpening, 240);
  const firstRemaining = openingIndex >= 0
    ? [...firstLines.slice(0, openingIndex), ...firstLines.slice(openingIndex + 1)].join("\n").trim()
    : "";
  return { opening, remaining: [firstRemaining, ...answers.slice(1)].filter((answer) => answer.trim().length > 0) };
}

function notificationFallback(details: Record<string, any>): string | undefined {
  const rows = Array.isArray(details.results) ? details.results : [];
  const fallbacks = rows.map((row: any) => row.takomiDetachedOutput as DetachedOutputProvenance | undefined)
    .filter((item): item is DetachedOutputProvenance => item !== undefined && item.fallbackState !== "not-needed");
  if (!fallbacks.length) return undefined;
  const first = fallbacks[0]!;
  return `output ${first.source} fallback: ${first.fallbackState}`;
}

function acceptanceLabel(details: Record<string, any>): string | undefined {
  const statuses = [...new Set((details.results ?? []).map((row: any) => row.acceptance?.status).filter((value: unknown): value is string => typeof value === "string"))];
  return statuses.length ? `acceptance ${statuses.join(", ")}` : undefined;
}

function pruneSeen(seen: Map<string, number>, now: number): void {
  for (const [key, timestamp] of seen) if (now - timestamp > NOTIFY_TTL_MS) seen.delete(key);
}

function claimNativeCompletionKey(id: string): boolean {
  const globalStore = globalThis as Record<string, unknown>;
  const existing = globalStore[NATIVE_NOTIFY_SEEN_KEY];
  const seen = existing instanceof Map ? existing as Map<string, number> : new Map<string, number>();
  globalStore[NATIVE_NOTIFY_SEEN_KEY] = seen;
  const now = Date.now();
  pruneSeen(seen, now);
  const key = `id:${id}`;
  if (seen.has(key)) return false;
  seen.set(key, now);
  return true;
}

async function notifyDetachedCompletion(pi: ExtensionAPI, data: unknown, allowQueue = true): Promise<void> {
  const captured = await captureForKnownLaunch(pi, data);
  if (!captured.launch || !captured.payload) {
    if (allowQueue && captured.error === "completion run id is not an exact known launch") queuePendingCompletion(pi, data);
    return;
  }
  const details = await normalizeDetachedCompletion(captured.payload, captured.launch);
  if (!details) return;
  const rows = (details as any).results as any[];
  const answers = rows.map((row) => finalAnswer(row)).filter((answer) => answer.trim().length > 0);
  if (!answers.length) return;
  const checklistProvenance = notificationChecklist(details as Record<string, any>);
  const fallback = notificationFallback(details as Record<string, any>);
  const acceptance = acceptanceLabel(details as Record<string, any>);
  const answerParts = notificationAnswerParts(answers);
  const firstLine = `${checklistProvenance} · ${answerParts.opening}`;
  const remainingPreview = [
    ...answerParts.remaining,
    acceptance,
    fallback ? `Fallback provenance: ${fallback}` : undefined,
  ].filter((line): line is string => Boolean(line)).join("\n");
  const resultPreview = [firstLine, remainingPreview || undefined].filter(Boolean).join("\n");
  const status = captured.payload.state === "paused"
    ? "paused"
    : captured.payload.success === false || captured.payload.state === "failed" ? "failed" : "completed";
  const agent = captured.payload.agent ?? (rows.map((row) => row.agent).filter(Boolean).join(", ") || "unknown");
  if (!claimNativeCompletionKey(captured.launch.id)) return;
  storeFor(pi).notified.add(captured.launch.id);
  const content = [
    `Background task ${status}: **${agent}**`,
    "",
    resultPreview,
  ].join("\n");
  pi.sendMessage({
    customType: "subagent-notify",
    content,
    display: true,
    details: {
      agent,
      status,
      resultPreview,
      durationMs: captured.payload.durationMs,
    },
  }, { triggerTurn: true });
}

/**
 * Replace pi-subagents' notifier through its own reload-safe registration slot.
 * The native message renderer remains authoritative; Takomi only enriches the
 * one native custom message and claims the same shared completion dedupe key.
 */
export function registerDetachedCompletionNotifications(pi: ExtensionAPI): () => void {
  const globalStore = globalThis as Record<string, unknown>;
  const staleTakomiCleanup = globalStore[TAKOMI_NOTIFY_HANDLER_KEY];
  if (typeof staleTakomiCleanup === "function") {
    try { staleTakomiCleanup(); } catch {}
  }
  const previous = globalStore[NATIVE_NOTIFY_UNSUBSCRIBE_KEY];
  if (typeof previous === "function") {
    try { previous(); } catch {}
  }

  let active = true;
  const unsubscribeEvent = pi.events.on("subagent:async-complete", (payload) => (
    notifyDetachedCompletion(pi, payload).catch((error) => {
      console.error("Takomi detached completion notification failed:", error);
    })
  ));
  const softNativeSlot = () => {
    // Native may register after Takomi. Let registration finish, then remove that
    // duplicate handler and reclaim the shared slot while this handler survives.
    queueMicrotask(() => {
      if (!active) return;
      const replacement = globalStore[NATIVE_NOTIFY_UNSUBSCRIBE_KEY];
      if (replacement !== softNativeSlot && typeof replacement === "function") {
        try { replacement(); } catch {}
      }
      if (active) globalStore[NATIVE_NOTIFY_UNSUBSCRIBE_KEY] = softNativeSlot;
    });
  };
  const cleanup = () => {
    if (!active) return;
    active = false;
    unsubscribeEvent();
    const store = stores.get(pi);
    if (store) store.pending = [];
    if (globalStore[NATIVE_NOTIFY_UNSUBSCRIBE_KEY] === softNativeSlot) delete globalStore[NATIVE_NOTIFY_UNSUBSCRIBE_KEY];
    if (globalStore[TAKOMI_NOTIFY_HANDLER_KEY] === cleanup) delete globalStore[TAKOMI_NOTIFY_HANDLER_KEY];
  };
  globalStore[TAKOMI_NOTIFY_HANDLER_KEY] = cleanup;
  globalStore[NATIVE_NOTIFY_UNSUBSCRIBE_KEY] = softNativeSlot;
  return cleanup;
}
