#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import { deriveOutputPath, fetchText, forceArray, parseArgs } from "./_shared.mjs";

function printUsage() {
  console.log(`Usage:
  node scripts/fetch-21st-source.mjs --url <cdn-url> [--url <cdn-url> ...] [--out-dir <dir>] [--json]

Examples:
  node scripts/fetch-21st-source.mjs --url https://cdn.21st.dev/user_Codehagen/hero-badge.tsx
  node scripts/fetch-21st-source.mjs --url https://cdn.21st.dev/a.tsx --url https://cdn.21st.dev/b.tsx --out-dir tmp/21st
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const urls = [...forceArray(args.url), ...args._].filter(Boolean);
  if (urls.length === 0) {
    printUsage();
    process.exit(1);
  }

  const results = [];
  for (const url of urls) {
    const content = await fetchText(url);
    results.push({
      url,
      fileName: path.basename(new URL(url).pathname) || "source.txt",
      content,
    });
  }

  if (args["out-dir"]) {
    const outDir = path.resolve(process.cwd(), args["out-dir"]);
    await fs.mkdir(outDir, { recursive: true });

    for (const result of results) {
      const outputPath = deriveOutputPath(outDir, result.url);
      await fs.writeFile(outputPath, result.content, "utf8");
      result.outputPath = outputPath;
    }

    console.log(JSON.stringify(results.map(({ content, ...rest }) => rest), null, 2));
    return;
  }

  if (args.json || results.length > 1) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  process.stdout.write(results[0].content);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
