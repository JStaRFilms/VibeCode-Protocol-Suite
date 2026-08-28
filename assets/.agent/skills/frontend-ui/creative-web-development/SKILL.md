---
name: creative-web-development
description: Use when engineering high-end creative web experiences using Three.js/R3F, GLSL shaders, Canvas 2D particle physics, GSAP ScrollTrigger, Lenis, or hybrid Blender frame scrubbing.
author: J StaR Films / Takomi
coauthored: J StaR Films / Takomi
version: 2.0.0
---

# Creative Web Development: Master Operational Framework

An authoritative engineering methodology for constructing interactive, GPU-accelerated digital experiences where user input drives unified visual computation pipelines across the DOM, Canvas 2D, Three.js, and GLSL shaders.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              INPUT-TO-COMPUTATION ENGINE                               │
├────────────────────────────┬─────────────────────────────┬─────────────────────────────┤
│        INPUT STAGE         │  STATE & INTERPOLATION      │ COMPUTATION & RENDER STAGE  │
│  - Pointer (Coords, Vel)   │  - Damping & Spring Physics │  - DOM 3D & Mask Clipping   │
│  - Wheel / Touch (Lenis)   │  - Virtual Playhead (GSAP)  │  - Canvas 2D Pixel Buffers  │
│  - Viewport (Scroll, SVH)  │  - GPU Uniforms (uMouse)    │  - Three.js / R3F Meshes    │
│  - Central RAF Ticker      │  - Projection Matrix (FOV)  │  - GLSL Vertex / Fragment   │
└────────────────────────────┴─────────────────────────────┴─────────────────────────────┘
```

For canonical domain terminology and anti-synonyms, see [references/terminology.md](references/terminology.md).  
For complete end-to-end production recipes, see [references/examples.md](references/examples.md).

---

## Master Decision Matrix & Technology Router

Match the experience goal to its specialized reference blueprint:

| Experience Goal | Primary Tech Stack | Reference Architecture |
|---|---|---|
| **Story Engineering & Narrative Rails** | Contradictions & Q&A Relays | [references/story-engineering.md](references/story-engineering.md) |
| **Domain Glossary & Anti-Synonyms** | Canonical Terminology | [references/terminology.md](references/terminology.md) |
| **Kinetic Typography & Staggers** | GSAP 3, SplitText, 3D CSS | [references/motion-and-scroll.md](references/motion-and-scroll.md) |
| **Synchronized Smooth Scroll** | Lenis, ScrollTrigger, Pinning | [references/motion-and-scroll.md](references/motion-and-scroll.md) |
| **Sand/Dust Text & Particle Physics** | Canvas 2D, ImageData, Springs | [references/canvas-and-particles.md](references/canvas-and-particles.md) |
| **Interactive 3D Product Viewports** | Three.js, R3F, DRACO GLTF | [references/threejs-and-r3f.md](references/threejs-and-r3f.md) |
| **GPU Distortion & Noise Shaders** | WebGL, GLSL, Simplex/FBM/Curl | [references/shaders-and-glsl.md](references/shaders-and-glsl.md) |
| **Hybrid Baked Video + WebGL** | Blender Cycles, Canvas Scrub | [references/hybrid-3d-cinematics.md](references/hybrid-3d-cinematics.md) |
| **Performance & Memory Audits** | DPR Clamping, InstancedMesh | [references/performance-and-profiling.md](references/performance-and-profiling.md) |
| **End-to-End Production Recipes** | HTML/JS/CSS Blueprints | [references/examples.md](references/examples.md) |

---

---

## Phase 0: Story Engineering, Creative Direction & Bespoke Storyboarding

Before authoring code or visual layouts, run the **Story Engineering Brain** to extract the core narrative, tension, and visual metaphors. Do not default to generic section clichés (`Hero → About → Process → Contact`).

For detailed narrative extraction workflows, see [references/story-engineering.md](references/story-engineering.md).

### 1. Execute the 6-Stage Narrative Extraction Pipeline
1. **Factual Archaeology**: Extract what actually happened from project milestones, research, and data. Identify dramatic scale numbers (e.g. *45 sources, 752 pages, 44 skills, 1 winner*).
2. **Core Transformation**: Define the three-part arc: $\text{BEFORE (Status Quo)} \to \text{CHANGE (Catalyst)} \to \text{AFTER (New Reality)}$.
3. **Contradiction & Driving Question**: Find the core tension (e.g. *"We used AI to escape AI-looking design"*) and formulate the single forward-motion Driving Question (*"Can a machine learn taste?"*).
4. **Question-Answer Relay**: Chain narrative beats so every shot answers one question and immediately creates the next.
5. **Emotional Modulation & Visual Metaphors**: Alternate emotional registers (`WONDER` $\to$ `TECHNICAL CURIOSITY` $\to$ `SCALE` $\to$ `SUSPENSE` $\to$ `VULNERABILITY` $\to$ `EXPLOSION` $\to$ `MYSTERY`) and translate abstract code concepts into physical 3D phenomena.
6. **Protect the Reveal**: Strictly gate the climax or final breakthrough artifact—never spoil the destination in the opening shot.

### 2. Enforce Anti-Trope Color Palettes
- **Banned Tropes**: Generic "AI purple / neon violet" glows, dark-mode obsidian clichés, and gradient-bordered glass cards.
- **Mandated Direction**: Ground the aesthetic in physical materials with 4–6 named hex tokens (e.g., Titanium Slate `#0F1113`, Chalk Bone `#EDE8DE`, Precision Safety Orange `#FF4800`, Matte Carbon `#0D0E10`, Terracotta `#C86432`, Raw Platinum `#E5E9EC`).

### 3. Author the Bespoke Multi-Shot Storyboard (4 to 10+ Shots)
Formulate the experience as a **bespoke sequence of 4 to 10+ cinematic shots** where normalized scroll progress ($0\% \to 100\%$) drives a continuous virtual playhead ($t = 0.0s \to 10.0s+$).

For every shot, define the 4 synchronized tracks:
1. **Camera Track** (Focal vector, dolly zoom, 3D tilt, or lateral tracking)
2. **Subject Action** (Resting, deconstructing, morphing, or assembling)
3. **Typography Track** (Mask reveals, SplitText staggers, or spatial drift)
4. **Interactive & Sound Trigger** (Cursor force fields, acoustic ticks, or harmonic sweeps)

### Exemplar Storyboard Matrix (Adapt to Subject Matter):

| Scroll Interval | Shot Role (Exemplar) | Camera / Focal Vector | Subject / Mechanism Action | Typography & Motion Track | Interactive & Sound Trigger |
|---|---|---|---|---|---|
| **$0\% - 15\%$** | **Shot 1: The Inciting Question** | Fixed wide view; subtle mouse parallax | Hero object in resting state with ambient float | Split-mask Driving Question reveal | Sand/dust particle dispersion on hover; subtle tick |
| **$15\% - 30\%$** | **Shot 2: The Deconstruction** | Dolly zoom into internal geometry | Core surface unlatches; optical refraction shifts | Eyebrow caption staggers along normal vector | Cursor proximity magnetizes nearby components |
| **$30\% - 45\%$** | **Shot 3: The Gathering / Scale** | Macro 3D perspective tilt (`rotateX`, `translateZ`)| 3D document cascade / scale metrics lock in | Monumental numbers with line-by-line stagger | Scroll-pinned layer separation; mechanical click |
| **$45\% - 60\%$** | **Shot 4: The Crucible / Trial** | Top-down perpendicular scan | Competing crystalline nodes collide / glitch state | Dynamic telemetry readouts scrub across view | Audio frequency sweep modulated by velocity |
| **$60\% - 75\%$** | **Shot 5: Spatial Deep-Dive** | 90° lateral pan into horizontal track | Multi-module exploration across spatial cards | Horizontal scrub with dynamic velocity skew | Card hover magnifiers & resonant chimes |
| **$75\% - 85\%$** | **Shot 6: Diagnostic Analysis** | 3D wireframe / LIDAR cross-section | Surface toggles to holographic topology scan | Monospace readouts typewrite across view | Highpass acoustic blips |
| **$85\% - 100\%$** | **Shot 7+: Climax & Reveal (VOID/FORM)** | Center stage convergence; aperture wipe | Full interactive WebGL breakthrough canvas docks | Hero thesis statement re-converges | Aperture shutter flash; harmonic chord |

### Completion Gate
- [ ] Story Engineering completed: Core transformation, contradiction, driving question, and Q&A relay defined.
- [ ] Climax/reveal is protected until the designated final shot.
- [ ] Bespoke storyboard is authored for the specific topic (4 to 10+ shots) defining all 4 synchronized tracks.
- [ ] Color palette uses material-grounded tokens with zero generic AI purple gradients.
- [ ] Single signature interaction (e.g. sand dust typography or liquid distortion) is explicitly chosen.

---

## Phase 1: Viewport Scaffolding, High-DPI Foundation & 3D Layer Stratification

Establish the spatial layout, viewport coordinate containers, and High-DPI rendering baselines.

1. **Enforce Design Restraint & Signature Interaction**:
   - Scope the experience to one primary **signature interaction** (e.g., kinetic sand text or liquid fluid distortion) paired with purposeful secondary micro-interactions.
2. **Configure Viewport Coordinate Containers**:
   - Use `100svh` heights on full-screen containers to eliminate mobile address-bar resize jumps.
   - Establish semantic stacking strata: Base Media (`z-index: 1`), Canvas/WebGL (`z-index: 10`), DOM UI/Typography (`z-index: 20`), Navigation (`z-index: 100`).
3. **Configure Color Management & DPR Ceiling**:
   - Clamp rendering resolution: `const dpr = Math.min(window.devicePixelRatio || 1, 2.0);`.
   - Enforce `THREE.SRGBColorSpace` and `THREE.ACESFilmicToneMapping` on WebGL renderers.

### Completion Gate
- [ ] Primary signature interaction is selected and scoped.
- [ ] Viewport containers use mobile-safe `100svh` units with explicit `z-index` stacking.
- [ ] Device pixel ratio is strictly clamped to $\le 2.0$.

---

## Phase 2: Kinetic Typography & DOM Interaction Systems

Deconstruct static text into dynamic, accessible visual objects using character splitting and overflow clip bounds.

1. **Synchronize Font Ingestion**:
   - Defer text measurement and splitting until font glyphs are loaded:
     ```javascript
     document.fonts.ready.then(() => initializeTypography());
     ```
2. **Decompose Text into Masked Hierarchies**:
   - Split typography targeting only the animated hierarchy (`type: 'lines,words,chars'`) with `smartWrap: true` and `autoSplit: true`.
   - Apply outer container masks (`.line-mask { overflow: hidden; display: block; }`) and inner character reveals (`.char { display: inline-block; }`).
3. **Enforce Dual-DOM Accessibility**:
   - Apply `aria-label` with the raw text string to the parent element and tag child split spans with `aria-hidden="true"`, or provide an intact `<h1 class="sr-only">`.
   - For detailed configuration and internationalization, see [references/motion-and-scroll.md](references/motion-and-scroll.md).

### Completion Gate
- [ ] Text splitting executes strictly after `document.fonts.ready` resolves.
- [ ] Split elements contain overflow masks without layout-breaking line wraps.
- [ ] Screen readers access intact semantic markup without spelling individual letters.

---

## Phase 3: Synchronized Smooth Scroll & Unified Virtual Playhead

Synchronize virtual scroll physics with GSAP ScrollTrigger timelines through a single master clock.

1. **Unify the Animation Ticker (Lenis + GSAP)**:
   - Forward Lenis scroll events to `ScrollTrigger.update`, drive Lenis through `gsap.ticker`, and enforce `lagSmoothing(0)`:
     ```javascript
     const lenis = new Lenis({ duration: 1.2, smoothWheel: true });
     lenis.on('scroll', ScrollTrigger.update);
     gsap.ticker.add((time) => lenis.raf(time * 1000));
     gsap.ticker.lagSmoothing(0);
     ```
2. **Calculate Pin Buffers & Scrub Intervals**:
   - Establish pinned scrollytelling tracks: `pin: true`, `pinSpacing: true`, `scrub: 1`, `end: () => "+=" + (window.innerHeight * N)`.
   - Allocate a 10% rest buffer zone ($p \in [0.90, 1.00]$) so visual sequences settle before unpinning.
   - Partition progress using `gsap.utils.clamp` and `gsap.utils.mapRange`.
   - For horizontal scroll tracks and multi-page shutter transitions, see [references/motion-and-scroll.md](references/motion-and-scroll.md).

### Completion Gate
- [ ] Lenis and ScrollTrigger run on a unified ticker with `lagSmoothing(0)`.
- [ ] Pinned scroll tracks contain a 10% resting buffer before releasing.
- [ ] Responsive `gsap.matchMedia()` degrades multi-turn 3D pins into clean vertical flow on mobile.

---

## Phase 4: Canvas 2D & Particle Physics Decomposition

Convert rasterized typography or image buffers into interactive particle fields with immutable anchor memory and cursor force repulsion.

1. **Configure High-DPI 2D Canvas**:
   - Scale internal buffer dimensions: `canvas.width = width * dpr; canvas.height = height * dpr; ctx.scale(dpr, dpr);`.
2. **Extract Pixel Buffers & 1D-to-2D Stride Mapping**:
   - Render typography to an offscreen buffer and extract raw bytes via `ctx.getImageData(0, 0, width, height)`.
   - Compute 1D stride index: $\text{index} = (y \times 4 \times \text{width}) + (x \times 4)$.
   - Calculate perceived photometric luminance (ITU-R BT.601):
     $$\text{Luminance} = \frac{\sqrt{0.299 \cdot R^2 + 0.587 \cdot G^2 + 0.114 \cdot B^2}}{100}$$
3. **Instantiate Anchored Particles & Spring Physics**:
   - For $\text{alpha} > 128$, instantiate particles storing dynamic state $(x, y, v_x, v_y)$ and immutable anchors $(\text{baseX}, \text{baseY})$.
   - On cursor proximity ($\text{dist} < \text{radius}$), apply directional repulsion:
     $$\vec{F}_{\text{repulsion}} = -\left(\frac{\vec{\Delta}}{\text{dist}}\right) \cdot \left(\frac{\text{radius} - \text{dist}}{\text{radius}}\right) \cdot \text{density}$$
   - On departure, pull particle toward anchor via Hooke's Law damping: $x_{t+1} = x_t + (\text{baseX} - x_t) \cdot k$.
   - For constellation lines ($O(N^2/2)$) and vector flow fields, see [references/canvas-and-particles.md](references/canvas-and-particles.md).

### Completion Gate
- [ ] 1D buffer stride correctly indexes contiguous RGBA byte data.
- [ ] Particles scatter under cursor proximity and reconstruct typography via anchor memory.
- [ ] Constellation proximity checks use upper-triangular indexing ($j = i + 1$).

---

## Phase 5: Three.js & React Three Fiber (R3F) Viewport Integration

Construct 3D viewport scenes, ingest DRACO-compressed GLTF assets, configure studio lighting, and synchronize camera vectors with scroll.

1. **Initialize WebGLRenderer & Screen Projection**:
   - Match camera FOV to viewport height: $\text{FOV} = 2 \cdot \arctan\left(\frac{\text{height}}{2 \cdot \text{distance}}\right) \cdot \left(\frac{180}{\pi}\right)$ (1 Three.js unit = 1 CSS pixel at $Z=0$).
2. **Ingest & Normalize DRACO Assets**:
   - Load `.glb` assets via `GLTFLoader` with `DRACOLoader`.
   - Compute spatial bounding box (`new THREE.Box3().setFromObject(model)`) to auto-center origin at $(0,0,0)$ and scale responsively.
3. **Establish Studio Lighting Rig**:
   - Position directional key light (soft shadow maps), ambient fill, rim highlights, and HDR environment reflection maps.
4. **Bind Scroll Rotation via Axis-Angle Math**:
   - Update rotation incrementally via `model.rotateOnAxis(axis, delta)` to prevent gimbal lock.
   - Use on-demand dirty rendering (`viewer.setDirty()`) during idle to conserve battery.
   - For R3F declarative hooks and `@react-three/drei` components, see [references/threejs-and-r3f.md](references/threejs-and-r3f.md).

### Completion Gate
- [ ] 3D models are DRACO-compressed and auto-centered at origin.
- [ ] Model rotations execute smoothly without Euler angle flipping.
- [ ] WebGL canvas properly releases pointer events when not in inspection mode.

---

## Phase 6: Custom GPU Shaders & GLSL Visual Computation

Deploy hardware-accelerated vertex displacement, fragment distortion, and mouse-velocity force fields in GLSL.

1. **Pass Uniforms & Correct Aspect Ratio**:
   - Feed uniforms: `uTime`, `uMouse`, `uVelocity`, `uResolution`, `uTexture`.
   - Normalize coordinates: `vec2 st = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);`.
2. **Implement Vertex Wave Displacement**:
   - Displace vertices dynamically along normals based on distance to mouse and procedural noise.
3. **Implement Fragment Fluid Distortion & RGB Chromatic Aberration**:
   - Distort UVs using 4-octave Fractional Brownian Motion (FBM) and Gaussian cursor falloff.
   - Stagger Red, Green, and Blue texture samples along displacement vectors:
     $$\text{Sample} = \text{vec4}(T(\text{uv} + \vec{d} \cdot 1.3).r, T(\text{uv} + \vec{d}).g, T(\text{uv} + \vec{d} \cdot 0.7).b, 1.0)$$
   - For Simplex noise, FBM, and Curl noise kernels, see [references/shaders-and-glsl.md](references/shaders-and-glsl.md).

### Completion Gate
- [ ] Shaders compile without warnings or runtime WebGL errors.
- [ ] UV aspect ratio preservation prevents texture distortion on resize.
- [ ] Velocity decays smoothly to zero when pointer stops moving.

---

## Phase 7: Hybrid 3D Cinematics & Asset Baking (ORYZO / Superlocal Paradigm)

Combine pre-rendered ray-traced frame sequences on Canvas 2D with synchronized real-time WebGL meshes and 3D perspective DOM overlays.

1. **Bake & Batch-Export Frame Sequences**:
   - Render offline camera paths in Blender Cycles/Eevee and export numbered WebP/JPEG frames (`frame_0001.webp` to `frame_NNNN.webp`, $1920 \times 1080$, quality 80–85%).
2. **Scrub Image Sequence on Canvas 2D**:
   - Preload all frames into an in-memory `Image[]` array before activating scroll. Never scrub native `<video>` tags on scroll.
   - Paint active frame using context-level `object-fit: cover` aspect ratio math.
3. **Orchestrate Real-Time WebGL & 3D Perspective DOM**:
   - Position Three.js canvas and 3D DOM container (`perspective: 1000px; transform-style: preserve-3d;`) directly above the background canvas.
   - Scrub child elements along `translateZ` and `rotateY` synchronized to the master ScrollTrigger playhead.
   - For complete frame scrubber classes and DOM depth recipes, see [references/hybrid-3d-cinematics.md](references/hybrid-3d-cinematics.md).

### Completion Gate
- [ ] Image frames preloaded into memory array before scroll scrubbing begins.
- [ ] Canvas frame painting maintains `object-fit: cover` without aspect warping.
- [ ] Real-time WebGL overlay and 3D DOM layers align with baked frame trajectory.

---

## Phase 8: Performance Budgeting, Memory Teardown & Graceful Degradation

Audit runtime GPU/CPU metrics, enforce draw call budgets, prevent garbage collection spikes, and adapt to mobile devices.

1. **Enforce Render & Resource Budgets**:
   - Restrict rendering resolution: `Math.min(window.devicePixelRatio, 2.0)`.
   - Maintain WebGL draw calls $< 50$ on mobile, $< 100$ on desktop via `THREE.InstancedMesh`.
   - Zero heap allocations inside animation loops: pre-allocate all scratch vectors/matrices outside RAF.
2. **Implement Graceful Mobile Degradation**:
   - Detect mobile viewports: increase particle stride (75% particle reduction), disable real-time shadow maps, and omit heavy post-processing passes.
   - Respect `prefers-reduced-motion: reduce` by replacing spatial travel with simple fades.
3. **Execute Comprehensive Teardown**:
   - On component unmount / route transition, call `cancelAnimationFrame`, `lenis.destroy()`, `ScrollTrigger.killAll()`, and recursively dispose geometries, materials, textures, and WebGL contexts.
   - For memory profiling guides and deallocation checklists, see [references/performance-and-profiling.md](references/performance-and-profiling.md).

### Completion Gate
- [ ] Zero memory leaks verified across route changes and window resizes.
- [ ] No object allocations (`new THREE.Vector3`) occur inside active RAF loops.
- [ ] Constant 60 FPS verified across desktop and mobile test profiles.

---

## Phase 9: End-to-End Production Verification & Synthesis

Validate the integrated experience against verified production recipes and browser environments.

1. **Execute Working Code Recipes**:
   - Verify implementations against tested recipes in [references/examples.md](references/examples.md).
2. **Audit Production Checklist**:
   - Verify 60/120 FPS performance across desktop and mobile devices.
   - Confirm all ScrollTrigger debug markers are removed in production builds.
   - Verify semantic accessibility tags and intact screen-reader fallbacks.

### Completion Gate
- [ ] All 9 sequential implementation phases pass their respective completion gates.
- [ ] Experience runs at steady 60 FPS without memory leaks or dropped frames.
