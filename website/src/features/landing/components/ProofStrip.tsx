import React from "react";

export default function ProofStrip() {
  const integrations = [
    { name: "PI Runtime", desc: "Tool orchestration" },
    { name: "Codex", desc: "Repo-local adapter" },
    { name: "Kilo Code", desc: "Mode handoff" },
    { name: "Anti-Gravity", desc: "Optional critique" },
    { name: "Skills", desc: "Reusable playbooks" },
    { name: "Strata Agents", desc: ".pi routing reads" },
  ];

  return (
    <section className="border-y border-zinc-900 bg-zinc-950/20 py-8">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-xs font-mono tracking-[0.2em] text-zinc-500 uppercase mb-6 select-none">
          RUNTIME SURFACES TAKOMI CAN COORDINATE
        </p>
        <div className="grid grid-cols-2 gap-y-6 gap-x-4 sm:grid-cols-3 md:grid-cols-6">
          {integrations.map((item, index) => (
            <div
              key={index}
              className="flex flex-col items-center md:items-start p-3 rounded border border-zinc-900/50 bg-zinc-950/40 hover:border-accent/30 transition-colors group select-none text-center md:text-left"
            >
              <span className="font-mono text-sm font-bold text-zinc-300 group-hover:text-accent transition-colors">
                {item.name}
              </span>
              <span className="font-mono text-[10px] text-zinc-500 mt-1">
                {item.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
