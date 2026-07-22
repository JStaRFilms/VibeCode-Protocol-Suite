import fs from 'node:fs';
import path from 'node:path';
import { loadCapabilities } from './capabilities.mjs';
import { normalizeRequest } from './request.mjs';

export function validateRequestFile(requestPath) {
  if (!requestPath) throw new Error('validate requires --request <path>');
  const absolutePath = path.resolve(requestPath);
  const raw = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  return validateRequest(raw, absolutePath);
}

export function validateRequest(raw, requestPath = undefined) {
  const capabilities = loadCapabilities();
  const errors = [];
  const warnings = [];
  let normalized;
  try {
    normalized = normalizeRequest(raw);
  } catch (error) {
    return {
      schemaVersion: 1,
      status: 'failed',
      requestPath,
      errors: [error.message],
      warnings,
    };
  }
  if (!capabilities.kinds.includes(normalized.kind)) {
    errors.push(`Unsupported kind: ${normalized.kind}`);
  }
  const allowedModes = capabilities.modes[normalized.kind] || [];
  if (normalized.mode && !allowedModes.includes(normalized.mode)) {
    warnings.push(`Mode "${normalized.mode}" is not listed for kind "${normalized.kind}".`);
  }
  if (normalized.variations > capabilities.variations.max) {
    warnings.push(`Variations ${normalized.variations} exceeds listed max ${capabilities.variations.max}.`);
  }
  if (normalized.aspectRatio && !capabilities.aspectRatios.includes(normalized.aspectRatio)) {
    warnings.push(`Aspect ratio "${normalized.aspectRatio}" is not in listed options.`);
  }
  if (normalized.projectUrl && !isFlowProjectUrl(normalized.projectUrl)) {
    errors.push(`Project URL must be a Google Flow project URL: ${normalized.projectUrl}`);
  }
  if (normalized.editorWaitMs !== undefined && normalized.editorWaitMs < 1000) {
    errors.push('editorWaitMs must be at least 1000 milliseconds.');
  }
  for (const asset of normalized.sourceAssets) {
    if (!fs.existsSync(path.resolve(asset))) {
      errors.push(`Source asset does not exist: ${asset}`);
    }
  }
  if (!normalized.allowSpend) {
    warnings.push('Spend guard is off. Generation will not submit until allowSpend=true or TAKOMI_FLOW_ALLOW_SPEND=true.');
  }
  return {
    schemaVersion: 1,
    status: errors.length ? 'failed' : 'ok',
    requestPath,
    normalized,
    errors,
    warnings,
  };
}

function isFlowProjectUrl(value) {
  try {
    const url = new URL(value);
    return url.hostname === 'labs.google' && url.pathname.includes('/fx/tools/flow/project/');
  } catch {
    return false;
  }
}
