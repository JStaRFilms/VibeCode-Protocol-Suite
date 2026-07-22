import path from 'node:path';
import { defaultProfileDir, FLOW_URL, readJson, resolvePath } from './paths.mjs';
import { normalizeRequest, canSpend } from './request.mjs';
import { closeFlowBrowser, launchFlowBrowser } from './browser.mjs';
import { createRun, baseResult, saveResult } from './result.mjs';
import { capture, fillPrompt, hasText, submitGeneration, tryDownloadAssets } from './flow-ui.mjs';
import { handleGenerationFollowups, waitForGenerationOutcome } from './flow-outcome.mjs';
import { catalogAssets } from './media.mjs';
import { createSettingsPlan } from './settings-plan.mjs';
import { prepareProjectEditor, recoverFreshChat } from './flow-project-session.mjs';
import { listMediaIds } from './flow-media.mjs';

export async function generateFromRequest(args = {}) {
  if (!args.request) throw new Error('generate requires a request path.');
  const request = normalizeRequest({ ...readJson(path.resolve(args.request)), ...requestOverrides(args) });
  const run = createRun(request, 'generate');
  const result = baseResult('blocked', run, {
    command: 'generate',
    kind: request.kind,
    prompt: request.prompt,
    flowUrl: FLOW_URL,
    settingsPlan: createSettingsPlan(request),
  });
  if (!canSpend(request)) {
    result.manualActions.push('Set request allowSpend=true or TAKOMI_FLOW_ALLOW_SPEND=true to submit a Flow generation.');
    saveResult(run, result);
    return result;
  }
  const browser = await launchFlowBrowser({
    profileDir: resolvePath(args.profileDir, defaultProfileDir()),
    downloadsDir: run.downloadsDir,
    browserChannel: args.browserChannel,
    cdpUrl: args.cdpUrl,
    headless: Boolean(args.headless),
  });
  try {
    result.screenshots.push(await capture(browser.page, run, 'before-project-resolve'));
    const project = await prepareProjectEditor(browser, request, result);
    result.projectSession = project.diagnostics;
    if (!project.ok) {
      requireManual(result, project.manualActions);
      return result;
    }
    result.projectUrl = project.diagnostics.projectUrl || browser.page.url();
    result.screenshots.push(await capture(browser.page, run, 'project-editor'));
    const maxAttempts = request.freshChatOnFailure === false ? 1 : 2;
    result.generationAttempts = [];
    if (request.freshChatOnFailure !== false && await hasText(browser.page, /failed|oops, something went wrong/i)) {
      await recoverFreshChat(browser.page, request);
    }
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const attemptResult = await runGenerationAttempt(browser.page, request, run, attempt);
      result.generationAttempts.push({ attempt, outcome: attemptResult.outcome, recovered: attemptResult.recovered });
      result.projectUrl = browser.page.url();
      result.generationOutcome = attemptResult.outcome;
      result.screenshots.push(await capture(browser.page, run, attempt === 1 ? 'after-wait' : `after-wait-${attempt}`));
      result.assets = attemptResult.assets;
      if (result.assets.length) break;
      if (attempt < maxAttempts && shouldRetryOutcome(attemptResult.outcome)) {
        const recovery = await recoverFreshChat(browser.page, request);
        if (recovery.recovered) {
          result.generationAttempts[result.generationAttempts.length - 1].recovered = true;
          continue;
        }
      }
      break;
    }
    if (result.assets.length) {
      result.assetCatalogPath = (await catalogAssets(run, result.assets, { frames: request.extractFrames || 0 })).catalogPath;
    }
    result.status = result.assets.length ? 'downloaded' : 'manual_action_required';
    if (!result.assets.length) result.manualActions.push(nextActionForOutcome(result.generationOutcome));
    return result;
  } catch (error) {
    result.status = 'failed';
    result.errors.push(error.message);
    return result;
  } finally {
    await closeFlowBrowser(browser);
    saveResult(run, result);
  }
}

function requestOverrides(args) {
  return Object.fromEntries([
    ['projectUrl', args.projectUrl],
    ['reuseCurrentProject', args.reuseCurrentProject],
    ['allowNewProject', args.allowNewProject],
    ['freshChatOnFailure', args.freshChatOnFailure],
    ['editorWaitMs', args.editorWaitMs],
  ].filter(([, value]) => value !== undefined));
}

async function fillPromptWithRecovery(page, request) {
  if (await fillPrompt(page, request.prompt)) return true;
  const recovery = await recoverFreshChat(page, request);
  return recovery.recovered && await fillPrompt(page, request.prompt);
}

async function submitWithRecovery(page, request) {
  if (await submitGeneration(page)) return true;
  const recovery = await recoverFreshChat(page, request);
  return recovery.recovered
    && await fillPrompt(page, request.prompt)
    && await submitGeneration(page);
}

async function runGenerationAttempt(page, request, run, attempt) {
  const baselineMediaIds = await listMediaIds(page);
  const pending = await pendingGenerationState(page, request);
  if (pending.matchesRequest) {
    await handleGenerationFollowups(page, request);
    const outcome = await waitForGenerationOutcome(page, request, { baselineMediaIds });
    const assets = await downloadAttemptAssets(page, run, request, outcome);
    return { outcome, assets, recovered: false };
  }
  if (pending.exists) {
    return {
      outcome: { status: 'active_generation_pending' },
      assets: [],
      recovered: false,
    };
  }
  if (!(await fillPromptWithRecovery(page, request))) {
    return {
      outcome: { status: 'prompt_not_found' },
      assets: [],
      recovered: false,
    };
  }
  await capture(page, run, attempt === 1 ? 'prompt-filled' : `prompt-filled-${attempt}`);
  if (!(await submitWithRecovery(page, request))) {
    return {
      outcome: { status: 'submit_not_found' },
      assets: [],
      recovered: false,
    };
  }
  await handleGenerationFollowups(page, request);
  const outcome = await waitForGenerationOutcome(page, request, { baselineMediaIds });
  const assets = await downloadAttemptAssets(page, run, request, outcome);
  return { outcome, assets, recovered: false };
}

async function downloadAttemptAssets(page, run, request, outcome) {
  const assets = await tryDownloadAssets(page, run, request.variations, {
    mediaIds: outcome.mediaIds || [],
    allowRenderedImageFallback: request.kind !== 'video',
  });
  if (assets.length && !['download_ready', 'media_ready'].includes(outcome.status)) {
    outcome.status = 'download_ready';
    outcome.recoveredFromStaleText = true;
  }
  return assets;
}

function shouldRetryOutcome(outcome = {}) {
  return ['failed', 'prompt_not_found', 'submit_not_found'].includes(outcome.status);
}

async function pendingGenerationState(page, request) {
  const pendingPattern = /would you like me to kick off|costing\s+\d+\s+credits|currently in the queue|waiting in the queue|been scheduled|i['’]ve scheduled|ready for you shortly/i;
  const text = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
  const exists = pendingPattern.test(text);
  if (!exists) return { exists: false, matchesRequest: false };
  const pageText = compactText(text).toLowerCase();
  const promptText = compactText(request.prompt).toLowerCase();
  const corePrompt = compactText(request.prompt.replace(/^create exactly one.*?not still images\.\s*/i, '')).toLowerCase();
  const matchesRequest = pageText.includes(promptText.slice(0, 80))
    || (corePrompt.length > 20 && pageText.includes(corePrompt.slice(0, 80)));
  return { exists, matchesRequest };
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function requireManual(result, actions) {
  result.status = 'manual_action_required';
  result.manualActions.push(...actions);
}

function nextActionForOutcome(outcome = {}) {
  if (outcome.status === 'failed') return 'Flow reported generation failure. Inspect the browser/run screenshots.';
  if (outcome.status === 'active_generation_pending') return 'A different Flow generation is already pending. Wait for it to finish before submitting another prompt.';
  if (outcome.status === 'prompt_not_found') return 'Prompt box was not found. Update Flow selectors or paste the prompt manually.';
  if (outcome.status === 'submit_not_found') return 'Generate/Create button was not found. Submit manually in the opened browser.';
  if (outcome.status === 'timeout') return 'Generation did not finish before the wait timeout. Leave trusted Chrome open and run inspect/observe again.';
  return 'Generation may still be running or download controls changed. Inspect the browser/run screenshots.';
}
