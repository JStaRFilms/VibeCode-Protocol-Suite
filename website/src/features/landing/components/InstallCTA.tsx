import Link from "next/link";
import InstallChooser from "@/features/site/components/InstallChooser";
import { quickLinks } from "@/features/site/siteData";

export default function InstallCTA() {
  return (
    <section id="install" className="mx-auto max-w-6xl px-6 py-20 md:py-28 border-t border-zinc-900 scroll-mt-16">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div className="flex flex-col gap-6">
          <span className="font-mono text-xs text-accent uppercase tracking-widest">
            INITIALIZE ENGINE
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Plug Takomi directly into your environment
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
            Install Takomi when you want agents to understand your workflow,
            not just your prompt. The primary path is Takomi&apos;s CLI configuring
            and driving PI. The Codex plugin is the PI-free orchestration path,
            and raw skills cover other coding agents.
          </p>

          <div id="plugin" className="border-t border-zinc-900 pt-6 mt-2">
            <h3 className="font-mono text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              What you get after install
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {quickLinks.slice(1).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded border border-zinc-900 bg-zinc-950/50 p-3 transition-colors hover:border-accent/30"
                >
                  <span className="font-mono text-xs font-bold text-zinc-200">
                    {link.title}
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    {link.text}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <InstallChooser />
      </div>
    </section>
  );
}
