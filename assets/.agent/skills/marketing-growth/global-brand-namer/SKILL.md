---
name: global-brand-namer
description: Generate memorable, brandable product and SaaS names using global linguistics (African, Asian, Nordic, Indigenous, and classical languages) to bypass English domain saturation. Use when the user asks to brainstorm product names, find available domains, develop cross-cultural brand identity, name a startup or side project, or needs a distinctive tech brand name that isn't just another English portmanteau. Triggers include "name my product," "brand name ideas," "domain name brainstorm," "SaaS name," "startup name," "what should I call," "name generator," or any request for creative, globally-inspired naming.
---

# Global Brand Namer

Generate premium, cross-culturally resonant brand names by mining non-English vocabulary and pairing with strategic domain modifiers. This skill transforms generic naming sessions into systematic linguistic exploration.

## Core Naming Principles

1. **Phonetic Fluidity** - The word must be easily pronounceable by an English-speaking audience without phonetic training. Avoid heavy consonant clusters, tonal requirements, or characters that don't transliterate cleanly.
2. **Domain Viability** - Assume all raw, single words (e.g., *Takumi*, *Agbara*) are squatted. Always pair the base word with a strategic modifier. See `references/saas-modifiers.md`.
3. **Syllabic Brevity** - Target 2-3 syllables maximum for the base word. One-syllable words work if they're distinctive.
4. **Semantic Depth** - The meaning behind the word should resonate with the product's purpose. A name with real meaning creates richer brand storytelling.
5. **Cross-Lingual Safety** - Verify the transliterated word doesn't mean something offensive in major world languages (English slang, Spanish, French, Portuguese, Mandarin).

## Workflow

### Step 1: Distill the Core Concept

Extract 2-4 English keywords capturing the product's function, feeling, or identity.

**Prompting questions:**
- What does the product DO? (build, connect, analyze, create)
- What FEELING should it evoke? (speed, trust, power, calm)
- Who is the audience? (developers, creators, enterprise, consumers)
- What's the competitive landscape? (crowded SaaS, niche tool, consumer app)

**Example:** A developer workflow tool might yield: *build, flow, craft, forge*

### Step 2: Linguistic Translation & Exploration

Translate concepts across diverse language families. Select language categories that match the project's aesthetic.

**Reference:** Load `references/language-matrices.md` for full language-to-aesthetic mapping.

Quick selection guide:

| Project Vibe | Best Language Families |
|---|---|
| Dev tools / Infrastructure | Japanese, Nordic, Latin, German |
| Creative / AI / Workflows | Yoruba, Sanskrit, Maori, Swahili |
| Minimalist SaaS / Analytics | Mandarin (Pinyin), Esperanto, Finnish |
| Community / Social | Zulu, Hawaiian, Portuguese, Tagalog |
| Security / Trust | Arabic, Norse, Latin, Greek |

### Step 3: Phonetic Filtering

Discard any translations that fail these checks:

- [ ] Can a native English speaker spell it after hearing it once?
- [ ] Is it <= 3 syllables?
- [ ] Does it avoid unfortunate homophones in English, Spanish, French, or Portuguese?
- [ ] Does it NOT require diacritics or special characters for the domain?
- [ ] Is it distinct from existing major brands?

### Step 4: Modifier Integration

Attach industry-standard structural words to create a viable, registrable domain.

**Reference:** Load `references/saas-modifiers.md` for the full modifier taxonomy.

Quick modifier selection:

| Product Type | Recommended Modifiers |
|---|---|
| Dev tools / APIs | Protocol, Core, Syntax, OS, Kit |
| Creative tools | Forge, Labs, Studio, UI, Works |
| Consumer apps | Get, Use, Run, App, Try |
| Enterprise / Platform | HQ, Cloud, Suite, Base, Stack |

### Step 5: Output Formatting

Present results in a structured grid:

```
## Name Suggestions for [Product]

### Tier 1: Top Picks
| # | Name | Base Word | Origin | Meaning | Domain Suggestion | TLD Options |
|---|------|-----------|--------|---------|-------------------|-------------|
| 1 | KodoForge | Kodo | Japanese | Heartbeat / Pulse | kodoforge.dev | .dev, .io |
| 2 | SareLabs | Sare | Yoruba | Run / Speed | sarelabs.com | .com, .io |
| 3 | VahvaKit | Vahva | Finnish | Strong / Robust | vahvakit.dev | .dev, .com |

### Tier 2: Strong Alternatives
[... more options ...]

### Tier 3: Creative Wild Cards
[... experimental options ...]

## Recommendation
[Top pick with rationale]
```

**Always generate at minimum 10 names across all tiers.**

## Constraints

- **Never** suggest exact-match `.com` domains for single dictionary words without a disclaimer about extreme cost/unavailability.
- **Never** use words with heavy cultural/religious significance (e.g., *Karma*, *Nirvana*, *Allah*, *Dharma*) unless the brand explicitly operates in that cultural space.
- **Always** verify the transliterated word doesn't clash with English slang, profanity, or brand names.
- **Always** present at least 3 TLD options per suggestion (.com, .dev, .io, .ai, .app, .co).
- **Flag** any name where cultural appropriation risk exists with a `[!] Cultural Note` callout.

## Pre-Mortem Checklist

Before finalizing any name, run through these risk checks:

1. **Cultural Appropriation** - Is the word sacred, ceremonial, or deeply tied to a marginalized group's identity? If yes, flag it.
2. **Transliteration Drift** - Does the Romanized spelling diverge enough from the original to lose meaning or create confusion?
3. **Accidental Homophones** - Cross-check against Spanish, French, Portuguese, German, and Mandarin for unintended meanings.
4. **Trademark Collision** - Does a quick mental scan suggest overlap with existing tech brands?
5. **Verbal Shareability** - Can someone say "Check out [Name]" in a conversation and have the listener spell it correctly?

## Integration with Domain Brainstormer

This skill complements the `domain-name-brainstormer` skill. Use **this skill** when the creative direction is "linguistically rich, globally inspired names." Use `domain-name-brainstormer` for straightforward English-based domain availability checking.
