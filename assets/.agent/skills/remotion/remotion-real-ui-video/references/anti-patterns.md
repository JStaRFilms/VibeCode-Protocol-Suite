# Anti-Patterns

Use this reference before and during review. If any anti-pattern appears, stop and correct it before calling the work complete.

## Anti-pattern 1: Pretty fake app screen

### Symptom

The composition creates custom JSX that resembles an existing app screen:

- handmade dashboard
- handmade form
- handmade table/grid
- handmade score sheet
- handmade sidebar/header
- handmade report card

### Why it is wrong

The video may look polished, but it no longer proves or showcases the real product UI. Future UI changes will not carry into the video, and the agent has violated the real-UI workflow.

### Correct response

Find the actual app component and import/extract it. Replace only data/runtime boundaries.

## Anti-pattern 2: Existing component ignored

### Symptom

The codebase has components like:

```txt
SelectionBar
RosterGrid
SaveActionBar
ReportPreview
WorkspaceShell
SettingsForm
BillingTable
```

But the Remotion composition builds similar JSX itself.

### Correct response

Use the existing components. If they are not exportable, export them or extract a presentational view.

## Anti-pattern 3: Semantic targets without semantic measurement

### Symptom

The agent adds `data-video-target`, but cursor/touch positions still come from hardcoded coordinates.

### Correct response

Measure the target with `getBoundingClientRect()`, normalize to composition coordinates, and use fallback coordinates only when measurement is unavailable.

## Anti-pattern 4: Raw bounding rect coordinates

### Symptom

The code uses:

```ts
x: targetRect.left - rootRect.left
```

without compensating for Remotion Studio scaling.

### Correct response

Use composition width/height from `useVideoConfig()`:

```ts
const scaleX = rootRect.width / compositionWidth;
const scaleY = rootRect.height / compositionHeight;

x = (targetRect.left - rootRect.left) / scaleX;
y = (targetRect.top - rootRect.top) / scaleY;
```

## Anti-pattern 5: CSS transitions on frame-driven motion

### Symptom

Frame-driven scroll/camera transforms use CSS `transition`.

### Why it is wrong

The browser interpolates while Remotion samples exact frames, causing jitter or stutter.

### Correct response

Use deterministic frame values only, e.g. `translate3d(...)`, and no CSS transition.

## Anti-pattern 6: Registered but not renderable

### Symptom

A composition is registered, but there are no scripts/commands for stills, debug stills, or final video.

### Correct response

Add or document render commands before calling the work done.

## Anti-pattern 7: Unreviewed production edits

### Symptom

Shared/production components are changed to satisfy Remotion, but no one checks whether live behavior changed.

### Correct response

Review every production edit. Prefer additive props, `data-video-target`, exports, or presentational extraction. Avoid changing live auth/data/routing/import behavior unless deliberately required.
