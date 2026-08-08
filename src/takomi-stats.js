import { createReadStream, promises as fs } from 'node:fs';
import readline from 'node:readline';
import os from 'os';
import path from 'path';

const colorEnabled = process.env.NO_COLOR !== '1' && process.env.NO_COLOR !== 'true';
const ansi = (open, close) => (value) => colorEnabled ? `\u001b[${open}m${value}\u001b[${close}m` : String(value);
const pc = {
  bold: ansi(1, 22),
  dim: ansi(2, 22),
  white: ansi(37, 39),
  gray: ansi(90, 39),
  cyan: ansi(36, 39),
  blue: ansi(34, 39),
  yellow: ansi(33, 39),
  magenta: ansi(35, 39),
};

// USD per million tokens: input, cached input, output.
const PRICES = {
  'gpt-5.6-luna': [0.20, 0.02, 1.20],
  'gpt-5.6-sol': [5.00, 0.50, 30.00],
  'gpt-5.6-terra': [2.00, 0.20, 12.00],
  'gpt-5.5': [5.00, 0.50, 30.00],
  'gpt-5.4': [2.50, 0.25, 15.00],
  'gpt-5.4-mini': [0.75, 0.075, 4.50],
  'gpt-5.4-nano': [0.20, 0.02, 1.25],
  'gpt-5.3-codex': [2.50, 0.25, 15.00],
  'gpt-5.2-codex': [1.75, 0.175, 14.00],
  'gpt-5-codex': [1.25, 0.125, 10.00],
  'gpt-5.2': [1.75, 0.175, 14.00],
  'gpt-5.1': [1.25, 0.125, 10.00],
  'gpt-5': [1.25, 0.125, 10.00],
  'gpt-5-mini': [0.25, 0.025, 2.00],
  'gpt-4.1': [2.00, 0.50, 8.00],
  'gpt-4o': [2.50, 1.25, 10.00],
  'o4-mini': [1.10, 0.275, 4.40],
  'claude-sonnet-4-6': [3.00, 0.30, 15.00],
};

async function exists(target) { try { await fs.access(target); return true; } catch { return false; } }
function safeJson(line) { try { return JSON.parse(line); } catch { return null; } }
function dayOf(ts) { return typeof ts === 'string' && ts.length >= 10 ? ts.slice(0, 10) : 'unknown'; }
const GPT_5_6_PRICE_CHANGE_AT = Date.parse('2026-07-30T00:00:00.000Z');
const LEGACY_GPT_5_6_PRICES = {
  'gpt-5.6-luna': [1.00, 0.10, 6.00],
  'gpt-5.6-terra': [2.50, 0.25, 15.00],
};

function add(map, key, patch) { const row = map.get(key) || { key, input: 0, cache: 0, output: 0, total: 0, cost: 0, events: 0 }; for (const [k,v] of Object.entries(patch)) row[k] = (row[k] || 0) + (Number(v) || 0); if (!Object.prototype.hasOwnProperty.call(patch, 'events')) row.events += 1; map.set(key, row); }
function priceForUsage(model, timestamp) {
  const usageAt = timestampMs(timestamp);
  if (usageAt !== null && usageAt < GPT_5_6_PRICE_CHANGE_AT && LEGACY_GPT_5_6_PRICES[model]) return LEGACY_GPT_5_6_PRICES[model];
  return PRICES[model];
}
function cost(model, input, cache, output, additiveCache = true, timestamp) { const p = priceForUsage(model, timestamp); if (!p) return 0; const nonCached = additiveCache ? input : Math.max(input - cache, 0); return (nonCached*p[0] + cache*p[1] + output*p[2]) / 1_000_000; }
function fmtTokens(n) { if (n >= 1e9) return `${(n/1e9).toFixed(2)}B`; if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`; if (n >= 1e3) return `${(n/1e3).toFixed(1)}K`; return String(Math.round(n || 0)); }
function fmtCount(n) { if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`; if (n >= 1e3) return `${(n/1e3).toFixed(1)}K`; return String(Math.round(n || 0)); }
function fmtPercent(n) { const value = Number(n) || 0; return `${(value * 100).toFixed(value >= 0.995 ? 1 : 0)}%`; }
function fmtMoney(n) { return `$${(n || 0).toFixed(n > 100 ? 0 : 2)}`; }
function fmtMoneyShort(n) { if (n >= 1000) return `$${(n/1000).toFixed(n >= 10_000 ? 0 : 1)}K`; return fmtMoney(n); }
function ms(n) { if (!n) return '-'; const s = Math.round(n/1000); if (s < 60) return `${s}s`; const m = Math.floor(s/60); if (m < 60) return `${m}m ${s%60}s`; const h = Math.floor(m/60); return `${h}h ${m%60}m`; }
const ACTIVE_GAP_THRESHOLD_MS = 15 * 60 * 1000;
function timestampMs(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function addTimestamp(target, value) {
  const parsed = timestampMs(value);
  if (parsed !== null) target.push(parsed);
}
function mergeIntervals(intervals) {
  const sorted = (intervals || [])
    .filter((interval) => Number.isFinite(interval?.start) && Number.isFinite(interval?.end) && interval.end > interval.start)
    .map((interval) => ({ start: interval.start, end: interval.end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  if (!sorted.length) return [];
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const previous = merged[merged.length - 1];
    if (current.start <= previous.end) previous.end = Math.max(previous.end, current.end);
    else merged.push({ ...current });
  }
  return merged;
}
function activeDuration(intervals) {
  return mergeIntervals(intervals).reduce((total, interval) => total + (interval.end - interval.start), 0);
}
function createActivityTracker(sessionStart) {
  return { intervals: [], lastActivityAt: timestampMs(sessionStart) ?? 0, toolStarts: new Map() };
}
function noteActivity(tracker, timestamp, maxGapMs = ACTIVE_GAP_THRESHOLD_MS) {
  const current = timestampMs(timestamp);
  if (current === null) return;
  const previous = tracker.lastActivityAt;
  const delta = current - previous;
  if (previous > 0 && delta > 0 && delta <= maxGapMs) tracker.intervals.push({ start: previous, end: current });
  tracker.lastActivityAt = Math.max(previous, current);
}
function noteToolStart(tracker, toolCallId, timestamp, maxGapMs = ACTIVE_GAP_THRESHOLD_MS) {
  const current = timestampMs(timestamp);
  if (current === null) return;
  noteActivity(tracker, current, maxGapMs);
  if (toolCallId) tracker.toolStarts.set(toolCallId, current);
}
function noteToolEnd(tracker, toolCallId, timestamp, maxGapMs = ACTIVE_GAP_THRESHOLD_MS) {
  const current = timestampMs(timestamp);
  if (current === null) return;
  const start = toolCallId ? tracker.toolStarts.get(toolCallId) : undefined;
  if (start !== undefined) {
    noteActivity(tracker, start, maxGapMs);
    if (current > start) tracker.intervals.push({ start, end: current });
    tracker.toolStarts.delete(toolCallId);
  } else {
    noteActivity(tracker, current, maxGapMs);
  }
  tracker.lastActivityAt = Math.max(tracker.lastActivityAt, current);
}
function parseSince(value) {
  if (!value) return null;
  const raw = String(value).trim().toLowerCase();
  const rel = raw.match(/^(\d+)(d|day|days|w|week|weeks|m|month|months)$/);
  const d = new Date(); d.setHours(0,0,0,0);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2][0];
    d.setDate(d.getDate() - (unit === 'w' ? n * 7 : unit === 'm' ? n * 30 : n));
    return d.toISOString().slice(0, 10);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}
function projectKey(file) {
  const normalized = String(file || '').replace(/\\/g, '/');
  const marker = '/sessions/';
  const idx = normalized.indexOf(marker);
  if (idx >= 0) {
    const encoded = normalized.slice(idx + marker.length).split('/')[0];
    return encoded.replace(/^--/, '').replace(/--$/, '').replace(/--/g, '/').replace(/-/g, ' ').trim() || 'global';
  }
  const cwdMarker = '/.pi/';
  const pidx = normalized.indexOf(cwdMarker);
  if (pidx >= 0) return normalized.slice(0, pidx).split('/').slice(-2).join('/');
  return 'unknown';
}

// ── ANSI-aware string helpers ───────────────────────────────────────────────
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\u001b\[[0-9;]*m/g;
function stripAnsi(s) { return String(s).replace(ANSI_RE, ''); }
function visLen(s) { return stripAnsi(s).length; }
function ansiPadEnd(s, w) { return s + ' '.repeat(Math.max(0, w - visLen(s))); }
function ansiPadStart(s, w) { return ' '.repeat(Math.max(0, w - visLen(s))) + s; }

async function files(root, suffix = '.jsonl') {
  const out = [];
  if (!root || !(await exists(root))) return out;
  async function walk(dir) {
    for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) await walk(p); else if (ent.name.endsWith(suffix)) out.push(p);
    }
  }
  await walk(root); return out;
}

function pushTask(taskRows, task) {
  if (!task?.end || task.end === task.start) return;
  task.activeMs = activeDuration(task.activityIntervals || []);
  taskRows.push(task);
}

async function scanPiSessions(root, source, events, sessionRows = [], taskRows = []) {
  let scannedFiles = 0;
  for (const file of await files(root)) {
    scannedFiles += 1;
    let provider = 'unknown', model = 'unknown', session = path.basename(file, '.jsonl'), cwd = '', currentTask = null, currentTaskTracker = null;
    const row = { key: session, session, source, file, project: projectKey(file), cwd, start: '', end: '', turns: 0, messages: 0, toolCalls: 0, subagentCalls: 0, roles: new Map(), stages: new Map(), workflows: new Map(), activeMs: 0, activityIntervals: [] };
    const rowTracker = createActivityTracker();
    const toolCalls = new Map();

    let lines;
    try {
      lines = readline.createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
    } catch {
      continue;
    }

    try {
      for await (const line of lines) {
      const obj = safeJson(line); if (!obj) continue;
      if (obj.timestamp) { row.start ||= obj.timestamp; row.end = obj.timestamp; }
      if (obj.type === 'session') { session = obj.id || session; cwd = obj.cwd || cwd; row.key = session; row.session = session; row.cwd = cwd; }
      if (obj.type === 'model_change') { provider = obj.provider || provider; model = obj.modelId || model; }
      if (obj.type === 'custom' && obj.customType === 'takomi-runtime-state' && obj.data) {
        const role = obj.data.role || 'unknown';
        const stage = obj.data.stage || 'unknown';
        const workflow = obj.data.workflow || 'unknown';
        row.roles.set(role, (row.roles.get(role) || 0) + 1);
        row.stages.set(stage, (row.stages.get(stage) || 0) + 1);
        row.workflows.set(workflow, (row.workflows.get(workflow) || 0) + 1);
        events.push({ source, file, timestamp: obj.timestamp, day: dayOf(obj.timestamp), session, provider, model, project: projectKey(file), kind: 'role', role, stage, workflow, input: 0, cache: 0, output: 0, total: 0, cost: 0 });
      }

      const msg = obj.type === 'message' && obj.message ? obj.message : null;
      if (msg) {
        row.messages += 1;
        const ts = obj.timestamp || msg.timestamp || '';
        if (!ts) continue;

        const msgProvider = msg.provider || msg.api || provider;
        const msgModel = msg.model || msg.modelId || model;
        provider = msgProvider || provider;
        model = msgModel || model;

        const u = msg.usage;
        if (u) {
          const input = +u.input || +u.inputTokens || 0;
          const cache = +u.cacheRead || +u.cachedInput || +u.cache_read || 0;
          const output = +u.output || +u.outputTokens || 0;
          const total = +u.totalTokens || +u.total || (input + cache + output);
          events.push({ source, file, timestamp: obj.timestamp, day: dayOf(obj.timestamp), session, provider: msgProvider, model: msgModel, project: projectKey(file), kind: 'usage', input, cache, output, total, cost: cost(msgModel, input, cache, output, true, ts) });
        }

        if (msg.role === 'user') {
          pushTask(taskRows, currentTask);
          currentTask = null;
          currentTaskTracker = createActivityTracker(ts);
          row.turns += 1;
          const textPart = Array.isArray(msg.content) ? msg.content.find((p) => p?.type === 'text')?.text || '' : '';
          currentTask = { source, file, session, project: projectKey(file), cwd, start: ts, end: ts, provider, model, turns: 1, toolCalls: 0, title: String(textPart).replace(/\s+/g, ' ').trim(), activityIntervals: currentTaskTracker.intervals };
          noteActivity(rowTracker, ts);
          noteActivity(currentTaskTracker, ts);
          continue;
        }

        if (msg.role === 'assistant' && Array.isArray(msg.content)) {
          noteActivity(rowTracker, ts);
          if (currentTaskTracker) noteActivity(currentTaskTracker, ts);
          if (currentTask) currentTask.end = ts;
          for (const part of msg.content) {
            if (!part || part.type !== 'toolCall') continue;
            const name = part.name || 'unknown';
            const callId = part.id || part.toolCallId || part.callId || part.invocationId || '';
            const input = part.arguments || {};
            row.toolCalls += 1;
            if (currentTask) currentTask.toolCalls += 1;
            if (name === 'takomi_subagent') {
              const count = Array.isArray(input.tasks) ? input.tasks.length : Array.isArray(input.chain) ? input.chain.length : 1;
              row.subagentCalls += count;
            }
            if (callId) {
              toolCalls.set(callId, { name, input, startedAt: ts });
              noteToolStart(rowTracker, callId, ts);
              if (currentTaskTracker) noteToolStart(currentTaskTracker, callId, ts);
            }
            events.push({ source, file, timestamp: obj.timestamp, day: dayOf(obj.timestamp), session, provider, model, project: projectKey(file), kind: 'tool', tool: name, input: 0, cache: 0, output: 0, total: 0, cost: 0 });
          }
          continue;
        }

        if (msg.role === 'toolResult' && msg.toolName) {
          noteToolEnd(rowTracker, msg.toolCallId, ts);
          if (currentTaskTracker) noteToolEnd(currentTaskTracker, msg.toolCallId, ts);
          if (msg.toolCallId) toolCalls.delete(msg.toolCallId);
          if (currentTask) currentTask.end = ts;
          continue;
        }

        noteActivity(rowTracker, ts);
        if (currentTaskTracker) noteActivity(currentTaskTracker, ts);
        if (currentTask) currentTask.end = ts;
      }

      }
    } catch {
      continue;
    }
    pushTask(taskRows, currentTask);
    if (currentTaskTracker && currentTask) {
      currentTask.activityIntervals = currentTaskTracker.intervals;
    }
    row.activityIntervals = rowTracker.intervals;
    row.activeMs = activeDuration(rowTracker.intervals);
    if (row.messages || row.toolCalls || row.turns) sessionRows.push(row);
  }
  return scannedFiles;
}

async function scanRunHistory(file) {
  const runs = [];
  if (!(await exists(file))) return runs;
  const text = await fs.readFile(file, 'utf8').catch(() => '');
  for (const line of text.split(/\r?\n/)) { const o = safeJson(line); if (o) runs.push(o); }
  return runs;
}

function expandHome(input, home = os.homedir()) {
  const value = String(input || '').trim();
  if (!value) return '';
  if (value === '~') return home;
  if (value.startsWith(`~${path.sep}`) || value.startsWith('~/') || value.startsWith('~\\')) return path.join(home, value.slice(2));
  return value;
}

function splitPathList(value, home = os.homedir()) {
  const values = Array.isArray(value) ? value : [value];
  const out = [];
  const delimiterPattern = path.delimiter === ';' ? /[;,]/g : /[:,]/g;
  for (const item of values) {
    if (!item) continue;
    for (const raw of String(item).split(delimiterPattern)) {
      const expanded = expandHome(raw, home);
      if (expanded) out.push(path.resolve(expanded));
    }
  }
  return out;
}

function uniqByPath(rows, field = 'root') {
  const seen = new Set();
  return rows.filter((row) => {
    const key = path.resolve(row[field] || row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function discoverProjectSessionRoots(projectRoots = []) {
  const found = [];
  const skip = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', 'venv', '.venv', '.turbo']);
  const roots = Array.isArray(projectRoots) ? projectRoots : [projectRoots];
  async function walk(dir) {
    let entries = [];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (!ent.isDirectory() || skip.has(ent.name)) continue;
      const p = path.join(dir, ent.name);
      const normalized = p.replace(/\\/g, '/');
      if (normalized.endsWith('/.pi/takomi') || normalized.endsWith('/.pi/agent/sessions')) {
        found.push(path.resolve(p));
        continue;
      }
      await walk(p);
    }
  }
  for (const root of roots.filter(Boolean)) await walk(path.resolve(root));
  return [...new Set(found)];
}

async function discoverSessionLinkedRoots(sessionRows = []) {
  const found = [];
  const seenCwds = new Set();
  for (const row of sessionRows) {
    const cwd = row?.cwd ? path.resolve(row.cwd) : '';
    if (!cwd || seenCwds.has(cwd)) continue;
    seenCwds.add(cwd);
    for (const root of [path.join(cwd, '.pi', 'takomi'), path.join(cwd, '.pi', 'agent', 'sessions')]) {
      if (await exists(root)) found.push(path.resolve(root));
    }
  }
  return [...new Set(found)];
}

async function readStatsConfigFile(file) {
  if (!(await exists(file))) return null;
  const parsed = safeJson(await fs.readFile(file, 'utf8').catch(() => ''));
  return parsed && typeof parsed === 'object' ? { ...parsed, configFile: file } : null;
}

async function readStatsLocalConfig(cwd, home, explicitPath) {
  const candidates = explicitPath
    ? [path.resolve(expandHome(explicitPath, home))]
    : [path.join(home, '.takomi', 'stats.local.json'), path.join(cwd, '.takomi-stats.local.json')];
  const configs = [];
  for (const file of candidates) {
    const parsed = await readStatsConfigFile(file);
    if (parsed) configs.push(parsed);
  }
  return {
    configFiles: configs.map(c => c.configFile),
    sessionRoots: configs.flatMap(c => Array.isArray(c.sessionRoots) ? c.sessionRoots : c.sessionRoots ? [c.sessionRoots] : []),
    sessionsRoot: configs.flatMap(c => Array.isArray(c.sessionsRoot) ? c.sessionsRoot : c.sessionsRoot ? [c.sessionsRoot] : []),
    runHistory: configs.flatMap(c => Array.isArray(c.runHistory) ? c.runHistory : c.runHistory ? [c.runHistory] : []),
    runHistoryFiles: configs.flatMap(c => Array.isArray(c.runHistoryFiles) ? c.runHistoryFiles : c.runHistoryFiles ? [c.runHistoryFiles] : []),
    projectRoots: configs.flatMap(c => Array.isArray(c.projectRoots) ? c.projectRoots : c.projectRoots ? [c.projectRoots] : []),
  };
}

export async function collectTakomiStats(opts = {}) {
  const home = opts.home || os.homedir();
  const cwd = opts.cwd || process.cwd();
  const localConfig = await readStatsLocalConfig(cwd, home, opts.statsConfig || process.env.TAKOMI_STATS_CONFIG);
  const rawEvents = [], rawSessions = [], rawTasks = [];
  const globalSessions = path.resolve(path.join(home, '.pi', 'agent', 'sessions'));
  const projectSessions = path.resolve(path.join(cwd, '.pi', 'agent', 'sessions'));
  const configuredProjectRoots = [
    ...splitPathList(localConfig.projectRoots, home),
    ...splitPathList(opts.projectRoot || opts.projectRoots || process.env.TAKOMI_STATS_PROJECT_ROOTS, home),
  ];
  const extraSessionRoots = [
    ...splitPathList(localConfig.sessionsRoot || localConfig.sessionRoots, home),
    ...splitPathList(opts.sessionsRoot || opts.sessionRoots || process.env.TAKOMI_STATS_SESSION_ROOTS, home),
  ];
  const sessionSources = uniqByPath([
    { source: 'pi-global', root: globalSessions, default: true },
    ...(projectSessions !== globalSessions ? [{ source: 'pi-project', root: projectSessions, default: true }] : []),
    { source: 'takomi-project', root: path.resolve(path.join(cwd, '.pi', 'takomi')), default: true },
    ...extraSessionRoots.map((root, index) => ({ source: `extra-session-${index + 1}`, root, default: false })),
  ]);
  const sourceRoots = [];
  const scannedRoots = new Set();
  async function scanSource(source) {
    const key = path.resolve(source.root);
    if (scannedRoots.has(key)) return;
    scannedRoots.add(key);
    const present = await exists(source.root);
    const filesScanned = present ? await scanPiSessions(source.root, source.source, rawEvents, rawSessions, rawTasks) : 0;
    sourceRoots.push({ ...source, exists: present, files: filesScanned });
  }
  for (const source of sessionSources) await scanSource(source);

  const linkedSessionRoots = await discoverSessionLinkedRoots(rawSessions);
  const discoveredSessionRoots = await discoverProjectSessionRoots(configuredProjectRoots);
  for (const root of linkedSessionRoots) await scanSource({ source: 'project-linked', root, default: false });
  for (const [index, root] of discoveredSessionRoots.entries()) await scanSource({ source: `project-root-${index + 1}`, root, default: false });
  const sinceDay = parseSince(opts.since);
  const events = rawEvents.filter(e => !sinceDay || e.day >= sinceDay);
  const sessionRows = rawSessions.filter(s => !sinceDay || dayOf(s.end || s.start) >= sinceDay);
  const taskRows = rawTasks.filter(t => !sinceDay || dayOf(t.end || t.start) >= sinceDay);
  const runHistoryFiles = uniqByPath([
    { file: path.resolve(path.join(home, '.pi', 'agent', 'run-history.jsonl')), default: true },
    ...splitPathList(localConfig.runHistory || localConfig.runHistoryFiles, home).map((file) => ({ file, default: false })),
    ...splitPathList(opts.runHistory || process.env.TAKOMI_STATS_RUN_HISTORY, home).map((file) => ({ file, default: false })),
  ], 'file');
  const runs = [];
  const runHistorySources = [];
  for (const entry of runHistoryFiles) {
    const present = await exists(entry.file);
    const fileRuns = present ? await scanRunHistory(entry.file) : [];
    runs.push(...fileRuns);
    runHistorySources.push({ ...entry, exists: present, runs: fileRuns.length });
  }
  const byDay = new Map(), byModel = new Map(), bySource = new Map(), byProject = new Map(), byTool = new Map(), byRole = new Map(), byStage = new Map(), byWorkflow = new Map();
  let totals = { input: 0, cache: 0, output: 0, total: 0, cost: 0, events: events.filter(e => e.kind === 'usage').length, toolCalls: 0, turns: 0 };
  for (const s of sessionRows) { totals.toolCalls += s.toolCalls; totals.turns += s.turns; }
  for (const e of events) {
    if (e.kind === 'tool') { add(byTool, e.tool || 'unknown', { total: 0, events: 1 }); continue; }
    if (e.kind === 'role') {
      add(byRole, e.role || 'unknown', { total: 0, events: 1 });
      add(byStage, e.stage || 'unknown', { total: 0, events: 1 });
      add(byWorkflow, e.workflow || 'unknown', { total: 0, events: 1 });
      continue;
    }
    totals.input += e.input; totals.cache += e.cache; totals.output += e.output; totals.total += e.total; totals.cost += e.cost;
    add(byDay, e.day, e); add(byModel, e.model, e); add(bySource, e.source, e); add(byProject, e.project, e);
  }
  const byAgent = new Map(); let longestRun = null;
  for (const r of runs) { add(byAgent, r.agent || 'unknown', { total: 0, events: 1 }); if (!longestRun || (+r.duration||0) > (+longestRun.duration||0)) longestRun = r; }
  const topSessions = [...sessionRows].sort((a,b)=>(b.activeMs||0)-(a.activeMs||0) || b.turns-a.turns || b.toolCalls-a.toolCalls).slice(0, 20);
  const topTasks = [...taskRows].sort((a,b)=>taskDuration(b)-taskDuration(a) || b.toolCalls-a.toolCalls).slice(0, 20);
  const mostSubagentsSession = [...sessionRows].sort((a,b)=>b.subagentCalls-a.subagentCalls)[0] || null;
  return { generatedAt: new Date().toISOString(), cwd, since: sinceDay, statsConfigFiles: localConfig.configFiles || [], totals, sessions: new Set([...events.map(e => e.session), ...sessionRows.map(s => s.session)]).size, sourceRoots, runHistorySources, byDay: [...byDay.values()].sort((a,b)=>a.key.localeCompare(b.key)), byModel: [...byModel.values()].sort((a,b)=>b.total-a.total), bySource: [...bySource.values()].sort((a,b)=>b.total-a.total), byProject: [...byProject.values()].sort((a,b)=>b.total-a.total), byTool: [...byTool.values()].sort((a,b)=>b.events-a.events), byRole: [...byRole.values()].sort((a,b)=>b.events-a.events), byStage: [...byStage.values()].sort((a,b)=>b.events-a.events), byWorkflow: [...byWorkflow.values()].sort((a,b)=>b.events-a.events), byAgent: [...byAgent.values()].sort((a,b)=>b.events-a.events), sessionRows, taskRows, topSessions, topTasks, mostSubagentsSession, runs, longestRun, recent: events.sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||'')).slice(0, 10) };
}

// ── Streak Calculation ──────────────────────────────────────────────────────
function calcStreaks(byDay) {
  if (!byDay.length) return { current: 0, longest: 0, quietDays: 0 };
  const daySet = new Set(byDay.map(d => d.key));
  const today = new Date(); today.setHours(0,0,0,0);
  // current streak: walk back from today
  let current = 0;
  for (let d = new Date(today); ; d.setDate(d.getDate() - 1)) {
    const key = d.toISOString().slice(0, 10);
    if (daySet.has(key)) current++; else break;
  }
  // longest streak: walk all sorted days
  const sorted = [...daySet].sort();
  let longest = 0, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]); prev.setDate(prev.getDate() + 1);
    if (prev.toISOString().slice(0, 10) === sorted[i]) { run++; } else { longest = Math.max(longest, run); run = 1; }
  }
  longest = Math.max(longest, run);
  // quiet days
  const first = new Date(sorted[0]);
  const span = Math.round((today - first) / 86400000) + 1;
  return { current, longest, quietDays: Math.max(0, span - sorted.length) };
}

// ── GitHub-style Heatmap Grid ───────────────────────────────────────────────
function heatmapGrid(byDay) {
  const dayMap = new Map(byDay.map(d => [d.key, d.total]));
  const max = Math.max(1, ...byDay.map(d => d.total));

  // Determine range: last ~26 weeks (half year) ending at current week
  const today = new Date(); today.setHours(0,0,0,0);
  // End at end of current week (Sunday)
  const endDate = new Date(today);
  const todayDow = endDate.getDay(); // 0=Sun, 1=Mon...
  if (todayDow !== 0) endDate.setDate(endDate.getDate() + (7 - todayDow));
  // Start 26 weeks back on Monday
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (26 * 7) + 1);
  while (startDate.getDay() !== 1) startDate.setDate(startDate.getDate() - 1);

  // Build grid: 7 rows (Mon..Sun), N columns (weeks)
  const weeks = [];
  const monthPositions = []; // { col, label }
  const cursor = new Date(startDate);
  let col = 0;
  let lastMonth = -1;

  while (cursor <= endDate) {
    const week = [];
    for (let dow = 0; dow < 7; dow++) {
      const key = cursor.toISOString().slice(0, 10);
      const val = cursor <= today ? (dayMap.get(key) || 0) : -1; // -1 = future
      week.push(val);
      // Track month transitions on the Monday of each week
      if (dow === 0) {
        const m = cursor.getMonth();
        if (m !== lastMonth) {
          const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          monthPositions.push({ col, label: monthNames[m] });
          lastMonth = m;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
    col++;
  }

  // Intensity cell — use ■ for filled, · for empty
  const SQ = '■';
  const EMPTY = '·';
  function cell(val) {
    if (val < 0) return ' ';  // future
    if (val === 0) return pc.gray(EMPTY);
    const x = val / max;
    if (x < 0.12) return pc.dim(pc.cyan(SQ));
    if (x < 0.30) return pc.cyan(SQ);
    if (x < 0.55) return pc.blue(SQ);
    if (x < 0.80) return pc.magenta(SQ);
    return pc.bold(pc.magenta(SQ));
  }

  const dayLabels = ['Mon','   ','Wed','   ','Fri','   ','Sun'];
  const rows = [];

  // Each cell is 2 chars wide (char + space) in the grid
  for (let dow = 0; dow < 7; dow++) {
    const prefix = pc.dim(dayLabels[dow]);
    const cells = weeks.map(w => cell(w[dow]));
    rows.push(`    ${prefix} ${cells.join(' ')}`);
  }

  // Month label row — positioned under the correct columns
  // Each column is 2 chars wide (cell + space separator)
  let labelStr = '';
  let prevEnd = 0;
  for (const ml of monthPositions) {
    const targetPos = ml.col * 2; // 2 chars per column (char + space)
    const gap = Math.max(0, targetPos - prevEnd);
    labelStr += ' '.repeat(gap) + ml.label;
    prevEnd = targetPos + ml.label.length;
  }
  rows.push(`        ${pc.dim(labelStr)}`);

  // Legend row
  rows.push('');
  rows.push(`    ${pc.dim('Less')} ${pc.gray(EMPTY)} ${pc.dim(pc.cyan(SQ))} ${pc.cyan(SQ)} ${pc.blue(SQ)} ${pc.magenta(SQ)} ${pc.bold(pc.magenta(SQ))} ${pc.dim('More')}`);

  return rows.join('\n');
}

// ── Box Drawing Helpers ─────────────────────────────────────────────────────
function hrule(w, ch = '─') { return ch.repeat(w); }

function center(text, width) {
  const vl = visLen(text);
  const pad = Math.max(0, Math.floor((width - vl) / 2));
  return ' '.repeat(pad) + text;
}

function truncateMiddle(text, width) {
  const value = String(text || '');
  if (visLen(value) <= width) return value;
  if (width <= 1) return '…';
  const keep = width - 1;
  const left = Math.ceil(keep / 2);
  const right = Math.floor(keep / 2);
  return value.slice(0, left) + '…' + value.slice(-right);
}

function shortDate(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return day || '-';
  const d = new Date(`${day}T00:00:00Z`);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function cleanProjectName(value, width = 36) {
  let label = String(value || 'unknown').replace(/\\/g, '/').split('/').filter(Boolean).pop() || String(value || 'unknown');
  label = label.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  label = label.replace(/^.*?\b20\d{2}\s+\d{2}\s+\d{2}\s*/u, '').trim() || label;
  return truncateMiddle(label, width);
}

function bar(value, max, width = 18) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const exact = ratio * width;
  if (value <= 0 || exact <= 0) return pc.dim('░'.repeat(width));
  if (exact < 1) return pc.blue('▏') + pc.dim('░'.repeat(Math.max(0, width - 1)));
  const filled = Math.max(1, Math.round(exact));
  return pc.blue('█'.repeat(filled)) + pc.dim('░'.repeat(Math.max(0, width - filled)));
}

function sectionTitle(title, width) {
  return ['  ' + pc.bold(pc.cyan(title)), '  ' + pc.dim(hrule(width - 4))].join('\n');
}

function statCard(value, label, color = pc.white) {
  return { value: String(value), label, color };
}

// ── Table Helper ────────────────────────────────────────────────────────────
function renderTable(title, rows, columns) {
  const lines = [];
  lines.push('  ' + pc.bold(pc.cyan(title)));
  lines.push('  ' + pc.dim(hrule(columns.reduce((s, c) => s + c.width, 0) + columns.length * 2)));
  for (const row of rows) {
    let line = '  ';
    for (const col of columns) {
      const val = String(col.get(row));
      line += col.align === 'right' ? ansiPadStart(val, col.width) : ansiPadEnd(val, col.width);
      line += '  ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

function sessionLabel(row, width = 36) {
  const project = row.project || row.cwd || row.key || 'unknown';
  return project.length > width ? '…' + project.slice(-(width - 1)) : project;
}
function sessionDay(row) { return dayOf(row.start || row.end).slice(5) || '??-??'; }
function sessionDuration(row) {
  return row?.activeMs ?? activeDuration(row?.activityIntervals || []);
}
function taskDuration(row) {
  return row?.activeMs ?? activeDuration(row?.activityIntervals || []);
}
function taskLabel(row, width = 34) {
  const label = row?.title || row?.project || row?.session || 'unknown';
  return label.length > width ? label.slice(0, width - 1) + '…' : label;
}
function runLabel(run, width = 28) {
  const label = run ? `${run.agent || 'unknown'}: ${run.task || ''}`.trim() : '-';
  return label.length > width ? label.slice(0, width - 1) + '…' : label;
}
function indentWrap(text, width = 76, indent = '      ') {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > width && line) { lines.push(line); line = word; }
    else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i ? indent : '') + l).join('\n');
}
function renderFullList(title, rows, renderRow, limit = 20) {
  const lines = ['\n' + pc.bold(pc.magenta('Takomi Stats')), renderTable(title, [], [{ width: 74 }])];
  rows.slice(0, limit).forEach((row, i) => lines.push(renderRow(row, i)));
  lines.push('\n' + pc.dim('Privacy: metadata only · no raw prompts or transcripts'));
  return lines.join('\n');
}

function renderSourceDiagnostics(stats) {
  const lines = ['\n' + pc.bold(pc.magenta('Takomi Stats'))];
  if (stats.statsConfigFiles?.length) {
    lines.push('  ' + pc.dim(`Local config: ${stats.statsConfigFiles.map(file => truncateMiddle(file, 54)).join(' · ')}`));
  }
  lines.push(renderTable('Sources', stats.bySource, [
    { width: 22, align: 'left', get: r => pc.white(r.key) },
    { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
    { width: 14, align: 'right', get: r => pc.dim(r.events + ' events') },
  ]));
  if (stats.sourceRoots?.length) {
    lines.push('');
    lines.push(renderTable('Checked Session Roots', stats.sourceRoots, [
      { width: 18, align: 'left', get: r => pc.white(r.source) },
      { width: 8, align: 'right', get: r => pc.cyan(String(r.files || 0)) },
      { width: 8, align: 'left', get: r => pc.dim(r.exists ? 'files' : 'missing') },
      { width: 48, align: 'left', get: r => pc.dim(truncateMiddle(r.root, 48)) },
    ]));
  }
  if (stats.runHistorySources?.length) {
    lines.push('');
    lines.push(renderTable('Checked Run History', stats.runHistorySources, [
      { width: 8, align: 'right', get: r => pc.cyan(String(r.runs || 0)) },
      { width: 8, align: 'left', get: r => pc.dim(r.exists ? 'runs' : 'missing') },
      { width: 58, align: 'left', get: r => pc.dim(truncateMiddle(r.file, 58)) },
    ]));
  }
  lines.push('\n' + pc.dim('Privacy: metadata only · no raw prompts or transcripts'));
  return lines.join('\n');
}

function renderFocusedView(stats, opts = {}) {
  const view = opts.view;
  const limit = opts.limit || 20;
  if (!view || view === 'overview') return null;
  if (view === 'sources') return renderSourceDiagnostics(stats);
  if (view === 'projects-full' || view === 'project-full') return renderFullList('Top Projects — Full Names', stats.byProject, (r, i) => [
    `  ${pc.dim(String(i + 1).padStart(2, '0') + '.')} ${pc.white(r.key)}`,
    `      ${pc.cyan(fmtTokens(r.total))}  ${pc.dim(fmtMoney(r.cost))}  ${pc.dim(r.events + ' calls')}`,
  ].join('\n'), limit);
  if (view === 'sessions-full' || view === 'session-full') return renderFullList('Longest Active Sessions — Full Names', stats.topSessions, (r, i) => [
    `  ${pc.dim(String(i + 1).padStart(2, '0') + '.')} ${pc.white(r.project || r.cwd || r.key || 'unknown')}`,
    `      ${pc.cyan(ms(sessionDuration(r)))}  ${pc.dim(r.turns + ' turns')}  ${pc.dim(r.toolCalls + ' tools')}`,
    `      ${pc.dim(r.file || '')}`,
  ].join('\n'), limit);
  if (view === 'tasks-full' || view === 'task-full') return renderFullList('Longest Active Turns — Full Prompts', stats.topTasks || [], (r, i) => [
    `  ${pc.dim(String(i + 1).padStart(2, '0') + '.')} ${pc.cyan(ms(taskDuration(r)))}  ${pc.magenta(r.toolCalls + ' tools')}  ${pc.dim(dayOf(r.start))}`,
    `      ${pc.white(indentWrap(r.title || r.project || r.session || 'unknown'))}`,
    `      ${pc.dim(r.project || '')}`,
  ].join('\n'), limit);
  const tables = {
    models: ['Top Models', stats.byModel, [
      { width: 26, align: 'left', get: r => pc.white(r.key) },
      { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
      { width: 10, align: 'right', get: r => pc.dim(fmtMoney(r.cost)) },
      { width: 12, align: 'right', get: r => pc.dim(r.events + ' calls') },
    ]],
    sources: ['Sources', stats.bySource, [
      { width: 22, align: 'left', get: r => pc.white(r.key) },
      { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
      { width: 14, align: 'right', get: r => pc.dim(r.events + ' events') },
    ]],
    projects: ['Top Projects', stats.byProject, [
      { width: 42, align: 'left', get: r => pc.white(r.key.length > 42 ? '…' + r.key.slice(-41) : r.key) },
      { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
      { width: 10, align: 'right', get: r => pc.dim(fmtMoney(r.cost)) },
      { width: 12, align: 'right', get: r => pc.dim(r.events + ' calls') },
    ]],
    agents: ['Main Agent Roles', stats.byRole, [
      { width: 24, align: 'left', get: r => pc.white(r.key) },
      { width: 8, align: 'right', get: r => pc.cyan(String(r.events)) },
      { width: 12, align: 'left', get: () => pc.dim('state hits') },
    ]],
    subagents: ['Top Subagents', stats.byAgent, [
      { width: 24, align: 'left', get: r => pc.white(r.key) },
      { width: 8, align: 'right', get: r => pc.cyan(String(r.events)) },
      { width: 8, align: 'left', get: () => pc.dim('runs') },
    ]],
    tools: ['Top Tools', stats.byTool, [
      { width: 28, align: 'left', get: r => pc.white(r.key) },
      { width: 10, align: 'right', get: r => pc.cyan(String(r.events)) },
      { width: 8, align: 'left', get: () => pc.dim('calls') },
    ]],
    sessions: ['Longest Active Sessions', stats.topSessions, [
      { width: 6, align: 'left', get: r => pc.dim(sessionDay(r)) },
      { width: 30, align: 'left', get: r => pc.white(sessionLabel(r, 30)) },
      { width: 9, align: 'right', get: r => pc.cyan(ms(sessionDuration(r))) },
      { width: 8, align: 'right', get: r => pc.cyan(String(r.turns)) },
      { width: 8, align: 'left', get: () => pc.dim('turns') },
      { width: 8, align: 'right', get: r => pc.cyan(String(r.toolCalls)) },
      { width: 8, align: 'left', get: () => pc.dim('tools') },
    ]],
    tasks: ['Longest Active Turns', stats.topTasks || [], [
      { width: 6, align: 'left', get: r => pc.dim(dayOf(r.start).slice(5)) },
      { width: 9, align: 'right', get: r => pc.cyan(ms(taskDuration(r))) },
      { width: 11, align: 'right', get: r => pc.magenta(`${r.toolCalls} tools`) },
      { width: 36, align: 'left', get: r => pc.white(taskLabel(r, 36)) },
    ]],
    daily: ['Daily Usage', [...stats.byDay].reverse(), [
      { width: 12, align: 'left', get: r => pc.white(r.key) },
      { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
      { width: 10, align: 'right', get: r => pc.dim(fmtMoney(r.cost)) },
      { width: 12, align: 'right', get: r => pc.dim(r.events + ' calls') },
    ]],
  };
  const spec = tables[view === 'project' ? 'projects' : view];
  if (!spec) return null;
  const [title, rows, cols] = spec;
  const suffix = stats.since ? pc.dim(`\n  Since: ${stats.since}`) : '';
  return ['\n' + pc.bold(pc.magenta('Takomi Stats')), suffix, renderTable(title, rows.slice(0, limit), cols), '\n' + pc.dim('Privacy: metadata only · no raw prompts or transcripts')].filter(Boolean).join('\n');
}

// ── Main Render ─────────────────────────────────────────────────────────────
function renderProfileCard(stats, { width, topModel, peak, streaks, cacheRatio }) {
  const user = process.env.USERNAME || process.env.USER || 'local';
  const outer = Math.max(68, Math.min(width - 2, 84));
  const inner = outer - 2;
  const line = (left, right = '') => {
    const leftText = String(left || '');
    const rightText = String(right || '');
    const gap = Math.max(1, inner - 2 - visLen(leftText) - visLen(rightText));
    return `  │ ${ansiPadEnd(leftText + ' '.repeat(gap) + rightText, inner - 2)} │`;
  };
  const solo = (text) => `  │ ${ansiPadEnd(text, inner - 2)} │`;
  const updated = shortDate(stats.generatedAt.slice(0, 10));
  const metricLine = [
    `${pc.bold(pc.blue(fmtTokens(stats.totals.total)))} Tokens`,
    `${pc.bold(pc.cyan(fmtPercent(cacheRatio)))} Cached`,
    `${pc.bold(pc.yellow(fmtMoneyShort(stats.totals.cost)))} Est. Cost`,
    `${pc.bold(pc.white(String(stats.sessions)))} Sessions`,
    `${pc.bold(pc.blue(fmtCount(stats.totals.toolCalls)))} Tool Calls`,
  ].join(pc.dim('  '));
  const contextLine = [
    `Peak: ${peak ? `${fmtTokens(peak.total)} on ${shortDate(peak.key)}` : '-'}`,
    `Top model: ${topModel}`,
    `Streak: ${streaks.current}d / ${streaks.longest}d`,
  ].join('        ');
  return [
    `  ╭${hrule(inner)}╮`,
    line(pc.bold(pc.white('Takomi')), pc.dim(`@${user}`)),
    line(pc.dim('Coding activity dashboard'), pc.dim(`Updated ${updated}`)),
    `  ├${hrule(inner)}┤`,
    solo(metricLine),
    solo(pc.dim(contextLine)),
    `  ╰${hrule(inner)}╯`,
  ].join('\n');
}

function renderHighlights(stats, { peak, longestSession, longestTask, cacheRatio }) {
  const topProject = stats.byProject[0] || null;
  const rows = [
    ['Peak day', peak ? `${fmtTokens(peak.total)} tokens · ${shortDate(peak.key)}` : '-'],
    ['Longest session', longestSession ? `${ms(sessionDuration(longestSession))} · ${longestSession.turns} turns · ${longestSession.toolCalls} tools` : '-'],
    ['Longest turn', longestTask ? `${ms(taskDuration(longestTask))} · ${longestTask.toolCalls} tools` : '-'],
    ['Top project', topProject ? `${cleanProjectName(topProject.key, 34)} · ${fmtTokens(topProject.total)}` : '-'],
    ['Cache efficiency', `${fmtPercent(cacheRatio)} · ${fmtTokens(stats.totals.cache)} cached`],
  ];
  const labelW = 16;
  return [
    sectionTitle('Highlights', 80),
    ...rows.map(([label, value]) => `  ${pc.dim(ansiPadEnd(label, labelW))} ${pc.white(value)}`),
  ].join('\n');
}

function renderSignals(stats) {
  const topModel = stats.byModel[0] || null;
  const topProject = stats.byProject[0] || null;
  const readCalls = stats.byTool.find(t => t.key === 'read')?.events || 0;
  const bashCalls = stats.byTool.find(t => t.key === 'bash')?.events || 0;
  const topAgent = stats.byAgent[0] || null;
  const lines = [];
  if (topProject) lines.push(`Heaviest project: ${cleanProjectName(topProject.key, 42)} at ${fmtTokens(topProject.total)} tokens`);
  if (topModel) lines.push(`Dominant model: ${topModel.key} handles ${fmtPercent(stats.totals.total ? topModel.total / stats.totals.total : 0)} of token volume`);
  if (readCalls || bashCalls) lines.push(`Tool-heavy behavior: read + bash = ${fmtCount(readCalls + bashCalls)} calls`);
  if (topAgent) lines.push(`Most-used subagent: ${topAgent.key} with ${fmtCount(topAgent.events)} runs`);
  if (!lines.length) return '';
  return [sectionTitle('Signals', 80), ...lines.slice(0, 4).map(line => `  ${pc.dim('•')} ${pc.white(line)}`)].join('\n');
}

function renderRankedBars(title, rows, { name, value, right, limit = 5, width = 18 }) {
  const visible = rows.slice(0, limit);
  if (!visible.length) return '';
  const max = Math.max(1, ...visible.map(value));
  const nameW = 32;
  const lines = [sectionTitle(title, 80)];
  for (const row of visible) {
    const rowName = ansiPadEnd(pc.white(name(row)), nameW);
    const amount = ansiPadStart(pc.cyan(fmtTokens(value(row))), 9);
    const suffix = right ? `  ${pc.dim(right(row))}` : '';
    lines.push(`  ${rowName} ${amount}  ${bar(value(row), max, width)}${suffix}`);
  }
  return lines.join('\n');
}

function renderCompactSessions(stats, limit = 4) {
  const rows = stats.topSessions.slice(0, limit);
  if (!rows.length) return '';
  const lines = [sectionTitle('Sessions', 80)];
  for (const row of rows) {
    lines.push(`  ${pc.dim(sessionDay(row))}  ${ansiPadEnd(pc.white(cleanProjectName(row.project || row.cwd || row.key, 34)), 34)}  ${ansiPadStart(pc.cyan(ms(sessionDuration(row))), 8)}  ${pc.dim(`${row.turns} turns · ${row.toolCalls} tools`)}`);
  }
  return lines.join('\n');
}

function renderCompactTools(stats, limit = 6) {
  const tools = stats.byTool.slice(0, limit);
  const agents = stats.byAgent.slice(0, 4);
  if (!tools.length && !agents.length) return '';
  const lines = [sectionTitle('Tools / Subagents', 80)];
  if (tools.length) lines.push(`  ${pc.dim('Tools')}      ${tools.map(t => `${pc.white(t.key)} ${pc.cyan(fmtCount(t.events))}`).join(pc.dim('  ·  '))}`);
  if (agents.length) lines.push(`  ${pc.dim('Subagents')}  ${agents.map(a => `${pc.white(a.key)} ${pc.cyan(fmtCount(a.events))}`).join(pc.dim('  ·  '))}`);
  return lines.join('\n');
}

function renderTakomiStatsOverview(stats, opts = {}) {
  const W = Math.min(process.stdout.columns || 80, 88);
  const topModel = stats.byModel[0]?.key || 'unknown';
  const peak = stats.byDay.reduce((a,b) => b.total > (a?.total||0) ? b : a, null);
  const streaks = calcStreaks(stats.byDay);
  const longestSession = stats.topSessions[0] || null;
  const longestTask = stats.topTasks?.[0] || null;
  const cacheRatio = stats.totals.total ? stats.totals.cache / stats.totals.total : 0;
  const limit = opts.limit || 5;
  const lines = [''];

  lines.push(renderProfileCard(stats, { width: W, topModel, peak, streaks, cacheRatio }));
  if (stats.since) lines.push('  ' + pc.dim(`Since: ${stats.since}`));

  if (!stats.totals.events && !stats.sessions && !stats.runs?.length) {
    lines.push('');
    lines.push(sectionTitle('No stats found yet', 80));
    lines.push('  ' + pc.white('Takomi did not find Pi session metadata in the default locations.'));
    lines.push('  ' + pc.dim('Checked ~/.pi/agent/sessions, project .pi/agent/sessions, and project .pi/takomi.'));
    lines.push('  ' + pc.dim('Use `takomi stats sources` for diagnostics or `--sessions-root` for custom/private roots.'));
    lines.push('');
    lines.push('  ' + pc.dim(hrule(W - 4)));
    lines.push('  ' + pc.dim('Privacy: metadata only · no raw prompts or transcripts'));
    lines.push('  ' + pc.dim('Costs are estimates when provider prices are unknown.'));
    lines.push('');
    return lines.join('\n');
  }

  lines.push('');
  lines.push(sectionTitle('Activity', 80));
  lines.push(heatmapGrid(stats.byDay));

  lines.push('');
  lines.push(renderHighlights(stats, { peak, longestSession, longestTask, cacheRatio }));

  const signals = renderSignals(stats);
  if (signals) { lines.push(''); lines.push(signals); }

  lines.push('');
  lines.push(renderRankedBars('Models', stats.byModel, {
    limit,
    name: r => truncateMiddle(r.key, 32),
    value: r => r.total,
    right: r => fmtMoneyShort(r.cost),
  }));

  if (stats.byProject.length) {
    lines.push('');
    lines.push(renderRankedBars('Projects', stats.byProject, {
      limit: Math.min(limit, 6),
      name: r => cleanProjectName(r.key, 32),
      value: r => r.total,
    }));
  }

  const sessions = renderCompactSessions(stats, Math.min(limit, 5));
  if (sessions) { lines.push(''); lines.push(sessions); }

  const tools = renderCompactTools(stats, Math.min(limit, 5));
  if (tools) { lines.push(''); lines.push(tools); }

  lines.push('');
  lines.push('  ' + pc.dim(hrule(W - 4)));
  lines.push('  ' + pc.dim('Privacy: metadata only · no raw prompts or transcripts'));
  lines.push('  ' + pc.dim('Costs are estimates when provider prices are unknown.'));
  lines.push('  ' + pc.dim('Use `takomi stats --full` for the detailed debug-style view.'));
  lines.push('');
  return lines.join('\n');
}

function renderTakomiStatsFull(stats, opts = {}) {
  const focused = renderFocusedView(stats, opts);
  if (focused) return focused;
  const W = Math.min(process.stdout.columns || 80, 86);
  const topModel = stats.byModel[0]?.key || 'unknown';
  const peak = stats.byDay.reduce((a,b) => b.total > (a?.total||0) ? b : a, null);
  const streaks = calcStreaks(stats.byDay);
  const longestSession = stats.topSessions[0] || null;
  const longestTask = stats.topTasks?.[0] || null;
  const lines = [];

  // ── Header ────────────────────────────────────────────────────────────
  lines.push('');
  lines.push(pc.cyan('  ' + hrule(W - 4, '━')));
  lines.push('');
  lines.push(center(pc.bold(pc.white('T A K O M I   S T A T S')), W));
  const user = process.env.USERNAME || process.env.USER || 'local';
  lines.push(center(pc.dim(`@${user}  ·  Takomi`), W));
  lines.push('');
  lines.push(pc.cyan('  ' + hrule(W - 4)));

  // ── Stat Cards Row 1 ─────────────────────────────────────────────────
  const cards1 = [
    statCard(fmtTokens(stats.totals.total), 'Tokens'),
    statCard(fmtPercent(stats.totals.total ? stats.totals.cache / stats.totals.total : 0), 'Cache Eff.'),
    statCard(fmtMoney(stats.totals.cost), 'Est. Cost'),
    statCard(String(stats.sessions), 'Sessions'),
    statCard(String(stats.totals.turns), 'Main Turns'),
  ];

  function buildCardLines(cards) {
    const gap = '  ';
    const cardW = Math.max(10, Math.floor((W - 4 - gap.length * (cards.length - 1)) / cards.length));
    let vStr = '  ';
    let lStr = '  ';
    cards.forEach((c, index) => {
      const value = truncateMiddle(c.value, cardW);
      const label = truncateMiddle(c.label, cardW);
      const vPad = Math.max(0, Math.floor((cardW - visLen(value)) / 2));
      const lPad = Math.max(0, Math.floor((cardW - visLen(label)) / 2));
      const color = c.color || pc.white;
      const vContent = ' '.repeat(vPad) + pc.bold(color(value));
      const lContent = ' '.repeat(lPad) + pc.dim(color(label));
      vStr += ansiPadEnd(vContent, cardW);
      lStr += ansiPadEnd(lContent, cardW);
      if (index < cards.length - 1) { vStr += gap; lStr += gap; }
    });
    return [vStr, lStr];
  }

  lines.push('');
  const [v1, l1] = buildCardLines(cards1);
  lines.push(v1);
  lines.push(l1);

  // ── Stat Cards Row 2 ─────────────────────────────────────────────────
  lines.push('');
  const cards2 = [
    statCard(peak ? fmtTokens(peak.total) : '-', 'Peak Day'),
    statCard(topModel, 'Top Model'),
    statCard(String(stats.totals.toolCalls), 'Tool Calls'),
    statCard(`${streaks.current} days`, 'Current'),
    statCard(`${streaks.longest} days`, 'Best Streak'),
  ];

  const [v2, l2] = buildCardLines(cards2);
  lines.push(v2);
  lines.push(l2);

  // ── Duration Cards ────────────────────────────────────────────────────
  lines.push('');
  const cards3 = [
    statCard(longestSession ? ms(sessionDuration(longestSession)) : '-', 'Longest Sess', pc.cyan),
    statCard(longestSession ? String(longestSession.turns) : '-', 'Max Turns', pc.cyan),
    statCard(longestTask ? ms(taskDuration(longestTask)) : '-', 'Longest Turn', pc.magenta),
    statCard(longestTask ? String(longestTask.toolCalls) : '-', 'Max Tools', pc.magenta),
    statCard(stats.mostSubagentsSession ? String(stats.mostSubagentsSession.subagentCalls) : '0', 'Max Subagents', pc.blue),
  ];
  const [v3, l3] = buildCardLines(cards3);
  lines.push(v3);
  lines.push(l3);

  // ── Info line ─────────────────────────────────────────────────────────
  lines.push('');
  const infoText = `Peak: ${peak?.key || '-'}  ·  ${streaks.quietDays} quiet days  ·  ${stats.totals.events.toLocaleString()} events  ·  active gaps ≤15m${stats.since ? `  ·  since ${stats.since}` : ''}`;
  lines.push(center(pc.dim(infoText), W));

  lines.push('');
  lines.push(pc.cyan('  ' + hrule(W - 4, '━')));

  // ── Activity Heatmap ────────────────────────────────────────────────────
  lines.push('');
  lines.push('  ' + pc.bold(pc.cyan('Token Activity')));
  lines.push('  ' + pc.dim(hrule(W - 4)));
  lines.push(heatmapGrid(stats.byDay));

  // ── Models Table ────────────────────────────────────────────────────────
  lines.push('');
  const modelLimit = opts.limit || 8;
  lines.push(renderTable('Top Models', stats.byModel.slice(0, modelLimit), [
    { width: 24, align: 'left',  get: r => pc.white(r.key) },
    { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
    { width: 10, align: 'right', get: r => pc.dim(fmtMoney(r.cost)) },
    { width: 12, align: 'right', get: r => pc.dim(r.events + ' calls') },
  ]));

  // ── Projects Table ──────────────────────────────────────────────────────
  if (stats.byProject.length) {
    lines.push('');
    lines.push(renderTable('Top Projects', stats.byProject.slice(0, 5), [
      { width: 34, align: 'left',  get: r => pc.white(r.key.length > 34 ? '…' + r.key.slice(-33) : r.key) },
      { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
      { width: 10, align: 'right', get: r => pc.dim(fmtMoney(r.cost)) },
    ]));
  }

  // ── Main Agent Roles Table ──────────────────────────────────────────────
  if (stats.byRole.length) {
    lines.push('');
    lines.push(renderTable('Main Agent Roles', stats.byRole.slice(0, modelLimit), [
      { width: 20, align: 'left',  get: r => pc.white(r.key) },
      { width: 8,  align: 'right', get: r => pc.cyan(String(r.events)) },
      { width: 10, align: 'left',  get: r => pc.dim('state hits') },
    ]));
  }

  // ── Main Session Table ──────────────────────────────────────────────────
  if (stats.topSessions.length) {
    lines.push('');
    lines.push(renderTable('Longest Active Sessions', stats.topSessions.slice(0, 5), [
      { width: 6,  align: 'left',  get: r => pc.dim(sessionDay(r)) },
      { width: 28, align: 'left',  get: r => pc.white(sessionLabel(r, 28)) },
      { width: 9,  align: 'right', get: r => pc.cyan(ms(sessionDuration(r))) },
      { width: 8,  align: 'right', get: r => pc.cyan(String(r.turns)) },
      { width: 8,  align: 'left',  get: r => pc.dim('turns') },
      { width: 8,  align: 'right', get: r => pc.cyan(String(r.toolCalls)) },
      { width: 6,  align: 'left',  get: r => pc.dim('tools') },
    ]));
  }

  // ── Longest Active Turns ───────────────────────────────────────────────
  if (stats.topTasks?.length) {
    lines.push('');
    lines.push(renderTable('Longest Active Turns', stats.topTasks.slice(0, 5), [
      { width: 6,  align: 'left',  get: r => pc.dim(dayOf(r.start).slice(5)) },
      { width: 9,  align: 'right', get: r => pc.cyan(ms(taskDuration(r))) },
      { width: 11, align: 'right', get: r => pc.magenta(`${r.toolCalls} tools`) },
      { width: 34, align: 'left',  get: r => pc.white(taskLabel(r, 34)) },
    ]));
  }

  // ── Longest Subagent Run ───────────────────────────────────────────────
  if (stats.longestRun) {
    lines.push('');
    lines.push(renderTable('Longest Subagent Run', [stats.longestRun], [
      { width: 22, align: 'left',  get: r => pc.white(r.agent || 'unknown') },
      { width: 10, align: 'right', get: r => pc.cyan(ms(+r.duration || 0)) },
      { width: 30, align: 'left',  get: r => pc.dim(runLabel(r, 30)) },
    ]));
  }

  // ── Tools Table ─────────────────────────────────────────────────────────
  if (stats.byTool.length) {
    lines.push('');
    lines.push(renderTable('Top Tools', stats.byTool.slice(0, modelLimit), [
      { width: 24, align: 'left',  get: r => pc.white(r.key) },
      { width: 8,  align: 'right', get: r => pc.cyan(String(r.events)) },
      { width: 6,  align: 'left',  get: r => pc.dim('calls') },
    ]));
  }

  // ── Sources Table ───────────────────────────────────────────────────────
  lines.push('');
  lines.push(renderTable('Sources', stats.bySource, [
    { width: 20, align: 'left',  get: r => pc.white(r.key) },
    { width: 10, align: 'right', get: r => pc.cyan(fmtTokens(r.total)) },
    { width: 14, align: 'right', get: r => pc.dim(r.events + ' events') },
  ]));

  // ── Subagents Table ─────────────────────────────────────────────────────
  if (stats.byAgent.length) {
    lines.push('');
    lines.push(renderTable('Top Subagents', stats.byAgent.slice(0, modelLimit), [
      { width: 20, align: 'left',  get: r => pc.white(r.key) },
      { width: 8,  align: 'right', get: r => pc.cyan(String(r.events)) },
      { width: 6,  align: 'left',  get: r => pc.dim('runs') },
    ]));
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  lines.push('');
  lines.push('  ' + pc.dim(hrule(W - 4)));
  lines.push('  ' + pc.dim('Privacy: metadata only · no raw prompts or transcripts'));
  lines.push('  ' + pc.dim('Costs are estimates when provider prices are unknown.'));
  lines.push('');

  return lines.join('\n');
}

export function renderTakomiStats(stats, opts = {}) {
  const full = opts.full || opts.view === 'full';
  if (full) return renderTakomiStatsFull(stats, { ...opts, view: opts.view === 'full' ? undefined : opts.view });
  const focused = renderFocusedView(stats, opts);
  if (focused) return focused;
  return renderTakomiStatsOverview(stats, opts);
}

export async function printTakomiStats(options = {}) {
  const stats = await collectTakomiStats(options);
  if (options.json) console.log(JSON.stringify(stats, null, 2)); else console.log(renderTakomiStats(stats, options));
}
