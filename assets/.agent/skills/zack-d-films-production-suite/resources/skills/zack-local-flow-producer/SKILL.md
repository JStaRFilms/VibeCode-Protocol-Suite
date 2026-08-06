---
name: zack-local-flow-producer
description: >
  Computer-side execution skill for a locked Zack Production Package. Validates
  the browser agent's handoff, calls the separate TakomiFlow provider for Google
  Flow image/video generation, manages narration and local editing, records all
  deviations, and delivers the final short without repeating approved research.
---

# Zack Local Flow Producer

## Role

You are the production executor. The supplied package is the creative source of
truth. You generate, review, download, narrate, edit, and deliver. You do not
silently rewrite the angle, script, asset identities, scene order, or factual
claims.

Read before execution:

1. `../../shared/contracts/zack-production-package.md`
2. `../../shared/contracts/zack-production-package.schema.json`
3. `../takomi-flow/SKILL.md`

TakomiFlow is a provider, not a competing controller.

## Input

Accept either:

- a project folder containing `handoff.json`; or
- a ZIP that extracts to such a folder.

Do not treat pasted prose as equivalent to a package when required files are
missing. Report missing files precisely.

## Phase 0 — Preserve and validate

1. Copy/extract the package into a working project directory.
2. Treat the source package as read-only after lock.
3. Run the bundled validator:

```bash
python <suite>/resources/shared/scripts/validate_handoff.py <project>/handoff.json
```

4. Verify paths, generation counts, dependencies, approval fields, and package
   status.
5. Create a separate `<project>/execution/manifest.json` with status
   `PREFLIGHT`, timestamps, provider state, tool versions, run IDs, output paths,
   QC, and deviations.

A `DRAFT` package may be inspected and converted into no-spend request files,
but no paid generation may be submitted. `LOCKED_FOR_PRODUCTION` plus explicit
provider spend approval is required for paid execution.

## Phase 1 — Provider readiness

Use the TakomiFlow module's preferred MCP tools when available and CLI fallback
otherwise.

- Run `doctor` and `capabilities`.
- Use `observe` when browser/UI state is uncertain.
- Reuse trusted Chrome and the current/specified Flow project when possible.
- Reuse `provider.projectUrl` when present.
- Never automate credentials or bypass login, captcha, consent, quota, safety,
  or rate-limit gates.
- Never install or repair global plugin files without telling the user the path
  and obtaining approval.

Compare requested settings against current capabilities. Record unsupported
settings in `execution/deviations.json`; choose the closest safe mapping only
when it preserves creative intent. Do not silently switch provider.

## Phase 2 — Build executable requests

Read `production/generation-queue.json` in order. Resolve each source asset ID to
an accepted local file before scheduling a dependent job.

For every job:

1. read its prompt file and acceptance checks;
2. map portable settings to the current TakomiFlow request schema;
3. prepare and validate the request without spending;
4. record the request path and settings plan;
5. submit only when package approval and runtime spend guard both permit it.

Treat Flow as one active paid generation at a time. Do not submit parallel jobs.

## Phase 3 — Style and asset generation

Execute the queue's image jobs sequentially:

1. style key;
2. people/character sheets;
3. props;
4. empty environment plates;
5. derived damage/wear states.

For each job: generate, inspect, review, and collect. Accept only outputs that
meet the package's named checks. Reject contamination, wrong aspect, missing
body parts, identity drift, unwanted text, or environment subject bleed.

Save accepted files under `<project>/execution/assets/` and map stable asset IDs
to exact paths in the execution manifest.

## Phase 4 — Video blocks

Execute video jobs sequentially. Supply only supported source references and
preserve the package's timecoded cut instructions.

Every video prompt must retain:

- explicit duration and aspect ratio;
- timecoded cuts;
- named asset identity cues;
- green/red annotation grammar;
- camera energy;
- characters only emote/gesture and do not speak;
- no generated words;
- the package's negative constraints.

After each run, inspect and collect the output to
`<project>/execution/blocks/blockNN.mp4`. Retry only for a named QC failure.
Record each retry and prompt deviation. Never skip a failed block.

## Phase 5 — Narration adapter

TakomiFlow is not assumed to provide voice cloning.

Use this order:

1. user-supplied narration;
2. an approved existing cloned-voice/TTS tool exposed to the local agent;
3. an approved standard voice;
4. a narration handoff if no voice tool exists.

Generate the full script as one take. Do not time-stretch. Aim to fit within the
planned visual duration with a short ending tail. Save narration under
`<project>/execution/audio/`.

Use Whisper/faster-whisper when available to create word timestamps and a beat
map. Otherwise derive approximate sentence timing and mark it as approximate.

## Phase 6 — Local edit

Use local FFmpeg or another explicitly approved editor. Default output:
1080×1920 MP4.

1. Probe and normalize block frame rates/resolution.
2. Concatenate blocks in queue order.
3. Apply `production/edit-map.json`:
   - punch-ins at reveals and kicker;
   - short shakes at impacts and block boundaries.
4. Place narration at t=0.
5. Duck or mute generated audio beneath narration as specified.
6. Loudness-normalize around integrated -16 LUFS and true peak -1.5 dB.
7. Trim to narration end plus the package tail.
8. Export `<project>/execution/output/final.mp4`.

Do not add new factual text or rewrite the story during editing.

## Phase 7 — Final QC and delivery

Check:

- expected aspect, resolution, duration, and audio stream;
- no missing or duplicate blocks;
- recurring elements remain recognizably consistent;
- no lip-sync or generated on-screen words;
- annotations follow the green/reveal and red/danger grammar;
- narration is synchronized and no dead air exceeds one second;
- macro/detail and gag beats survived generation/editing;
- every deviation is documented.

Set the execution manifest to `COMPLETE` only after the final file passes QC.
Deliver the actual file plus a concise execution report. Keep the original
locked package unchanged.

## Retry and escalation

Classify failures before retrying:

- still running/queued;
- stale UI text with media already ready;
- browser selector/UI drift;
- generation quality failure;
- safety refusal;
- login/captcha/consent/quota/manual gate;
- unsupported requested setting;
- local editing/tool failure.

Retry bad creative output once unchanged, then simplify/re-stage without changing
the factual beat. Use TakomiFlow `observe` before assuming selectors broke. Stop
and report after repeated failure rather than burning unapproved credits.
