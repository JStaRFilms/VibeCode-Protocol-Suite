import { createRequire } from 'node:module';
import path from 'node:path';

export async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch (firstError) {
    try {
      const requireFromCwd = createRequire(path.join(process.cwd(), 'package.json'));
      return requireFromCwd('playwright');
    } catch {
      const message = [
        'Playwright is required for TakomiFlow browser automation.',
        'Install it in the plugin folder with:',
        '  cd C:\\Users\\johno\\plugins\\takomi-flow',
        '  pnpm install',
        '',
        `Original import error: ${firstError.message}`,
      ].join('\n');
      throw new Error(message);
    }
  }
}
