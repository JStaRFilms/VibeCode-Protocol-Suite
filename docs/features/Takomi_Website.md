# Blueprint: Takomi VibeCode Protocol Website

## Goal
Build a modern, high-converting landing page showcasing the Takomi VibeCode Protocol. It should explain the philosophy and how Takomi transforms AI from a chatbot into a development partner.

## Implementation Status
- Scaffolded a standalone Next.js App Router site in `website/`.
- Added a static landing page with header, hero, Takomi-specific runtime strip, value pillars, PI demo, workflow timeline, installation CTA, and footer.
- Added functional pages for Documents, Installation, Coding, Codex, and Plugin.
- Used Anti-Gravity for the initial UI/code pass, then tightened install accuracy, script references, brand assets, routing links, and verification.

## Components (Client vs Server)
- The website will be a **Next.js App Router** application (to be scaffolded in `website/`).
- **Server First**: All UI components are React Server Components by default.
- **Client Sparingly**: Only use `'use client'` for interactivity (e.g., animations provided by 21st.dev components).

## Data Flow
- This is a static presentation site. No database schema or complex data fetching is required for V1.

## Verification
- `npm run lint` from `website/`
- `npx tsc --noEmit` from `website/`

## Current Landing Sections
- Header: logo-only wordmark, functional route navigation, GitHub link, and installation CTA.
- Hero: real Takomi logo, repo package version pulled at render time, primary install command, and terminal setup preview.
- Runtime surfaces: PI Runtime, Codex, Kilo Code, Anti-Gravity as optional critique, Skills, and Strata Agents.
- Value pillars: lifecycle workflows, sub-agent teams, progressive context loading, instance management, strata routing, and unified extensions.
- PI demo: staged terminal trace showing prompt capture, runtime detection, policy routing, roadbook creation, sub-agent packet creation, and verification.
- Lifecycle timeline: Genesis, Design, Build, Review, and Recovery.
- Installation CTA: focuses on CLI, PI, and Codex plugin value rather than internal marketplace plumbing.
- Footer: concise brand summary, functional site links, GitHub link, and ISC license note.
