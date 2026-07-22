import PageFrame from "@/features/site/components/PageFrame";

export default function CodexPage() {
  return (
    <PageFrame>
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="max-w-3xl">
          <span className="font-mono text-xs uppercase tracking-widest text-accent">
            Codex Plugin
          </span>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
            Takomi discipline without requiring PI
          </h1>
          <p className="mt-5 text-base leading-relaxed text-zinc-400 md:text-lg">
            The Codex plugin is the UI alternative for users who want Takomi’s
            task mindset, roadbooks, and sub-agent coordination inside Codex.
            It does not replace the full PI extension stack, but it gives you a
            strong workflow without installing PI.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded border border-zinc-800 bg-zinc-900 md:grid-cols-2">
          {[
            {
              title: "Task dedication",
              text: "The plugin helps decide whether the next move is Genesis, Design, Build, Review, recovery, or direct small-task execution.",
            },
            {
              title: "Sub-agent management",
              text: "It frames child threads or sub-agents with clear packets so the parent can coordinate instead of losing control of the work.",
            },
            {
              title: "Roadbook habit",
              text: "For broad work, it favors markdown roadbooks and task folders so work survives context compaction and handoff.",
            },
            {
              title: "Runtime awareness",
              text: "Runtime detection still matters, but as support for routing: it tells Codex what surfaces exist before the plugin chooses a path.",
            },
          ].map((item) => (
            <article key={item.title} className="bg-zinc-950 p-7">
              <h2 className="font-mono text-lg font-bold text-foreground">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {item.text}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded border border-zinc-800 bg-zinc-950/60 p-6">
          <h2 className="font-mono text-lg font-bold text-foreground">
            What you do and do not get
          </h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <p className="text-sm leading-relaxed text-zinc-400">
              You get Takomi’s orchestration posture: plan first when needed,
              delegate carefully, keep the parent thread accountable, and verify
              before handoff.
            </p>
            <p className="text-sm leading-relaxed text-zinc-400">
              You do not get every PI-powered context-management extension unless
              you install PI through the CLI path. That is why the install page
              presents the paths separately.
            </p>
          </div>
        </div>
      </section>
    </PageFrame>
  );
}
