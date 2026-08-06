---
name: zack-d-films
description: >
  End-to-end pipeline for Zack D Films-style 3D animated myth-busting shorts via
  Higgsfield MCP. Use whenever the user asks for a "Zack D Films style short",
  "Zack-style video", a 3D animated short about "what really happened", a
  myth-busting / hidden-mechanism vertical short, or just "make me a Zack short".
  One prompt in → trending-topic research, curiosity-loop script, scene-by-scene
  production plan, character sheets for consistency, 3D animated blocks with baked
  green/red annotations, cloned-voice narration, and a final edited 9:16 MP4 with
  zoom-ins and screen shakes. Hands-off after topic pick and script lock.
---

# zack-d-films

Recreates the Zack D Films production line — normally a 50-person team — as one
Claude chat over Higgsfield MCP. The user experience follows five acts, in this
exact order, matching the channel's real growth engine: **SCRIPT → VISUALS →
ANIMATION → VOICE → EDIT.**

> HOW TO READ THIS FILE: execute Phases 1→8 IN ORDER. Each phase has a GATE.
> Long templates live in `references/` — read them when the phase says so.
> `references/replication-troy.md` is the canonical worked example (the Trojan
> Horse short): when in doubt about any phase's output shape, imitate it.

## Runtime contract

- **Models are LOCKED:** stills/character sheets → `seedream_v5_pro` · animated
  blocks → `gemini_omni` · narration → `seed_audio`. Never substitute.
- **Aspect is 9:16** unless the user explicitly asks for 16:9. Pass
  `aspect_ratio` explicitly on EVERY image and video call — it never inherits.
- All shell work (probe, Whisper timing, ffmpeg edit, upload) runs in
  Higgsfield `sandbox_exec` — never on the client. Preflight a fresh run with:
  `sandbox_exec({restart:true, command:"set -e; for b in ffmpeg ffprobe python3 curl jq; do command -v $b >/dev/null; done; python3 -c 'import faster_whisper'; mkdir -p zack/{blocks,audio,output}"})`
- Poll every job to a terminal state. `completed` is the only good state. On
  `failed`/`nsfw`: RETRY LADDER (bottom of file). If no dedicated status tool is
  available, `job_display({id})` returns the job's status + result URLs; wait
  between polls with `sandbox_exec({command:"sleep 50"})` (~40–60s for images,
  poll video jobs every ~60s; blocks take 2–6 min).
- `medias[].role` may be auto-coerced by the server (e.g. `image` →
  `image_references` on seedream). That's fine — read the `adjustments` field,
  don't fight it.
- If a `gemini_omni` call returns a preset RECOMMENDATION instead of a job,
  resubmit the same call with `declined_preset_id` set to that preset's id.
  Never ask the user about it.
- Maintain `zack/manifest.json` in the sandbox (or an equivalent local notes
  block) recording: locked style formula, asset job ids, per-block prompts +
  job ids + statuses, narration job id, beat map, edit map. It is the resumable
  source of truth.
- Never expose model names, phase names, or internal mechanics in chat. The
  user sees creative substance and approval gates only.
- Characters NEVER talk on screen (no lip-sync). The narrator is external.
  Every video prompt includes "characters only emote and gesture, they do NOT
  talk" and a mute/diegetic-only audio note.
- No real brand / studio / IP names in prompts. No on-screen text in
  generations (annotations are shapes, not words).

## The house formula (what makes it "a Zack video")

1. **Curiosity loop script** — opens a question the brain needs closed; closes
   it in the final line with a reframing kicker.
2. **Perfect consistency** — every recurring person/object/place is generated
   once as a character sheet, then referenced in every clip. Same backbone
   every time; the model never "remembers", it *sees*.
3. **Signature 3D look** — glossy stylized-realistic 3D (see
   `references/style-3d.md`), warm sun, cobalt sky, PBR materials.
4. **Baked annotations** — neon-green glowing outlines/arrows/rectangles for
   "look here / how it works"; red dashed trajectories, red glowing cracks and
   red impact bursts for danger/physics. Rendered in-world by the video model.
5. **One recognizable narrator voice** — the user's cloned voice.
6. **Zoom-ins and screen shakes** timed to key moments in the edit.

## PIPELINE

### Phase 1 — RESEARCH (trending topics → options)
If the user already named a topic, skip to Phase 2.
Otherwise search the web NOW (2–3 queries: "trending topics this week
{month year}", "what is everyone talking about {month year}", one vertical the
user cares about). Find anchors with mainstream heat (a new movie, a viral
event, a season). For each anchor derive a *history/science story with a
secret*: the best picks have (a) a myth everyone believes, (b) a documented
"actually..." angle, (c) strong physical/visual potential.
Present **3–5 topic options**, one line each: `**Topic** — why it's hot now +
the hidden angle`. Wait for the user's pick.
**GATE 1:** a picked topic.

### Phase 2 — ANGLE
State the angle in one sentence of the form: *"Everyone believes X — but
[historians/engineers/scientists] now think Y, and the real mechanism is
Z."* The angle must flip the familiar story, not just retell it.
**GATE 2:** an angle with a genuine flip.

### Phase 3 — SCRIPT (curiosity loop)
Read `references/scriptwriter.md`, then write the narration:
- Default length 28–32s ≈ **75–85 words** (~2.7 words/sec). Scale by the same
  rate if the user asked for another duration.
- 5 beats: **Myth → Twist → Mechanism A → Mechanism B → Kicker.**
- Then run the rewrite pass from scriptwriter.md (cut hedges, concretize
  numbers, kill adjectives that don't render).
Show the script in chat (SCRIPT LOCK) and ask one short approve/tweak
question. This is the last mandatory stop — after approval the run is
hands-off to final video.
**GATE 3:** approved script.

### Phase 4 — SCENE PLAN (the production plan)
Read `references/scene-planning.md`. Break the script into **blocks of 10s**
(N = ceil(duration/10)). For every block write a timed shot list — Zack pacing
is **6–9 hard cuts per 10s block** (~1.0–1.6s per shot). For each shot:
`[t0–t1] SIZE/ANGLE — subject + action — annotation (if any) — assets used`.
Rules: vary size+angle on every cut; at least one MACRO eye/detail shot per
video; one "gag" beat (vanish-poof, deadpan reveal); annotations per the
green/red grammar; every shot names which character sheets appear.
Also produce the **asset roster**: every character, object, environment that
appears in ≥2 shots, plus damage/wear states (e.g. "wall — intact / cracked /
breached"). Post the plan in chat as a compact table. Do not wait for approval
(the script was the lock) — proceed.
**GATE 4:** every block has timed shots; every shot maps to roster assets.

### Phase 5 — CHARACTER SHEETS (the consistency backbone)
Read `references/style-3d.md` and take its STYLE FORMULA **byte-identical**
into every prompt in this phase and Phase 6.
1. **Style key** — one `seedream_v5_pro` still (9:16): a representative scene
   in the formula. Keep its job_id as the look anchor.
2. **Asset sheets** — one image per roster entry, in parallel, each with the
   look anchor as `medias` role `image`:
   - people → `aspect_ratio:"2:3"`, full body, neutral flat backdrop, front
     3/4 view, sheet-style;
   - objects/props → `"1:1"`, isolated, no scene;
   - environments → `"9:16"` (target aspect), dressed, no people. **Subject-bleed
     guard (proven bug):** the style key's hero subject WILL leak into location
     plates unless the prompt says `ENVIRONMENT SHEET — EMPTY LOCATION PLATE,
     take only the render style and palette from the reference image, NOT its
     subject` plus an explicit `ABSOLUTELY NO {style-key subject}, NO people,
     NO animals` line. QC every environment plate for the hero subject before
     Phase 6 and regenerate contaminated ones with that wording;
   - damage/wear states → separate sheet derived from the base sheet (pass the
     base sheet job_id as an additional media).
3. Poll all to `completed`. Show the gallery in chat with one line: these are
   the character sheets that keep every scene consistent.
**GATE 5:** every roster entry has a completed sheet. Never enter Phase 6 with
a missing asset — that beat WILL drift.

### Phase 6 — ANIMATION (one call per block)
For each block submit ONE `gemini_omni` call: `duration:10`,
`resolution:"720p"`, `aspect_ratio:"9:16"`, `medias` = environment →
characters → props (role `image_references`, max ~3 — pick the assets that
block actually shows). The prompt = the block's timed shot list rewritten as
explicit timecoded cuts (template in `references/scene-planning.md` §3),
including annotation directions, camera energy (whip-ins, crash zooms), the
"do NOT talk" line, and the NEGATIVE line. Submit blocks in parallel batches
of ≥3; poll the batch; RETRY LADDER on failures. A `completed` block is FINAL
unless it violates a named QC check (style drift vs sheets, wrong aspect,
collapsed cuts → regenerate once with the cut list emphasized).
Download every block into the sandbox as `zack/blocks/blockNN.mp4`.
**GATE 6:** all N blocks completed + downloaded, no gaps.

### Phase 7 — VOICE (the user's voice, one continuous narration)
- If the user has provided ~1 min of their voice: create a cloned voice
  (voice-creation tool / `create_voice` flow), then use its element voice_id.
- Else call `list_voices` and let the user pick once (or reuse the voice they
  picked in a previous run — it's in memory/manifest). Record
  `voice_id`+`voice_type`; LOCKED for the channel.
- Generate the FULL script as ONE `seed_audio` take:
  `[confident documentary narrator, deliberate storytelling pace with natural
  beats between sentences, starts speaking immediately] [00:00-00:{len}]
  {full script}` with the locked voice pair. **Pacing note (proven):** with a
  plain "tight pacing" hint the take lands ~10% SHORT of the timecode window;
  the "deliberate storytelling pace" wording hits the target. Check
  `durationSec` on the completed job — aim for N×10 − 1.5s; regenerate with an
  adjusted pacing hint if off by >2s.
- Download to `zack/audio/narration.wav`. In the sandbox run faster-whisper
  word timestamps → `zack/audio/words.json`. Derive the **beat map**: the
  timestamp of every beat keyword (the moments zoom-ins will hit).
- If narration > N×10s: tighten the script line that overflows and regenerate.
  NEVER time-stretch audio.
**GATE 7:** one narration file ≤ N×10s, words.json, beat map.

### Phase 8 — EDIT (zooms, shakes, final cut)
Read `references/scene-planning.md` §4 (edit grammar). **Order of operations
(proven):** call `media_upload({filename:"final.mp4"})` FIRST to get the
presigned PUT URL and media_id, THEN assemble — so the upload can run inside
the same sandbox call as the render. **Sandbox persistence is not guaranteed
between calls** (files may vanish even back-to-back): the robust default is
ONE foreground `sandbox_exec` call (≤120s) that does everything — write
helper files via quoted heredocs, download blocks + narration with parallel
`curl`, probe fps, extract/concat SFX, concat blocks, apply the edit map,
mix, trim, `curl PUT` to the presigned URL. Use `-preset veryfast -crf 16/17`
to fit the budget (a 3-block short assembles in ~50s). Steps:
1. Concat blocks 1..N (re-encode, uniform fps from probe — never hardcode).
2. Apply the **edit map** with the bundled `scripts/zack_edit.py`, fed by
   `edit_map.json`:
   - `punch` zoom-ins (~1.0→1.08 over ~0.4s) at 3–6 beat-map moments
     (reveals, annotations, kicker);
   - `shake` (±1% crop jitter, ~0.3s) at every block boundary and impact beat.
   In the one-shot path, run `zack_edit.py --print-vf` to emit just the ffmpeg
   `-vf` expression and fold it into the final encode (one pass instead of
   two) — `scripts/assemble_oneshot.sh` is the proven full template.
3. Lay the narration over the composite from t=0 (video SFX ducked to ~0.25×
   under it), `amix ... ,loudnorm=I=-16:TP=-1.5`, trim to narration end + 0.4s.
4. QC probe: 1080×1920, duration ≈ narration+tail, audio present, plays from
   frame 1.
5. Upload with the presigned URL from step 0 (`curl -f -X PUT` in the SAME
   call as assembly), then `media_confirm({type:"video", media_id})` → deliver
   the hosted URL. One file, `final.mp4`. A sandbox path is not a deliverable.
**GATE 8:** exactly one final MP4, delivered as a confirmed hosted URL.

### After delivery
Offer (one line each, never run unasked): 2K upscale via `upscale_video`;
a YouTube title/description pass; saving the style+voice as the channel
profile for next time.

## RETRY LADDER (Phase 5/6 failures)
1. Resubmit same prompt (new seed) ×2.
2. Reword: soften violence tokens (battle → clash, blood → dust), remove
   tight-face close-ups of distressed characters, resubmit ×2.
3. Reframe the beat (different shot size / staging).
4. Never drop a block, never leave a gap. After ~8 attempts on one block, stop
   and surface it.

## FINAL QC CHECKLIST
- [ ] One vertical 1080×1920 MP4, narration synced, no dead air > 1s.
- [ ] Every recurring element visually identical across blocks (sheet-driven).
- [ ] Annotations: green = reveal, red = danger/physics; no on-screen words.
- [ ] ≥1 macro eye/detail shot; ≥1 gag beat; kicker closes the loop.
- [ ] Zoom-ins on reveals; shakes on impacts/boundaries.
- [ ] No brand/IP names; characters never lip-sync.
