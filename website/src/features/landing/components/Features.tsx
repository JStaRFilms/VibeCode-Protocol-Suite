import React from "react";

export default function Features() {
  const features = [
    {
      icon: (
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      title: "Lifecycle Workflows",
      desc: "Genesis, Design, Build, Review, and recovery are treated as distinct operating modes, each with the right documents, gates, and handoff shape.",
    },
    {
      icon: (
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      ),
      title: "Sub-Agent Teams",
      desc: "Specialized agents can take bounded packets of work while the parent coordinator keeps the roadbook, synthesis, and verification coherent.",
    },
    {
      icon: (
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      title: "Progressive Context Loading",
      desc: "Takomi avoids prompt bloat by surfacing light context first, then loading full skills, policies, docs, or feature files only when the task actually needs them.",
    },
    {
      icon: (
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      title: "Instance Management",
      desc: "Runtime checks separate project, user, CLI, and plugin surfaces so multiple agents can reason about the same workspace without trampling the active state.",
    },
    {
      icon: (
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      title: "Strata Routing",
      desc: "Strata-aware agents read `.pi`, policy files, local profiles, and available extensions before deciding whether Codex, PI, Kilo Code, or another surface should act.",
    },
    {
      icon: (
        <svg className="h-5 w-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      ),
      title: "Borrowed Extensions, Unified",
      desc: "Takomi combines its own skills with useful external PI extensions and optional reviewers so users choose capabilities, not a pile of disconnected tools.",
    },
  ];

  return (
    <section id="protocol" className="mx-auto max-w-6xl px-6 py-20 md:py-28 scroll-mt-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div>
          <span className="font-mono text-xs text-accent uppercase tracking-widest">
            WHY TAKOMI EXISTS
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mt-2">
            Coordination before code generation
          </h2>
        </div>
        <p className="max-w-md text-zinc-400 text-sm md:text-base leading-relaxed">
          Takomi is the skill set plus custom PI extensions and selected borrowed
          extensions, organized around routing, context, delegation, and readable
          state.
        </p>
      </div>

      <div className="grid gap-px bg-zinc-900 overflow-hidden rounded border border-zinc-800 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feat, index) => (
          <div
            key={index}
            className="bg-zinc-950 p-8 flex flex-col gap-4 transition-colors hover:bg-zinc-900/40 group cursor-default"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded border border-zinc-800 bg-zinc-900/50 group-hover:border-accent/30 group-hover:bg-accent-muted transition-colors">
                {feat.icon}
              </div>
              <h3 className="font-mono text-base font-bold text-foreground tracking-tight">
                {feat.title}
              </h3>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed mt-2">
              {feat.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
