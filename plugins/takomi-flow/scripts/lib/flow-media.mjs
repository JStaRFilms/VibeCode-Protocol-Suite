export async function listMediaIds(page) {
  const ids = await page.locator('img[src*="media.getMediaUrlRedirect"], video[src*="media.getMediaUrlRedirect"]').evaluateAll(items => (
    items.map(item => mediaIdFromUrl(item.getAttribute('src') || item.src || '')).filter(Boolean)
  )).catch(() => []);
  return [...new Set(ids)];
}

export async function newMediaIds(page, baselineIds = []) {
  const baseline = new Set(baselineIds);
  return (await listMediaIds(page)).filter(id => !baseline.has(id));
}

export async function openGeneratedMediaById(page, mediaId) {
  if (!mediaId) return false;
  const candidates = [
    page.locator(`img[src*="${mediaId}"]`).first(),
    page.locator(`video[src*="${mediaId}"]`).first(),
  ];
  for (const locator of candidates) {
    if (!(await locator.count().catch(() => 0))) continue;
    try {
      await locator.scrollIntoViewIfNeeded().catch(() => {});
      await locator.click({ timeout: 10000, force: true });
      await page.waitForTimeout(3000);
      return true;
    } catch {}
  }
  return false;
}

function mediaIdFromUrl(value) {
  try {
    const url = new URL(value, 'https://labs.google');
    return url.searchParams.get('name');
  } catch {
    const match = /[?&]name=([^&]+)/.exec(value);
    return match ? decodeURIComponent(match[1]) : null;
  }
}
