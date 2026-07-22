export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }
    const [key, inlineValue] = token.slice(2).split(/=(.*)/s, 2);
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

export function printUsage() {
  console.log(`
TakomiFlow

Usage:
  node scripts/takomi-flow.mjs bootstrap [--profile-dir <path>] [--browser-channel chrome] [--cdp-url <url>] [--headless]
  node scripts/takomi-flow.mjs doctor [--profile-dir <path>] [--output-dir <path>]
  node scripts/takomi-flow.mjs audit [--profile-dir <path>] [--output-dir <path>]
  node scripts/takomi-flow.mjs capabilities
  node scripts/takomi-flow.mjs examples [--name <example-name>]
  node scripts/takomi-flow.mjs trusted-chrome [--port 9222] [--profile-dir <path>] [--chrome-path <path>]
  node scripts/takomi-flow.mjs plan --kind <video|image> --prompt <text> [--submit --target-dir <path>]
  node scripts/takomi-flow.mjs observe [--profile-dir <path>] [--output-dir <path>] [--browser-channel chrome] [--cdp-url <url>] [--headless]
  node scripts/takomi-flow.mjs smoke [--profile-dir <path>] [--output-dir <path>] [--browser-channel chrome] [--cdp-url <url>]
  node scripts/takomi-flow.mjs prepare --kind <video|image> --prompt <text> [--variations 1]
  node scripts/takomi-flow.mjs workflow --kind <video|image> --prompt <text> [--project-url <url>] [--reuse-current-project] [--allow-new-project] [--submit --allow-browser --allow-spend]
  node scripts/takomi-flow.mjs template --kind <video|image> [--output-dir <path>]
  node scripts/takomi-flow.mjs validate --request <path>
  node scripts/takomi-flow.mjs generate --request <path> [--project-url <url>] [--reuse-current-project] [--allow-new-project]
  node scripts/takomi-flow.mjs selftest [--output-dir <path>]
  node scripts/takomi-flow.mjs inspect --run <run.json|run-dir>
  node scripts/takomi-flow.mjs latest [--output-dir <path>]
  node scripts/takomi-flow.mjs runs [--output-dir <path>] [--limit 20]
  node scripts/takomi-flow.mjs assets --run <run.json|run-dir> [--frames 4]
  node scripts/takomi-flow.mjs review --run <run.json|run-dir> [--frames 4]
  node scripts/takomi-flow.mjs collect --run <run.json|run-dir> --target-dir <path> [--frames 4 --include-frames]
  node scripts/takomi-flow.mjs report [--run <run.json|run-dir>] [--output-dir <path>]

Spend guard:
  generation submits only when request allowSpend=true or TAKOMI_FLOW_ALLOW_SPEND=true.

Google login note:
  If Google says the browser may not be secure, use trusted Chrome attach mode:
  node scripts/takomi-flow.mjs trusted-chrome
  Then log in manually and attach with --cdp-url http://127.0.0.1:9222.

Project reuse:
  Pass --project-url or attach Chrome while already on a Flow project. TakomiFlow will not click
  New project unless --allow-new-project is set. Use --fresh-chat-on-failure=false to disable
  same-project chat recovery.
`);
}
