import path from 'node:path';
import { defaultRunsDir, ensureDir, timestampId, writeJson } from './paths.mjs';

const VALID_KINDS = new Set(['video', 'image']);

export function normalizeRequest(input) {
  const kind = String(input.kind || 'video').toLowerCase();
  if (!VALID_KINDS.has(kind)) {
    throw new Error(`Invalid kind "${kind}". Expected video or image.`);
  }
  const prompt = String(input.prompt || '').trim();
  if (!prompt) {
    throw new Error('A non-empty prompt is required.');
  }
  const variations = Math.max(1, Number.parseInt(input.variations || '1', 10) || 1);
  return {
    schemaVersion: 1,
    kind,
    prompt,
    variations,
    aspectRatio: input.aspectRatio || input['aspect-ratio'] || undefined,
    durationSeconds: toOptionalNumber(input.durationSeconds || input.duration),
    mode: input.mode || (kind === 'video' ? 'text-to-video' : 'text-to-image'),
    modelHint: input.modelHint || input.model || 'best-available',
    outputDir: path.resolve(input.outputDir || input['output-dir'] || defaultRunsDir()),
    allowSpend: toOptionalBoolean(input.allowSpend ?? input['allow-spend'], false),
    extractFrames: Math.max(0, Number.parseInt(input.extractFrames || input['extract-frames'] || '0', 10) || 0),
    sourceAssets: normalizeList(input.sourceAssets || input.assets),
    projectUrl: input.projectUrl || input['project-url'] || undefined,
    reuseCurrentProject: toOptionalBoolean(input.reuseCurrentProject ?? input['reuse-current-project'], true),
    allowNewProject: toOptionalBoolean(input.allowNewProject ?? input['allow-new-project'], false),
    freshChatOnFailure: toOptionalBoolean(input.freshChatOnFailure ?? input['fresh-chat-on-failure'], true),
    editorWaitMs: toOptionalNumber(input.editorWaitMs || input['editor-wait-ms']),
    notes: input.notes || undefined,
  };
}

export function createPreparedRequest(args) {
  const request = normalizeRequest(args);
  const requestDir = ensureDir(path.join(request.outputDir, 'requests'));
  const requestPath = path.join(requestDir, `${timestampId('request')}.json`);
  writeJson(requestPath, { ...request, status: 'prepared', requestPath });
  return { request, requestPath };
}

export function canSpend(request) {
  return request.allowSpend === true || process.env.TAKOMI_FLOW_ALLOW_SPEND === 'true';
}

function toOptionalNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalBoolean(value, defaultValue) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value).split(',').map(item => item.trim()).filter(Boolean);
}
