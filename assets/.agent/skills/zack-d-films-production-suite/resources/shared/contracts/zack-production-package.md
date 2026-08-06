# Zack Production Package Contract

Version: `1.0`

This contract separates browser-side creative planning from computer-side
execution. The package is portable and provider-aware without embedding browser
selectors, credentials, or unstable provider internals.

## Ownership

- The **browser planner** owns research, factual claims, angle, narration, scene
  design, prompt intent, generation order, acceptance criteria, and package lock.
- The **local producer** owns provider mapping, generation runs, downloads,
  narration execution, editing, QC, delivery, and deviation logging.
- The **TakomiFlow provider** owns Google Flow browser operations only.
- A locked source package is immutable. Execution state goes under `execution/`.

## Required project tree

```text
zack-project/
├── HANDOFF.md
├── handoff.json
├── package-manifest.json              # recommended after lock
├── research/
│   ├── sources.json
│   ├── claims.json
│   └── research-summary.md
├── script/
│   ├── narration.txt
│   └── timed-script.json
├── production/
│   ├── scene-plan.json
│   ├── asset-roster.json
│   ├── generation-queue.json
│   ├── edit-map.json
│   └── qc-checklist.json
└── prompts/
    ├── style-key.txt
    ├── assets/
    └── blocks/
```

## State rules

- `DRAFT`: package can change and may not trigger paid generation.
- `LOCKED_FOR_PRODUCTION`: script and production plan are frozen.
- The local agent writes `EXECUTING` and `COMPLETE` only to
  `execution/manifest.json`; it does not mutate `handoff.json`.

## Approval rules

- `scriptLocked` is true only after explicit script approval.
- `productionPlanLocked` is true only after the user approves or explicitly
  delegates final planning authority.
- `flowCreditSpendApproved` is true only after explicit authorization to spend
  Flow credits for the recorded budget.
- A package may be locked while spend approval remains false. The local agent may
  validate and prepare requests, but not submit paid generations.

## Paths

All paths stored in JSON must be relative to the package root, use forward
slashes, and must not contain `..`, drive letters, or absolute roots.

## Research traceability

Every material narration claim should list one or more source IDs. Sources hold
URLs and metadata; prompt files should not contain long quotations. Uncertainty
must be preserved rather than turned into certainty for drama.

## Portable generation jobs

Jobs express intent and dependencies, not fragile UI selectors. Provider modules
map them to current capabilities. Each job must have a stable ID, kind, prompt
path, requested media properties, dependencies, acceptance checks, and credit
flag.

## Deviations

The local producer records any mapping or prompt change in
`execution/deviations.json` with:

- job ID;
- original requirement;
- executed change;
- reason;
- whether creative meaning changed;
- approval obtained, when required.

Provider switches and material factual/script changes always require user
approval.
