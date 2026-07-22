import { createPreparedRequest } from './request.mjs';
import { validateRequestFile } from './request-validator.mjs';
import { generateFromRequest } from './generation.mjs';
import { createSettingsPlan } from './settings-plan.mjs';

export async function runWorkflow(args = {}) {
  const { request, requestPath } = createPreparedRequest(args);
  const validation = validateRequestFile(requestPath);
  const result = {
    schemaVersion: 1,
    status: validation.status === 'ok' ? 'prepared' : 'failed',
    requestPath,
    request,
    settingsPlan: createSettingsPlan(request),
    validation,
    generation: null,
    nextActions: nextActions(args, validation),
  };
  if (validation.status !== 'ok' || !args.submit) return result;
  if (!args.allowBrowser) {
    result.status = 'blocked';
    result.nextActions = ['Set allowBrowser=true to permit opening Flow for generation.'];
    return result;
  }
  result.generation = await generateFromRequest({
    request: requestPath,
    profileDir: args.profileDir,
    browserChannel: args.browserChannel,
    cdpUrl: args.cdpUrl,
    headless: Boolean(args.headless),
  });
  result.status = result.generation.status;
  result.nextActions = afterGeneration(result.generation);
  return result;
}

function nextActions(args, validation) {
  if (validation.status !== 'ok') return ['Fix request validation errors before opening Flow.'];
  if (!args.submit) {
    return [
      'Review the prepared request file.',
      'Run generate with explicit spend approval when ready.',
    ];
  }
  if (!args.allowBrowser) return ['Set allowBrowser=true to permit opening Flow for generation.'];
  return ['Generation was requested; TakomiFlow will still enforce the spend guard.'];
}

function afterGeneration(generation) {
  const actions = [];
  if (generation.manualActions?.length) actions.push(...generation.manualActions);
  if (generation.errors?.length) actions.push('Review generation errors in run metadata.');
  if (generation.assets?.length) actions.push('Run assets/report to catalog downloads and create a handoff.');
  if (!actions.length) actions.push('Inspect the run metadata and screenshots.');
  return actions;
}
