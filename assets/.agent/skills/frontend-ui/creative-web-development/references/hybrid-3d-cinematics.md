# Hybrid 3D Cinematics & Baked Asset Pipelines

An authoritative architectural guide for implementing the ORYZO AI, Superlocal, and Apple hybrid paradigm: combining offline-rendered Blender CGI image sequence scrubbing with real-time interactive WebGL overlays and 3D perspective DOM transformations.

---

## 1. The Hybrid 3D Architectural Paradigm

Top-tier creative studios achieve photorealistic lighting, complex optical refraction, and volumetric depth on the web without crashing client GPUs by decoupling raytracing from real-time execution.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VIEWPORT LAYER STACK                            │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 3: Interactive DOM UI & Kinetic Typography (z-index: 20)         │
│          Buttons, feature callouts, navigation, SplitText headlines    │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Real-Time WebGL / Three.js Interactive Overlays (z-index: 10) │
│          Floating glass cards, cursor-reactive shaders, 3D meshes      │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 1: Pinned HTML5 2D Canvas Image-Sequence Scrubber (z-index: 1)   │
│          Offline baked Cycles/Eevee photorealistic lighting & camera   │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
        [Unified GSAP ScrollTrigger Virtual Playhead (0.0 -> 1.0)]
```

### Architectural Comparison

| Dimension | 100% Real-Time WebGL | Hybrid Baked + Real-Time Engine |
|---|---|---|
| **Lighting Quality** | Simplified PBR / Approximated reflections | True Raytraced Global Illumination (Blender Cycles) |
| **Mobile Performance** | Heavy GPU thermal throttling & battery drain | Lightweight 2D canvas frame draw (solid 60 FPS) |
| **Asset Delivery** | Massive textures + shader compilation delay | Compressed WebP/JPEG sequence cached in memory |
| **Interaction Depth** | High | High (Real-time WebGL/DOM overlays react to cursor & scroll) |

---

## 2. Blender Production & Asset Baking Workflow

Export 3D camera animations and lighting sequences from Blender as lightweight, sequential image assets.

### Camera & Lightmap Baking Rules
1. **Camera Parameter Alignment**: Lock the Blender camera Focal Length (e.g., 50mm) and sensor dimensions. Calculate matching Three.js `PerspectiveCamera` FOV:
   $$\text{FOV} = 2 \cdot \arctan\left(\frac{\text{SensorHeight}}{2 \cdot \text{FocalLength}}\right) \cdot \left(\frac{180}{\pi}\right)$$
2. **Texture Light Baking**: In Blender Cycles, bake indirect lighting, ambient occlusion, and global illumination directly into 32-bit diffuse maps. This allows real-time Three.js overlay models to run on performant `MeshBasicMaterial` without requiring dynamic shadow passes.
3. **Sequence Export & Dimensions**:
   - Resolution: $1920 \times 1080$ (Desktop) and $1080 \times 1920$ (Mobile portrait if separate).
   - Target frame count: 150–300 frames per scrollytelling section (ultra-smooth scrubbing with $\sim 15\text{MB}$ memory footprint).

### Batch CLI Image Optimization

```bash
# Linux / macOS / Windows (FFmpeg batch conversion to high-efficiency WebP)
ffmpeg -i frame_%04d.png -q:v 80 -vf "scale=1920:1080" frame_%04d.webp
rm frame_*.png

# Alternative: High-Quality JPEG (sips on macOS)
for file in frame_*.tif; do sips -s format jpeg "$file" -s formatOptions 82 --out "${file%.tif}.jpg"; done
rm frame_*.tif
```

---

## 3. High-Performance In-Memory Canvas Sequence Scrubber Engine

Never scrub HTML5 `<video>` elements directly on scroll. Video decoders optimize for forward linear playback and drop frames during bidirectional scrubbing. Preload discrete frames into memory.

### Canvas Aspect Ratio Containment (`object-fit: cover` Math)

```javascript
export function drawCanvasCoverFrame(ctx, img, canvasWidth, canvasHeight) {
  if (!img || !img.complete || img.naturalWidth === 0) return;

  const imgAspect = img.naturalWidth / img.naturalHeight;
  const canvasAspect = canvasWidth / canvasHeight;

  let drawWidth, drawHeight, drawX, drawY;

  if (imgAspect > canvasAspect) {
    drawHeight = canvasHeight;
    drawWidth = canvasHeight * imgAspect;
    drawX = (canvasWidth - drawWidth) / 2;
    drawY = 0;
  } else {
    drawWidth = canvasWidth;
    drawHeight = canvasWidth / imgAspect;
    drawX = 0;
    drawY = (canvasHeight - drawHeight) / 2;
  }

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
}
```

### Complete Sequence Scrubber Class

```javascript
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export class CinematicSequenceScrubber {
  constructor(canvas, frameCount, frameUrlGenerator) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.frameCount = frameCount;
    this.frameUrlGenerator = frameUrlGenerator;
    this.images = [];
    this.currentFrame = 0;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.0);

    this.initCanvasSize();
    this.preloadFrames(() => this.setupScrollTimeline());

    window.addEventListener('resize', () => {
      this.initCanvasSize();
      if (this.images[this.currentFrame]) {
        drawCanvasCoverFrame(this.ctx, this.images[this.currentFrame], window.innerWidth, window.innerHeight);
      }
    });
  }

  initCanvasSize() {
    this.canvas.width = window.innerWidth * this.dpr;
    this.canvas.height = window.innerHeight * this.dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.scale(this.dpr, this.dpr);
  }

  preloadFrames(onComplete) {
    let loadedCount = 0;
    const total = this.frameCount;

    for (let i = 0; i < total; i++) {
      const img = new Image();
      img.onload = () => {
        if (++loadedCount === total) onComplete();
      };
      img.onerror = () => {
        if (++loadedCount === total) onComplete(); // Prevent deadlock on individual asset glitch
      };
      img.src = this.frameUrlGenerator(i);
      this.images.push(img);
    }
  }

  setupScrollTimeline() {
    // Paint initial frame
    drawCanvasCoverFrame(this.ctx, this.images[0], window.innerWidth, window.innerHeight);

    ScrollTrigger.create({
      trigger: '.cinematic-pinned-track',
      start: 'top top',
      end: () => `+=${window.innerHeight * 4}`,
      pin: true,
      scrub: 1.0,
      anticipatePin: 1,
      onUpdate: (self) => {
        // Complete frame sequence at 90% progress to allow breathing room for unpinning
        const animProgress = Math.min(self.progress / 0.90, 1.0);
        const frameIndex = Math.floor(animProgress * (this.frameCount - 1));

        if (frameIndex !== this.currentFrame && this.images[frameIndex]) {
          this.currentFrame = frameIndex;
          drawCanvasCoverFrame(
            this.ctx,
            this.images[frameIndex],
            window.innerWidth,
            window.innerHeight
          );
        }
      },
    });
  }
}
```

---

## 4. Layering 3D Perspective DOM Overlays

Superimpose interactive DOM typography and glassmorphism feature cards over the video scrubber using 3D perspective transforms.

### CSS Layout & Perspective Hierarchy

```html
<section class="cinematic-pinned-track">
  <!-- Layer 1: Background Canvas Scrubber -->
  <canvas id="sequence-canvas"></canvas>

  <!-- Layer 2: 3D Spatial Perspective DOM Overlays -->
  <div class="spatial-overlay-layer">
    <div class="hero-headline">
      <h1>NEURAL ARCHITECTURE</h1>
    </div>
    <div class="feature-card card-left">
      <h2>01 / PHOTONIC FABRIC</h2>
      <p>Sub-millisecond optical interconnects.</p>
    </div>
    <div class="feature-card card-right">
      <h2>02 / NEURAL INFERENCE</h2>
      <p>Continuous hardware tensor execution.</p>
    </div>
  </div>
</section>
```

```css
.cinematic-pinned-track {
  position: relative;
  width: 100vw;
  height: 100svh;
  overflow: hidden;
  background: #000000;
}

#sequence-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
  pointer-events: none;
}

.spatial-overlay-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 20;
  perspective: 1000px;
  transform-style: preserve-3d;
  pointer-events: none;
}

.hero-headline {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) translateZ(0px);
  color: #ffffff;
  will-change: transform, opacity;
}

.feature-card {
  position: absolute;
  width: 320px;
  padding: 2rem;
  background: rgba(18, 18, 20, 0.75);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  color: #ffffff;
  pointer-events: auto;
  will-change: transform, opacity;
}

.card-left {
  bottom: 20%;
  left: 10%;
  transform: translateZ(600px);
  opacity: 0;
}

.card-right {
  bottom: 20%;
  right: 10%;
  transform: translateZ(600px);
  opacity: 0;
}
```

### Synchronized DOM Scrub Timeline

```javascript
export function bindSpatialDOMTimeline() {
  ScrollTrigger.create({
    trigger: '.cinematic-pinned-track',
    start: 'top top',
    end: '+=400%',
    scrub: 1,
    onUpdate: (self) => {
      const p = self.progress;

      // 1. Headline recedes into deep 3D background (0.00 -> 0.30)
      if (p <= 0.35) {
        const textP = p / 0.35;
        gsap.set('.hero-headline', {
          transform: `translate(-50%, -50%) translateZ(${-textP * 600}px)`,
          opacity: 1 - textP,
        });
      }

      // 2. Card Left pulls forward from foreground (0.25 -> 0.60)
      if (p >= 0.25 && p <= 0.65) {
        const leftP = gsap.utils.clamp(0, 1, gsap.utils.mapRange(0.25, 0.60, 0, 1, p));
        gsap.set('.card-left', {
          transform: `translate3d(0, 0, ${(1 - leftP) * 600}px) rotateY(${gsap.utils.mapRange(0, 1, 20, 0, leftP)}deg)`,
          opacity: leftP,
        });
      }

      // 3. Card Right pulls forward at secondary milestone (0.55 -> 0.90)
      if (p >= 0.55 && p <= 0.90) {
        const rightP = gsap.utils.clamp(0, 1, gsap.utils.mapRange(0.55, 0.85, 0, 1, p));
        gsap.set('.card-right', {
          transform: `translate3d(0, 0, ${(1 - rightP) * 600}px) rotateY(${gsap.utils.mapRange(0, 1, -20, 0, rightP)}deg)`,
          opacity: rightP,
        });
      }
    },
  });
}
```
