import { FLOW_URL } from './paths.mjs';
import { hasText, openFlow } from './flow-ui.mjs';

export async function prepareProjectEditor(browser, request, result) {
  const diagnostics = { projectUrl: undefined, recovered: false };
  const waitMs = Number(request.editorWaitMs || process.env.TAKOMI_FLOW_EDITOR_WAIT_MS || 90000);

  let mayUseCurrentProject = false;
  if (request.projectUrl) {
    browser.page = await openProjectUrl(browser, request.projectUrl);
    mayUseCurrentProject = true;
  } else if (request.reuseCurrentProject) {
    browser.page = await findProjectPage(browser) || browser.page;
    mayUseCurrentProject = true;
  }

  if (mayUseCurrentProject && isProjectUrl(browser.page.url())) {
    const ready = await waitForProjectEditor(browser.page, waitMs);
    diagnostics.projectUrl = browser.page.url();
    return { ok: ready.ok, diagnostics, manualActions: ready.manualActions };
  }

  await openFlow(browser.page);
  if (request.allowNewProject) {
    const opened = await clickNewProject(browser.page);
    if (!opened) {
      return { ok: false, diagnostics, manualActions: ['New project button was not found. Open a Flow project manually, then retry with --project-url.'] };
    }
    const ready = await waitForProjectEditor(browser.page, waitMs);
    diagnostics.projectUrl = browser.page.url();
    return { ok: ready.ok, diagnostics, manualActions: ready.manualActions };
  }

  Object.assign(result, await currentFlowState(browser.page));
  return {
    ok: false,
    diagnostics,
    manualActions: ['Open an existing Flow project, pass --project-url, or set --allow-new-project to create a new Flow project.'],
  };
}

export async function recoverFreshChat(page, request) {
  if (!request.freshChatOnFailure) return { recovered: false, reason: 'freshChatOnFailure is disabled.' };
  if (!isProjectUrl(page.url())) return { recovered: false, reason: 'Current page is not a Flow project.' };
  const before = page.url();
  await leaveMediaEditor(page);
  const candidates = [
    page.getByRole('button', { name: /new chat|new session|start new chat|new generation/i }).first(),
    page.locator('button,[role="button"]').filter({ hasText: /new chat|new session|start new chat|new generation/i }).first(),
    page.locator('[aria-label*="New chat" i], [aria-label*="New session" i], [aria-label*="Start new" i]').first(),
  ];
  for (const locator of candidates) {
    if (!(await locator.count().catch(() => 0))) continue;
    try {
      await locator.click({ timeout: 10000 });
      await page.waitForTimeout(1500);
      const ready = await waitForProjectEditor(page, request.editorWaitMs || 60000);
      return { recovered: ready.ok, reason: ready.ok ? 'fresh chat opened' : ready.manualActions.join(' ') };
    } catch {}
  }
  if (await hasText(page, /oops|something went wrong|try again|chat failed/i)) {
    await page.goto(projectBaseUrl(before), { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
    const ready = await waitForProjectEditor(page, request.editorWaitMs || 60000);
    return { recovered: ready.ok, reason: ready.ok ? 'project reloaded' : ready.manualActions.join(' ') };
  }
  return { recovered: false, reason: 'No same-project fresh chat control was found.' };
}

async function openProjectUrl(browser, projectUrl) {
  const page = (await findProjectPage(browser, projectUrl)) || browser.page;
  await page.goto(projectBaseUrl(projectUrl), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await leaveMediaEditor(page);
  return page;
}

async function findProjectPage(browser, exactUrl = undefined) {
  const pages = browser.context.pages();
  const match = pages.find(page => exactUrl ? page.url() === exactUrl : isProjectUrl(page.url()));
  return match || null;
}

async function clickNewProject(page) {
  const candidates = [
    page.getByRole('button', { name: /new project/i }).first(),
    page.locator('button').filter({ hasText: /new project/i }).first(),
    page.getByText('New project').first(),
  ];
  for (const locator of candidates) {
    if (!(await locator.count().catch(() => 0))) continue;
    try {
      await locator.click({ timeout: 10000 });
      await page.waitForURL(/\/project\//, { timeout: 30000 }).catch(() => {});
      await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      return isProjectUrl(page.url());
    } catch {}
  }
  return false;
}

async function waitForProjectEditor(page, timeoutMs) {
  await leaveMediaEditor(page);
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const state = await currentFlowState(page);
    if (state.manualActions.length) return { ok: false, manualActions: state.manualActions };
    const hasEditorText = await hasText(page, /what do you want to create|start creating|add media/i);
    const inputCount = await page.locator('div[role="textbox"], textarea:not(.g-recaptcha-response)').count().catch(() => 0);
    if (hasEditorText && inputCount > 0) return { ok: true, manualActions: [] };
    await page.waitForTimeout(1000);
  }
  return { ok: false, manualActions: ['Flow project editor did not become ready before the wait timeout.'] };
}

async function leaveMediaEditor(page) {
  if (!/\/edit\//.test(page.url())) return;
  const candidates = [
    page.getByRole('button', { name: /^Done$/i }).last(),
    page.locator('button').filter({ hasText: /^Done$/i }).last(),
    page.getByRole('button', { name: /back/i }).first(),
    page.locator('button').filter({ hasText: /arrow_back|back/i }).first(),
  ];
  for (const locator of candidates) {
    if (!(await locator.count().catch(() => 0))) continue;
    try {
      await locator.click({ timeout: 10000, force: true });
      await page.waitForURL(url => !/\/edit\//.test(url.toString()), { timeout: 15000 }).catch(() => {});
      if (!/\/edit\//.test(page.url())) return;
    } catch {}
  }
  await page.goto(projectBaseUrl(page.url()), { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
}

async function currentFlowState(page) {
  const text = (await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')).toLowerCase();
  const manualActions = [];
  if (text.includes('sign in') || text.includes('log in')) manualActions.push('Sign into Google/Flow in the opened browser.');
  if (text.includes('captcha') || text.includes('verify')) manualActions.push('Complete the verification challenge in the browser.');
  if (/quota|usage limit|not enough credits|insufficient credits|out of credits/.test(text)) {
    manualActions.push('Review Flow quota or credits message in the browser.');
  }
  return { manualActions };
}

function isProjectUrl(url) {
  return /\/project\//.test(url || '');
}

function projectBaseUrl(url) {
  return String(url || '').replace(/\/edit\/[^/?#]+.*/, '');
}
