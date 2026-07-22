import path from 'node:path';
import { ensureDir } from './paths.mjs';
import { loadPlaywright } from './playwright-loader.mjs';
import { launchTrustedChrome } from './trusted-chrome.mjs';

const DEFAULT_CDP_URL = 'http://127.0.0.1:9222';

export async function launchFlowBrowser(options = {}) {
  const { chromium } = await loadPlaywright();
  const profileDir = ensureDir(path.resolve(options.profileDir));
  const downloadsDir = ensureDir(path.resolve(options.downloadsDir));
  const headless = options.headless === true;
  const trustedCdpUrl = await trustedChromeCdpUrl(options);
  if (trustedCdpUrl) {
    const browser = await chromium.connectOverCDP(trustedCdpUrl);
    const context = browser.contexts()[0] || await browser.newContext({ acceptDownloads: true });
    const page = context.pages()[0] || await context.newPage();
    return { browser, context, page, profileDir, downloadsDir, cdpUrl: trustedCdpUrl, attached: true };
  }
  const channel = options.browserChannel || process.env.TAKOMI_FLOW_BROWSER_CHANNEL || defaultBrowserChannel();
  const context = await chromium.launchPersistentContext(profileDir, {
    headless,
    ...(channel ? { channel } : {}),
    acceptDownloads: true,
    downloadsPath: downloadsDir,
    viewport: { width: 1440, height: 960 },
  });
  const page = context.pages()[0] || await context.newPage();
  return { context, page, profileDir, downloadsDir, browserChannel: channel };
}

export async function closeFlowBrowser(browser) {
  if (browser.attached) {
    if (typeof browser.browser?.disconnect === 'function') {
      browser.browser.disconnect();
      return;
    }
    await browser.browser?.close?.().catch(() => {});
    return;
  }
  await browser.context.close().catch(() => {});
}

async function trustedChromeCdpUrl(options) {
  if (options.cdpUrl) return options.cdpUrl;
  if (options.headless === true || options.usePlaywrightBrowser === true) return null;
  if (await canConnect(DEFAULT_CDP_URL)) return DEFAULT_CDP_URL;
  try {
    const trusted = launchTrustedChrome({ url: options.url });
    return await waitForCdp(trusted.cdpUrl);
  } catch {
    return null;
  }
}

async function waitForCdp(cdpUrl) {
  const timeoutMs = 10000;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await canConnect(cdpUrl)) return cdpUrl;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return null;
}

async function canConnect(cdpUrl) {
  try {
    const response = await fetch(`${cdpUrl}/json/version`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

function defaultBrowserChannel() {
  if (process.platform === 'win32' || process.platform === 'darwin') return 'chrome';
  return undefined;
}
