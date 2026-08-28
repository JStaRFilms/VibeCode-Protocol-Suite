---
name: youtube-pipeline
description: Complete YouTube video production pipeline from ideation to distribution. Covers Strategy (Phase 1), Packaging (Phase 2), Scripting (Phase 3), Shorts (Phase 3.5), Production (Phase 4), and Repurposing (Phase 5).
---

# YouTube Pipeline Skill

This skill provides access to a complete YouTube video production pipeline. It is self-contained: when activated, resolve the folder containing this `SKILL.md` as `<skill-root>` and read the bundled workflow, knowledge, prompt, and script files from there.

## Quick Reference

| Phase | Workflow | Purpose |
|-------|----------|---------|
| 1 | `/youtube-phase1-strategy` | Find proven topic via 3-source validation (YT Studio + VidIQ + Google Trends) |
| 2 | `/youtube-phase2-packaging` | Engineer title & thumbnail |
| 3 | `/youtube-phase3-scripting` | Write retention-optimized script |
| 3.5 | `/youtube-phase3.5-shorts` | Create 6 Shorts (3 Topic + 3 Extract) |
| 4 | `/youtube-phase4-production` | Film, edit, polish |
| 5 | `/youtube-phase5-repurposing` | Distribute to all platforms (YT, TikTok, IG, LinkedIn) |
| Master | `/youtube-pipeline` | Orchestrate all 6 phases |

---

## Bundled Files (Always Read These First)

All runtime instructions are bundled in this skill. Do not require the user's vault, a global config folder, or a specific agent harness for normal use.

**Workflow Files:**
```
<skill-root>/resources/youtube-pipeline.md
<skill-root>/resources/youtube-phase1-strategy.md
<skill-root>/resources/youtube-phase2-packaging.md
<skill-root>/resources/youtube-phase3-scripting.md
<skill-root>/resources/youtube-phase3.5-shorts.md
<skill-root>/resources/youtube-phase4-production.md
<skill-root>/resources/youtube-phase5-repurposing.md
```

**Knowledge And Prompts:**
```
<skill-root>/resources/knowledge/
<skill-root>/resources/prompts/
```

**Automation Scripts (Phase 1):**
```
<skill-root>/scripts/parse_yt_studio.ps1
<skill-root>/scripts/google-trends/search.js
```

---

## Phase 1 Automation Tools

### YouTube Studio HTML Parser
Extracts topics and volume indicators from YouTube Studio's Inspiration tab.

**User Workflow:**
1. Go to YouTube Studio → Inspiration → Search topic
2. Right-click results → Inspect → Find `<yta-section id="top-section">`
3. Right-click → Copy → Copy outerHTML
4. Paste into `.html` file

**Agent Command:**
```powershell
$SkillRoot = "<path-to-installed-youtube-pipeline-skill>"
powershell -ExecutionPolicy Bypass -File (Join-Path $SkillRoot "scripts/parse_yt_studio.ps1") -InputFile "topic.html" -OutputFile "parsed.md"
```

### Google Trends Research
Google Trends validation is required. This skill bundles the local `google-trends` Node CLI so agents can run trends checks without relying on a separate global skill install.

**First-Time Setup:**
```powershell
$SkillRoot = "<path-to-installed-youtube-pipeline-skill>"
$TrendRoot = Join-Path $SkillRoot "scripts/google-trends"
Push-Location $TrendRoot
pnpm install
Pop-Location
```

**Agent Command:**
```powershell
$SkillRoot = "<path-to-installed-youtube-pipeline-skill>"
node (Join-Path $SkillRoot "scripts/google-trends/search.js") -k "Claude Cowork" -p youtube -t "now 7-d"
```

If Node dependencies are unavailable, use the manual Google Trends workflow in `resources/youtube-phase1-strategy.md`. Do not assume a Gemini, Codex, Pi, or other harness-specific path.

## How to Use This Skill

### Option 1: Full Pipeline
Invoke `/youtube-pipeline` and follow the prompts. The orchestrator will:
1. Ask where you're starting
2. Chain through all 6 phases
3. Track state across phases

### Option 2: Single Phase
Jump directly to any phase:
- `/youtube-phase1-strategy` — Just need a topic (uses 3-source validation)
- `/youtube-phase2-packaging` — Just need title/thumbnail
- `/youtube-phase3-scripting` — Just need a script
- `/youtube-phase3.5-shorts` — Create 6 Shorts from a video
- `/youtube-phase4-production` — Just need production guidance
- `/youtube-phase5-repurposing` — Distribute to all platforms

---

## AI Persona: The Brutal Expert

When running this pipeline, the AI operates as:

- **Never yes-mans.** Weak ideas get called out.
- **Demands proof.** "This video is viral" → "Show me the view:sub ratio."
- **Generates outputs.** AI generates titles, hooks, thumbnail concepts for user to pick from.
- **Teaches the why.** Every step includes the reasoning behind it.
- **Challenges weak work.** "That hook is mid. Try this instead..."

---

## Phase 1: 3-Source Research Validation

Find proven topics using three data sources:

| Source | What to Check | Signal |
|--------|---------------|--------|
| **YouTube Studio Trends** | Inspiration tab → "What people are looking for" | High/Medium volume |
| **Competitor VidIQ** | Videos 4+ weeks old still getting views/hr | Evergreen topic |
| **Google Trends** | Explore → YouTube Search → Rising queries | Breakout (5000%+) |

**Perfect Storm:** When all 3 sources point to the same topic = proven opportunity.

---

## Phase 3.5: 6 Shorts System (Topic + Extract)

⚠️ **Retention Protection:** Extract shorts hurt main video retention (viewers skip sections they've seen). Post extract shorts LAST.

| Category | Count | What It Is | When to Post |
|----------|-------|------------|--------------|
| **Topic Shorts** | 3 | NEW recordings on the topic | Week 1: Mon/Wed/Fri |
| **Extract Shorts** | 3 | Sandwich Method clips from main | Week 2: Mon/Wed/Fri |

**Topic Short Types:**
1. **Hot Take** — Spicy opinion on the topic
2. **Quick Win** — One actionable tip
3. **Story Hook** — Personal story as teaser

**Sandwich Method (Extract Shorts):**
| Layer | Time | What It Is |
|-------|------|------------|
| **Top Bun** | 0:00-0:05 | Fresh hook (user records new VO) |
| **Meat** | 0:05-0:50 | Clip from main video |
| **Bottom Bun** | 0:50-1:00 | Fresh CTA (user records new VO) |

---

## Phase 5: Repurposing & Distribution

| Platform | Content | Extra Work |
|----------|---------|------------|
| **YouTube** | Main + 6 Shorts | None |
| **TikTok** | Same 6 Shorts | None (repost) |
| **Instagram** | Same 6 Shorts (Reels) | None (repost) |
| **LinkedIn** | 6 Shorts + 3 Text Posts + Stories | Text posts need drafting |

**Result:** 1 filming session = 7 pieces of content = 2 weeks of distribution across all platforms.

---

## Key Frameworks (Phase 3 Scripting)

These are embedded in the Phase 3 workflow but summarized here for reference:

| Framework | What It Does |
|-----------|--------------|
| **Ego Trap Hook** | "You think [X] is helping you, but it's actually why you're failing" |
| **Cost of Inaction** | "If you ignore this, you'll keep [Pain] while others [Gain]" |
| **DISC Layering** | Hit all personality types: D=Results, I=Story, S=Steps, C=Data |
| **30-Second Snap** | Reset attention every 30 seconds with visual/energy change |
| **Loop Architecture** | Open Loop → Content → Payoff → Bridge to next loop |

---

## Updating This Skill

The files in `resources/` are the packaged source used at runtime. If you refresh them from another workspace, copy into this skill folder and keep all references relative to `<skill-root>`.

**To Sync (PowerShell):**
```powershell
$SkillRoot = "<path-to-installed-youtube-pipeline-skill>"
$ExternalWorkflowDir = "<path-to-external-workflow-source>"
$ExternalKnowledgeDir = "<path-to-external-knowledge-source>"
$ExternalPromptDir = "<path-to-external-prompt-source>"

Copy-Item -Path (Join-Path $ExternalWorkflowDir "youtube-*.md") -Destination (Join-Path $SkillRoot "resources") -Force
Copy-Item -Path (Join-Path $ExternalKnowledgeDir "*.md") -Destination (Join-Path $SkillRoot "resources/knowledge") -Force
Copy-Item -Path (Join-Path $ExternalPromptDir "*.md") -Destination (Join-Path $SkillRoot "resources/prompts") -Force
```

**When to Sync:**
- After updating any external workflow, processed note, or prompt source.
- To add new phases, add the workflow to `resources/`, add supporting knowledge/prompts if needed, and update this `SKILL.md` quick reference.
- If the Google Trends CLI changes, refresh `scripts/google-trends/search.js`, `package.json`, and `pnpm-lock.yaml` together.
- After syncing, run a reference check for absolute local paths and harness-specific install paths.
