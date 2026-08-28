# Canvas 2D Buffers, Particle Physics & Pixel Manipulation

An authoritative engineering reference for building interactive 2D canvas particle systems, raw pixel-buffer extraction, photometric luminance mapping, sand/dust typographic decomposition, and trigonometric flow fields.

---

## 1. High-DPI Canvas Backing Scale & Context Configuration

Ensure pixel-perfect rendering across Retina and High-DPI screens without visual blurriness or layout distortion by scaling the internal raster buffer while preserving CSS layout dimensions.

```javascript
export function configureHighDPICanvas(canvas, width, height) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2.0); // Clamp to max 2x for GPU fill-rate protection

  // Set internal display buffer dimensions
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  // Set CSS display layout dimensions
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // Scale context operations to match logical CSS coordinates
  ctx.scale(dpr, dpr);

  return { ctx, dpr, width, height };
}
```

---

## 2. 1D-to-2D Pixel Buffer Extraction & Stride Arithmetic

The `ctx.getImageData(0, 0, width, height)` API returns a linear 1D `Uint8ClampedArray` containing sequential RGBA pixel bytes ($0\text{--}255$) in row-major order.

### Stride Indexing Formula

To locate the Red channel byte index of coordinate $(x, y)$ in a buffer of width $W$:

$$\text{Index}(x, y) = (y \times 4 \times W) + (x \times 4)$$

```
Pixel (x, y) ──► [ Index + 0 : Red   (0 - 255) ]
              ──► [ Index + 1 : Green (0 - 255) ]
              ──► [ Index + 2 : Blue  (0 - 255) ]
              ──► [ Index + 3 : Alpha (0 - 255) ]
```

### Photometric Relative Luminance (ITU-R BT.601 Standard)

Human retinal cones perceive green light with significantly higher sensitivity than red or blue. Compute perceived photometric luminance:

$$\text{Luminance} = \frac{\sqrt{0.299 \cdot R^2 + 0.587 \cdot G^2 + 0.114 \cdot B^2}}{100}$$

```javascript
export function extractLuminanceGrid(ctx, width, height) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const grid = [];

  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * 4 * width) + (x * 4);
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      const brightness = Math.sqrt(
        0.299 * (r * r) +
        0.587 * (g * g) +
        0.114 * (b * b)
      ) / 100;

      row.push({
        brightness,
        color: `rgba(${r}, ${g}, ${b}, ${a / 255})`,
        alpha: a,
      });
    }
    grid.push(row);
  }
  return grid;
}
```

---

## 3. Sand / Dust Typography Decomposition Architecture

Decompose typographical glyphs into thousands of interactive particles equipped with immutable anchor memory and physical spring restitution.

```
[Draw Text to Offscreen Canvas]
               │
               ▼
[Extract Raw Uint8ClampedArray Buffer]
               │
               ▼
[Scan Grid at Sampling Stride (Step: 4px desktop / 8px mobile)]
               │
               ▼ (if Alpha > 128)
[Instantiate Particle(x, y) with Anchor(baseX, baseY)]
               │
               ▼
[Clear Buffer & Run Interactive Physics RAF Loop]
```

### Complete Typography Particle Class

```javascript
export class TextParticle {
  constructor(x, y, color = '#ffffff', size = 1.5) {
    // Dynamic Simulation State
    this.x = x + (Math.random() - 0.5) * 20; // Subtle initial jitter
    this.y = y + (Math.random() - 0.5) * 20;
    this.vx = 0;
    this.vy = 0;
    this.size = size;
    this.color = color;

    // Immutable Anchor Memory (Rest State)
    this.baseX = x;
    this.baseY = y;

    // Physical Characteristics
    this.density = Math.random() * 20 + 10; // Mass / inertia resistance factor
    this.friction = 0.92;
    this.springFactor = 0.08; // Hooke's Law spring stiffness
  }

  update(mouse) {
    // 1. Calculate Vector & Distance to Cursor
    const dx = mouse.x - this.x;
    const dy = mouse.y - this.y;
    const distSq = dx * dx + dy * dy;
    const radiusSq = mouse.radius * mouse.radius;

    // 2. Cursor Repulsion Force Field
    if (distSq < radiusSq && distSq > 0) {
      const dist = Math.sqrt(distSq);
      const force = (mouse.radius - dist) / mouse.radius; // 1.0 at center, 0.0 at edge
      const normalX = dx / dist;
      const normalY = dy / dist;

      this.vx -= normalX * force * this.density;
      this.vy -= normalY * force * this.density;
    }

    // 3. Elastic Spring-Back Return to Anchor Memory (Hooke's Law)
    const springDx = this.baseX - this.x;
    const springDy = this.baseY - this.y;

    this.vx += springDx * this.springFactor;
    this.vy += springDy * this.springFactor;

    // 4. Apply Friction & Velocity Integration
    this.vx *= this.friction;
    this.vy *= this.friction;

    this.x += this.vx;
    this.y += this.vy;
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
  }
}
```

### Complete Typography Particle System Manager

```javascript
export class TextParticleSystem {
  constructor(canvas, text = 'CREATIVE') {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.text = text;
    this.particles = [];
    this.mouse = { x: -1000, y: -1000, radius: 120 };
    this.rafId = null;

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mouseleave', () => {
      this.mouse.x = -1000;
      this.mouse.y = -1000;
    });

    window.addEventListener('resize', () => this.init());

    this.init();
  }

  init() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(dpr, dpr);

    // 1. Render Typographic Glyphs to Buffer
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '900 clamp(48px, 12vw, 160px) sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(this.text, width / 2, height / 2);

    // 2. Extract Raw Pixel Buffer
    const imgData = this.ctx.getImageData(0, 0, width * dpr, height * dpr);
    const data = imgData.data;
    this.particles = [];

    // 3. Sample Non-Transparent Pixels (Mobile-Adaptive Stride)
    const isMobile = width <= 768;
    const step = isMobile ? 8 : 4;

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const pixelX = Math.floor(x * dpr);
        const pixelY = Math.floor(y * dpr);
        const index = (pixelY * 4 * (width * dpr)) + (pixelX * 4);
        const alpha = data[index + 3];

        if (alpha > 128) {
          this.particles.push(new TextParticle(x, y, '#ffffff', isMobile ? 2.0 : 1.5));
        }
      }
    }

    // 4. Clear Raster Text before starting particle loop
    this.ctx.clearRect(0, 0, width, height);
    if (!this.rafId) this.animate();
  }

  animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].update(this.mouse);
      this.particles[i].draw(this.ctx);
    }

    this.rafId = requestAnimationFrame(() => this.animate());
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}
```

---

## 4. Upper-Triangular Constellation Line Optimization ($O(N^2/2)$)

When connecting proximity lines between $N$ particles, standard nested loops execute $N^2$ iterations. Initializing the inner loop at $j = i + 1$ eliminates duplicate comparisons ($B \leftrightarrow A$) and self-checks ($A \leftrightarrow A$), cutting iterations by $50\%$ to $\frac{N(N-1)}{2}$.

```javascript
export function drawConstellationNetwork(ctx, particles, maxDistance = 60) {
  const maxDistSq = maxDistance * maxDistance;
  const len = particles.length;

  for (let i = 0; i < len; i++) {
    const pA = particles[i];

    for (let j = i + 1; j < len; j++) {
      const pB = particles[j];

      const dx = pA.x - pB.x;
      const dy = pA.y - pB.y;
      const distSq = dx * dx + dy * dy;

      // Distance-squared check avoids costly Math.sqrt on distant pairs
      if (distSq < maxDistSq) {
        const dist = Math.sqrt(distSq);
        const opacity = 1.0 - (dist / maxDistance);

        ctx.strokeStyle = `rgba(255, 255, 255, ${(opacity * 0.4).toFixed(3)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }
    }
  }
}
```

---

## 5. Mathematical Vector Flow Fields (Zero-Matrix Overhead)

Compute continuous vector flow fields using direct trigonometric coordinate arithmetic instead of costly context matrix stack operations (`ctx.save()`, `ctx.translate()`, `ctx.rotate()`, `ctx.restore()`).

```javascript
export class VectorFlowField {
  #ctx;
  #width;
  #height;
  #cellSize = 20;
  #zoom = 0.005;
  #radius = 1.0;
  #vr = 0.01;

  constructor(ctx, width, height) {
    this.#ctx = ctx;
    this.#width = width;
    this.#height = height;
  }

  update() {
    this.#radius += this.#vr;
    if (this.#radius > 5 || this.#radius < -5) {
      this.#vr *= -1;
    }
  }

  draw(time = 0) {
    for (let y = 0; y < this.#height; y += this.#cellSize) {
      for (let x = 0; x < this.#width; x += this.#cellSize) {
        // Direct trigonometric angle mapping from wave interference
        const angle = (Math.cos(x * this.#zoom + time) + Math.sin(y * this.#zoom + time)) * this.#radius;
        const length = this.#cellSize * 0.8;

        this.#ctx.strokeStyle = `hsl(${(angle * 60) % 360}, 70%, 60%)`;
        this.#ctx.lineWidth = 1.2;
        this.#ctx.beginPath();
        this.#ctx.moveTo(x, y);
        // Direct endpoint arithmetic avoids matrix transforms
        this.#ctx.lineTo(
          x + Math.cos(angle) * length,
          y + Math.sin(angle) * length
        );
        this.#ctx.stroke();
      }
    }
  }
}
```
