"use client";

import React, { useState } from "react";

interface Phase {
  id: string;
  name: string;
  command: string;
  objective: string;
  steps: string[];
  output: string;
}

export default function Timeline() {
  const [activeTab, setActiveTab] = useState("genesis");

  const phases: Phase[] = [
    {
      id: "genesis",
      name: "01. Genesis",
      command: "pwsh -File .\\plugins\\takomi-codex\\scripts\\takomi-board.ps1 -Action create",
      objective: "Decompose a vague project prompt into structured blueprints, issues, and templates.",
      steps: [
        "Audit existing project workspace configurations.",
        "Scaffold readable roadbooks under 'docs/tasks/orchestrator-sessions/'.",
        "Construct specific issue registers under 'docs/issues/'.",
      ],
      output: "[✓] Genesis complete: Created docs/features/Auth_System.md and 3 issues.",
    },
    {
      id: "design",
      name: "02. Design",
      command: "use takomi-codex to plan this interface",
      objective: "Map database schemas, establish layout systems, and define component props.",
      steps: [
        "Load relevant skills only when the design task needs them.",
        "Generate page blueprints and implementation constraints.",
        "Verify light/dark mode accessibility contrast.",
      ],
      output: "[✓] Design brief approved. No nested cards rule active.",
    },
    {
      id: "build",
      name: "03. Build",
      command: "npx tsc --noEmit && npm run lint",
      objective: "Write features incrementally, enforcing type-safety constraints continuously.",
      steps: [
        "Import validated parameters and Zod payload schemas.",
        "Run compilation validation: npx tsc --noEmit.",
        "Split growing files when the design or maintenance signal justifies it.",
      ],
      output: "[✓] Build gate passed. Compiled 14 tsx files without errors.",
    },
    {
      id: "review",
      name: "04. Review",
      command: "pwsh -File .\\plugins\\takomi-codex\\scripts\\takomi-doctor.ps1 -Root .",
      objective: "Verify implementation details, run security scans, and clean up code comments.",
      steps: [
        "Initialize J-Star Reviewer NPM code quality checks.",
        "Verify environment variables and RLS database schemas.",
        "Generate final feature handoff documentation.",
      ],
      output: "[✓] Review passed: 0 critical vulnerabilities, 0 lint failures.",
    },
    {
      id: "recovery",
      name: "05. Recovery",
      command: "pwsh -File .\\plugins\\takomi-codex\\scripts\\takomi-policy.ps1 -Root .",
      objective: "Recover from confused routing, stale context, or oversized prompt state.",
      steps: [
        "Execute 'agent_reset.md' mid-session protocols.",
        "Reload only the policies and skills required for the next action.",
        "Load project state snapshots to restore functional baseline.",
      ],
      output: "[✓] Recovery complete. Prompt kernel payload reduced from 1200 to 250 lines.",
    },
  ];

  const currentPhase = phases.find((p) => p.id === activeTab) || phases[0];

  return (
    <section id="workflow" className="mx-auto max-w-6xl px-6 py-20 md:py-28 border-t border-zinc-900 scroll-mt-16">
      <div className="mb-12">
        <span className="font-mono text-xs text-accent uppercase tracking-widest">
          LIFECYCLE TIMELINE
        </span>
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mt-2">
          The Orchestration Pipeline
        </h2>
        <p className="max-w-2xl text-zinc-400 mt-3 text-sm md:text-base">
          From initial blueprint planning to production deployment and emergency context recovery. 
          Each phase is backed by local automation scripts.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Navigation buttons */}
        <div className="flex flex-row lg:flex-col w-full lg:w-64 gap-1.5 overflow-x-auto lg:overflow-x-visible pb-4 lg:pb-0 border-b lg:border-b-0 border-zinc-900">
          {phases.map((phase) => (
            <button
              key={phase.id}
              onClick={() => setActiveTab(phase.id)}
              className={`flex-none lg:w-full text-left font-mono text-xs sm:text-sm px-4 py-3 rounded border transition-all cursor-pointer whitespace-nowrap ${
                activeTab === phase.id
                  ? "border-accent/30 bg-accent-muted text-accent glow-accent"
                  : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/30"
              }`}
            >
              {phase.name}
            </button>
          ))}
        </div>

        {/* Phase details */}
        <div className="flex-1 w-full border border-zinc-800 bg-zinc-950/40 rounded p-6 sm:p-8 font-mono">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-6">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
              ACTIVE PLAYBOOK COMMAND
            </span>
            <span className="text-xs text-zinc-400 select-all bg-zinc-900 px-2 py-0.5 rounded">
              {currentPhase.command}
            </span>
          </div>

          <h3 className="text-lg font-bold text-foreground mb-3 font-sans">
            Objective
          </h3>
          <p className="text-zinc-300 text-sm leading-relaxed mb-6 font-sans">
            {currentPhase.objective}
          </p>

          <h3 className="text-sm font-bold text-zinc-400 mb-3 uppercase tracking-wider">
            Operational Steps
          </h3>
          <ul className="space-y-3.5 mb-8">
            {currentPhase.steps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm text-zinc-300">
                <span className="text-accent mt-1.5 flex-none h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="font-sans">{step}</span>
              </li>
            ))}
          </ul>

          <div className="border-t border-zinc-900 pt-6">
            <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">
              Playbook Result Output
            </div>
            <div className="bg-zinc-950/80 border border-zinc-900 rounded p-3 text-xs sm:text-sm text-emerald-400 select-all">
              {currentPhase.output}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
