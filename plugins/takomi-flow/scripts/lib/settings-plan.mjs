export function createSettingsPlan(request) {
  const requested = {
    kind: request.kind,
    mode: request.mode,
    variations: request.variations,
    aspectRatio: request.aspectRatio,
    durationSeconds: request.durationSeconds,
    modelHint: request.modelHint,
    extractFrames: request.extractFrames,
    sourceAssets: request.sourceAssets || [],
    projectUrl: request.projectUrl,
    reuseCurrentProject: request.reuseCurrentProject,
    allowNewProject: request.allowNewProject,
    freshChatOnFailure: request.freshChatOnFailure,
    editorWaitMs: request.editorWaitMs,
  };
  const automatic = ['prompt', 'project reuse', 'same-project chat recovery', 'download folder', 'metadata', 'asset catalog'];
  if (request.extractFrames > 0) automatic.push('video review frame extraction after download');
  return {
    schemaVersion: 1,
    requested,
    automatic,
    selectorDependent: selectorDependent(request),
    notes: [
      'Prompt submission and downloads are automated through public Flow UI selectors.',
      'Visual settings remain explicit in metadata until live Flow controls are observed and selector coverage is tuned.',
    ],
  };
}

function selectorDependent(request) {
  const items = [];
  if (request.mode) items.push({ field: 'mode', value: request.mode });
  if (request.aspectRatio) items.push({ field: 'aspectRatio', value: request.aspectRatio });
  if (request.durationSeconds) items.push({ field: 'durationSeconds', value: request.durationSeconds });
  if (request.modelHint && request.modelHint !== 'best-available') {
    items.push({ field: 'modelHint', value: request.modelHint });
  }
  if (request.sourceAssets?.length) {
    items.push({ field: 'sourceAssets', value: request.sourceAssets });
  }
  if (request.variations > 1) items.push({ field: 'variations', value: request.variations });
  return items;
}
