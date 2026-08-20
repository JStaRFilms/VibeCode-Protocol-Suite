---
name: 21st-dev-components
description: Use when the user wants to build a React site or app section from 21st.dev components, clone the structure of a reference site with 21st.dev building blocks, browse 21st.dev manually and return copied prompts/code, or says things like "build me a site like this", "use 21st.dev", "copy prompt", "component URL", "hero from 21st", or "match this landing page with ready-made components".
---

# 21st.dev Reference-to-Component Skill

This skill routes between two flows:

- **Auto mode**: the user provides a reference site URL and wants the agent to inspect it, infer the required sections, choose matching 21st.dev components automatically, and integrate them.
- **Manual mode**: the user wants guided collection. The agent lists the sections, tells the user what to fetch from 21st.dev, then integrates the returned handoff.

Use this skill only for **React-family** projects. If the repo is not React-based, explain that v1 of this skill is React-only and stop.

## Bundled Resources

- `references/categories.md`
  Use for section-to-category mapping and direct 21st.dev category URLs.
- `references/manual-handoff-template.md`
  Use when the user is gathering components manually.
- `references/section-detection-rubric.md`
  Use during Auto mode after crawling the reference site.
- `scripts/resolve-21st-component.mjs`
  Resolve a 21st.dev component page into normalized metadata.
- `scripts/fetch-21st-source.mjs`
  Fetch raw source from 21st CDN URLs.
- `scripts/build-manual-handoff-template.mjs`
  Generate a manual handoff markdown file for the user.

## Raw Code Resolution Standard

Do not derive 21st.dev CDN source URLs by string concatenation or by manually modifying the community page URL.

Always treat the user-facing 21st.dev component page as the source of truth, then resolve it into metadata before fetching code.

### Required workflow
1. Start with the 21st.dev community component URL.
2. Run the resolver script on that page URL.
3. Read `codeUrl` and `demoCodeUrl` from the resolver output.
4. Fetch source from those returned URLs.
5. Only fall back to manual copy/paste if resolution succeeds but raw source cannot be fetched in the current environment.

### Command
```bash
node scripts/resolve-21st-component.mjs --url "<21st-component-url>" --json
```

### Why this rule exists
21st.dev community URLs do not always map cleanly to CDN paths. Mismatches can include:
- author slug differences between page URL and CDN path
- internal user IDs in CDN paths instead of public author names
- timestamped filenames such as `code.1748367465506.tsx`
- version query params such as `?v=1`
- demo paths that are not reliably predictable

Because of this, the correct standard is:

**community page URL -> resolve metadata -> fetch `codeUrl` / `demoCodeUrl`**

not:

**community page URL -> manually transform into CDN URL**

### Manual fallback rule
If the resolver returns metadata but the environment cannot fetch the raw source files, ask the user for one of these:
- pasted code from the 21st.dev Copy Code action
- downloaded component source
- permission to use an alternate environment that can fetch the returned CDN URLs

This resolution step is mandatory in both Auto mode and Manual mode whenever the environment allows it.

## Mode Router

### Use Auto mode when

- The user gives a live reference site URL.
- The user says "build me something like this", "clone this layout", or "crawl this site and rebuild it".
- The user expects the agent to choose components automatically.

### Use Manual mode when

- The user says they will browse 21st.dev themselves.
- The user pastes 21st.dev component URLs, copied prompts, code fences, or a markdown handoff file.
- The user wants the agent to tell them exactly what sections to gather.

If Auto mode fails because the site is blocked, brittle, or the 21st lookup is weak, fall back to Manual mode immediately and generate the handoff template instead of dead-ending.

## Auto Mode Workflow

### Step 1: Crawl the reference site in a browser

Use the browser-first workflow from the `webapp-testing` skill. Do not rely only on raw HTML if the page is clearly client-rendered.

What to inspect:
- header / navbar / announcement bars
- hero block
- feature grids or card rows
- social proof / logos
- testimonials
- pricing
- FAQ
- forms / auth blocks
- footer
- app shell elements such as sidebar, table, tabs, or modals

Load `references/section-detection-rubric.md` if the page structure is not obvious.

### Step 2: Build a page anatomy model

Write down the major sections in visual order. For each section, capture:
- section name
- rough structure
- visual tone
- obvious dependencies such as carousels, motion, video, maps, charts, or forms

### Step 3: Map sections to 21st.dev categories

Load `references/categories.md` and map each detected section to one or more category slugs.

Rules:
- Match structure first, style second.
- Use one primary category and optional supporting categories.
- Decorative elements like shaders, backgrounds, or borders are secondary, not the main section match.

### Step 4: Discover and resolve candidate components

Search 21st.dev for each mapped category. Once you have likely component URLs:

1. Resolve each page:
   ```bash
   node scripts/resolve-21st-component.mjs --url "<21st-component-url>" --json
   ```
2. Inspect:
   - dependency count
   - component/demo CDN URLs
   - tags
   - author
   - registry dependency hints

### Step 5: Choose the best match automatically

Default behavior is **not** to ask the user to choose.

Prefer:
- closest structural match
- lowest dependency burden
- compatibility with the current repo
- easier adaptation to the existing styling system

### Step 6: Fetch source and integrate

Fetch component/demo source from the resolved `codeUrl` and `demoCodeUrl` values. Do not guess CDN paths manually.

Fetch component/demo source from CDN URLs:

```bash
node scripts/fetch-21st-source.mjs --url "<code-url>" --url "<demo-code-url>" --out-dir tmp/21st
```

Then integrate into the repo:
- adapt file paths to the existing project structure
- prefer the repo's current component locations
- prefer existing Tailwind, TypeScript, and shadcn conventions when present
- if shadcn conventions are absent, adapt rather than forcing `/components/ui`
- if required dependencies or setup are missing, install/configure them first

### Step 7: Report what was selected

When you finish, state:
- which sections were detected
- which 21st.dev components were selected
- which dependencies were added
- any sections that required partial custom adaptation

## Manual Mode Workflow

### Step 1: Break the page into sections

Identify the target sections from the user's request or reference URL:
- header / navbar
- hero
- features
- testimonials
- pricing
- footer
- sidebar
- CTA
- forms
- tables
- auth
- FAQ

### Step 2: Tell the user what to collect

Use `references/categories.md` to give the exact 21st.dev category links.

Generate a checklist file when useful:

```bash
node scripts/build-manual-handoff-template.mjs --sections "header,hero,features,pricing,footer" --out 21st-handoff.md
```

Point the user at the template in `references/manual-handoff-template.md` if they want to paste directly in chat instead of using a file.

### Step 3: Accept one combined handoff

The handoff can contain:
- 21st.dev URLs
- copied prompt blocks
- code fences
- dependency lists
- placement notes

Do not make the user re-explain the same page structure if the handoff already contains it.

### Step 4: Parse and integrate

For each returned section:
- resolve the component URL if present
- read normalized metadata first, especially `codeUrl`, `demoCodeUrl`, and dependencies
- fetch source from the resolved raw URLs when needed
- merge copied prompt/code information with repo context
- install dependencies
- adapt imports, component paths, and utility functions to the current repo

## Integration Rules

- v1 supports React projects broadly.
- Preserve the repo's existing file layout whenever possible.
- If Tailwind or TypeScript is missing and the chosen component requires it, explain exactly what must be added before integration.
- If the component assumes shadcn utilities like `cn` or `@/lib/utils`, either map them to the repo equivalent or add a minimal compatible helper.
- If one section cannot be matched cleanly, integrate the rest and flag the unmatched section explicitly.

## Failure Handling

- Bad reference URL or blocked crawl: switch to Manual mode and generate a handoff template.
- 21st.dev page resolves but source URLs are missing: use the copied prompt path or ask for the component's copied prompt/code only for that section.
- Resolver succeeds but the environment cannot fetch the raw CDN URLs: ask the user for pasted Copy Code output, downloaded source, or permission to use another environment for fetch.
- Non-React target repo: explain the limitation and stop.

## Output Defaults

- **Auto mode**: inspect, choose, fetch, integrate, report.
- **Manual mode**: generate checklist, ingest handoff, integrate, report.
