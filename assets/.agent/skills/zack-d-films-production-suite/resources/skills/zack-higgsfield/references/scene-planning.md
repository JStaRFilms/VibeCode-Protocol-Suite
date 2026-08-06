# Zack Scene Planning and Edit Grammar

## 1. Shot plan

Split narration into 10-second blocks. Target 6–9 hard cuts per block. Format:

`[00.0–01.3] SIZE/ANGLE — subject + action — annotation — assets`

Vary size or angle every cut. Include at least one macro detail and one visual gag.
Every recurring subject must name its reference sheet.

## 2. Asset roster

Create stable IDs for recurring people, props, environments, and damage states.
A dependent animation block may not begin until all named sheets exist.

## 3. Animation prompt template

- State duration and aspect.
- List explicit timecoded hard cuts.
- For each cut: framing, action, camera move, annotation, and reference assets.
- Add: “Characters only emote and gesture; they do not talk or lip-sync.”
- Add audio intent: muted or diegetic-only.
- Negative: no text, logos, identity drift, duplicate limbs, melted geometry,
  unintended subjects, or unexplained scene changes.

## 4. Edit grammar

- Punch: scale about 1.00→1.08 over roughly 0.4 seconds on reveals and kicker.
- Shake: short ±1% crop jitter for about 0.3 seconds on impacts and boundaries.
- Narration starts at t=0.
- Duck useful production audio to roughly 25% beneath narration.
- Normalize near integrated -16 LUFS and true peak -1.5 dB.
- Trim to narration end plus about 0.4 seconds.
