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
The 6 essential, always-active core skills:

- `takomi` (author: J StaR Films) — unified Takomi workflow/router skill.
- `sync-docs` (author: J StaR Films) — keeps project docs aligned after implementation work.
- `security-audit` (author: J StaR Films) — baseline security review and auth/payment boundary checks.
- `agent-recovery` (author: J StaR Films) — recovery and reset guidance when an agent is stuck.
- `avoid-feature-creep` (author: J StaR Films) — scope discipline and anti-bloat principles.
- `git-commit-generation` (author: Kilo Code, coauthored: J StaR Films / Takomi) — conventional commit message generation.

## Custom Page & Atomic Umbrella Packages
Custom opens a dedicated category browser with color-coded categories. Multi-skill ecosystems are grouped into atomic umbrella packages to minimize system prompt token usage.

### 10 Canonical Categories
1. **Core / Recommended** (`core`): The 6 core skills listed above.
2. **Developer / Frameworks** (`dev-workflows`): `web-dev-standards` (atomic umbrella: Next.js, Expo, monorepos, Resend), `ai-sdk`, `git-github-tools` (atomic umbrella: GitHub ops, worktrees, PR fixes), `context7`, `jules`, `anti-gravity`.
3. **Security & Web Audits** (`security`): `security-audit`, `audit-website`.
4. **Frontend / UI** (`frontend`): `frontend-ui` (atomic umbrella: frontend design, guidelines, UI/UX Pro Max, Expo UI, 21st.dev, Figma, testing).
5. **Convex Suite** (`convex`): `convex` (atomic umbrella: 12 backend sub-skills).
6. **Video / Motion / Art** (`video-motion`): `hyperframes` (atomic umbrella: 19 video sub-skills), `remotion` (atomic umbrella: 2 sub-skills), `zack-d-films-production-suite`, `algorithmic-art`.
7. **AI Media / Content Creation** (`ai-media`): `ai-media` (atomic umbrella: Flow, avatars, marketing video, voice, podcast, photos).
8. **Marketing / SEO / Growth** (`marketing-seo`): `marketing-growth` (atomic umbrella: copywriting, SEO, pricing, social, naming, trends, YouTube).
9. **Docs / Office / Extraction** (`office-docs`): `office-docs` (atomic umbrella: PDF, DOCX, PPTX, XLSX, exams), `high-fidelity-extraction`.
10. **Agent Engineering & Prompting** (`agent-engineering`): `agent-engineering` (atomic umbrella: prompt engineering, context optimization, skill creator, SDD, task spawning, READMEs).


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
