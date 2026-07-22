import InstallChooser from "@/features/site/components/InstallChooser";
import PageFrame from "@/features/site/components/PageFrame";

export default function InstallationPage() {
  return (
    <PageFrame>
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="max-w-3xl">
          <span className="font-mono text-xs uppercase tracking-widest text-accent">
            Installation
          </span>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
            Install the path that matches your agent surface
          </h1>
          <p className="mt-5 text-base leading-relaxed text-zinc-400 md:text-lg">
            Takomi is not three unrelated products. The primary path is CLI
            through PI, the Codex plugin is a PI-free orchestration interface,
            and the raw skill is the portable fallback for other coding agents.
          </p>
        </div>

        <div className="mt-12">
          <InstallChooser />
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["PI through CLI", "For the complete workflow: context management, PI extensions, setup/refresh, diagnostics, and tool orchestration."],
            ["Codex Plugin", "For users who want Takomi task discipline, thread delegation, roadbooks, and review posture without installing PI."],
            ["Raw Skill", "For Anti-Gravity, Kilo Code, and other skill-aware coding agents where you want the Takomi mindset in a lighter form."],
          ].map(([title, text]) => (
            <article key={title} className="rounded border border-zinc-800 bg-zinc-950/60 p-5">
              <h2 className="font-mono text-base font-bold text-foreground">
                {title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {text}
              </p>
            </article>
          ))}
        </div>
      </section>
    </PageFrame>
  );
}
