import React from "react";
import Image from "next/image";
import Link from "next/link";
import { navLinks, repositoryUrl } from "@/features/site/siteData";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-zinc-900 bg-zinc-950/60 py-12 font-mono">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-sm">
          <Image
            src="/takomi-logo.png"
            alt="Takomi"
            width={116}
            height={34}
            className="h-8 w-auto"
          />
          <p className="mt-3 text-xs leading-relaxed text-zinc-500 font-sans">
            Takomi coordinates skills, custom PI extensions, borrowed extensions,
            and agent routing so development work follows a readable lifecycle.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
          <a
            href={repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-accent"
          >
            GitHub
          </a>
        </div>

        <span className="text-[10px] text-zinc-600">
          &copy; {currentYear} VibeCode Protocol. Open source under ISC license.
        </span>
      </div>
    </footer>
  );
}
