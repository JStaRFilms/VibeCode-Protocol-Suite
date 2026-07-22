import { defaultProfileDir, defaultRunsDir, FLOW_URL, resolvePath } from './paths.mjs';
import { closeFlowBrowser, launchFlowBrowser } from './browser.mjs';
import { createRun, baseResult, saveResult } from './result.mjs';
import { capture, inspectFlowState, openFlow } from './flow-ui.mjs';

export async function observeFlow(options = {}) {
  const outputDir = resolvePath(options.outputDir, defaultRunsDir());
  const run = createRun({ outputDir }, 'observe');
  const profileDir = resolvePath(options.profileDir, defaultProfileDir());
  const browser = await launchFlowBrowser({
    profileDir,
    downloadsDir: run.downloadsDir,
    browserChannel: options.browserChannel,
    cdpUrl: options.cdpUrl,
    headless: options.headless === true,
  });
  const result = baseResult('ok', run, { command: 'observe', flowUrl: FLOW_URL, profileDir });
  try {
    await openFlow(browser.page);
    result.screenshots.push(await capture(browser.page, run, 'observe-flow'));
    Object.assign(result, await inspectFlowState(browser.page));
    result.controls = await collectControls(browser.page);
    if (result.manualActions.length) result.status = 'manual_action_required';
  } catch (error) {
    result.status = 'failed';
    result.errors.push(error.message);
  } finally {
    await closeFlowBrowser(browser);
    saveResult(run, result);
  }
  return result;
}

async function collectControls(page) {
  return page.evaluate(() => {
    const text = node => (node.innerText || node.textContent || node.getAttribute('aria-label') || '').trim();
    const pick = selector => Array.from(document.querySelectorAll(selector))
      .slice(0, 80)
      .map(node => ({
        tag: node.tagName.toLowerCase(),
        text: text(node).slice(0, 120),
        ariaLabel: node.getAttribute('aria-label') || '',
        placeholder: node.getAttribute('placeholder') || '',
        role: node.getAttribute('role') || '',
        type: node.getAttribute('type') || '',
      }))
      .filter(item => item.text || item.ariaLabel || item.placeholder || item.role || item.type);
    return {
      buttons: pick('button,[role="button"]'),
      inputs: pick('input,textarea,[contenteditable="true"],[role="textbox"]'),
      links: pick('a'),
    };
  }).catch(error => ({ error: error.message }));
}
