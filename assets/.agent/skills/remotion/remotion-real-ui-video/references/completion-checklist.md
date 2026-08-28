# Completion Checklist

Use this checklist before saying a Remotion real-UI video task is complete.

## Pre-implementation report

- [ ] Listed real UI source files for every app-screen scene.
- [ ] Listed real components imported or extracted.
- [ ] Listed runtime/data/provider boundaries replaced with demo/local equivalents.
- [ ] Identified which scenes are marketing overlays only.
- [ ] Asked the user before creating any video-only mockup of an existing app screen.

## Real UI compliance

For each app-screen scene:

- [ ] Scene imports/extracts real app UI components.
- [ ] Scene does not hand-build a lookalike dashboard/form/table/screen.
- [ ] Demo data enters through props/providers/boundaries, not by rewriting visual JSX.
- [ ] Any production/shared component changes are additive and low-risk.

## Timeline and interaction compliance

- [ ] Interactions are centralized in a timeline/action object.
- [ ] Every action has `targetId`, fallback coordinates, `downFrame`, `upFrame`, and `commitFrame`.
- [ ] UI/route/data changes happen at `commitFrame`, after click/tap release.
- [ ] Desktop uses cursor indicators; mobile uses touch indicators.
- [ ] Mobile scroll is frame-driven and deterministic, with no CSS transitions.

## Target measurement compliance

- [ ] Click/tap targets use `data-video-target`.
- [ ] DOM measurements use `getBoundingClientRect()`.
- [ ] Measurements are normalized from viewport/Studio-scaled pixels into composition coordinates.
- [ ] Debug overlays use the same normalized coordinate space as the cursor/touch indicator.
- [ ] Fallback hardcoded coordinates are used only if measurement is unavailable.

## Render and artifact compliance

- [ ] Final composition canvas uses full HD by default: 1920×1080 for landscape or 1080×1920 for portrait/mobile, unless the user explicitly requested a smaller/different size.
- [ ] Typechecked every touched package.
- [ ] Rendered stills at key scene/action frames.
- [ ] Rendered at least one debug-overlay still per composition.
- [ ] Added or documented still/debug/final video render commands.
- [ ] Rendered final video artifact unless user requested stills only.
- [ ] Compared output scene-by-scene against the user's script.
- [ ] Checked that UI is not cramped, clipped, or too small on the chosen canvas.

## Required final report

When reporting completion, include:

```txt
Real UI reused:
- Scene <n>: <component> from <path>

Demo boundaries:
- <boundary>: <demo/local replacement>

Verification:
- typecheck command(s)
- still/debug artifact(s)
- final video artifact

Known gaps:
- <none or explicit caveat>
```

## Golden task mental test

Before implementation, ask:

> If the product team changes the real app screen tomorrow, would this video scene naturally inherit that change?

If the answer is no because the screen was recreated in Remotion, the implementation has failed this skill unless the user explicitly requested a mockup/redesign.
