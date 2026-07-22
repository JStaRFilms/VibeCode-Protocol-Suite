import Link from "next/link";

interface InfoPageProps {
  eyebrow: string;
  title: string;
  intro: string;
  sections: Array<{
    title: string;
    text: string;
    points: string[];
  }>;
}

export default function InfoPage({
  eyebrow,
  title,
  intro,
  sections,
}: InfoPageProps) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div className="max-w-3xl">
        <span className="font-mono text-xs uppercase tracking-widest text-accent">
          {eyebrow}
        </span>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground md:text-6xl">
          {title}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-zinc-400 md:text-lg">
          {intro}
        </p>
      </div>

      <div className="mt-12 grid gap-px overflow-hidden rounded border border-zinc-800 bg-zinc-900 md:grid-cols-2">
        {sections.map((section) => (
          <article key={section.title} className="bg-zinc-950 p-7">
            <h2 className="font-mono text-lg font-bold text-foreground">
              {section.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              {section.text}
            </p>
            <ul className="mt-5 space-y-3">
              {section.points.map((point) => (
                <li key={point} className="flex gap-3 text-sm text-zinc-300">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/installation"
          className="inline-flex h-11 items-center rounded border border-accent bg-accent px-5 text-sm font-semibold text-background transition-colors hover:bg-transparent hover:text-accent"
        >
          Start installation
        </Link>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded border border-zinc-800 bg-zinc-900/50 px-5 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-foreground"
        >
          Back to overview
        </Link>
      </div>
    </section>
  );
}
