import path from 'node:path';
import fs from 'node:fs';
import { FLOW_URL } from './paths.mjs';
import { openGeneratedMediaById } from './flow-media.mjs';

export async function openFlow(page) {
  await page.goto(FLOW_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
}

export async function capture(page, run, name) {
  const filePath = path.join(run.screenshotsDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => null);
  return filePath;
}

export async function inspectFlowState(page) {
  const title = await page.title().catch(() => '');
  const url = page.url();
  const text = (await page.locator('body').innerText({ timeout: 5000 }).catch(() => '')).slice(0, 5000);
  const lower = text.toLowerCase();
  const manualActions = [];
  if (lower.includes('sign in') || lower.includes('log in')) {
    manualActions.push('Sign into Google/Flow in the opened browser.');
  }
  if (lower.includes('captcha') || lower.includes('verify')) {
    manualActions.push('Complete the verification challenge in the browser.');
  }
  if (lower.includes('quota') || lower.includes('limit') || lower.includes('credits')) {
    manualActions.push('Review Flow quota or credits message in the browser.');
  }
  return { title, url, manualActions, textSample: text };
}

export async function ensureProjectEditor(page) {
  if (page.url().includes('/project/')) return waitForProjectEditor(page);
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
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      return page.url().includes('/project/') && await waitForProjectEditor(page);
    } catch {}
  }
  return false;
}

async function waitForProjectEditor(page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  const ready = page.locator('body').filter({ hasText: /what do you want to create|start creating|add media/i });
  await ready.waitFor({ state: 'visible', timeout: 60000 }).catch(() => {});
  return (await page.locator('div[role="textbox"], textarea:not(.g-recaptcha-response)').count().catch(() => 0)) > 0;
}

export async function fillPrompt(page, prompt) {
  const candidates = [
    page.locator('textarea:not(.g-recaptcha-response):not([name*="recaptcha"]):visible').last(),
    page.locator('[contenteditable="true"][role="textbox"]:visible').last(),
    page.locator('div[role="textbox"]:visible').last(),
  ];
  for (const locator of candidates) {
    if (!(await locator.count().catch(() => 0))) continue;
    try {
      await locator.click({ timeout: 8000 });
      if (!(await fillEditable(locator, page, prompt))) continue;
      if (await editableContains(locator, prompt)) return true;
    } catch {}
  }
  return false;
}

async function fillEditable(locator, page, prompt) {
  if (await locator.fill(prompt, { timeout: 8000 }).then(() => true).catch(() => false)) return true;
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A').catch(() => {});
  await page.keyboard.insertText(prompt).catch(async () => {
    await page.keyboard.type(prompt, { delay: 5 });
  });
  return true;
}

async function editableContains(locator, prompt) {
  const expected = compactText(prompt).slice(0, 80);
  const actual = await locator.evaluate(element => {
    const value = element.value || element.innerText || element.textContent || '';
    return value.replace(/\s+/g, ' ').trim();
  }).catch(() => '');
  return compactText(actual).includes(expected);
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export async function submitGeneration(page) {
  const preferred = [
    page.locator('button').filter({ hasText: /arrow_forward\s*Create/i }).last(),
    page.getByRole('button', { name: /^Create$/i }).last(),
    page.locator('button').filter({ hasText: /^Create$/i }).last(),
  ];
  for (const button of preferred) {
    if (!(await button.count().catch(() => 0))) continue;
    try {
      if (await button.isDisabled().catch(() => false)) continue;
      await button.click({ timeout: 8000 });
      return true;
    } catch {}
  }
  const labels = /submit|start/i;
  const buttons = [
    page.getByRole('button', { name: labels }).first(),
    page.locator('button').filter({ hasText: labels }).first(),
  ];
  for (const button of buttons) {
    if (!(await button.count().catch(() => 0))) continue;
    try {
      if (await button.isDisabled().catch(() => false)) continue;
      await button.click({ timeout: 8000 });
      return true;
    } catch {}
  }
  return false;
}

export async function tryDownloadAssets(page, run, maxDownloads = 1, options = {}) {
  const assets = [];
  const allowRenderedImageFallback = options.allowRenderedImageFallback !== false;
  await openGeneratedMedia(page, options.mediaIds || []);
  for (let i = 0; i < maxDownloads; i += 1) {
    const button = downloadButton(page);
    if (!(await button.count().catch(() => 0))) break;
    const [completed] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }).catch(() => null),
      button.click({ timeout: 5000 }).catch(() => null),
    ]);
    if (!completed) {
      if (!allowRenderedImageFallback) break;
      const imagePath = await downloadLargestRenderedImage(page, run, i).catch(() => null);
      if (!imagePath) break;
      assets.push(imagePath);
      continue;
    }
    const suggested = completed.suggestedFilename();
    const filePath = path.join(run.downloadsDir, suggested);
    await completed.saveAs(filePath);
    assets.push(filePath);
  }
  return assets;
}

async function downloadLargestRenderedImage(page, run, index) {
  const images = await page.locator('img').evaluateAll(items => items
    .map(img => ({ src: img.src, width: img.naturalWidth, height: img.naturalHeight }))
    .filter(item => item.src && item.width >= 256 && item.height >= 256)
    .sort((a, b) => (b.width * b.height) - (a.width * a.height)));
  if (!images.length) return null;
  const response = await page.context().request.get(images[0].src, { timeout: 30000 });
  if (!response.ok()) return null;
  const filePath = path.join(run.downloadsDir, `flow-image-${index + 1}.png`);
  fs.writeFileSync(filePath, await response.body());
  return filePath;
}

export async function openGeneratedMedia(page, mediaIds = []) {
  if (await downloadButton(page).count().catch(() => 0)) return true;
  for (const mediaId of mediaIds) {
    if (await openGeneratedMediaById(page, mediaId)) return true;
  }
  const candidates = [
    page.getByAltText(/video thumbnail|generated image/i).first(),
    page.locator('img[src*="media.getMediaUrlRedirect"]').last(),
    page.locator('[role="button"]').filter({ hasText: /play_circle/i }).first(),
    page.locator('button').filter({ hasText: /play_circle/i }).first(),
  ];
  for (const locator of candidates) {
    if (!(await locator.count().catch(() => 0))) continue;
    try {
      await locator.click({ timeout: 10000 });
      await page.waitForTimeout(3000);
      return true;
    } catch {}
  }
  return false;
}

export async function hasText(page, pattern) {
  return (await page.locator('body').filter({ hasText: pattern }).count().catch(() => 0)) > 0;
}

export function downloadButton(page) {
  return page.locator([
    'button[aria-label*="Download" i]',
    '[role="button"][aria-label*="Download" i]',
    'button[title*="Download" i]',
    '[role="button"][title*="Download" i]',
    'button:has-text("download")',
    '[role="button"]:has-text("download")',
  ].join(', ')).first();
}
