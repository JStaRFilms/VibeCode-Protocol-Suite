import PageFrame from "@/features/site/components/PageFrame";

export default function CodingPage() {
  const phases = [
    {
      phase: "Genesis",
      purpose: "Turn an idea into requirements, constraints, and a first roadbook.",
      output: "docs/features/*.md, issue-style tasks, acceptance criteria",
    },
    {
      phase: "Design",
      purpose: "Decide the interface, data flow, policy boundaries, and sub-agent packets.",
      output: "component plan, routing notes, risks, verification strategy",
    },
    {
      phase: "Build",
      purpose: "Edit the smallest useful slice after the plan and route are clear.",
      output: "focused code changes, updated docs, local checks",
    },
    {
      phase: "Review",
      purpose: "Look for regressions, security gaps, stale docs, and missing tests.",
      output: "findings first, then summary and residual risk",
    },
  ];

  return (
    <PageFrame>
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="max-w-3xl">
          <span className="font-mono text-xs uppercase tracking-widest text-accent">
            Coding
          </span>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
            A workflow for deciding what the agent should do next
          </h1>
          <p className="mt-5 text-base leading-relaxed text-zinc-400 md:text-lg">
            Takomi is a thinking layer for coding agents. It separates project
            definition, design, implementation, delegation, and review so a model
            does not treat every request as “open files and start editing.”
          </p>
        </div>

        <div className="mt-12 overflow-hidden rounded border border-zinc-800">
          {phases.map((item, index) => (
            <div
              key={item.phase}
              className="grid gap-4 border-b border-zinc-900 bg-zinc-950 p-6 last:border-b-0 md:grid-cols-[160px_1fr_280px]"
            >
              <div className="font-mono text-sm font-bold text-accent">
                {String(index + 1).padStart(2, "0")} / {item.phase}
              </div>
              <p className="text-sm leading-relaxed text-zinc-300">
                {item.purpose}
              </p>
              <p className="font-mono text-xs leading-relaxed text-zinc-500">
                {item.output}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          <article className="rounded border border-zinc-800 bg-zinc-950/60 p-6">
            <h2 className="font-mono text-lg font-bold text-foreground">
              Why sub-agents matter
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Sub-agents are useful only when the parent agent gives them a
              bounded packet: objective, files to inspect, definition of done,
              and what not to change. Takomi keeps the parent responsible for
              synthesis and verification so parallel work does not turn into
              scattered opinions.
            </p>
          </article>
          <article className="rounded border border-zinc-800 bg-zinc-950/60 p-6">
            <h2 className="font-mono text-lg font-bold text-foreground">
              Why context handling matters
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Large prompt bundles feel powerful until they drown the model.
              Takomi prefers progressive context: load indexes and policy hints
              first, then pull full skills, docs, or task files only when the
              next action needs them.
            </p>
          </article>
        </div>
      </section>
    </PageFrame>
  );
}
