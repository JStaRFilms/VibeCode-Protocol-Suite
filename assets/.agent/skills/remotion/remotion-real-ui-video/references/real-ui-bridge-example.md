# Real UI Bridge Reference

Use this reference when implementing a Remotion composition for an existing app screen.

## Required pattern

```txt
Existing app route/page
  -> live container/hooks/providers
  -> RealFeatureView props

Remotion composition
  -> imports RealFeatureView
  -> supplies deterministic demo props
  -> drives route/state from timeline commit frames
  -> overlays cursor/touch/highlights around the real UI
```

## Good example shape

```tsx
// app/admin/scores/page.tsx
export default function ScoresPage() {
  const session = useLiveSession();
  const data = useScoresQuery(session.schoolId);
  return <ScoresWorkspaceView data={data} onSave={saveScores} />;
}

// app/admin/scores/ScoresWorkspaceView.tsx
export function ScoresWorkspaceView({ data, onSave }: Props) {
  return (
    <WorkspaceShell>
      <ScoreSelector value={data.selection} />
      <ScoreGrid rows={data.rows} onSave={onSave} />
      <PreviewAction />
    </WorkspaceShell>
  );
}

// remotion/compositions/ScoresDemo.tsx
export function ScoresDemo() {
  const frame = useCurrentFrame();
  const scene = getScene(frame);
  return (
    <AbsoluteFill data-video-coordinate-root>
      <ScoresWorkspaceView
        data={getDemoScoresData(scene)}
        onSave={() => undefined}
      />
      <TimelineCursor />
    </AbsoluteFill>
  );
}
```

## Bad example shape

```tsx
// remotion/compositions/ScoresDemo.tsx
// BAD: This redraws the app screen from scratch even though real components exist.
function FakeScoreGrid() {
  return <table>{/* handmade lookalike rows */}</table>;
}
```

This is unacceptable unless the user explicitly approved a video-only mockup/redesign after being told real UI reuse is not being attempted.

## Refactor rule

If the real screen is coupled to live hooks/auth/API calls, do not clone the JSX. Extract a presentational view:

```txt
Before:
ScoresPage contains hooks + full JSX

After:
ScoresPage contains hooks and passes props
ScoresWorkspaceView contains the existing JSX
Remotion imports ScoresWorkspaceView
```

## Marketing overlay rule

New Remotion-only JSX is allowed for:

- hook cards
- captions
- CTA/end cards
- spotlights/highlights
- cursor/touch indicators
- camera masks/backgrounds

It is not allowed for replacing existing app screens.
