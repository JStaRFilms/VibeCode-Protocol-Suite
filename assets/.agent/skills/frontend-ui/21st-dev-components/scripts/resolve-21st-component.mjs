#!/usr/bin/env node

import {
  extractNextFlightPayloads,
  fetchText,
  findJsonObject,
  findJsonString,
  parseArgs,
} from "./_shared.mjs";

function printUsage() {
  console.log(`Usage:
  node scripts/resolve-21st-component.mjs --url <21st-component-url> [--json]

Examples:
  node scripts/resolve-21st-component.mjs --url https://21st.dev/community/components/Codehagen/hero-badge/default --json
  node scripts/resolve-21st-component.mjs --url https://21st.dev/community/components/Codehagen/hero-badge/default
`);
}

function normalizeMetadata(url, html) {
  const payloadText = extractNextFlightPayloads(html).join("\n");
  const component = findJsonObject(payloadText, '"component":', (value) => typeof value?.component_slug === "string");
  const demo = findJsonObject(payloadText, '"demo":', (value) => typeof value?.demo_slug === "string");
  const registryDependencies =
    findJsonObject(payloadText, '"registryDependencies":') ??
    findJsonObject(payloadText, '"registry_dependencies":');
  const npmDependenciesOfRegistryDependencies =
    findJsonObject(payloadText, '"npmDependenciesOfRegistryDependencies":') ??
    findJsonObject(payloadText, '"npm_dependencies_of_registry_dependencies":');
  const tailwindConfig = findJsonObject(payloadText, '"tailwindConfig":');
  const globalCss = findJsonString(payloadText, '"globalCss":"');
  const demoCodeInline = findJsonString(payloadText, '"demoCode":"');

  if (!component) {
    throw new Error("Could not locate structured component metadata in the 21st.dev page payload.");
  }

  return {
    inputUrl: url,
    fetchedAt: new Date().toISOString(),
    title: component.name ?? component.component_slug,
    componentName: component.name ?? null,
    componentSlug: component.component_slug ?? null,
    componentNames: Array.isArray(component.component_names) ? component.component_names : [],
    author: component.user?.username ?? component.user?.name ?? component.user_id ?? null,
    authorProfile: component.user?.website_url ?? component.user?.github_url ?? null,
    description: component.description ?? null,
    license: component.license ?? null,
    tags: Array.isArray(component.tags) ? component.tags.map((tag) => tag.slug ?? tag.name).filter(Boolean) : [],
    dependencies: component.dependencies ?? {},
    demoDependencies: demo?.demo_dependencies ?? component.demo_dependencies ?? {},
    demoDirectRegistryDependencies:
      demo?.demo_direct_registry_dependencies ??
      component.demo_direct_registry_dependencies ??
      [],
    directRegistryDependencies: component.direct_registry_dependencies ?? [],
    registryDependencies: registryDependencies ?? {},
    npmDependenciesOfRegistryDependencies: npmDependenciesOfRegistryDependencies ?? {},
    codeUrl: component.code ?? null,
    demoCodeUrl: demo?.demo_code ?? component.demo_code ?? null,
    previewUrl: demo?.preview_url ?? component.preview_url ?? null,
    videoUrl: demo?.video_url ?? component.video_url ?? null,
    compiledCssUrl: demo?.compiled_css ?? component.compiled_css ?? null,
    tailwindConfig,
    globalCss,
    demoCodeInline,
    websiteUrl: component.website_url ?? null,
    downloadsCount: component.downloads_count ?? null,
    likesCount: component.likes_count ?? null,
    demoName: demo?.name ?? null,
    demoSlug: demo?.demo_slug ?? null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    printUsage();
    process.exit(0);
  }

  const url = args.url ?? args._[0];
  if (!url) {
    printUsage();
    process.exit(1);
  }

  const html = await fetchText(url);
  const metadata = normalizeMetadata(url, html);

  if (args.json) {
    console.log(JSON.stringify(metadata, null, 2));
    return;
  }

  const lines = [
    `Title: ${metadata.title ?? "Unknown"}`,
    `Author: ${metadata.author ?? "Unknown"}`,
    `Component Slug: ${metadata.componentSlug ?? "Unknown"}`,
    `Demo Slug: ${metadata.demoSlug ?? "Unknown"}`,
    `Tags: ${metadata.tags.join(", ") || "None"}`,
    `Dependencies: ${Object.keys(metadata.dependencies).join(", ") || "None"}`,
    `Code URL: ${metadata.codeUrl ?? "None"}`,
    `Demo Code URL: ${metadata.demoCodeUrl ?? "None"}`,
    `Preview URL: ${metadata.previewUrl ?? "None"}`,
  ];

  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
