const fs = require('fs');
const path = require('path');

const root = path.resolve('.');
const base = path.join(root, 'assets/.agent/skills');
const matt = path.join(root, 'tmp/Matt-skills');
const pstack = path.join(root, 'tmp/p-stack-skills');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function copyDir(src, dest, transformSkillMd) {
  ensureDir(dest);
  const items = fs.readdirSync(src);
  for (const item of items) {
    if (item === 'agents') continue; // skip vendor-specific configs
    const sPath = path.join(src, item);
    const dPath = path.join(dest, item);
    const stat = fs.statSync(sPath);
    if (stat.isDirectory()) {
      copyDir(sPath, dPath, transformSkillMd);
    } else {
      let content = fs.readFileSync(sPath, 'utf8');
      if (item === 'SKILL.md' && transformSkillMd) {
        content = transformSkillMd(content);
      }
      fs.writeFileSync(dPath, content, 'utf8');
    }
  }
}

function buildFrontmatter({ name, description, author, coauthored = 'J StaR Films / Takomi', version = '2.0.0' }) {
  return `---
name: ${name}
description: ${description}
author: ${author}
coauthored: ${coauthored}
version: ${version}
---

`;
}

function stripOldFrontmatter(content) {
  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end !== -1) {
      return content.slice(end + 3).replace(/^\r?\n/, '');
    }
  }
  return content;
}

console.log('=== Starting Unified Skills Migration ===');

// =========================================================================
// 1. CORE ESSENTIALS
// =========================================================================

// 1.1 grill-me (Combines Matt's grilling + P-Stack's interrogate)
console.log('1.1 Installing Core Essential: grill-me...');
ensureDir(path.join(base, 'grill-me'));
const mattGrilling = fs.readFileSync(path.join(matt, 'productivity/grilling/SKILL.md'), 'utf8');
const pInterrogate = fs.readFileSync(path.join(pstack, 'interrogate/SKILL.md'), 'utf8');

const grillMeBody = `# Grill Me

Stress-test a plan, design, or set of requirements through an interactive interview. Combines structured **Question Frontier Trees** with **Adversarial Interrogation**.

## Core Discipline

Interview the user relentlessly until you reach a shared, unambiguous understanding. Map decisions as a **Design Tree**: every decision branches into the secondary decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask *now* without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

### Question Format

\`\`\`markdown
❓ **Q1** - **<Question Title>**: <Question body detailing context and options>

➡️ **Recommended**: <Your recommended answer and rationale>
\`\`\`

---

## The Adversarial Lens (Interrogation Mode)

While working the tree, actively hunt for failure modes and unstated assumptions:

1. **Failure Modes & Degradation**: What happens when the primary network call, cache, or external API fails?
2. **Concurrency & Race Conditions**: What happens when two users or subagents write to this resource simultaneously?
3. **Data Boundary Leaks**: Are types strictly bounded, or is untrusted data passing through without validation?
4. **Load-bearing Assumptions**: What implicit assumptions is this design leaning on? Prove or invalidate them.

---

## When to Stop

Stop when:
1. Every branch of the frontier has been answered or explicitly deferred.
2. All load-bearing dependencies and failure modes are accounted for.
3. The design can be converted directly into a formal spec without further clarifying questions.
`;

fs.writeFileSync(
  path.join(base, 'grill-me/SKILL.md'),
  buildFrontmatter({
    name: 'grill-me',
    description: 'Use when stress-testing a plan, design, or requirements through an interactive interview with question frontiers and adversarial challenges.',
    author: 'Matt Pocock / P-Stack',
    version: '2.0.0'
  }) + grillMeBody,
  'utf8'
);

// 1.2 code-review (Matt's 2-axis Standards vs Spec)
console.log('1.2 Installing Core Essential: code-review...');
ensureDir(path.join(base, 'code-review'));
const codeReviewRaw = fs.readFileSync(path.join(matt, 'engineering/code-review/SKILL.md'), 'utf8');
fs.writeFileSync(
  path.join(base, 'code-review/SKILL.md'),
  buildFrontmatter({
    name: 'code-review',
    description: 'Use when reviewing staged changes, PRs, or branch diffs against repository standards and originating specifications using parallel sub-agents.',
    author: 'Matt Pocock',
    version: '2.0.0'
  }) + stripOldFrontmatter(codeReviewRaw),
  'utf8'
);

// =========================================================================
// 2. STANDALONE TOOLS
// =========================================================================

// 2.1 wait-what
console.log('2.1 Installing Standalone Tool: wait-what...');
ensureDir(path.join(base, 'wait-what'));
const waitWhatRaw = fs.readFileSync(path.join(matt, 'productivity/wait-what/SKILL.md'), 'utf8');
fs.writeFileSync(
  path.join(base, 'wait-what/SKILL.md'),
  buildFrontmatter({
    name: 'wait-what',
    description: 'Use when the user needs an instant comprehension reset to re-pitch the last message in Simplified Technical English using project glossary terms.',
    author: 'Matt Pocock',
    version: '2.0.0'
  }) + stripOldFrontmatter(waitWhatRaw),
  'utf8'
);

// 2.2 bro
console.log('2.2 Installing Standalone Tool: bro...');
ensureDir(path.join(base, 'bro'));
const broRaw = fs.readFileSync(path.join(pstack, 'bro/SKILL.md'), 'utf8');
fs.writeFileSync(
  path.join(base, 'bro/SKILL.md'),
  buildFrontmatter({
    name: 'bro',
    description: 'Use when the user requests ultra-concise, zero-fluff developer communication for rapid pair-programming.',
    author: 'P-Stack',
    version: '2.0.0'
  }) + stripOldFrontmatter(broRaw),
  'utf8'
);

// 2.3 poteto-mode
console.log('2.3 Installing Standalone Tool: poteto-mode...');
ensureDir(path.join(base, 'poteto-mode'));
const potetoRaw = fs.readFileSync(path.join(pstack, 'poteto-mode/SKILL.md'), 'utf8');
fs.writeFileSync(
  path.join(base, 'poteto-mode/SKILL.md'),
  buildFrontmatter({
    name: 'poteto-mode',
    description: 'Use when operating on strict token budgets or lightweight models requiring ultra-compact execution and minimal output.',
    author: 'P-Stack',
    version: '2.0.0'
  }) + stripOldFrontmatter(potetoRaw),
  'utf8'
);

// =========================================================================
// 3. NEW UMBRELLA SUITE: code-intelligence
// =========================================================================
console.log('3. Installing Umbrella Suite: code-intelligence...');
const codeIntelDir = path.join(base, 'code-intelligence');
ensureDir(codeIntelDir);

// 3.1 Router SKILL.md
const codeIntelRouter = buildFrontmatter({
  name: 'code-intelligence',
  description: "Use when understanding code, asking 'why' (decision archaeology/git history), 'how' (runtime execution trace), calculating 'blast-radius' before refactoring, debugging with 'diagnosing-bugs', explaining systems with 'teach', or logging runs with 'show-me-your-work'.",
  author: 'P-Stack / Matt Pocock',
  version: '2.0.0'
}) + `# Code Intelligence Suite

A consolidated suite for deep codebase comprehension, decision archaeology, impact analysis, and runtime diagnostics.

## Sub-Skills & Capabilities

Read the relevant sub-skill file via \`view_file\` on demand:

| Sub-Skill | Trigger Keywords | Path |
|---|---|---|
| **\`why\`** | Decision archaeology, design rationale, why code exists | [\`why/SKILL.md\`](why/SKILL.md) |
| **\`how\`** | Runtime execution trace, data flow, component ownership | [\`how/SKILL.md\`](how/SKILL.md) |
| **\`blast-radius\`** | Dependency graph impact, ripple effects before refactoring | [\`blast-radius/SKILL.md\`](blast-radius/SKILL.md) |
| **\`diagnosing-bugs\`** | Symptom capture, repro scripts, root-cause isolation | [\`diagnosing-bugs/SKILL.md\`](diagnosing-bugs/SKILL.md) |
| **\`teach\`** | Plain-language system walkthroughs & persistent learning workspaces | [\`teach/SKILL.md\`](teach/SKILL.md) |
| **\`show-me-your-work\`** | TSV decision log for multi-step or unattended runs | [\`show-me-your-work/SKILL.md\`](show-me-your-work/SKILL.md) |

---

## Operating Protocol

1. When asked **why** something was built a certain way, consult [\`why/SKILL.md\`](why/SKILL.md) to inspect git history, commit messages, PRs, and ADRs before answering.
2. Before making wide refactors, invoke [\`blast-radius/SKILL.md\`](blast-radius/SKILL.md) to trace downstream dependants.
3. When tracking down elusive bugs, follow [\`diagnosing-bugs/SKILL.md\`](diagnosing-bugs/SKILL.md) to build an isolated reproduction script before editing application code.
`;
fs.writeFileSync(path.join(codeIntelDir, 'SKILL.md'), codeIntelRouter, 'utf8');

// Copy code-intelligence sub-skills
copyDir(path.join(pstack, 'why'), path.join(codeIntelDir, 'why'));
copyDir(path.join(pstack, 'how'), path.join(codeIntelDir, 'how'));
copyDir(path.join(pstack, 'blast-radius'), path.join(codeIntelDir, 'blast-radius'));
copyDir(path.join(matt, 'engineering/diagnosing-bugs'), path.join(codeIntelDir, 'diagnosing-bugs'));
copyDir(path.join(pstack, 'show-me-your-work'), path.join(codeIntelDir, 'show-me-your-work'));

// Teach sub-skill (combining P-Stack plain walkthrough + Matt workspace formats)
copyDir(path.join(matt, 'productivity/teach'), path.join(codeIntelDir, 'teach'), (content) => {
  return buildFrontmatter({
    name: 'teach',
    description: 'Use when explaining complex codebase concepts plainly without jargon, or managing a persistent learning workspace with MISSION.md.',
    author: 'Matt Pocock / P-Stack',
    version: '2.0.0'
  }) + stripOldFrontmatter(content);
});

// =========================================================================
// 4. NEW UMBRELLA SUITE: engineering-principles
// =========================================================================
console.log('4. Installing Umbrella Suite: engineering-principles (21 principles)...');
const principlesDir = path.join(base, 'engineering-principles');
ensureDir(principlesDir);

// Copy all 21 principle directories from p-stack
const pItems = fs.readdirSync(pstack).filter(f => f.startsWith('principle-'));
const principleIndexRows = [];

for (const pName of pItems) {
  const shortName = pName.replace(/^principle-/, '');
  const targetDir = path.join(principlesDir, shortName);
  copyDir(path.join(pstack, pName), targetDir);

  // Read description
  const skillFile = path.join(pstack, pName, 'SKILL.md');
  const skillContent = fs.readFileSync(skillFile, 'utf8');
  const matchDesc = skillContent.match(/^description:\s*([^\n]+(?:\n\s+[^\n]+)*)/m);
  const desc = matchDesc ? matchDesc[1].replace(/\n\s+/g, ' ').replace(/^["']|["']$/g, '').trim() : shortName;

  principleIndexRows.push(`| **\`${shortName}\`** | ${desc} | [\`${shortName}/SKILL.md\`](./${shortName}/SKILL.md) |`);
}

const principlesRouter = buildFrontmatter({
  name: 'engineering-principles',
  description: 'Use when designing systems, structuring code, reviewing diffs, handling state, or adhering to core software engineering discipline principles.',
  author: 'P-Stack',
  version: '2.0.0'
}) + `# Engineering Principles Suite

A catalogue of 21 foundational principles for software architecture, code quality, state management, and agentic workflows.

## Principles Catalog

Read the specific principle file via \`view_file\` on demand when applying its rule:

| Principle | When to Apply | File Path |
|---|---|---|
${principleIndexRows.join('\n')}
`;

fs.writeFileSync(path.join(principlesDir, 'SKILL.md'), principlesRouter, 'utf8');

// =========================================================================
// 5. ENHANCING EXISTING SUITES
// =========================================================================

// 5.1 agent-engineering
console.log('5.1 Enhancing agent-engineering suite...');
const agentEngDir = path.join(base, 'agent-engineering');
ensureDir(agentEngDir);

copyDir(path.join(matt, 'productivity/writing-for-agents'), path.join(agentEngDir, 'writing-for-agents'));
copyDir(path.join(matt, 'engineering/domain-modeling'), path.join(agentEngDir, 'domain-modeling'));
copyDir(path.join(matt, 'engineering/to-spec'), path.join(agentEngDir, 'conversation-to-spec'));
copyDir(path.join(matt, 'productivity/to-questionnaire'), path.join(agentEngDir, 'to-questionnaire'));
copyDir(path.join(pstack, 'arena'), path.join(agentEngDir, 'arena'));
copyDir(path.join(pstack, 'automate-me'), path.join(agentEngDir, 'automate-me'));
copyDir(path.join(pstack, 'reflect'), path.join(agentEngDir, 'reflect'));
copyDir(path.join(pstack, 'create-verification-skill'), path.join(agentEngDir, 'create-verification-skill'));
copyDir(path.join(pstack, 'maintain-verification-skill'), path.join(agentEngDir, 'maintain-verification-skill'));

// Update agent-engineering router
const agentEngRouter = buildFrontmatter({
  name: 'agent-engineering',
  description: "Use when engineering LLM prompts, writing agent docs ('writing-for-agents'), modeling domain vocabulary ('domain-modeling' CONTEXT.md/ADRs), creating specs ('conversation-to-spec'), spawning task DAGs ('spawn-task'), running code tournaments ('arena'), or managing subagents.",
  author: 'J StaR Films / Matt Pocock / P-Stack',
  version: '2.0.0'
}) + `# Agent Engineering Suite

Comprehensive suite for prompt engineering, agent steering rules, domain dictionaries (\`CONTEXT.md\`), task decomposition DAGs, and subagent orchestration.

> [!IMPORTANT]
> **Foundational Guide:** When authoring or editing any skill, \`AGENTS.md\`, or subagent prompt, read [\`writing-for-agents/SKILL.md\`](writing-for-agents/SKILL.md) and [\`writing-for-agents/SKILL-MECHANICS.md\`](writing-for-agents/SKILL-MECHANICS.md) first to ensure tight context pointers and zero token waste.

## Sub-Skills

| Sub-Skill | Purpose | Path |
|---|---|---|
| **\`writing-for-agents\`** | Core rules for writing skills, AGENTS.md, context pointers, and router mechanics | [\`writing-for-agents/SKILL.md\`](writing-for-agents/SKILL.md) |
| **\`domain-modeling\`** | Generates \`CONTEXT.md\` ubiquitous language glossary with \`_Avoid_\` anti-synonyms and ADRs | [\`domain-modeling/SKILL.md\`](domain-modeling/SKILL.md) |
| **\`conversation-to-spec\`** | Synthesizes chat discussions into formal technical specifications | [\`conversation-to-spec/SKILL.md\`](conversation-to-spec/SKILL.md) |
| **\`spawn-task\`** | Decomposes specs into tracer-bullet vertical slice task packets with blocking DAGs | [\`spawn-task/SKILL.md\`](spawn-task/SKILL.md) |
| **\`to-questionnaire\`** | Generates async questionnaires for domain experts and external stakeholders | [\`to-questionnaire/SKILL.md\`](to-questionnaire/SKILL.md) |
| **\`arena\`** | Spawns parallel candidate implementations and blind-judges the strongest solution | [\`arena/SKILL.md\`](arena/SKILL.md) |
| **\`automate-me\`** | Scans terminal history and repeated workflows to produce new agent skills and scripts | [\`automate-me/SKILL.md\`](automate-me/SKILL.md) |
| **\`reflect\`** | Spawns 3 review subagents over transcripts to extract learnings and patch skills | [\`reflect/SKILL.md\`](reflect/SKILL.md) |
| **\`create-verification-skill\`** | Generates project-local verification harnesses driving apps end-to-end | [\`create-verification-skill/SKILL.md\`](create-verification-skill/SKILL.md) |
| **\`maintain-verification-skill\`** | Audits and updates project verification harnesses as code evolves | [\`maintain-verification-skill/SKILL.md\`](maintain-verification-skill/SKILL.md) |
| **\`subagent-driven-development\`** | Parallel subagent orchestration and implementation task loops | [\`subagent-driven-development/SKILL.md\`](subagent-driven-development/SKILL.md) |
| **\`prompt-engineering\`** | Advanced prompting patterns, meta-prompts, and eval harnesses | [\`prompt-engineering/SKILL.md\`](prompt-engineering/SKILL.md) |
| **\`skill-creator\`** | Scaffolding new agent skills following repository conventions | [\`skill-creator/SKILL.md\`](skill-creator/SKILL.md) |
| **\`optimize-agent-context\`** | Optimizing context windows and rule files | [\`optimize-agent-context/SKILL.md\`](optimize-agent-context/SKILL.md) |
| **\`crafting-effective-readmes\`** | Writing structured repository documentation | [\`crafting-effective-readmes/SKILL.md\`](crafting-effective-readmes/SKILL.md) |
`;
fs.writeFileSync(path.join(agentEngDir, 'SKILL.md'), agentEngRouter, 'utf8');

// 5.2 web-dev-standards
console.log('5.2 Enhancing web-dev-standards suite...');
const webDevDir = path.join(base, 'web-dev-standards');
ensureDir(webDevDir);

copyDir(path.join(matt, 'engineering/codebase-design'), path.join(webDevDir, 'codebase-design'));
copyDir(path.join(matt, 'engineering/tdd'), path.join(webDevDir, 'test-driven-development'));
copyDir(path.join(matt, 'engineering/wizard'), path.join(webDevDir, 'interactive-wizard'));
copyDir(path.join(pstack, 'typescript-best-practices'), path.join(webDevDir, 'typescript-standards'));

const webDevRouter = buildFrontmatter({
  name: 'web-dev-standards',
  description: "Use when designing software architectures ('codebase-design' Deep Modules/Design-It-Twice), writing tests ('test-driven-development' mock boundaries), creating setup scripts ('interactive-wizard'), TypeScript standards, Next.js, Expo, or Monorepos.",
  author: 'J StaR Films / Matt Pocock / P-Stack',
  version: '2.0.0'
}) + `# Web Development Standards Suite

Architectural doctrines, testing boundaries, language standards, and framework guidelines.

## Sub-Skills

| Sub-Skill | Purpose | Path |
|---|---|---|
| **\`codebase-design\`** | Ousterhout's Deep Modules, \`DESIGN-IT-TWICE.md\` (3 parallel interface drafts), and seam placement | [\`codebase-design/SKILL.md\`](codebase-design/SKILL.md) |
| **\`test-driven-development\`** | TDD red-green-refactor with strict mock boundaries (mock only external I/O) and observable behavior tests | [\`test-driven-development/SKILL.md\`](test-driven-development/SKILL.md) |
| **\`interactive-wizard\`** | Generates delightful, progress-tracked Bash wizards (\`template.sh\`) for human-only setup steps and secrets | [\`interactive-wizard/SKILL.md\`](interactive-wizard/SKILL.md) |
| **\`typescript-standards\`** | TypeScript best practices: discriminated unions, branded types, and boundary validation | [\`typescript-standards/SKILL.md\`](typescript-standards/SKILL.md) |
| **\`nextjs-standards\`** | Next.js App Router patterns, Server Components, server actions, and caching | [\`nextjs-standards/SKILL.md\`](nextjs-standards/SKILL.md) |
| **\`upgrading-expo\`** | Expo SDK upgrades and React Native configuration | [\`upgrading-expo/SKILL.md\`](upgrading-expo/SKILL.md) |
| **\`monorepo-management\`** | Turborepo and pnpm workspace dependency and boundary management | [\`monorepo-management/SKILL.md\`](monorepo-management/SKILL.md) |
| **\`shared-resend-portfolio\`** | Shared transactional email integration with Resend | [\`shared-resend-portfolio/SKILL.md\`](shared-resend-portfolio/SKILL.md) |
`;
fs.writeFileSync(path.join(webDevDir, 'SKILL.md'), webDevRouter, 'utf8');

// 5.3 git-github-tools
console.log('5.3 Enhancing git-github-tools suite...');
const gitToolsDir = path.join(base, 'git-github-tools');
ensureDir(gitToolsDir);

copyDir(path.join(matt, 'engineering/resolving-merge-conflicts'), path.join(gitToolsDir, 'resolving-merge-conflicts'));
copyDir(path.join(matt, 'engineering/triage'), path.join(gitToolsDir, 'issue-pr-triage'));

const gitToolsRouter = buildFrontmatter({
  name: 'git-github-tools',
  description: "Use when resolving merge conflicts ('resolving-merge-conflicts'), triaging issues/PRs ('issue-pr-triage' AGENT-BRIEF.md), managing worktrees, GitHub ops, or fixing PR comments.",
  author: 'J StaR Films / Matt Pocock',
  version: '2.0.0'
}) + `# Git & GitHub Tools Suite

Operations for git workflow management, merge conflict reconciliation, issue/PR triage state machines, and isolated worktrees.

## Sub-Skills

| Sub-Skill | Purpose | Path |
|---|---|---|
| **\`resolving-merge-conflicts\`** | 3-step intent reconciliation for in-progress git merge/rebase conflicts | [\`resolving-merge-conflicts/SKILL.md\`](resolving-merge-conflicts/SKILL.md) |
| **\`issue-pr-triage\`** | State machine for issues and external PRs; writes durable \`AGENT-BRIEF.md\` contracts | [\`issue-pr-triage/SKILL.md\`](issue-pr-triage/SKILL.md) |
| **\`git-worktree\`** | Creating and managing isolated git worktrees for parallel agent development | [\`git-worktree/SKILL.md\`](git-worktree/SKILL.md) |
| **\`github-ops\`** | Managing GitHub issues, PRs, milestones, and labels | [\`github-ops/SKILL.md\`](github-ops/SKILL.md) |
| **\`pr-comment-fix\`** | Automated resolution of PR review feedback and comments | [\`pr-comment-fix/SKILL.md\`](pr-comment-fix/SKILL.md) |
`;
fs.writeFileSync(path.join(gitToolsDir, 'SKILL.md'), gitToolsRouter, 'utf8');

// 5.4 frontend-ui
console.log('5.4 Enhancing frontend-ui suite...');
const frontendDir = path.join(base, 'frontend-ui');
ensureDir(frontendDir);

copyDir(path.join(matt, 'engineering/prototype'), path.join(frontendDir, 'prototyping-variants'));

const frontendRouter = buildFrontmatter({
  name: 'frontend-ui',
  description: "Use when designing web/mobile UI, creating prototypes ('prototyping-variants' Logic demo/UI switch bar), applying UI/UX Pro Max, 21st.dev components, Stitch, or Figma.",
  author: 'J StaR Films / Matt Pocock',
  version: '2.0.0'
}) + `# Frontend UI Suite

Design systems, interactive component libraries, throwaway prototyping patterns, and responsive UI guidelines.

## Sub-Skills

| Sub-Skill | Purpose | Path |
|---|---|---|
| **\`prototyping-variants\`** | Two-branch throwaway prototyping: Logic Simulator HTML demo & in-app UI variant switch bar | [\`prototyping-variants/SKILL.md\`](prototyping-variants/SKILL.md) |
| **\`frontend-design\`** | Foundational frontend design principles and typography | [\`frontend-design/SKILL.md\`](frontend-design/SKILL.md) |
| **\`ui-ux-pro-max\`** | High-end visual styling, animations, and micro-interactions | [\`ui-ux-pro-max/SKILL.md\`](ui-ux-pro-max/SKILL.md) |
| **\`21st-dev-components\`** | Modern UI component patterns from 21st.dev | [\`21st-dev-components/SKILL.md\`](21st-dev-components/SKILL.md) |
| **\`web-design-guidelines\`** | Usability, UX consistency, and accessibility standards | [\`web-design-guidelines/SKILL.md\`](web-design-guidelines/SKILL.md) |
| **\`building-native-ui\`** | React Native and Expo mobile UI development | [\`building-native-ui/SKILL.md\`](building-native-ui/SKILL.md) |
| **\`figma\`** | Figma asset inspection and translation to code | [\`figma/SKILL.md\`](figma/SKILL.md) |
| **\`stitch\`** | Component stitching and layout orchestration | [\`stitch/SKILL.md\`](stitch/SKILL.md) |
| **\`component-analysis\`** | Auditing component composition and hierarchy | [\`component-analysis/SKILL.md\`](component-analysis/SKILL.md) |
| **\`webapp-testing\`** | Playwright web application integration testing | [\`webapp-testing/SKILL.md\`](webapp-testing/SKILL.md) |
`;
fs.writeFileSync(path.join(frontendDir, 'SKILL.md'), frontendRouter, 'utf8');

// 5.5 office-docs
console.log('5.5 Enhancing office-docs suite...');
const officeDocsDir = path.join(base, 'office-docs');
ensureDir(officeDocsDir);

copyDir(path.join(pstack, 'technical-writing'), path.join(officeDocsDir, 'technical-writing'));

const officeDocsRouter = buildFrontmatter({
  name: 'office-docs',
  description: "Use when creating or editing office documents (PDF, Word DOCX, PowerPoint PPTX, Excel XLSX), or applying Diátaxis/STE technical writing standards ('technical-writing').",
  author: 'J StaR Films / P-Stack',
  version: '2.0.0'
}) + `# Office Documents & Technical Writing Suite

Document processing, file generation (PDF, DOCX, PPTX, XLSX), and formal technical writing standards.

## Sub-Skills

| Sub-Skill | Purpose | Path |
|---|---|---|
| **\`technical-writing\`** | Diátaxis framework, Google Developer Style, and Simplified Technical English | [\`technical-writing/SKILL.md\`](technical-writing/SKILL.md) |
| **\`pdf\`** | Reading, extracting, and creating PDF documents | [\`pdf/SKILL.md\`](pdf/SKILL.md) |
| **\`docx\`** | Creating, formatting, and modifying Word documents | [\`docx/SKILL.md\`](docx/SKILL.md) |
| **\`pptx\`** | Generating and editing PowerPoint presentations | [\`pptx/SKILL.md\`](pptx/SKILL.md) |
| **\`xlsx\`** | Spreadsheets, formulas, data extraction, and styling | [\`xlsx/SKILL.md\`](xlsx/SKILL.md) |
| **\`exam-creator-skill\`** | School and exam paper layout formatting | [\`exam-creator-skill/SKILL.md\`](exam-creator-skill/SKILL.md) |
`;
fs.writeFileSync(path.join(officeDocsDir, 'SKILL.md'), officeDocsRouter, 'utf8');

console.log('=== Unified Skills Migration Complete ===');
