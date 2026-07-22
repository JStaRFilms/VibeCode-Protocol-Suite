"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { installCommand } from "@/features/site/siteData";

interface HeroProps {
  version: string;
}

export default function Hero({ version }: HeroProps) {
  const [terminalLine, setTerminalLine] = useState(0);

  // Simple terminal line stepper for interactive feel
  useEffect(() => {
    const interval = setInterval(() => {
      setTerminalLine((prev) => (prev < 4 ? prev + 1 : 0));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative mx-auto max-w-6xl px-6 pt-8 pb-8 md:pt-16 md:pb-16">
      <div className="flex flex-col items-center text-center gap-4 md:gap-5">
        <Image
          src="/takomi-logo.png"
          alt="Takomi"
          width={360}
          height={104}
          className="h-auto w-full max-w-[220px] sm:max-w-[320px]"
          priority
        />

        {/* Status chip */}
        <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent-muted px-3.5 py-1 text-xs font-mono tracking-tight text-accent">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          <span>TAKOMI v{version}</span>
          <span className="text-zinc-600 font-normal">|</span>
          <span>STATUS: OPERATIONAL</span>
        </div>

        {/* Headline */}
        <h1 className="max-w-4xl text-[1.85rem] font-extrabold tracking-tight text-foreground sm:text-5xl md:text-[3.45rem] leading-[1.08] font-sans">
          Stop wrestling with AI.<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-sage to-signal glow-accent">
            Start building with purpose.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="max-w-2xl text-base text-zinc-400 sm:text-xl">
          Takomi is a repo-local context firewall and agent lifecycle manager for
          progressive context, strict build gates, and step-by-step roadbooks.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
          <Link
            href="/installation"
            className="group relative flex h-11 items-center justify-center gap-2 rounded border border-accent bg-accent px-6 text-sm font-semibold text-background transition-all duration-200 hover:bg-transparent hover:text-accent cursor-pointer"
          >
            Choose install path
            <svg
              className="h-4 w-4 fill-none stroke-current transition-transform duration-200 group-hover:translate-x-0.5"
              viewBox="0 0 24 24"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
          
          <Link
            href="/docs"
            className="flex h-11 items-center justify-center rounded border border-zinc-800 bg-zinc-900/40 px-6 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-foreground cursor-pointer"
          >
            Explore Docs
          </Link>
        </div>
      </div>

      {/* Cinematic Terminal Mockup */}
      <div className="mx-auto max-w-4xl mt-8 md:mt-12 border border-zinc-800 bg-zinc-950/80 rounded-lg shadow-2xl overflow-hidden scanline-effect">
        {/* Terminal Header */}
        <div className="flex h-10 items-center justify-between px-4 border-b border-zinc-900 bg-zinc-900/40">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-zinc-800" />
            <span className="w-3 h-3 rounded-full bg-zinc-800" />
            <span className="w-3 h-3 rounded-full bg-zinc-800" />
          </div>
          <span className="font-mono text-xs text-zinc-500 tracking-tight select-none">
            takomi-runtime --session-id=aca17045
          </span>
          <div className="w-12" />
        </div>

        {/* Terminal Content */}
        <div className="h-[170px] overflow-hidden p-4 font-mono text-xs sm:h-[300px] sm:p-6 sm:text-sm leading-relaxed text-zinc-300 bg-zinc-950/90 select-all selection:bg-accent selection:text-background">
          <div className="flex items-center gap-2 text-zinc-500 mb-2">
            <span>Microsoft Windows [Version 10.0.22631]</span>
          </div>
          
          <div className="flex items-start gap-2 mb-4">
            <span className="text-accent">&gt;</span>
            <span>{installCommand}</span>
          </div>

          <div className="text-zinc-500 mb-4 animate-pulse-slow">
            [+] Resolving skill target package... Done.<br />
            [+] Copying local policies to .agents/skills/takomi/<br />
            [✓] Added skill: takomi (repo-local configuration active)
          </div>

          <div className="flex items-start gap-2 mb-2">
            <span className="text-accent">&gt;</span>
            <span>pwsh -NoProfile -File .\plugins\takomi-codex\scripts\takomi-doctor.ps1</span>
          </div>

          {/* Stepped Terminal Outputs */}
          <div className="space-y-2.5">
            <div className={`transition-opacity duration-500 ${terminalLine >= 0 ? "opacity-100" : "opacity-0 h-0 overflow-hidden"}`}>
              <span className="text-emerald-500">[✓]</span> <span className="text-zinc-400">Takomi Doctor version v0.1 initialized.</span>
            </div>
            
            <div className={`transition-opacity duration-500 ${terminalLine >= 1 ? "opacity-100" : "opacity-0 h-0 overflow-hidden"}`}>
              <span className="text-zinc-500">Checking project files & rules...</span><br />
              <span className="text-amber-500">[!]</span> <span className="text-zinc-400">Size signal: page surface is growing. Suggest split when useful.</span>
            </div>

            <div className={`transition-opacity duration-500 ${terminalLine >= 2 ? "opacity-100" : "opacity-0 h-0 overflow-hidden"}`}>
              <span className="text-emerald-500">[✓]</span> <span className="text-zinc-400">Blueprint Rule verified: docs/features/Takomi_UI_Landing.md present.</span>
            </div>

            <div className={`transition-opacity duration-500 ${terminalLine >= 3 ? "opacity-100" : "opacity-0 h-0 overflow-hidden"}`}>
              <span className="text-emerald-500">[✓]</span> <span className="text-zinc-400">Type Safety Gate verified: running &apos;npx tsc --noEmit&apos;... No errors.</span>
            </div>

            <div className={`transition-opacity duration-500 ${terminalLine >= 4 ? "opacity-100" : "opacity-0 h-0 overflow-hidden"}`}>
              <span className="text-accent font-bold">[READY]</span> <span className="text-zinc-100 font-semibold">Takomi is primed. Context Router loaded with 14 active skills.</span>
            </div>
          </div>

          <div className="mt-4 flex items-center">
            <span className="text-accent mr-2">&gt;</span>
            <span className="w-2 h-4 bg-accent animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  );
}
