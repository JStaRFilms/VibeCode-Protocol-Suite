# TakomiFlow Provider Contract

TakomiFlow is an external visual provider operated through its MCP tools when
available and CLI otherwise. Integrating agents should exchange stable JSON
request/result files instead of depending on browser selectors.

## Request intent

A request should identify:

- kind: image or video;
- prompt;
- variations;
- aspect ratio;
- video duration when relevant;
- supported source assets;
- output directory;
- project URL/reuse preference;
- explicit `allowSpend` state.

Run capability discovery and validation before generation. Unsupported fields
must be surfaced through the settings plan rather than silently assumed.

## Result intent

Downstream agents consume:

- run ID and status;
- project URL;
- request/settings plan;
- screenshots/manual-action state;
- downloaded asset paths;
- errors and retry classification;
- review/collection report.

## Safety boundary

Never bypass login, captcha, consent, quota, safety, or rate limits. Never submit
a paid generation without explicit approval plus the runtime spend guard. Keep
credentials out of requests, logs, and project packages.

## Stable integration sequence

`doctor → capabilities → prepare/workflow → validate → generate → inspect → review → collect`

Flow is treated as one active paid generation at a time.
