# Takomi 

<div align="center">
  <h3>🎯 Stop Wrestling With AI. Start Building With Purpose.</h3>
  <p><em>The artisan's toolkit that transforms AI from chatbot to development partner — powered by the VibeCode Protocol</em></p>
</div>

---

> **🎉 Rebrand Notice:** VibeSuite is now **Takomi**!  
> If you're following tutorials that reference `vibesuite` or `VibeCode`, simply use `takomi` instead.  
> Example: `npx vibesuite install` → `npx takomi install`  
> The VibeCode Protocol lives on as the engine powering Takomi.

---

## 🚀 Quick Start (Recommended)

### Takomi Pi Harness

```bash
npm install -g takomi
takomi setup pi
cd my-project
takomi
```

Optional global skills:

```bash
takomi setup skills
# First install defaults to Core Skills.
# Repeat installs default to Leave As Is so existing selections are not pruned accidentally.
# Custom opens a color-coded category TUI with expandable skill rows when a TTY is available.
# Optional Pi feature packs can also be managed later:
takomi setup pi-features
```

Useful management commands:

```bash
takomi refresh   # one-command update: Takomi + Pi/assets/skills
takomi status
takomi doctor
takomi setup all
takomi setup project
```

Legacy commands like `takomi install pi`, `takomi sync pi`, `takomi upgrade`, and `takomi init` still work, but the simpler mental model is: **setup once, refresh when stale, run `takomi` to use it.**

During `takomi setup pi` or `takomi setup pi-features`, Takomi offers optional Pi feature packs with recommended/manual/select-all/skip choices. Current defaults install **Takomi Interview** (`npm:@juicesharp/rpiv-ask-user-question`) so models can ask structured clarification questions. **Takomi Todo** (`npm:@juicesharp/rpiv-todo`), **Takomi Browser QA** (`npm:pi-chrome`), and **Takomi Doc Preview** (`npm:pi-markdown-preview`) remain opt-in. `takomi refresh` runs Pi's package updater so installed optional, custom, old, and new Pi packages are reconciled together.

Takomi keeps `pi-subagents` installed as an internal runtime module, but setup/refresh now detects legacy raw Pi subagent activation (`npm:pi-subagents` in Pi settings or `~/.pi/agent/extensions/subagent`) and offers to disable it so models see `takomi_subagent` instead of two competing subagent tools.

### Context Manager

Takomi now ships a Pi-native `takomi-context-manager` extension. It reduces prompt bloat with progressive context loading:

- skill names are always visible, while descriptions and full `SKILL.md` files load only when needed
- `skill_manifest`, `skill_load`, `policy_manifest`, `policy_load`, and `context_report` tools expose context on demand
- `/takomi routing` remains the source of truth for model-routing policy
- `takomi_subagent` is guarded by routing-policy context and can recover from wrong-provider model choices
- `/context-report` shows prompt compaction, loaded skills/policies, blocked actions, model-routing corrections, and duplicate extension diagnostics

`context_report` is context-manager-specific rather than a clone of Pi's Alt-C window. It restores its own hidden snapshots and Pi tool-result history after `/reload`/restart, and labels any remaining gaps instead of reporting fresh in-memory zeros as session truth. It supports `mode: "summary" | "verbose" | "problems"`; `verbose: true` remains a compatibility alias for `mode: "verbose"`. The `/context-report` slash command supports argument completions for `summary`, `verbose`, and `problems`.

### Option A: Global Install (Best for Multi-IDE Users) ⭐

Install once. Use everywhere. Your skills follow you across detected AI harnesses (Antigravity, Claude Code, Codex, Cursor, Kilo Code, Pi/shared Agent Skills, Windsurf):

```bash
# Using pnpm
pnpm dlx takomi install

# Using npx
npx takomi install
```

What happens next:
- 🔍 **Auto-detects** every AI harness on your machine
- 📦 **Creates your command center** at `~/.takomi/`
- 🧰 **Lets you choose Core, Present Custom, Custom, All, or Leave As Is for skills**
- 📡 **Syncs your selected toolkit** to every IDE automatically
- 🔄 **Keeps KiloCode in sync** across CLI and VS Code

### Option B: Per-Project Setup

Need workflows for just this project? Drop them in with one command:

```bash
pnpm dlx takomi init
```

Choose your weapons:
- ✅ **.agent Folder** — Workflows for Cursor, Windsurf, Gemini Code Assist
- ✅ **Agent YAMLs** — Custom modes for Kilo Code
- ✅ **Legacy Protocols** — Copy-paste prompts for browser AI
- ✅ **Cherry-pick** exactly the workflows and skills you need

---

## Codex Takomi Skills (No Slash Required)

Takomi now supports a full skill-native protocol path in Codex:
- Router skill: `takomi`
- Specialist skills: `takomi-*` (migrated from non-legacy workflows)
- Backward phrase aliases: `vibe genesis`, `vibe build`, `mode code`, and related prior names

Use natural language:

```text
use takomi
use takomi genesis
run vibe genesis
continue build with takomi
```

Install the Takomi protocol suite:

```bash
npx -y skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite --skill takomi
```

Original Takomi-authored skills in this bundle include `21st-dev-components`, `takomi`, `global-brand-namer`, `jstar-reviewer`, and the core VibeCode/Takomi workflow skills that ship with the CLI.

### Codex Plugin Quick Start

For the newer repo-local Codex plugin path, enable `takomi-codex` from `.agents/plugins/marketplace.json`. That marketplace entry points Codex at `./plugins/takomi-codex`, which includes plugin metadata, the `takomi-codex` skill, and local verification scripts.

This plugin path is distinct from `skills add --skill takomi`, which installs the older global Takomi skill. Use natural language such as `use takomi-codex to inspect this repo`, `use Takomi to plan this feature`, or `create a Takomi roadbook for this work`.

See [Takomi Codex Onboarding](docs/takomi-codex-onboarding.md) for activation, first-run verification, policy loading, roadbooks, dry-run dispatch, no-Pi fallback, and troubleshooting.

---

## 📦 Skill Ecosystem

Think of skills as specialized team members you can summon on demand. From security audits to AI video generation — there's a skill for that.

Takomi's own installer no longer installs every bundled skill by default. `takomi setup skills` uses **Core Skills** for first-time installs, **Leave As Is** for repeat installs, and ownership-safe cleanup when you explicitly deselect Takomi-managed skills. Manual/user-added skills are preserved. Custom selection opens a color-coded category browser with expandable rows on capable terminals, and falls back to simple prompts elsewhere. The global store/harness sync path uses the same ownership model so deselected Takomi-managed skills and workflows can be pruned from `~/.takomi/` and synced harness folders without touching manual or imported resources.

The published bundle currently ships **72 top-level skills**, including the original `21st-dev-components` workflow for guided 21st.dev integration. The `pr-comment-fix` skill is sourced from https://gist.github.com/GSonofNun/35c67304c35dac7d6b43308b5371f671.

### Interactive Search & Install
```bash
# Using pnpm
pnpm dlx skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite

# Using npx
npx -y skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite
```

### Core Essentials (Start Here)
The recommended Takomi installer defaults are:

```txt
takomi
sync-docs
code-review
security-audit
optimize-agent-context
agent-recovery
avoid-feature-creep
ai-sdk
git-commit-generation
```

For the external `skills` CLI, install only the router skill if you want the smallest possible footprint:

```bash
npx -y skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite --skill takomi
```

### Convex Development Suite
Backend superpowers for the Convex ecosystem:
```bash
npx -y skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite --skill convex --skill convex-agents --skill convex-best-practices --skill convex-component-authoring --skill convex-cron-jobs --skill convex-file-storage --skill convex-functions --skill convex-http-actions --skill convex-migrations --skill convex-realtime --skill convex-schema-validator --skill convex-security-audit --skill convex-security-check
```

### AI Media Suite (Paid / Advanced)
For when you need more than code — videos, voice, images, and automation:
```bash
npx -y skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite --skill ai-avatar-video --skill ai-marketing-videos --skill ai-podcast-creation --skill ai-product-photography --skill ai-social-media-content --skill ai-voice-cloning
```

### The Full Arsenal (Free)
Everything else — SEO, research, documentation, testing, and beyond:
```bash
npx -y skills add https://github.com/JStaRFilms/VibeCode-Protocol-Suite --skill 21st-dev-components --skill agent-recovery --skill algorithmic-art --skill audit-website --skill avoid-feature-creep --skill building-native-ui --skill code-review --skill component-analysis --skill context7 --skill convex --skill convex-agents --skill convex-best-practices --skill convex-component-authoring --skill convex-cron-jobs --skill convex-file-storage --skill convex-functions --skill convex-http-actions --skill convex-migrations --skill convex-realtime --skill convex-schema-validator --skill convex-security-audit --skill convex-security-check --skill copywriting --skill crafting-effective-readmes --skill docx --skill domain-name-brainstormer --skill frontend-design --skill gemini --skill git-worktree --skill github-ops --skill global-brand-namer --skill google-trends --skill high-fidelity-extraction --skill jstar-reviewer --skill jules --skill marketing-ideas --skill monorepo-management --skill nextjs-standards --skill optimize-agent-context --skill pdf --skill pptx --skill pr-comment-fix --skill pricing-strategy --skill programmatic-seo --skill prompt-engineering --skill remotion --skill security-audit --skill seo-ready --skill skill-creator --skill social-content --skill spawn-task --skill stitch --skill subagent-driven-development --skill sync-docs --skill twitter-automation --skill ui-ux-pro-max --skill upgrading-expo --skill webapp-testing --skill web-design-guidelines --skill xlsx --skill youtube-pipeline
```

---

## 🌐 Global Skills Router (v2.0)

**One install. Every IDE. Zero friction.**

Takomi v2.0 introduces the **Global Skills Router** — install skills once into `~/.takomi/`, and Takomi syncs them into each harness' current global skills directory. You can choose symlink/junction mode for one canonical copy, auto fallback, or plain copy mode. Works on Mac & Windows.

Note: `SKILL.md` is portable, but `~/.agents/skills` is **not** a universal global skills directory. Pi does load `~/.agents/skills`, and Takomi keeps that as the Pi/shared Agent Skills target. Other harnesses use their own global paths. See `docs/skills-harness-targets.md` for the current checked path table.

### Supported Harnesses

| Harness | Global Skills Path | Global Workflows Path |
|---|---|---|
| **Antigravity** | `~/.gemini/config/skills/` | `~/.gemini/config/global_workflows/` |
| **Claude Code** | `~/.claude/skills/` | _(skills only)_ |
| **Codex** | `~/.codex/skills/` | _(skills only)_ |
| **Cursor** | `~/.cursor/skills/` | _(skills only)_ |
| **Kilo Code** | `~/.kilocode/skills/` | `~/.kilocode/workflows/` |
| **Pi / shared Agent Skills** | `~/.agents/skills/` | _(skills only)_ |
| **Windsurf** | `~/.codeium/windsurf/skills/` | `~/.codeium/windsurf/global_workflows/` |

### CLI Commands

| Command | What It Does |
|---|---|
| `takomi` | Launch Takomi in the current project |
| `takomi setup` | One-time guided setup — detects IDEs, creates your toolkit, syncs everything |
| `takomi setup pi\|skills\|project\|all` | Targeted setup without memorizing installer internals |
| `takomi refresh` | One-command update for Takomi CLI, Pi/assets, and skills |
| `takomi refresh pi\|skills\|project\|all` | Targeted refresh when you need it |
| `takomi add <url>` | Pull skills from any GitHub repo into your global store |
| `takomi status` | See what's connected and your toolkit status |
| `takomi doctor` | Run detailed diagnostics |

Legacy aliases remain supported: `install` → `setup`, `sync`/`upgrade` → `refresh`, `init` → `setup project`, `harnesses` → `status`, `update` → `refresh project`.

### Example: Add Remote Skills

```bash
# Pull skills from any GitHub repo into your global store
pnpm dlx takomi add https://github.com/JStaRFilms/VibeCode-Protocol-Suite

# See what's connected
pnpm dlx takomi status

# Refresh everything
pnpm dlx takomi refresh
```

### KiloCode YAML Auto-Sync

When KiloCode is detected, `takomi install` syncs `custom_modes.yaml` to **both** locations automatically:
- CLI: `~/.kilocode/cli/global/settings/custom_modes.yaml`
- Extension: `%APPDATA%/Antigravity/User/globalStorage/kilocode.kilo-code/settings/custom_modes.yaml`

---

## 🌟 What Is Takomi?

**AI shouldn't feel like a chatbot. It should feel like a teammate.**

Takomi is a complete workflow system for collaborating with AI to build software. Think of yourself as the Visionary/CEO, and your AI assistants as a specialized, high-performance development team that actually delivers.

This isn't prompt engineering. This is **orchestrated development** — a battle-tested collection of protocols, workflows, and prompts that transform AI from code generators into genuine project partners.

---

## 📂 Repository Structure

Built for two types of builders:

| Folder | Purpose | Who It's For |
|--------|---------|--------------|
| **`.agent/`** | Workflows & Skills for agentic IDEs | Cursor, Windsurf, Gemini Code Assist users |
| **`Legacy (Manual Method)/`** | Copy-paste prompts & protocols | Browser-based AI users (ChatGPT, Claude.ai) |
| **`Deep_Source_Prompts/`** | Reference docs & source materials | Prompt engineers, contributors |

---

## 🤖 For Agentic IDE Users (Recommended)

**Using Cursor, Windsurf, VS Code + Gemini Code Assist, or similar?**  
Everything you need is in the **`.agent/`** folder.

### Quick Setup

1. Copy the `.agent/` folder to your project root
2. Your IDE automatically detects workflows and skills
3. Invoke with natural language in Codex (e.g., `use takomi genesis`) - slash commands are optional

### What's Inside `.agent/`

```
.agent/
├── workflows/          # Executable step-by-step workflows
│   ├── vibe-genesis.md         # Start new projects (V3)
│   ├── vibe-design.md          # Generate design systems
│   ├── vibe-build.md           # Execute the build
│   ├── vibe-continueBuild.md   # Resume work in new sessions
│   ├── vibe-finalize.md        # Final verification & handoff
│   ├── vibe-spawnTask.md       # Break down complex features
│   ├── vibe-syncDocs.md        # Update documentation
│   ├── vibe-primeAgent.md      # Load project context
│   ├── reverse_genesis.md      # Onboard to existing codebases
│   │
│   ├── mode-orchestrator.md    # Coordinate multi-agent projects
│   ├── mode-architect.md       # Plan and design systems
│   ├── mode-code.md            # Write and refactor code
│   ├── mode-debug.md           # Diagnose issues
│   ├── mode-ask.md             # Explain and analyze
│   ├── mode-review.md          # Code review (manual)
│   └── ...
│
└── skills/             # Implicit capabilities (auto-activated)
    ├── prime-agent/        # Load project context
    ├── code-review/        # J-Star code review loop
    ├── security-audit/     # Deep security analysis
    ├── nextjs-standards/   # Next.js coding standards
    ├── vercel-ai-sdk/      # AI SDK reference docs
    ├── youtube-pipeline/   # Video production workflow
    └── ...
```

### Key Workflows

#### 🏗️ Project Lifecycle (V3)
| Slash Command | What It Does |
|---------------|--------------|
| `/vibe-genesis` | Architect a new project with PRD, Issues, and Guidelines |
| `/vibe-design` | Generate design system and page mockups |
| `/vibe-build` | Scaffold and build the project with verification gates |
| `/vibe-continueBuild` | Resume work in a new chat session |
| `/vibe-finalize` | Final verification and handoff report |
| `/reverse_genesis` | Onboard AI to an existing codebase |

#### 🎯 Mode Workflows (Specialized Roles)
| Slash Command | What It Does |
|---------------|--------------|
| `/mode-orchestrator` | Coordinate complex multi-agent projects |
| `/mode-architect` | Plan and design technical systems |
| `/mode-code` | Write and refactor code |
| `/mode-debug` | Diagnose and troubleshoot issues |
| `/mode-ask` | Explain and analyze without making changes |
| `/mode-review` | Manual code review before commits |

#### 🔄 Daily Development
| Slash Command | What It Does |
|---------------|--------------|
| `/vibe-primeAgent` | Load project context at start of session |
| `/vibe-spawnTask` | Break down complex features into tasks |
| `/vibe-syncDocs` | Update documentation after code changes |
| `/mode-review_code` | Run J-Star automated code review |
| `/escalate` | Generate escalation report when stuck |
| `/migrate` | Transfer context to a new chat session |

---

## 📋 For Browser-Based AI Users

**Using ChatGPT, Claude.ai, or Gemini in the browser?**  
Use the **`Legacy (Manual Method)/`** folder with copy-paste prompts.

### The Protocol Library

| # | Protocol | Purpose |
|---|---|----------|
| 0 | **Takomi User Manual** | Complete guide to the system |
| 1 | **Project Genesis Protocol** | Start any new project (99% of cases) |
| 2 | **Ultimate Orchestration Prompt** | One-shot prompt for quick scripts |
| 3 | **Design System Genesis Protocol** | Create visual design systems |
| 4 | **GitHub Issue Meta-Prompt** | Structured issue creation |
| 5 | **Escalation & Handoff Protocol** | When AI gets stuck |
| 8 | **Seamless Migration Meta-Prompt** | Transfer context between sessions |
| 9 | **Reverse Genesis Protocol** | Onboard AI to existing codebases |

### How to Use

1. Open the relevant `.md` file from `Legacy (Manual Method)/`
2. Copy the entire prompt
3. Paste it into your AI chat interface
4. Follow the conversation flow

---

## 📚 Deep Source Prompts (For Contributors)

The **`Deep_Source_Prompts/`** folder contains the **reference documentation** and **source materials** used to create the workflows and protocols.

### Contents

- **Coding Guidelines** — React/TypeScript and Next.js App Router standards
- **Vercel AI SDK Docs** — Complete AI SDK reference (building RAG, streaming, tools)
- **Design System Docs** — Google's Material Design 3, mobile-first patterns
- **Agent Prompts** — Raw system prompts for various AI agents
- **OpenRouter Docs** — API reference for multi-model routing

> **Note:** These are raw, unprocessed reference materials. They're useful for understanding *why* the workflows are structured the way they are, or for creating new workflows.

---

## 🎯 The Takomi Philosophy

- **Structured Collaboration**: Clear roles for different AI agents (Genesis, Designer, Builder, Orchestrator, Architect, Coder, Debugger)
- **End-to-End Workflows**: From project genesis to debugging escalations
- **Documentation-Driven**: Every project gets proper docs, issues, and roadmaps
- **Multi-Agent Orchestration**: Coordinate specialized agents for complex projects
- **Scalable**: Works for tiny scripts or enterprise applications

## 🆕 What's New (V3 + Mode Workflows)

### V3 Project Workflows
The V3 workflows introduce verification gates, TypeScript strict mode, and better continuation support:
- `tsc --noEmit` after every file edit
- 1:1 Feature Requirement ↔ Issue correlation
- Templates from `nextjs-standards` skill
- Seamless session continuation with `/vibe-continueBuild`

### Mode Workflows (KiloCode-Inspired)
New specialized mode workflows for targeted tasks:
- `/mode-orchestrator` — Coordinate multi-agent projects with session-based task management
- `/mode-architect` — Plan and design before coding
- `/mode-code` — Focused implementation mode
- `/mode-debug` — Systematic troubleshooting
- `/mode-ask` — Analysis without changes
- `/mode-review` — Quality assessment

### Naming Convention
- **`vibe-*`** workflows = Project lifecycle (genesis, design, build, continue, finalize)
- **`mode-*`** workflows = Specialized agent modes (orchestrator, architect, code, debug, ask, review)
- **Skills** = Reusable capabilities with auto-loading (in `.agent/skills/`)

---

## 👥 Your AI Team

### Project Workflows (Vibe Series)
| Role | Workflow | Responsibility | When to Use |
|------|----------|---------------|-------------|
| **Genesis** | `/vibe-genesis` | Strategic planning, PRD creation, issue generation | Starting new projects |
| **Designer** | `/vibe-design` | Visual design systems, UI mockups | Before implementation |
| **Builder** | `/vibe-build` | Initial code implementation with verification | Building the foundation |
| **Continuer** | `/vibe-continueBuild` | Resume work in new sessions | Continuing after breaks |
| **Finalizer** | `/vibe-finalize` | Verification, handoff reports | Project completion |

### Mode Workflows (Specialized Modes)
| Role | Workflow | Responsibility | When to Use |
|------|----------|---------------|-------------|
| **Orchestrator** | `/mode-orchestrator` | Coordinate multi-agent projects, delegate tasks | Complex projects requiring coordination |
| **Architect** | `/mode-architect` | Technical planning, system design | Before coding complex features |
| **Coder** | `/mode-code` | Write, refactor, implement code | Day-to-day coding tasks |
| **Debugger** | `/mode-debug` | Systematic issue diagnosis | When bugs are hard to find |
| **Analyst** | `/mode-ask` | Explain, analyze, recommend | Understanding code without changes |
| **Reviewer** | `/mode-review` | Code quality assessment | Pre-commit quality gates |

---

## 🚀 Quick Start Guide

### For Agentic IDE Users
```bash
# 1. Copy .agent folder to your project root
cp -r path/to/VibeCode-Protocol-Suite/.agent ./

# 2. Start a new project (V3 Workflow)
# Type: /vibe-genesis

# 3. Generate design system
# Type: /vibe-design

# 4. Build the project
# Type: /vibe-build

# 5. Continue in new sessions
# Type: /vibe-continueBuild

# 6. Finalize and handoff
# Type: /vibe-finalize
```

### For Complex Multi-Agent Projects
See the Takumi orchestration build plan: `docs/takumi_code_v0.001_plan.md`.
```bash
# Use the orchestrator to coordinate multiple specialized agents
# Type: /mode-orchestrator

# The orchestrator will:
# 1. Break down your project into subtasks
# 2. Create task files in docs/tasks/orchestrator-sessions/[ID]/
# 3. Guide you to spawn sub-agents for each task
# 4. Track completion and synthesize results
```

### For Browser AI Users
```bash
# 1. Open: Legacy (Manual Method)/1 Project Genesis Protocol The VibeCode Workflow.md
# 2. Copy the entire content
# 3. Paste into ChatGPT/Claude/Gemini
# 4. Follow the conversation flow
```

---

## 🤝 Contributing

This is a living system. If you discover improvements:

1. Test your changes with real projects
2. Add reference materials to `Deep_Source_Prompts/` if needed
3. Create workflows in `.agent/workflows/` for agentic IDEs
4. Update legacy prompts in `Legacy (Manual Method)/` for browser users
5. Create a GitHub Issue with your proposed changes

---

## 🙏 Acknowledgements

Externally sourced skills and optional Pi packages retain credit to their upstream creators. Takomi-original skills, workflows, and Takomi runtime/orchestration extensions in this repository, including `21st-dev-components`, remain authored and maintained by J StaR Films Studios.

- **Pi Coding Agent**: Built for [Pi](https://github.com/earendil-works/pi) / `@earendil-works/pi-coding-agent` by **Mario Zechner** and Earendil Works — the MIT-licensed coding-agent runtime and extension API that powers the Pi-native Takomi harness.
- **Anthropic Skills**: From [anthropics/skills](https://github.com/anthropics/skills) — a massive collection including **Office Suite** (PDF/DOCX/PPTX/XLSX), **Frontend Design**, **Webapp Testing**, **Algorithmic Art**, **Monorepo Management**, and **Skill Creator**.
- **Inference.sh Skills**: From [inference.sh/skills](https://github.com/inference-sh/skills) — complete media & automation suite including **Marketing Videos**, **Voice Cloning**, **Social Content**, **Twitter Automation**, **Product Photography**, and **Prompt Engineering**.
- **Marketing Skills**: From [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) — the complete marketer's toolkit: **Copywriting**, **Pricing Strategy**, **Social Strategy**, **Programmatic SEO**, and **Marketing Ideas**.
- **Expo Skills**: From [Expo](https://github.com/expo/skills) — **Building Native UI** (React Native/Expo Router) and **Upgrading Expo** guide.
- **Vercel AI SDK**: From [vercel/ai](https://github.com/vercel/ai) — **AI SDK** reference and **Web Design Guidelines**.
- **UI/UX Pro Max**: From [Next Level Builder](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — premium design intelligence.
- **Remotion**: From [Remotion](https://github.com/remotion-dev/skills) — programmatic video creation.
- **Subagent Development**: From [obra/superpowers](https://github.com/obra/superpowers) — advanced implementation planning.
- **Context7**: From [upstash/context7](https://github.com/upstash/context7) — fresh library documentation fetcher.
- **Audit Website**: From [squirrelscan/skills](https://github.com/squirrelscan/skills) — professional website auditor.
- **Convex Skills**: From [waynesutton/convexskills](https://github.com/waynesutton/convexskills) — complete Convex development suite including **Functions**, **Schema Validation**, **Realtime**, **Agents**, **File Storage**, **Migrations**, **HTTP Actions**, **Cron Jobs**, **Component Authoring**, **Best Practices**, **Security Audit**, **Security Check**, **Avoid Feature Creep**, and **Optimize Agent Context**.
- **Anti-Gravity**: Custom skill for running Google's current Anti-Gravity CLI workflow for large-context review and analysis.
- **Google Stitch Skills**: From [google-labs-code/stitch-skills](https://github.com/google-labs-code/stitch-skills) — Design-to-code suite including **design-md**, **enhance-prompt**, **stitch-loop**, **react-components**, and **shadcn-ui**.
- **Jules**: From [sanjay3290/ai-skills](https://github.com/sanjay3290/ai-skills) — delegate coding tasks to Google Jules AI agent.
- **Subagent Execution**: Built on **[`pi-subagents`](https://github.com/nicobailon/pi-subagents)** by **Nico Bailon** — providing the underlying Pi extension for delegated subagent runs (result rendering, live progress, single/parallel/chain execution, session/artifact handling, and related subagent tooling), upon which Takomi adds its own lifecycle orchestration, model-routing policy, and workflow metadata.
- **Takomi Interview / Todo Optional Packs**: Optional setup integrates **[`@juicesharp/rpiv-ask-user-question`](https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-ask-user-question)** and **[`@juicesharp/rpiv-todo`](https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-todo)** by **juicesharp** — MIT-licensed Pi extensions for structured user questions and live todo overlays.
- **Takomi Browser QA Optional Pack**: Optional setup can install **[`pi-chrome`](https://github.com/tianrendong/pi-chrome)** by **tianrendong** — an MIT-licensed Pi extension for explicitly authorized Chrome/browser automation.
- **Takomi Doc Preview Optional Pack**: Optional setup can install **[`pi-markdown-preview`](https://github.com/omaclaren/pi-markdown-preview)** by **omaclaren** — an MIT-licensed Pi extension for terminal/browser/PDF markdown and LaTeX previews.
- **Context Mode Research / Optional Power User Tooling**: **[`context-mode`](https://github.com/mksglu/context-mode)** by **Mert Koseoğlu** is credited as an external context-window and session-continuity project. It is not bundled as a Takomi default; users can install/evaluate it separately under its own license.
- **Git Commit Generation**: From the **[`kilocode`](https://github.com/Kilo-Org/kilocode)** repository by **Kilo-Org** (specifically, [git-commit-generation.md](https://github.com/Kilo-Org/kilocode/blob/main/packages/kilo-docs/pages/code-with-ai/features/git-commit-generation.md)) — enabling automated, high-quality conventional git commit messages based on staged changes.

## 📄 License

This repository contains workflow protocols and prompts. Feel free to use, modify, and share. The goal is to improve AI-human collaboration for everyone.

---

<div align="center">
  <p><strong>Built with ❤️ by artisans who code with the flow</strong></p>
  <p><em>Transform AI from a tool into a true development partner</em></p>
</div>
