#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import {
  categoryDetails,
  getSectionCategories,
  normalizeSections,
  parseArgs,
} from "./_shared.mjs";

function printUsage() {
  console.log(`Usage:
  node scripts/build-manual-handoff-template.mjs --sections hero,features,pricing [--reference-url <url>] [--goal <text>] [--out <file>]

Examples:
  node scripts/build-manual-handoff-template.mjs --sections hero,features,footer
  node scripts/build-manual-handoff-template.mjs --sections '["navbar","hero","pricing"]' --reference-url https://example.com --out handoff.md
`);
}

function buildTemplate({ sections, referenceUrl, goal }) {
  const renderedSections = sections.map((section) => {
    const categories = getSectionCategories(section);
    const categoryLines = categories.length
      ? categories
          .map((slug) => {
            const details = categoryDetails(slug);
            const countSuffix = details.count ? ` (${details.count})` : "";
            return `- ${details.label}${countSuffix}: ${details.url}`;
          })
          .join("\n")
      : "- Add any relevant 21st.dev category URLs you used.";

    return `## ${section}

Suggested 21st.dev categories:
${categoryLines}

Chosen 21st.dev URLs:
- 

Copy prompt or notes:
\`\`\`md
\`\`\`

Component code blocks:
\`\`\`tsx
\`\`\`

Dependencies:
- 

Placement / styling notes:
- 
`;
  });

  return `# 21st.dev Manual Handoff

Reference URL:
${referenceUrl || ""}

Page goal:
${goal || ""}

Desired page order:
- ${sections.join("\n- ")}

General project notes:
- Framework:
- Styling stack:
- Existing component path:
- Constraints:

${renderedSections.join("\n")}
`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const sectionsInput = args.sections ?? args._[0];
  const sections = normalizeSections(sectionsInput);

  if (sections.length === 0) {
    printUsage();
    process.exit(1);
  }

  const template = buildTemplate({
    sections,
    referenceUrl: args["reference-url"] ?? "",
    goal: args.goal ?? "",
  });

  if (args.out) {
    const outputPath = path.resolve(process.cwd(), args.out);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, template, "utf8");
    console.log(outputPath);
    return;
  }

  process.stdout.write(template);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
