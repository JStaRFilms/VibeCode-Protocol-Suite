---
name: creative-web-development
description: Use when originating, planning, building, or auditing distinctive creative web experiences. Routes sparse briefs through concept selection before choosing motion, Canvas, WebGL, 3D, or implementation architecture.
author: J StaR Films / Takomi
coauthored: J StaR Films / Takomi
version: 3.2.0
---

# Creative Web Development

Create experiences with a clear visual idea and carefully selected technology that makes that idea possible.

Treat creative direction and creative engineering as separate decisions. Establish what the experience means, how it should feel, and what visitors need before selecting implementation techniques.

## Route the Request

Classify the request before producing a plan or changing code.

| Request state | Route |
|---|---|
| Sparse brief; the user wants ideas, a direction, or a plan | Read [references/creative-direction.md](references/creative-direction.md), then [references/concept-evaluation.md](references/concept-evaluation.md). |
| Evidence-rich history, case study, launch story, or project retrospective | Read [references/story-engineering.md](references/story-engineering.md), then [references/concept-evaluation.md](references/concept-evaluation.md). |
| The user already supplied a governing concept or detailed art direction | Preserve it and continue at **Experience Architecture**. |
| The user asks for one technique, implementation, or bug fix | Route directly to the relevant technical reference. Do not redesign the experience. |
| The user asks for a creative audit | Read [references/concept-evaluation.md](references/concept-evaluation.md); add [references/performance-and-profiling.md](references/performance-and-profiling.md) only when implementation exists. |

## Reference Loading Contract

The router selects references; selection makes reading them mandatory. Do not substitute prior knowledge, remembered APIs, summaries, implementation examples, or the main skill for the current reference files.

1. Build a **Reference Manifest** listing every capability the task requires and the reference that governs it.
2. Read every selected reference completely before making detailed decisions or writing code.
3. Record a compact **Reference Receipt** with the file path and at least one non-obvious constraint from that file that changes the plan or implementation.
4. If a new capability enters scope, pause that part of the work, add its reference to the manifest, and read it before continuing.
5. Read [references/performance-and-profiling.md](references/performance-and-profiling.md) whenever the solution includes an animation loop, smooth-scroll orchestration, Canvas, WebGL, shaders, frame sequences, or persistent media.
6. Read each domain reference before consulting [references/examples.md](references/examples.md). Recipes illustrate implementation after a decision; they do not replace domain instructions.

For integrated work, load every participating domain reference. A shader-driven Three.js scrollytelling experience, for example, requires the motion, Three.js, shader, and performance references—not whichever file the agent already knows best.

Keep the receipt brief, but make it observable in the plan, working notes, or progress update. Never claim a reference was loaded unless the complete current file was read.

A receipt proves that a reference was consulted, not that the finished work complies with it. Treat every recorded constraint as binding through the final response. Before delivery, run the **Constraint Audit** in Phase 5 and revise contradictions instead of merely reporting them.

### Reference Gate

- [ ] Manifest covers every requested capability.
- [ ] Every selected reference was read completely.
- [ ] Receipt records an applied constraint from each selected reference.
- [ ] No detailed plan or implementation relies on an unread routed reference.

Do not force every request through cinematic scrollytelling. Utility sites, editorial compositions, product demonstrations, spatial experiences, and narrative case studies require different structures.

## Deliverable Boundary

Lock the stopping point before selecting references.

For a concept, direction, or plan-only request:

- Load only the routed concept, story, or evaluation references. Do not load technical domain references merely to make the plan sound complete.
- Stop after **Experience Architecture**. Do not provide frameworks, dependencies, rendering architecture, implementation recipes, API or telemetry designs, shader or animation formulas, performance budgets, code-level timings, or build phases.
- Describe motion as an experiential rule and technology as an unresolved implementation question. Technical translation begins only when the user requests or approves implementation.

Loading technical references or appending an implementation blueprint does not demonstrate ambition in a plan-only task; it violates the request contract.

### Boundary Gate

- [ ] Selected references match the requested deliverable.
- [ ] The response stops at the locked phase.
- [ ] No later section quietly expands into implementation.

## Phase 0: Establish the Request Contract

1. Determine the requested deliverable: concept, plan, build, focused implementation, or audit.
2. Separate supplied facts from assumptions and unknowns. Preserve unknowns instead of inventing business claims, metrics, addresses, prices, services, awards, APIs, or live data.
3. Identify the visitor's primary jobs and the information that must remain immediately usable.
4. Record hard constraints: brand assets, content, accessibility, platform, performance, schedule, and available media.

When the user asks for a plan only, stop after **Experience Architecture**. Return creative decisions and rationale without code, dependency lists, shader formulas, or implementation scaffolding.

Create a compact **Fact Trace** for operational details that appear in the proposed experience. Each business name, address, price, schedule, metric, service, amenity, policy, award, historical claim, integration, and live-data capability must be one of:

- **Known**: supplied or verified, with its source identified.
- **Provisional**: necessary to explain the design and marked as provisional at the point of use.
- **Unknown**: retained as a content requirement or placeholder, never presented as an actual feature or customer-facing claim.

Examples may illustrate an interaction only when visibly labelled as examples. A truth-ledger disclaimer at the beginning does not authorize invented specifics later in the plan.

### Completion Gate

- [ ] Deliverable and stopping point are explicit.
- [ ] Facts, assumptions, and unknowns are distinguishable.
- [ ] Every operational detail in the proposed experience is traceable and labelled at its point of use.
- [ ] Visitor jobs and non-negotiable utility are identified.

## Phase 1: Establish the Governing Concept

For a sparse brief, execute the divergence and selection method in [references/creative-direction.md](references/creative-direction.md). Evaluate candidates with [references/concept-evaluation.md](references/concept-evaluation.md).

For an evidence-rich story, use [references/story-engineering.md](references/story-engineering.md). Apply its narrative methods only when the material contains real events, proof, change, or discovery.

If the user supplied a concept, test it for domain truth, ownability, coherence, utility, and interaction necessity before extending it. Strengthen weak links without replacing the user's direction.

Ambition means a stronger governing idea, more meaningful relationships between elements, and a more resolved experience. It does not mean maximizing effects, libraries, scenes, particles, or technical terminology.

### Completion Gate

- [ ] One governing concept is stated in a single memorable sentence.
- [ ] The concept arises from the subject rather than a reusable creative-web trope.
- [ ] The signature interaction expresses the concept and supports the visitor's journey.
- [ ] Factual claims remain supplied, verified, or explicitly provisional.

## Phase 2: Design the Experience Architecture

Choose the structure that best serves the concept and visitor jobs:

- **Utility journey** for fast decisions, visits, bookings, purchases, or contact.
- **Editorial composition** for interpretation, browsing, and typographic hierarchy.
- **Narrative progression** for evidence-rich transformations and case studies.
- **Product demonstration** for mechanisms, benefits, comparison, and conversion.
- **Spatial exploration** when navigation through an environment is essential to the premise.
- **Hybrid structure** when utility must remain immediately available around an expressive core.

Define:

1. Content hierarchy and persistent utility.
2. Composition, typography, imagery, material, and color rules.
3. A motion law describing how the visual world behaves.
4. One signature interaction and only the secondary interactions required to support it.
5. Desktop, touch, keyboard, reduced-motion, and low-capability expressions of the same concept.
6. The sequence of states or sections. Use cinematic shots only when a continuous time-based journey materially strengthens the idea.

### Completion Gate

- [ ] Structure follows visitor needs and concept rather than a default page template.
- [ ] Visual, motion, interaction, and content decisions express the same premise.
- [ ] Mobile and accessibility preserve the concept instead of merely removing effects.
- [ ] The plan states what will remain deliberately simple.

## Phase 3: Translate the Concept into Technology

Enter this phase only when implementation is requested or approved. Choose the smallest technical system capable of realizing the concept.

| Required behavior | Consult |
|---|---|
| Canonical creative-development vocabulary | [references/terminology.md](references/terminology.md) |
| Kinetic typography, GSAP, Lenis, ScrollTrigger, page transitions | [references/motion-and-scroll.md](references/motion-and-scroll.md) |
| Canvas typography, particles, force fields, pixel buffers | [references/canvas-and-particles.md](references/canvas-and-particles.md) |
| Three.js, React Three Fiber, GLTF, cameras, lighting | [references/threejs-and-r3f.md](references/threejs-and-r3f.md) |
| GLSL distortion, displacement, procedural noise | [references/shaders-and-glsl.md](references/shaders-and-glsl.md) |
| Baked frame sequences and hybrid 3D cinematics | [references/hybrid-3d-cinematics.md](references/hybrid-3d-cinematics.md) |
| Runtime budgets, degradation, teardown, profiling | [references/performance-and-profiling.md](references/performance-and-profiling.md) |
| Complete implementation recipes | [references/examples.md](references/examples.md), after architecture is chosen |

Prefer semantic DOM and CSS for content and layout. Add Canvas or WebGL only where the concept requires continuous visual computation, spatial rendering, or pixel-level behavior. Do not load implementation examples during concept generation; examples are engineering references, not art direction.

### Completion Gate

- [ ] Every selected technology has a concept-linked responsibility.
- [ ] Simpler alternatives were considered before adding GPU or scroll orchestration.
- [ ] Content and primary actions remain available without the enhanced rendering layer.

## Phase 4: Build a Coordinated System

1. Establish semantic content, responsive layout, and accessible controls first.
2. Model user input as state that drives the chosen visual behavior instead of accumulating disconnected event-triggered effects.
3. Coordinate DOM, Canvas, WebGL, and sound through the minimum number of clocks and state owners.
4. Implement the signature interaction before secondary motion. Remove secondary effects that weaken its prominence.
5. Add capability-aware fallbacks and teardown alongside each enhanced system.

Use only the technical references required by the selected architecture.

### Completion Gate

- [ ] The signature interaction works and communicates the governing concept.
- [ ] Animation systems share explicit timing and state ownership.
- [ ] Keyboard, touch, reduced-motion, and low-capability paths remain complete.

## Phase 5: Verify Concept and Implementation

Run the evaluation in [references/concept-evaluation.md](references/concept-evaluation.md) against the finished plan or experience. When implementation exists, also run the relevant checks in [references/performance-and-profiling.md](references/performance-and-profiling.md).

Before delivering any output, run a compact **Constraint Audit**:

1. Revisit every Reference Receipt constraint and locate the decision that applies it.
2. Compare the final work with the deliverable boundary and Fact Trace.
3. Treat any contradiction, unlabelled operational claim, or scope expansion as a failure to revise—not a caveat to disclose.
4. Re-read a governing reference when the audit exposes uncertainty; do not rely on the earlier receipt.

For a plan, record the audit result briefly: reference compliance, factual integrity, and boundary compliance. Do not call the plan compliant while listing unresolved violations.

Delete effects, abstractions, and technologies that do not strengthen meaning, usability, or execution quality.

### Completion Gate

- [ ] The experience is recognizable from its governing idea, not merely its effects.
- [ ] Replacing the subject with another noun would break the concept.
- [ ] Important visitor tasks remain fast and obvious.
- [ ] Every receipt constraint remains observable in the finished work.
- [ ] Operational claims pass the Fact Trace and the deliverable remains inside its locked boundary.
- [ ] Relevant accessibility, performance, and resource-lifecycle checks pass.
