export function videoPrompt(args = {}) {
  const variations = normalizeVariations(args.variations);
  return promptResult('TakomiFlow video workflow', [
    'Use TakomiFlow to prepare a Google Flow video request.',
    `Topic or prompt: ${args.topic || '<ask the user for the video prompt>'}`,
    `Aspect ratio: ${args.aspectRatio || '16:9'}`,
    `Variations: ${variations}`,
    'Read takomi-flow://contract and takomi-flow://templates/video if available.',
    'Run capabilities, prepare, validate, then generate only with explicit browser and spend approval.',
    'After generation, inspect the run and catalog assets with frame extraction.',
  ]);
}

export function imagePrompt(args = {}) {
  const variations = normalizeVariations(args.variations);
  return promptResult('TakomiFlow image workflow', [
    'Use TakomiFlow to prepare a Google Flow image request.',
    `Topic or prompt: ${args.topic || '<ask the user for the image prompt>'}`,
    `Aspect ratio: ${args.aspectRatio || '1:1'}`,
    `Variations: ${variations}`,
    'Read takomi-flow://contract and takomi-flow://templates/image if available.',
    'Run capabilities, prepare, validate, then generate only with explicit browser and spend approval.',
    'After generation, inspect the run and catalog downloaded assets.',
  ]);
}

export function reviewPrompt(args = {}) {
  return promptResult('TakomiFlow review workflow', [
    'Use TakomiFlow to review a completed or partial Flow run.',
    `Run path: ${args.run || '<ask for the run.json path or run directory>'}`,
    `Review frames: ${normalizeFrames(args.frames)}`,
    'Run inspect or latest if the user did not provide a run path.',
    'Run review with frame extraction to produce assets.json, report.md, and next actions.',
    'If downloaded assets are present and a downstream project needs them, run collect after review.',
    'Report run status, errors, manual actions, asset paths, frame paths, and reportPath.',
  ]);
}

export function collectPrompt(args = {}) {
  return promptResult('TakomiFlow collect workflow', [
    'Use TakomiFlow to package reviewed Flow outputs for another project or pipeline.',
    `Run path: ${args.run || '<ask for the run.json path or run directory>'}`,
    `Target folder: ${args.targetDir || '<ask for the downstream target folder>'}`,
    `Include frames: ${args.includeFrames === 'false' ? 'false' : 'true'}`,
    'Run review first when asset quality or errors are unknown.',
    'Run collect with a target directory and include frames when video review frames are useful downstream.',
    'Return the copied asset paths, copied frame paths, report path, and takomi-flow-collection.json manifest path.',
  ]);
}

function normalizeVariations(value) {
  const parsed = Number.parseInt(value || '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeFrames(value) {
  const parsed = Number.parseInt(value || '4', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 4;
}

function promptResult(description, lines) {
  return {
    description,
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: lines.join('\n'),
      },
    }],
  };
}
