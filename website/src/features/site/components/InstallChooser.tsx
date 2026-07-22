"use client";

import React, { useState } from "react";
import { installOptions } from "@/features/site/siteData";
import { copyText } from "@/features/site/copyText";

interface InstallChooserProps {
  compact?: boolean;
}

export default function InstallChooser({ compact = false }: InstallChooserProps) {
  const [activeId, setActiveId] =
    useState<(typeof installOptions)[number]["id"]>("pi");
  const [copied, setCopied] = useState(false);

  const active =
    installOptions.find((option) => option.id === activeId) ?? installOptions[0];

  const copyCommand = async () => {
    await copyText(active.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/60 p-4 sm:p-5">
      <div className="mb-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          Where should Takomi run?
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {installOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setActiveId(option.id)}
              className={`rounded border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                active.id === option.id
                  ? "border-accent bg-accent text-background"
                  : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-accent/40"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm leading-relaxed text-zinc-400">
        {active.description}
      </p>

      {!compact && (
        <ul className="mt-4 space-y-2">
          {active.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3 text-sm text-zinc-300">
              <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 rounded border border-zinc-900 bg-background p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Command / prompt
          </span>
          <button
            type="button"
            onClick={copyCommand}
            className="rounded border border-accent/30 bg-accent-muted px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-accent transition-colors hover:border-accent"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <code className="block overflow-x-auto whitespace-pre font-mono text-sm leading-relaxed text-zinc-200">
          {active.command}
        </code>
      </div>
    </div>
  );
}
