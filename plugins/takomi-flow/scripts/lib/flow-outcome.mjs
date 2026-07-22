import { downloadButton, hasText, openGeneratedMedia } from './flow-ui.mjs';
import { newMediaIds } from './flow-media.mjs';

export async function handleGenerationFollowups(page, request) {
  if (await hasText(page, /which of these durations would you prefer/i)) {
    await chooseDuration(page, request.durationSeconds || 4);
    await page.waitForTimeout(2000);
  }
  if (await hasText(page, /costing\s+\d+\s+credits/i)) {
    return clickApprove(page);
  }
  return false;
}

export async function waitForGenerationOutcome(page, request, options = {}) {
  const timeoutMs = Number(options.timeoutMs || process.env.TAKOMI_FLOW_WAIT_MS || 300000);
  const intervalMs = Number(options.intervalMs || process.env.TAKOMI_FLOW_POLL_MS || 5000);
  const readyProbeMs = Number(options.readyProbeMs || process.env.TAKOMI_FLOW_READY_PROBE_MS || 45000);
  const started = Date.now();
  let lastReadyProbeAt = 0;
  let approved = false;
  while (Date.now() - started < timeoutMs) {
    if (await hasText(page, /which of these durations would you prefer/i)) {
      await chooseDuration(page, request.durationSeconds || 4);
    }
    if (await hasText(page, /costing\s+\d+\s+credits/i)) {
      approved = await clickApprove(page) || approved;
    }
    const freshMediaIds = await newMediaIds(page, options.baselineMediaIds || []);
    const downloadReady = await downloadButton(page).count().catch(() => 0);
    if (downloadReady && (!options.baselineMediaIds || freshMediaIds.length || /\/edit\//.test(page.url()))) {
      return { status: 'download_ready', approved, mediaIds: freshMediaIds };
    }
    if (freshMediaIds.length) {
      await openGeneratedMedia(page, freshMediaIds);
      return { status: 'media_ready', approved, mediaIds: freshMediaIds };
    }
    if (Date.now() - started >= readyProbeMs && Date.now() - lastReadyProbeAt >= readyProbeMs) {
      lastReadyProbeAt = Date.now();
      if (await probeDownloadableMedia(page, freshMediaIds)) {
        return { status: 'download_ready', approved, mediaIds: freshMediaIds, probed: true };
      }
    }
    if (await hasVisibleText(page, /\b\d{1,3}%\b|generating|currently in the queue|waiting in the queue|been scheduled|i['’]ve scheduled|ready for you shortly/i)) {
      await page.waitForTimeout(intervalMs);
      continue;
    }
    if (await hasText(page, /failed|oops, something went wrong/i)) {
      return { status: 'failed', approved };
    }
    await page.waitForTimeout(intervalMs);
  }
  return { status: 'timeout', approved };
}

async function probeDownloadableMedia(page, mediaIds = []) {
  if (await downloadButton(page).count().catch(() => 0)) return true;
  await openGeneratedMedia(page, mediaIds);
  await page.waitForTimeout(1000);
  return (await downloadButton(page).count().catch(() => 0)) > 0;
}

async function hasVisibleText(page, pattern) {
  return page.locator('body').evaluate((body, source) => {
    const regex = new RegExp(source, 'i');
    const isVisible = element => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node) {
      const visibleChildCount = [...node.children].filter(isVisible).length;
      if (visibleChildCount === 0 && isVisible(node) && regex.test(node.innerText || node.textContent || '')) {
        return true;
      }
      node = walker.nextNode();
    }
    return false;
  }, pattern.source).catch(() => false);
}

async function chooseDuration(page, requested) {
  const options = [4, 6, 8, 10];
  const closest = options.reduce((best, item) => (
    Math.abs(item - requested) < Math.abs(best - requested) ? item : best
  ), options[0]);
  const option = page.getByText(new RegExp(`^${closest} seconds$`, 'i')).first();
  if (await option.count().catch(() => 0)) await option.click({ timeout: 10000 }).catch(() => {});
}

async function clickApprove(page) {
  const candidates = [
    page.getByRole('button', { name: /^Approve$/i }).last(),
    page.locator('button').filter({ hasText: /^Approve$/i }).last(),
    page.locator('[role="button"]').filter({ hasText: /^Approve$/i }).last(),
    page.locator('div,button,[role="button"]').filter({ hasText: /^\s*check\s*Approve\s*$/i }).last(),
  ];
  for (const locator of candidates) {
    if (!(await locator.count().catch(() => 0))) continue;
    try {
      await locator.click({ timeout: 10000, force: true });
      await page.waitForTimeout(1000);
      const stillVisible = await page.getByRole('button', { name: /^Approve$/i })
        .last()
        .isVisible({ timeout: 1000 })
        .catch(() => false);
      if (!stillVisible || await hasVisibleText(page, /generating|currently in the queue|waiting in the queue|been scheduled|i['’]ve scheduled|ready for you shortly/i)) {
        return true;
      }
    } catch {}
  }
  return false;
}
