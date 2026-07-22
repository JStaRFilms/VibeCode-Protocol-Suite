import PageFrame from "@/features/site/components/PageFrame";

export default function DocsPage() {
  return (
    <PageFrame>
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-accent">
              Documents
            </span>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
              A reader for the repo brain
            </h1>
            <p className="mt-5 text-base leading-relaxed text-zinc-400 md:text-lg">
              The long-term docs experience should let you point Takomi at a
              GitHub repository, fetch the markdown tree, and browse feature
              plans, roadbooks, onboarding, and policies as live HTML.
            </p>
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="rounded border border-zinc-800 bg-background px-3 py-2 font-mono text-xs text-zinc-400">
                github.com/JStaRFilms/VibeCode-Protocol-Suite
              </span>
              <button
                type="button"
                className="rounded border border-accent bg-accent px-3 py-2 text-xs font-bold text-background"
              >
                Preview docs
              </button>
            </div>

            <div className="grid overflow-hidden rounded border border-zinc-900 md:grid-cols-[210px_1fr]">
              <div className="border-b border-zinc-900 bg-background p-4 md:border-b-0 md:border-r">
                {[
                  "README.md",
                  "docs/takomi-codex-onboarding.md",
                  "docs/features/Takomi_Website.md",
                  "docs/features/Codex_Takomi_Plugin.md",
                  ".pi/takomi/model-routing.md",
                ].map((file, index) => (
                  <div
                    key={file}
                    className={`rounded px-2 py-2 font-mono text-xs ${
                      index === 1
                        ? "bg-accent-muted text-accent"
                        : "text-zinc-500"
                    }`}
                  >
                    {file}
                  </div>
                ))}
              </div>

              <article className="bg-zinc-950 p-5">
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  Live markdown preview
                </div>
                <h2 className="mt-3 text-2xl font-bold text-foreground">
                  Takomi Codex Onboarding
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  This page would render the selected markdown file, preserve
                  links between docs, and expose copyable commands inline. It is
                  a better “Explore Docs” destination than static marketing copy.
                </p>
                <div className="mt-5 rounded border border-zinc-900 bg-background p-3 font-mono text-xs text-zinc-400">
                  use takomi-codex to inspect this repo
                </div>
              </article>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            ["Repository picker", "Paste a GitHub URL and load the markdown tree."],
            ["Clickable file tree", "Navigate docs, roadbooks, and feature plans without leaving the page."],
            ["Command blocks", "Copy install, doctor, policy, and board commands directly from rendered docs."],
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
