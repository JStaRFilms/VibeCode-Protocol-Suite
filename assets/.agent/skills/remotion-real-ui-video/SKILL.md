---
name: remotion-real-ui-video
description: >-
  Strict reusable workflow for turning an existing app into code-native Remotion videos that reuse the real app UI/components instead of screenshots, screen recordings, or recreated clone/mock screens. Use when a user wants product demos, walkthroughs, onboarding videos, launch videos, or proof compositions from an existing React/Next/web app with mock/demo/local data, scripted navigation, click/touch choreography, responsive mobile proofs, scroll choreography, or calibrated cursor/tap targeting. Enforces real-UI compliance: agents must inspect and import/extract actual app components before building app-screen scenes, and must stop rather than hand-build lookalike dashboards/forms/tables unless the user explicitly approves a mockup/redesign.
---

# Remotion Real UI Video Workflow

## Core Rule

Render the app's real UI in Remotion. Do not recreate clone screens, redesign dashboards, or rely on screenshots as the primary production path. Replace runtime/data boundaries with deterministic demo data so the existing components can render safely and repeatably.

## New Project Transfer Rule

This skill is a workflow, not a drop-in guarantee. For each new project, inspect the app's structure before implementing: routing, providers, styling setup, auth/session flow, data fetching, browser/server boundaries, responsive layouts, and Remotion compatibility. Adapt the generic pattern to the specific codebase instead of assuming prior project files, routes, models, or tooling exist.

Default to doing serious video/demo conversion work on a fresh branch or Git worktree. Coexisting in the same project is possible when changes are strictly isolated behind Remotion-only entrypoints, demo providers, stubs, aliases, and scripts; however, branch/worktree isolation is safer when replacing auth, data, routing, or external-service boundaries.

## Non-negotiables

- Preserve the product's existing UI composition, layout hierarchy, shared components, styling, and navigation patterns.
- Do not build Remotion-only clone dashboards, forms, tables, cards, sidebars, score sheets, admin panels, or product screens when a real app component already exists.
- Do not recreate a screen because it is faster, prettier, easier to animate, or simpler than wiring the real component. That violates this skill.
- Do not redesign screens just because video rendering needs local data or scripted timing.
- Prefer extracting data/provider boundaries over rewriting JSX.
- Replace live runtime dependencies at the boundary: authentication/session, databases, external APIs, payment providers, uploads, analytics, webhooks, AI calls, and feature flags.
- Use believable deterministic demo data. Avoid random-at-render data unless seeded.
- Never expose implementation wording such as "demo", "mock", "fake", "video mode", or "test data" in user-facing UI unless the user explicitly wants that.
- Prefer code-native Remotion compositions that import/render real app components over screenshots or screen capture. Use Playwright/screenshots only as diagnostic/reference fallbacks.
- Drive cursor/touch movement, down/up frames, app reactions, route/state commits, and scroll/camera changes from centralized timeline objects.
- Route/data state must change only at a commit frame after the visual click/tap has landed.
- Prefer semantic DOM target tracking (`data-video-target`) over raw coordinates; raw coordinates are fallbacks only.
- Normalize DOM measurements into Remotion composition coordinates before positioning cursors, touches, debug overlays, or highlights.
- For Remotion-authored movement/scrolling, avoid CSS `transition`/browser-driven animation on properties that change every frame. Drive motion from frame values only.
- Default final compositions to full HD so real UI is not cramped: use 1920×1080 for landscape and 1080×1920 for portrait/mobile. Smaller sizes such as 1280×720 are acceptable only for quick draft renders or explicit user request.
- For mobile/tablet proofs, use separate Remotion compositions with intended portrait dimensions, preferably 1080×1920 for final output. Use full-screen app surfaces, touch indicators, and scripted scroll; avoid desktop pan/zoom and mouse cursors.

## Recommended Architecture

Use a video/demo data layer around the real app UI:

```txt
real app UI components
  -> thin runtime/data boundary
    -> live providers OR demo/local providers
  -> scripted route/state/timeline layer
  -> Remotion composition
  -> optional debug overlays/reference captures
```

When starting from an app with tightly coupled data/auth, split containers from presentational components:

```txt
LivePage/LiveContainer
  -> loads auth/session/live data
  -> calls actions/mutations
  -> renders RealFeatureView props

RemotionComposition
  -> imports RealFeatureView
  -> supplies demo data + no-op/demo actions
  -> drives state from timeline commit frames
```

## Required References

Before implementing any non-trivial real-UI Remotion task, read:

- `references/real-ui-bridge-example.md` for the required real-component bridge pattern.
- `references/anti-patterns.md` to avoid known failure modes.
- `references/completion-checklist.md` before reporting completion.

For trivial edits to an already-compliant composition, reading the checklist is enough.

## Real UI Compliance Gate

Before implementing a composition for an existing app screen, prove the screen is real-UI-backed:

1. Find the actual route/page/component files that render the requested screen in the app.
2. Identify the exported or extractable view component(s) that own the real UI.
3. Import those real components into Remotion, or extract a presentational view from them while preserving JSX/layout/classes.
4. Replace only runtime/data/provider boundaries with demo data, stubs, aliases, or no-op actions.
5. If the real UI cannot be imported/extracted without major refactor, stop and tell the user. Ask whether to refactor the real component boundary or intentionally create a video-only mockup.

A composition that hand-builds a lookalike screen without first exhausting real component reuse is not acceptable under this skill. Marketing polish can be added around the real UI, but not by replacing the real UI with a recreated clone.

## Mandatory Pre-Implementation Report

Before writing Remotion scene JSX for any app screen, produce a short implementation report with this exact information:

```txt
Real UI source files:
- <route/page/component path>
- <shared component path>

Real components to reuse/extract:
- <component name> from <path>

Runtime boundaries to replace:
- <auth/session/data/provider/API/etc.>

Scenes requiring real UI:
- Scene <n>: reuse <component/path>

Scenes that are pure marketing overlays:
- Scene <n>: hook/CTA/background only, no existing app screen replaced

Blocked items / user decisions needed:
- <none or specific blocker>
```

If this report cannot name the real UI source files and components for an app-screen scene, do not implement that scene as a clone. Stop and ask for direction.

## Allowed Exceptions

The only acceptable places to create new Remotion-only JSX are:

- abstract hook cards, captions, labels, callouts, highlights, spotlights, and CTA/end cards
- cursor/touch/debug overlays
- camera frames, masks, backgrounds, and transitions around real UI
- intentionally approved mockups/redesigns after telling the user real UI reuse is blocked or not being attempted

These exceptions do not allow recreating existing app screens, tables, forms, dashboards, report cards, sidebars, or score-entry sheets.

## Workflow

1. Inspect before editing.
   - For non-trivial work, read `references/real-ui-bridge-example.md` and `references/anti-patterns.md` before implementation.
   - Treat every project as different; do not assume the app uses the same framework, router, auth provider, data layer, styling system, or component structure as a prior project.
   - Check Git status and decide whether to create a new branch/worktree before making video/demo changes. Prefer isolation for broad edits or any auth/data/provider/runtime boundary changes.
   - Identify the real routes/components that own the target UI. Record their file paths before building Remotion scenes.
   - Identify data hooks, auth guards, providers, live API calls, browser-only assumptions, and external connectors.
   - Identify styling/global CSS/font/image/runtime requirements that Remotion must load or stub.
   - List the smallest boundaries that must be replaced for Remotion rendering.
   - Do not proceed to implementation until you know whether each requested scene will reuse real UI, wrap real UI, or requires explicit user approval for a video-only mockup.

2. Preserve real UI components.
   - Keep class names, component structure, spacing, and shared UI imports.
   - Extract presentational views only when necessary.
   - Reuse existing forms, tables, dashboards, navigation shells, sheets, reports, cards, and toolbars instead of rebuilding them in a Remotion-only file.
   - Do not replace complex real screens with simplified video-only copies unless the user explicitly requests a redesign or approves a mockup after being told real UI reuse is blocked.

3. Create deterministic demo runtime/data.
   - Provide local/demo sessions, users, accounts, projects, plans, records, notifications, payments, activity, or whatever domain entities the UI expects.
   - Simulate loading, success, failure, empty, and optimistic states when useful for the video.
   - Replace live mutations/actions with local no-op or scripted state changes.
   - Keep user-facing copy production-like, not labeled as mock/demo.

4. Build a code-native Remotion bridge.
   - Import the real UI view/component into a Remotion composition.
   - If the requested app screen currently exists only as a route wired to live hooks, extract a presentational component from that route and use it in both the app and Remotion.
   - Provide required providers, styles, aliases/stubs, and local data.
   - Stub framework integrations as needed, e.g. routing/link/navigation modules, image/font loaders, analytics, or server-only APIs.
   - Keep Remotion-specific code around the UI, not inside every component.
   - If production/shared components must be edited for video compatibility, keep changes additive and low-risk: optional props, `data-video-target` attributes, exported presentational boundaries, or harmless no-op hooks. Avoid changing live behavior, import semantics, routing, auth, or data logic just to satisfy Remotion.
   - Do not create new Remotion-only JSX that imitates an existing app screen unless explicitly approved as a mockup/redesign.

5. Script interactions with a centralized timeline.
   - Define named actions with `targetId`, fallback coordinates, `downFrame`, `upFrame`, and `commitFrame`.
   - Derive route/view/data state from frame and commit frames.
   - Make click/tap visibly land before route/data state changes.
   - Keep timing constants readable and named so the user can tune them in Remotion Studio.

6. Use semantic target measurement.
   - Add `data-video-target="meaningful-id"` to the real clickable/focusable UI element.
   - Measure target boxes at render time with `getBoundingClientRect()`.
   - Convert viewport/Studio-scaled pixels into composition pixels relative to a `data-video-coordinate-root` using `useVideoConfig()` width/height.
   - Position cursor/touch indicators at the normalized target center.
   - Render optional debug target overlays in the same normalized coordinate space.

7. Handle responsive/mobile separately.
   - Create a dedicated mobile/tablet composition with realistic portrait viewport dimensions. Default final portrait/mobile output to 1080×1920; avoid tiny phone canvases unless rendering drafts or explicitly requested.
   - Default final landscape output to 1920×1080 so desktop UI has enough room and does not look cramped.
   - Add mobile-only targets for drawer links, bottom tabs, cards, and stacked rows that replace desktop sidebars/tables.
   - Use touch/tap indicators, not mouse cursors.
   - Drive drawer/menu open state from timeline commit frames.
   - For long pages, drive vertical scroll from timeline state with deterministic transforms such as `translate3d(...)`; avoid CSS transitions on frame-driven transforms.

8. Verify.
   - Read `references/completion-checklist.md` and use it as the completion gate.
   - Run targeted typecheck/build for every touched package, including the app package, Remotion host package, and any shared component package.
   - Render stills at each important click/tap/down/commit frame.
   - Render at least one debug-overlay still per composition that proves semantic targets and cursor/touch indicators share the same normalized coordinate space. If target measurement uses `getBoundingClientRect()`, verify it is normalized for Remotion Studio scaling with the composition root and `useVideoConfig()` dimensions.
   - Add or document convenient render commands/scripts for the new composition, including still/debug rendering and final video rendering. A registered composition without an easy render path is incomplete.
   - Render the final composition to a video artifact after stills look correct; do not call the workflow complete with stills only unless the user asked only for stills.
   - Review every production/shared component touched for video compatibility. Confirm changes are additive and do not alter live auth, routing, data fetching, imports, or app behavior unnecessarily.
   - Compare the rendered output against the user's script scene by scene. Flag mismatches such as a tiny link where the script asked for a button, clipped UI, unclear status transitions, or highlighting the wrong row/entity.
   - Before calling the work complete, perform a real-UI compliance check: for each app-screen scene, name the real component imported/extracted. If any app-screen scene is hand-built as lookalike JSX without approval, mark the work incomplete.

## Implementation Patterns

### Timeline action shape

```ts
type VideoAction = {
  id: string;
  label: string;
  target: {
    frame: number;
    targetId: string;
    x: number; // fallback only
    y: number; // fallback only
  };
  downFrame: number;
  upFrame: number;
  commitFrame: number;
};
```

### Coordinate normalization pattern

Use this normalization for every cursor/touch/debug-overlay target measured from the DOM. Do not use raw `targetRect.left - rootRect.left` unless the root is guaranteed to be unscaled.

```ts
const targetRect = target.getBoundingClientRect();
const rootRect = root.getBoundingClientRect();
const scaleX = rootRect.width / compositionWidth;
const scaleY = rootRect.height / compositionHeight;

const normalized = {
  x: (targetRect.left - rootRect.left) / scaleX,
  y: (targetRect.top - rootRect.top) / scaleY,
  width: targetRect.width / scaleX,
  height: targetRect.height / scaleY,
};
```

### Frame-driven scroll pattern

```ts
const scrollY = interpolate(frame, [start, end], [0, 240], {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
});

<div style={{ transform: `translate3d(0, ${-Math.round(scrollY)}px, 0)` }} />
```

Do not add CSS `transition` to the same transform; Remotion is already sampling exact frames.

## Common Pitfalls

- Recreating screens instead of importing real components.
- Starting with a blank Remotion composition and drawing a similar dashboard/form/table from scratch.
- Treating visual similarity as success. Under this skill, visual similarity is not enough; app-screen scenes must be backed by real app components.
- Building a polished marketing mockup that resembles the app but bypasses the app's actual route/components.
- Seeing existing components such as selection bars, grids, forms, tables, or action bars, then rebuilding similar JSX inside the Remotion composition instead of extracting/importing them.
- Using hardcoded coordinates after adding `data-video-target` instead of measuring semantic targets.
- Measuring targets with `getBoundingClientRect()` but forgetting to normalize for Remotion Studio scaling.
- Registering a composition but forgetting render scripts, debug still scripts, or a final rendered video artifact.
- Touching production/shared components for video needs without reviewing whether the changes affect live behavior.
- Calling work done when the output only partially matches the user's script, has clipped UI, has unclear click/tap targets, uses the wrong visual emphasis, or renders final output at a cramped canvas size when FHD would be appropriate.
- Putting demo/auth/video labels in user-facing UI.
- Hardcoding click coordinates without semantic target measurement.
- Using raw `getBoundingClientRect()` values directly in cursor transforms; Studio preview scaling will make clicks drift.
- Measuring targets in one coordinate space while rendering overlays/cursors in another.
- Changing UI state at click-down instead of after click-up.
- Using desktop cursor/pan/zoom language for mobile proofs.
- Adding CSS transitions to frame-driven Remotion transforms, causing scroll or camera jitter.
- Letting real auth, database, payments, uploads, or analytics execute during video rendering.

## Skill Maintenance

When a user adds a reusable preference, correction, or workflow rule while building Remotion videos, update this skill if the rule is project-agnostic. Keep project-specific routes, filenames, brands, and domain entities out of this generic skill; those belong in project-local skills or documentation.
