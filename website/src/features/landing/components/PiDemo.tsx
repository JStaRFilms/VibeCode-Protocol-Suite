"use client";

import React, { useEffect, useState } from "react";

const terminalScenes = [
  {
    title: "TAKOMI - BUILD A CUSTOM WORKFLOW EXTENSION",
    prompt: "Build a Takomi workflow extension that opens a full-screen TUI roadbook panel.",
    cwd: "~/Development/takomi",
    mode: "genesis",
    model: "codex",
    status: "thinking",
  },
  {
    title: "TAKOMI - ROUTE THROUGH .PI POLICY",
    prompt: "Read .pi, load model routing, then decide whether this is Genesis or Design.",
    cwd: "~/Development/takomi/.pi",
    mode: "routing",
    model: "takomi_subagent",
    status: "policy loaded",
  },
  {
    title: "TAKOMI - SPAWN DESIGN PACKET",
    prompt: "Send the UI behavior to a designer sub-agent, keep parent synthesis in this thread.",
    cwd: "~/Development/takomi/docs/tasks",
    mode: "design",
    model: "takomi_subagent",
    status: "delegating",
  },
  {
    title: "TAKOMI - WRITE, VERIFY, HANDOFF",
    prompt: "Implement the approved slice, run lint and types, then update the roadbook.",
    cwd: "~/Development/takomi/website",
    mode: "build",
    model: "gpt-5.3-codex",
    status: "verifying",
  },
] as const;

export default function PiDemo() {
  const [active, setActive] = useState(0);
  const scene = terminalScenes[active];

  useEffect(() => {
    const timer = setInterval(() => {
      setActive((value) => (value + 1) % terminalScenes.length);
    }, 3200);

    return () => clearInterval(timer);
  }, []);

  return (
    <section
      id="demo"
      className="pi-grid border-t border-zinc-900 py-20 md:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-8 flex items-center justify-between border border-zinc-800 bg-zinc-950/60 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          <span>Takomi demo surface</span>
          <span className="hidden text-accent sm:inline">
            npm install -g takomi && takomi setup pi
          </span>
          <span>[ copy ]</span>
        </div>

        <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="overflow-hidden border border-zinc-800 bg-[#102333]/90 shadow-2xl shadow-black/40">
            <div className="border-b border-zinc-800 bg-[#253344] px-4 py-2 font-mono text-xs uppercase tracking-[0.22em] text-zinc-300">
              {scene.title} <span className="text-accent">•</span>
            </div>
            <div className="min-h-[500px] p-5 font-mono text-sm text-[#7fa6c8]">
              <p>
                <span className="text-signal">takomi</span>{" "}
                <span className="text-zinc-500">v2.1.38</span>
              </p>
              <p>escape interrupt • ctrl+c/ctrl+d clear/exit • / commands</p>
              <p className="mt-1">Press ctrl+o to show loaded resources.</p>

              <p className="mt-8 max-w-xl">
                Takomi can explain its own workflows and look up its docs. Ask it
                how to use Genesis, Design, Build, Review, or sub-agents.
              </p>

              <div className="mt-10">
                <p className="text-signal">[Context]</p>
                <p className="pl-4">.pi/takomi/model-routing.md</p>
                <p className="pl-4">docs/features/Takomi_Website.md</p>
                <p className="pl-4">takomi-codex/SKILL.md</p>
              </div>

              <div className="mt-10 border-y border-[#254158] bg-black/35 p-4 text-zinc-100">
                <p>
                  <span className="text-signal">-</span> {scene.prompt}
                </p>
                <p className="mt-3 text-[#d8d8d8]">
                  <span className="text-signal">-</span> Route through {scene.mode},
                  write the roadbook, then return a build-ready packet.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap justify-between gap-3 border-t border-[#254158] pt-4 text-[#7fa6c8]">
                <span>{scene.cwd} (main)</span>
                <span>$0.000 (sub) 0.0%/128k</span>
                <span>({scene.model}) {scene.status}</span>
              </div>
            </div>
            <div className="border-t border-zinc-800 bg-zinc-900/80 px-4 py-3 font-mono text-xs text-zinc-300">
              Here we ask Takomi to build a custom workflow extension, but the
              harness decides the sequence before any file changes.
            </div>
          </div>

          <div className="space-y-28 py-4">
            <article>
              <h2 className="font-serif text-4xl italic leading-tight text-zinc-100 md:text-5xl">
                Change the harness, not your workflow
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-zinc-300">
                Takomi should feel like Pi: an agent harness you can bend to your
                process. If you need a workflow, provider, prompt pack, or UI
                surface, ask the harness to route and build it.
              </p>
              <p className="mt-5 text-lg leading-relaxed text-zinc-300">
                The demo is not random tool noise. It shows a controlled flow:
                detect runtime, read policy, create a roadbook, delegate a packet,
                then build.
              </p>
            </article>

            <article>
              <h2 className="font-serif text-4xl italic leading-tight text-zinc-100 md:text-5xl">
                Steer or follow up
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-zinc-300">
                Submit messages while the agent works. Use Codex plugin mode for
                thread delegation, or PI through CLI when you want the full context
                manager and extension stack.
              </p>
            </article>

            <article>
              <h2 className="font-serif text-4xl italic leading-tight text-zinc-100 md:text-5xl">
                Three ways to run
              </h2>
              <p className="mt-6 text-lg leading-relaxed text-zinc-300">
                PI through CLI for the complete harness. Codex plugin for a PI-free
                orchestration surface. Raw skills for Anti-Gravity, Kilo Code, and
                other skill-aware coding agents.
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
