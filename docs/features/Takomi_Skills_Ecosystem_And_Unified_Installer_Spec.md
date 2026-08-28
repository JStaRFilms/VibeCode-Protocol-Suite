# Takomi Skills Ecosystem & Unified Installer Specification

## Problem Statement

Developers and AI agents using modern agentic harnesses (Google Antigravity, Claude Code, OpenAI Codex, Pi, Cursor, Windsurf) face two interrelated challenges:

1. **Agent Prompt Bloat and Context Saturation**: Installing dozens of independent skills injects thousands of tokens of raw YAML frontmatter into the agent's base system prompt on every single turn. This wastes token budget, slows model generation, and causes harnesses with strict context injection caps (such as Antigravity) to drop skills silently.
2. **Fragmented Installer and Environment Management**: Prior installation methods had diverging interfaces and behaviors. Project workspace initialization (`init`), global multi-IDE synchronization (`install`), and shared skills management used disparate prompt flows, inconsistent core defaults, and flat unorganized lists. Additionally, running Python-based CLI skills on Windows environments caused unhandled `UnicodeEncodeError` crashes due to legacy `cp1252` encoding defaults.

## Solution

A unified, token-efficient skills architecture and management suite consisting of:

1. **Lean Unified Skills Architecture**: High-cohesion domain capabilities consolidated into **12 Atomic Umbrella Suites** (each exposing a single router `SKILL.md` with dense keyword context pointers), **8 Core Essentials** (always active for universal software engineering baseline intelligence), and standalone developer utilities.
2. **Unified Interactive Category Tree Installer**: A shared terminal user interface (TUI) and catalog engine powering all installation entry points (`init`, `install`, `install skills`, `sync`). It provides collapsible category trees, batch toggle capabilities, dynamic core resolution, and SHA-256 ownership tracking to protect custom/modified skills during updates or pruning.
3. **Safe Multi-Harness Global Cleanup Utility**: A non-destructive reset tool supporting dry-run previews, selective IDE targeting, and protected asset preservation (e.g. Codex directories, `.system` folders, `copywriting.zip`).
4. **Cross-Platform UTF-8 Console Resilience**: Native stream reconfiguration embedded into CLI-driven Python skills to guarantee flawless execution of ASCII/Unicode design systems and status indicators on Windows systems.

---

## User Stories

1. As a developer using AI coding agents, I want my agent harness to load a concise top-level skill index, so that 10,000+ tokens are not wasted on system prompt overhead on every turn.
2. As an agent responding to user requests, I want parent umbrella skills to provide clear keyword context pointers, so that I can automatically discover and read specialized sub-skills via relative file links without prompt bloat.
3. As a developer running `takomi init`, I want to browse and select workspace skills using an interactive category tree, so that I can easily find and configure domain-specific tools without navigating a flat list of 100+ items.
4. As a developer configuring global IDEs via `takomi install`, I want the installer to detect all supported harnesses (Antigravity, Claude, Cursor, Windsurf, KiloCode, Codex) and synchronize selected skill suites deterministically.
5. As a developer managing my skills installation, I want Takomi to track installed assets using SHA-256 hashes in an ownership manifest, so that my custom skills and local modifications are never overwritten or deleted during automated updates.
6. As a user pruning deselected skills, I want the CLI to present an explicit confirmation showing only Takomi-managed items to be removed, so that my proprietary skills remain safe.
7. As a developer aborting an installation prompt via Escape or Ctrl+C, I want the CLI to exit cleanly without unhandled runtime type errors.
8. As a developer on Windows, I want Python-based skills like `ui-ux-pro-max` to output Unicode characters, boxes, and emojis without crashing on `cp1252` encoding errors.
9. As a developer cleaning up legacy agent installations, I want a dedicated cleanup tool that safely removes obsolete folders while strictly preserving my Codex skills and specific backup archives.
10. As a developer running CI or local test suites, I want all subagent lifecycle, heartbeat rendering, and skill selection tests to execute deterministically without scheduler flakiness on Windows.
11. As a technical writer and agent architect, I want all skill instructions to follow strict frontmatter schemas and apply the unslop writing style directly, so that agents communicate clearly without conversational filler.
12. As an agent executing Conventional Commits, I want clear, concise commit generation guidelines free of unparsed frontend documentation tags or IDE-specific button dependencies.
13. As a maintainer, I want an automated integrity verification script that scans all `SKILL.md` files across the repository to validate frontmatter structure and relative markdown links.
14. As a developer customizing core capabilities, I want promotions to Core Essentials to be strictly reserved for explicit user confirmation, ensuring baseline agent instructions remain predictable.
15. As a developer requesting structured research findings, I want future skills to support standardized standalone HTML exports, so that complex analysis reports can be rendered in clean, dark-mode documents.

---

## Implementation Decisions

### 1. Taxonomy & Core Skill Governance
- **8 Core Essentials**: Fixed baseline consisting of `takomi`, `grill-me`, `code-review`, `sync-docs`, `security-audit`, `agent-recovery`, `avoid-feature-creep`, and `git-commit-generation`. Any promotion to core is explicitly locked to user discretion.
- **12 Atomic Umbrella Suites**: Group related sub-skills into cohesive directories (`code-intelligence`, `engineering-principles`, `agent-engineering`, `frontend-ui`, `convex`, `video-motion`, `ai-media`, `marketing-growth`, `office-docs`, `web-dev-standards`, `git-github-tools`, `zack-production-suite`).
- **Standalone Exceptions**: Standalone top-level registration is limited to single-purpose binary wrappers (`audit-website`, `context7`, `jules`) and global communication modes (`wait-what`, `bro`, `poteto-mode`).
- **Standardized Frontmatter**: Every `SKILL.md` strictly adheres to YAML frontmatter with `name`, `description` (starting with `"Use when [user wants to do X]..."`), `author`, `coauthored`, and `version`.

### 2. Unified CLI & Interactive TUI Selection
- **Shared Selection Engine**: `takomi init`, `takomi install`, and `takomi install skills` invoke `promptCustomSkillSelection()`, which launches `skills-selection-tui.js` in interactive TTY environments with fallback to standard prompts in non-interactive shells.
- **Dynamic Catalog Consumption**: All installation commands resolve core skills dynamically via `getValidCoreSkills()` and categorize bundled assets via `SKILL_CATEGORIES` in `skill-categories.js`.
- **Cancellation Safety**: All prompt flows validate prompt response completeness (`if (!response.components || !response.path) return;`) before path resolution to prevent runtime exceptions.
- **Dead Code Elimination**: Pruned unreferenced imports (`syncToHarness`) and obsolete prompt schema definitions across CLI entry points.

### 3. Safe Cleanup & Reset Automation
- **Selective & Dry-Run by Default**: `clean-installed-skills.mjs` executes in dry-run mode unless `--execute` or `-f` is explicitly provided. Supports target filtering (`--only=shared,antigravity,gemini_legacy`) and temporary directory removal (`--tmp`).
- **Protected File Registry**: Built-in exclusion lists safeguard `.system`, `.git`, `.gitignore`, `copywriting.zip`, all dot-files, and skip `~/.codex/skills/` unless `--include-codex` is passed.

### 4. Cross-Platform Runtime Hardening
- **Python Console UTF-8 Reconfiguration**: Injected standard stream reconfiguration at script startup for `search.py`, `design_system.py`, and `core.py`:
  ```python
  import sys
  if hasattr(sys.stdout, 'reconfigure'):
      sys.stdout.reconfigure(encoding='utf-8')
  if hasattr(sys.stderr, 'reconfigure'):
      sys.stderr.reconfigure(encoding='utf-8')
  ```
- Applied synchronously across the repository source, global Antigravity (`~/.gemini/config/skills`), and global shared (`~/.agents/skills`) directories.

---

## Testing Decisions

### Test Characteristics
- Tests assert strictly on public CLI APIs, file system outcomes, manifest contents, and interactive state transitions, rather than internal implementation details.
- All asynchronous timings incorporate generous buffer multiples (e.g. 850ms completion delays against 125ms heartbeat intervals) to ensure deterministic assertions across Windows, macOS, and Linux runners.

### Tested Areas
1. **Skill Taxonomy & Catalog Integrity**:
   - `scripts/verify_skills_integrity.cjs`: Scans all 163+ `SKILL.md` files for valid YAML frontmatter and validates that all relative markdown links resolve to existing files on disk (ignoring fenced code blocks).
   - `scripts/test-skill-selection.js`: Validates 8/8 Core Essentials, non-core exclusions, category mappings (`code-intelligence`, `principles`), manifest ownership tracking, manual collision protection, and store pruning.
2. **Subagent Production Lifecycle & Visual Rendering**:
   - `scripts/test-subagent-production-lifecycle.js`: 5 consecutive stress cycles validating Takomi-only lifecycle, native-first ordering, Takomi-first ordering, ownership reloads, and race handling.
   - `scripts/test-subagent-renderers.js`: Verifies compact, control-safe visual cards at 40 and 60 columns.
3. **Provider & Context Integration**:
   - `scripts/test-antigravity-provider.js`: Validates model catalog definitions, file-based `@file` context generation, and runtime model mapping.

### Prior Art
- Existing suite located in `scripts/test-regressions.js`, `scripts/test-workflow-catalog.js`, and `scripts/test-context-manager-renderers.js`.

---

## Out of Scope

- Modifying upstream third-party APIs or MCP server protocols.
- Automated generation of HTML report templates (reserved for the queued HTML response standardization skill).
- Modifying prompt files inside protected user directories without explicit confirmation.
- Automatic unilateral promotion of non-core skills into Core Essentials.

---

## Further Notes

- All documentation and agent instructions must adhere to the `unslop` skill standard, favoring positive, active instructions and eliminating AI conversational filler.
- This specification serves as the architectural benchmark for all future skill additions, harness integrations, and CLI packaging releases.
