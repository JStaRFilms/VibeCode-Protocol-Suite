import React from "react";
import Image from "next/image";
import Link from "next/link";
import { navLinks, repositoryUrl } from "@/features/site/siteData";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl h-16 items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center font-mono text-lg font-bold tracking-tight text-foreground transition-opacity hover:opacity-90"
        >
          <Image
            src="/takomi-logo.png"
            alt="Takomi"
            width={118}
            height={34}
            className="h-8 w-auto"
            priority
          />
        </Link>
        
        <nav className="hidden items-center gap-7 text-sm font-medium text-zinc-400 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/installation"
            className="hidden sm:inline-flex h-9 items-center justify-center rounded border border-accent/20 bg-accent-muted px-4 text-xs font-semibold text-accent transition-all duration-200 hover:border-accent hover:bg-accent/10 cursor-pointer"
          >
            Initialize
          </Link>
          <a
            href={repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="GitHub Repository"
          >
            <svg
              className="h-[18px] w-[18px] fill-current text-zinc-400"
              viewBox="0 0 16 16"
              version="1.1"
              aria-hidden="true"
            >
              <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.35 3.12.88.01.47.01.84.01.93 0 .22-.15.47-.55.38A8.014 8.014 0 0 1 0 8c0-4.42 3.58-8 8-8z"></path>
            </svg>
          </a>
        </div>
      </div>
    </header>
  );
}
