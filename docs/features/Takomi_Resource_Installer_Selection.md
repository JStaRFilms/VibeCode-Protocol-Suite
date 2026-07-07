# Takomi Resource Installer Selection

## Status
Implemented first pass: core/repeat-install modes, categorized selection, ownership-safe skill reconciliation, global store/harness ownership tracking, tests, and a terminal TUI category browser with prompt fallback.

## Goal
Takomi should stop installing every bundled skill by default. Skill installation should be intentional, categorized, visually clear, and ownership-safe on repeat installs.

## Primary Flow
### Page 1: Skills Installation Mode
If no Takomi-owned skills are detected:

```txt
Skills Installation

● Core Skills [Recommended]
  Essential skills for efficient Takomi usage.

○ Custom
  Choose categories and individual skills.

○ All Skills
  Install every bundled Takomi skill.

○ None
  Do not install Takomi skills.
```

If Takomi-owned skills are already detected:

```txt
Skills Installation

● Leave As Is [Recommended]
  Keep your current Takomi skill selection unchanged.

○ Present Custom
  Review currently installed skills and change selections.

○ Core Skills
  Switch to recommended core skills.

○ Custom
  Choose categories and individual skills.

○ All Skills
  Install every bundled Takomi skill.

○ None
  Disable Takomi-managed skills.
```

Important: `Core Skills` must not silently delete previously installed Takomi-owned skills unless the user confirms the removal plan.

## Recommended Core Skills
Proposed default set:

- `takomi` — unified Takomi workflow/router skill. Required for natural-language Takomi workflow behavior in non-native harnesses.
- `sync-docs` — keeps project docs aligned after implementation work.
- `code-review` — general review capability.
- `security-audit` — baseline security review.
- `optimize-agent-context` — context hygiene and prompt/context efficiency.
- `agent-recovery` — recovery/reset guidance.
- `avoid-feature-creep` — scope discipline.
- `ai-sdk` — developer AI feature support; user wants this as default.
- `git-commit-generation` — commit-message workflow; user wants this as default.

Needs review:
- `spawn-task` — likely optional because Takomi already includes `vibe-spawnTask.md` inside the `takomi` skill/workflows.
- `subagent-driven-development` — likely overlaps with Takomi orchestration/subagent workflow and should be optional or merged with the orchestration category.

## Custom Page
Custom opens a dedicated category browser, not a giant flat list.

Controls target:
- Space: select/deselect category or skill
- Right arrow: expand category
- Left arrow: collapse category
- Enter: continue
- Back/Escape: previous page

Visual behavior:
- Color-coded categories.
- Selected category labels appear in brackets, e.g. `[Core / Recommended]`, `[Security / Review]`, `[Convex]`.
- Expanded category shows skill names and descriptions.
- If the terminal is not an interactive TTY, the installer falls back to category and per-category multiselect prompts.

## Proposed Categories
### Core / Recommended
Core skills listed above.

### Developer / Frameworks
- `ai-sdk`
- `nextjs-standards`
- `monorepo-management`
- `upgrading-expo`
- `github-ops`
- `git-worktree`
- `git-commit-generation`
- `pr-comment-fix`
- `jules`
- `gemini`
- `anti-gravity`

### Security / Review
- `security-audit`
- `audit-website`
- `code-review`
- `jstar-reviewer`
- `convex-security-audit`
- `convex-security-check`

### Convex
- `convex`
- `convex-agents`
- `convex-best-practices`
- `convex-component-authoring`
- `convex-cron-jobs`
- `convex-file-storage`
- `convex-functions`
- `convex-http-actions`
- `convex-migrations`
- `convex-realtime`
- `convex-schema-validator`
- `convex-security-audit`
- `convex-security-check`

### Frontend / UI
- `frontend-design`
- `web-design-guidelines`
- `building-native-ui`
- `ui-ux-pro-max`
- `component-analysis`
- `21st-dev-components`
- `stitch`
- `webapp-testing`

### Docs / Office / Extraction
- `pdf`
- `docx`
- `pptx`
- `xlsx`
- `high-fidelity-extraction`
- `crafting-effective-readmes`

### Marketing / SEO / Copy
- `copywriting`
- `marketing-ideas`
- `pricing-strategy`
- `programmatic-seo`
- `seo-ready`
- `social-content`
- `twitter-automation`
- `google-trends`
- `domain-name-brainstormer`
- `global-brand-namer`
- `youtube-pipeline`

### AI Media / Content Creation
Optional and not default:
- `ai-avatar-video`
- `ai-marketing-videos`
- `ai-podcast-creation`
- `ai-product-photography`
- `ai-social-media-content`
- `ai-voice-cloning`

### Creative / Video / Art
- `algorithmic-art`
- `blender-mcp-scene-director`
- `remotion`
- `remotion-real-ui-video`
- `youtube-pipeline`
- `ai-avatar-video`
- `ai-marketing-videos`

### Skill Building / Prompting / Orchestration
- `skill-creator`
- `prompt-engineering`
- `subagent-driven-development`
- `spawn-task` if retained

## Deletion / Cleanup Policy
Recommended approach: include cleanup, but make it explicit and safe.

Default repeat install should be **non-destructive**:
- `Leave As Is [Recommended]` does nothing to existing Takomi-owned skills.
- `Present Custom` starts from the currently installed Takomi-owned selection.

When a user deselects a previously Takomi-owned skill:
1. Show a removal preview.
2. Remove it only if it is recorded in the Takomi ownership manifest.
3. If the current folder hash differs from Takomi’s recorded hash, preserve it and warn that it may have been modified.
4. Never remove skills absent from the Takomi manifest.

## Manifest Requirements
Track per resource:
- resource type: skill/workflow/etc.
- name
- category
- target path
- source package version
- installed hash
- installed timestamp
- user-selected mode/custom selection

This enables safe reconciliation across setup, refresh, global store sync, and harness targets.

## Recommended Implementation Strategy
1. Add shared resource metadata/taxonomy.
2. Add install mode resolver: leave-as-is/core/custom/all/none.
3. Add ownership-aware reconciler.
4. Use it from `setup skills`, `refresh skills`, `setup all`, global store population, and harness sync.
5. Add TUI/custom selector after the basic resolver is stable.

## Implemented Coverage
- Direct global skills target: `takomi setup skills`, `takomi refresh skills`, and `takomi setup all` skills portion.
- Multi-IDE global store setup: `takomi setup` / legacy `takomi install` skills and workflows portions.
- Harness sync: ownership-aware copying and pruning for skills/workflows synced from the global store.
- Safety behavior: manual collisions and modified Takomi-owned resources are preserved and reported.
