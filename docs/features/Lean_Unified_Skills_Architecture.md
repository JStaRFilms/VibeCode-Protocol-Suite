# Lean Unified Skills Architecture

## Status
Implemented: Multi-skill ecosystems consolidated into 12 atomic umbrella suites with router `SKILL.md` files; Core Essentials slimmed to 8 always-active skills; 10 standalone developer tools; canonical non-overlapping categories defined; test suite verified across all harnesses.

## Overview
AI agent harnesses (Google Antigravity, Claude Code, OpenAI Codex, Pi, Cursor, Windsurf) scan top-level directories for `SKILL.md` frontmatter and inject all discovered descriptions into the system prompt. With 99+ flat skills installed, this created severe token bloat (10k–25k tokens per turn) and led harnesses like Antigravity to silently drop skills due to context limits.

The Lean Unified Skills Architecture solves context saturation without sacrificing deep domain capabilities by combining:
1. **Atomic Umbrella Suites**: Multi-skill frameworks live in self-contained directories where a single top-level `SKILL.md` acts as the router, while individual sub-skills are read on demand via relative paths (`view_file`).
2. **8 Core Essentials**: A minimal, always-active core set for general development.
3. **Canonical Non-Overlapping Categories**: Clean pack-based installation and browsing.

---

## The 8 Core Essentials

Always active by default, providing universal baseline development intelligence:

| Skill | Trigger Description | Author |
|---|---|---|
| `takomi` | Use when coordinating multi-stage work, initializing Takomi workflows (genesis, design, build, review, finalize), or navigating agent lifecycle states. | J StaR Films |
| `grill-me` | Use when stress-testing a plan, design, or requirements through an interactive interview with question frontiers and adversarial challenges. | Matt Pocock / P-Stack / J StaR Films |
| `code-review` | Use when reviewing staged changes, PRs, or branch diffs against repository standards and originating specifications using parallel sub-agents. | Matt Pocock / J StaR Films |
| `sync-docs` | Use after writing code, implementing features, or fixing bugs to update feature documentation in `docs/features/` and keep project documentation in sync. | J StaR Films |
| `security-audit` | Use when auditing code for security vulnerabilities, verifying auth/payment boundaries, scanning for secret leaks, or doing pre-deployment sanity checks. | J StaR Films |
| `agent-recovery` | Use when an agent is stuck in loops, repeating errors, losing context, or needs session migration, state reset, or subagent escalation. | J StaR Films |
| `avoid-feature-creep` | Use when planning features, reviewing scope, or building MVPs to prevent over-engineering, unnecessary abstractions, and unrequested scope expansion. | J StaR Films |
| `git-commit-generation` | Use when generating clear, conventional git commit messages based on staged changes or recent repository diffs. | Kilo Code / J StaR Films |

---

## The 12 Atomic Umbrella Suites

Each suite is installed as a complete atomic directory. Standard harnesses discover exactly 1 top-level skill in their system prompt. When invoked, the agent reads the specific sub-skill needed.

```
📁 assets/.agent/skills/
├── 🔷 code-intelligence/               (6 sub-skills)
│   ├── SKILL.md                       (Router + Keyword Map)
│   ├── why/SKILL.md
│   ├── how/SKILL.md
│   ├── blast-radius/SKILL.md
│   ├── diagnosing-bugs/SKILL.md
│   ├── teach/SKILL.md
│   └── show-me-your-work/SKILL.md
│
├── 🔷 engineering-principles/         (21 sub-principles)
│   ├── SKILL.md                       (Router + Principles Catalog)
│   ├── boundary-discipline/SKILL.md
│   ├── build-the-lever/SKILL.md
│   ├── encode-lessons-in-structure/SKILL.md
│   ├── exhaust-the-design-space/SKILL.md
│   ├── experience-first/SKILL.md
│   ├── fix-root-causes/SKILL.md
│   ├── foundational-thinking/SKILL.md
│   ├── guard-the-context-window/SKILL.md
│   ├── laziness-protocol/SKILL.md
│   ├── make-operations-idempotent/SKILL.md
│   ├── migrate-callers-then-delete-legacy-apis/SKILL.md
│   ├── minimize-reader-load/SKILL.md
│   ├── model-the-domain/SKILL.md
│   ├── never-block-on-the-human/SKILL.md
│   ├── outcome-oriented-execution/SKILL.md
│   ├── prove-it-works/SKILL.md
│   ├── redesign-from-first-principles/SKILL.md
│   ├── separate-before-serializing-shared-state/SKILL.md
│   ├── sequence-verifiable-units/SKILL.md
│   ├── subtract-before-you-add/SKILL.md
│   └── type-system-discipline/SKILL.md
│
├── 🔷 agent-engineering/              (15 sub-skills)
│   ├── SKILL.md                       (Router + Directory)
│   ├── writing-for-agents/SKILL.md    (Foundational guide for agent docs)
│   ├── domain-modeling/SKILL.md       (CONTEXT.md + ADRs)
│   ├── conversation-to-spec/SKILL.md
│   ├── spawn-task/SKILL.md            (Tracer-bullet DAGs)
│   ├── to-questionnaire/SKILL.md
│   ├── arena/SKILL.md
│   ├── automate-me/SKILL.md
│   ├── reflect/SKILL.md
│   ├── create-verification-skill/SKILL.md
│   ├── maintain-verification-skill/SKILL.md
│   ├── subagent-driven-development/SKILL.md
│   ├── prompt-engineering/SKILL.md
│   ├── skill-creator/SKILL.md
│   ├── optimize-agent-context/SKILL.md
│   └── crafting-effective-readmes/SKILL.md
│
├── 🔷 web-dev-standards/              (8 sub-skills)
│   ├── SKILL.md                       (Router + Directory)
│   ├── codebase-design/SKILL.md       (Deep Modules + Design-It-Twice)
│   ├── test-driven-development/SKILL.md (Mock boundaries & observable behavior)
│   ├── interactive-wizard/SKILL.md    (Bash template.sh generator)
│   ├── typescript-standards/SKILL.md
│   ├── nextjs-standards/SKILL.md
│   ├── upgrading-expo/SKILL.md
│   ├── monorepo-management/SKILL.md
│   └── shared-resend-portfolio/SKILL.md
│
├── 🔷 git-github-tools/               (5 sub-skills)
│   ├── SKILL.md                       (Router + Directory)
│   ├── resolving-merge-conflicts/SKILL.md
│   ├── issue-pr-triage/SKILL.md       (Triage state machine & AGENT-BRIEF.md)
│   ├── git-worktree/SKILL.md
│   ├── github-ops/SKILL.md
│   └── pr-comment-fix/SKILL.md
│
├── 🔷 frontend-ui/                    (10 sub-skills)
│   ├── SKILL.md                       (Router + Directory)
│   ├── prototyping-variants/SKILL.md  (Logic simulator demo & UI switch bar)
│   ├── frontend-design/SKILL.md
│   ├── web-design-guidelines/SKILL.md
│   ├── ui-ux-pro-max/SKILL.md
│   ├── building-native-ui/SKILL.md
│   ├── 21st-dev-components/SKILL.md
│   ├── component-analysis/SKILL.md
│   ├── figma/SKILL.md
│   ├── stitch/SKILL.md
│   └── webapp-testing/SKILL.md
│
├── 🔷 office-docs/                    (6 sub-skills)
│   ├── SKILL.md                       (Router + Directory)
│   ├── technical-writing/SKILL.md     (Diátaxis + STE)
│   ├── pdf/SKILL.md
│   ├── docx/SKILL.md
│   ├── pptx/SKILL.md
│   ├── xlsx/SKILL.md
│   └── exam-creator-skill/SKILL.md
│
├── 🔷 convex/                         (12 sub-skills)
│   ├── SKILL.md                       (Router + Overview)
│   ├── convex-functions/SKILL.md
│   ├── convex-schema-validator/SKILL.md
│   ├── convex-realtime/SKILL.md
│   ├── convex-cron-jobs/SKILL.md
│   ├── convex-file-storage/SKILL.md
│   ├── convex-http-actions/SKILL.md
│   ├── convex-agents/SKILL.md
│   ├── convex-security-audit/SKILL.md
│   ├── convex-security-check/SKILL.md
│   ├── convex-best-practices/SKILL.md
│   ├── convex-migrations/SKILL.md
│   └── convex-component-authoring/SKILL.md
│
├── 🔷 hyperframes/                    (19 sub-skills)
│   ├── SKILL.md                       (Router + Capability Map)
│   ├── hyperframes-core/SKILL.md
│   ├── hyperframes-animation/SKILL.md
│   ├── hyperframes-keyframes/SKILL.md
│   ├── hyperframes-cli/SKILL.md
│   ├── hyperframes-creative/SKILL.md
│   ├── hyperframes-media/SKILL.md
│   ├── hyperframes-registry/SKILL.md
│   ├── media-use/SKILL.md
│   ├── embedded-captions/SKILL.md
│   ├── faceless-explainer/SKILL.md
│   ├── general-video/SKILL.md
│   ├── motion-graphics/SKILL.md
│   ├── music-to-video/SKILL.md
│   ├── pr-to-video/SKILL.md
│   ├── product-launch-video/SKILL.md
│   ├── remotion-to-hyperframes/SKILL.md
│   ├── slideshow/SKILL.md
│   ├── talking-head-recut/SKILL.md
│   └── website-to-video/SKILL.md
│
├── 🔷 marketing-growth/               (11 sub-skills)
│   ├── SKILL.md                       (Router + Directory)
│   ├── copywriting/SKILL.md
│   ├── marketing-ideas/SKILL.md
│   ├── pricing-strategy/SKILL.md
│   ├── programmatic-seo/SKILL.md
│   ├── seo-ready/SKILL.md
│   ├── social-content/SKILL.md
│   ├── twitter-automation/SKILL.md
│   ├── google-trends/SKILL.md
│   ├── domain-name-brainstormer/SKILL.md
│   ├── global-brand-namer/SKILL.md
│   └── youtube-pipeline/SKILL.md
│
├── 🔷 ai-media/                       (8 sub-skills)
│   ├── SKILL.md                       (Router + Directory)
│   ├── takomi-flow/SKILL.md
│   ├── ai-avatar-video/SKILL.md
│   ├── ai-marketing-videos/SKILL.md
│   ├── photo-book-builder/SKILL.md
│   ├── ai-podcast-creation/SKILL.md
│   ├── ai-product-photography/SKILL.md
│   ├── ai-social-media-content/SKILL.md
│   └── ai-voice-cloning/SKILL.md
│
└── 🔷 remotion/                       (2 sub-skills)
    ├── SKILL.md                       (Router + Best Practices)
    └── remotion-real-ui-video/SKILL.md
```

---

## Standalone Tools

Specialized tools that remain standalone at the top level:
- `wait-what` (Instant comprehension reset in Simplified Technical English)
- `bro` (Ultra-concise, zero-fluff developer communication style)
- `poteto-mode` (Ultra-compact token conserving mode)
- `ai-sdk` (AI SDK integration patterns)
- `jules` (Google Jules workflow client)
- `context7` (Real-time documentation lookup API)
- `anti-gravity` (Antigravity CLI runner)
- `audit-website` (Website SEO and security audit via Squirrelscan)
- `high-fidelity-extraction` (DOM scraping & web intelligence protocol)
- `algorithmic-art` (Generative art with p5.js)

---

## Canonical Categories

| Category ID | Title | Contained Top-Level Packages & Skills |
|---|---|---|
| `core` | Core / Recommended | `takomi`, `grill-me`, `code-review`, `sync-docs`, `security-audit`, `agent-recovery`, `avoid-feature-creep`, `git-commit-generation` |
| `code-intelligence` | Code Intelligence & Comprehension | `code-intelligence` |
| `principles` | Engineering Principles | `engineering-principles` |
| `dev-workflows` | Developer / Frameworks | `web-dev-standards`, `ai-sdk`, `git-github-tools`, `context7`, `jules`, `anti-gravity`, `wait-what`, `bro`, `poteto-mode` |
| `security` | Security & Web Audits | `security-audit`, `audit-website` |
| `frontend` | Frontend / UI | `frontend-ui` |
| `convex` | Convex Suite | `convex` |
| `video-motion` | Video / Motion / Art | `hyperframes`, `remotion`, `zack-d-films-production-suite`, `algorithmic-art` |
| `ai-media` | AI Media / Content Creation | `ai-media` |
| `marketing-seo` | Marketing / SEO / Growth | `marketing-growth` |
| `office-docs` | Docs / Office / Extraction | `office-docs`, `high-fidelity-extraction` |
| `agent-engineering` | Agent Engineering & Prompting | `agent-engineering` |
