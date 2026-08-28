# Master Creative Web Development: Production Recipes & End-to-End Blueprints

A curated collection of production-grade, fully commented implementations across the 5 signature creative web development paradigms (Awwwards / FWA / CSSDA standard).

---

## Recipe 1: Text-to-Sand / Dust Particle Decomposition & Reconstruction

A standalone HTML5 Canvas 2D engine that rasterizes typography, decomposes it into thousands of physics particles, scatters them under cursor proximity force fields, and elastically reconstructs the text via anchor memory.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sand Typography Particle Physics</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #09090b; overflow: hidden; }
    canvas { display: block; width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="particleCanvas"></canvas>

  <script>
    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');

    let width, height, dpr;
    let particles = [];
    const mouse = { x: -1000, y: -1000, radius: 110 };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2.0);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);

      initTextParticles();
    }

    class SandParticle {
      constructor(x, y) {
        this.x = x + (Math.random() - 0.5) * 20;
        this.y = y + (Math.random() - 0.5) * 20;
        this.baseX = x; // Immutable Anchor Memory
        this.baseY = y;
        this.vx = 0;
        this.vy = 0;
        this.size = Math.random() * 1.5 + 1.0;
        this.density = Math.random() * 25 + 10;
        this.friction = 0.90;
        this.springFactor = 0.08; // Hooke's Law spring stiffness
      }

      update() {
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distSq = dx * dx + dy * dy;
        const radiusSq = mouse.radius * mouse.radius;

        // Repulsion force field
        if (distSq < radiusSq && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const force = (mouse.radius - dist) / mouse.radius;
          const nx = dx / dist;
          const ny = dy / dist;
          this.vx -= nx * force * this.density;
          this.vy -= ny * force * this.density;
        }

        // Elastic spring recovery toward anchor memory
        const springX = this.baseX - this.x;
        const springY = this.baseY - this.y;
        this.vx += springX * this.springFactor;
        this.vy += springY * this.springFactor;

        this.vx *= this.friction;
        this.vy *= this.friction;

        this.x += this.vx;
        this.y += this.vy;
      }

      draw() {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function initTextParticles() {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 clamp(48px, 12vw, 160px) sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('IMMERSIVE', width / 2, height / 2);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      particles = [];

      // Stride: 4px desktop, 8px mobile (75% performance optimization)
      const stride = (width <= 768) ? Math.floor(8 * dpr) : Math.floor(4 * dpr);

      for (let y = 0; y < canvas.height; y += stride) {
        for (let x = 0; x < canvas.width; x += stride) {
          const index = (y * 4 * canvas.width) + (x * 4);
          const alpha = data[index + 3];

          if (alpha > 128) {
            particles.push(new SandParticle(x / dpr, y / dpr));
          }
        }
      }

      ctx.clearRect(0, 0, width, height);
    }

    function animate() {
      // Subtle trail persistence
      ctx.fillStyle = 'rgba(9, 9, 11, 0.25)';
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
      }
      requestAnimationFrame(animate);
    }

    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    window.addEventListener('mouseleave', () => {
      mouse.x = -1000;
      mouse.y = -1000;
    });

    window.addEventListener('resize', resize);
    window.addEventListener('DOMContentLoaded', () => {
      resize();
      animate();
    });
  </script>
</body>
</html>
```

---

## Recipe 2: Scroll-Driven 3D Product Interactive Showcase

A synchronized Three.js 3D product showcase orchestrated across a 400% pinned viewport with Lenis smooth scroll, GSAP ScrollTrigger, DRACO loader, and circular clip-path mask reveals.

```javascript
/**
 * 3D Scrollytelling Showcase
 * Technology: Three.js, DRACOLoader, GSAP 3, ScrollTrigger, Lenis
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export class Scrollytelling3D {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.model = null;

    this.init();
  }

  async init() {
    this.initLenis();
    this.initThree();
    await this.loadModel('/assets/models/product.glb');
    this.initScrollTimeline();
  }

  initLenis() {
    this.lenis = new Lenis({ duration: 1.2, smoothWheel: true });
    this.lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => this.lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  initThree() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Studio Lighting Rig
    const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.8);
    keyLight.position.set(4, 5, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    this.scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xd6eaff, 0.8);
    fillLight.position.set(-4, -1, -2);
    this.scene.add(fillLight);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    this.camera.position.set(0, 0, 4);

    const render = () => {
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(render);
    };
    render();

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
    });
  }

  loadModel(url) {
    return new Promise((resolve) => {
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

      const loader = new GLTFLoader();
      loader.setDRACOLoader(dracoLoader);

      loader.load(url, (gltf) => {
        this.model = gltf.scene;

        // Auto-center geometry
        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        this.model.position.sub(center);

        this.model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.scene.add(this.model);
        dracoLoader.dispose();
        resolve();
      });
    });
  }

  initScrollTimeline() {
    const yAxis = new THREE.Vector3(0, 1, 0);
    let lastRotation = 0;

    ScrollTrigger.create({
      trigger: '.pinned-hero-track',
      start: 'top top',
      end: '+=400%',
      pin: true,
      scrub: 1.2,
      anticipatePin: 1,
      onUpdate: (self) => {
        const progress = self.progress;

        // 1. Rotate 3D Model across 4 full turns via axis-angle math
        if (this.model) {
          const targetRotation = progress * Math.PI * 2 * 4;
          const delta = targetRotation - lastRotation;
          this.model.rotateOnAxis(yAxis, delta);
          lastRotation = targetRotation;
        }

        // 2. Circular Theme Mask Expansion (0.15 -> 0.45)
        const maskP = gsap.utils.clamp(0, 1, gsap.utils.mapRange(0.15, 0.45, 0, 100, progress));
        gsap.set('.circular-theme-mask', {
          clipPath: `circle(${maskP}% at 50% 50%)`,
        });

        // 3. Headline Exit (0.00 -> 0.20)
        const textP = gsap.utils.clamp(0, 1, gsap.utils.mapRange(0.00, 0.20, 0, 1, progress));
        gsap.set('.hero-title', {
          xPercent: -120 * textP,
          opacity: 1 - textP,
        });

        // 4. Stagger Spec Callouts (0.50 -> 0.85)
        const specP = gsap.utils.clamp(0, 1, gsap.utils.mapRange(0.50, 0.85, 0, 1, progress));
        gsap.set('.spec-item', {
          opacity: specP,
          y: (1 - specP) * 40,
        });
      },
    });
  }
}
```

---

## Recipe 3: Interactive GPU Fluid Distortion Plane (GLSL + Three.js)

A full-screen interactive shader plane responding to cursor velocity with dynamic UV displacement and RGB channel split (chromatic aberration).

```javascript
/**
 * Fluid RGB Distortion Plane
 * Technology: Three.js, Custom GLSL, Cursor Velocity Tracking
 */

import * as THREE from 'three';

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D uTexture;
  uniform vec2 uMouse;
  uniform vec2 uVelocity;
  uniform float uSpeed;
  uniform float uTime;
  uniform vec2 uResolution;
  varying vec2 vUv;

  // Aspect-corrected coordinates
  vec2 getCoverUv(vec2 uv, vec2 screenRes, vec2 texRes) {
    vec2 s = screenRes;
    vec2 i = texRes;
    float rs = s.x / s.y;
    float ri = i.x / i.y;
    vec2 newRes = rs < ri ? vec2(i.x * s.y / i.y, s.y) : vec2(s.x, i.y * s.x / i.x);
    vec2 offset = (rs < ri ? vec2((newRes.x - s.x) / 2.0, 0.0) : vec2(0.0, (newRes.y - s.y) / 2.0)) / newRes;
    return uv * s / newRes + offset;
  }

  void main() {
    vec2 uv = getCoverUv(vUv, uResolution, vec2(1920.0, 1080.0));

    // Calculate distance to cursor
    float dist = distance(vUv, uMouse);
    float force = smoothstep(0.35, 0.0, dist);

    // Displacement vector modulated by speed
    vec2 dir = normalize(vUv - uMouse + 0.0001);
    vec2 displacement = dir * force * (uSpeed * 0.04) * sin(dist * 20.0 - uTime * 3.0);

    // Sample RGB channels with differential spatial offsets
    float r = texture2D(uTexture, uv + displacement * 1.3).r;
    float g = texture2D(uTexture, uv + displacement).g;
    float b = texture2D(uTexture, uv + displacement * 0.7).b;
    float a = texture2D(uTexture, uv).a;

    // Fast cursor flash highlight
    float flash = uSpeed * force * 0.15;
    vec3 finalColor = vec3(r, g, b) + vec3(flash);

    gl_FragColor = vec4(finalColor, a);
  }
`;

export class FluidDistortionPlane {
  constructor(canvasContainer, imageUrl) {
    this.container = canvasContainer;
    this.imageUrl = imageUrl;
    this.mouse = new THREE.Vector2(0.5, 0.5);
    this.targetMouse = new THREE.Vector2(0.5, 0.5);
    this.prevMouse = new THREE.Vector2(0.5, 0.5);
    this.velocity = new THREE.Vector2(0, 0);
    this.speed = 0;

    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
    this.container.appendChild(this.renderer.domElement);

    const texture = new THREE.TextureLoader().load(this.imageUrl);
    texture.minFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTexture: { value: texture },
        uMouse: { value: this.mouse },
        uVelocity: { value: this.velocity },
        uSpeed: { value: 0 },
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(this.container.clientWidth, this.container.clientHeight) },
      },
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);

    this.bindEvents();
    this.render();
  }

  bindEvents() {
    window.addEventListener('mousemove', (e) => {
      this.targetMouse.x = e.clientX / window.innerWidth;
      this.targetMouse.y = 1.0 - (e.clientY / window.innerHeight);
    });

    window.addEventListener('resize', () => {
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.material.uniforms.uResolution.value.set(this.container.clientWidth, this.container.clientHeight);
    });
  }

  render() {
    // 1. Mouse interpolation
    this.mouse.lerp(this.targetMouse, 0.12);

    // 2. Velocity calculation & decay
    const dx = this.mouse.x - this.prevMouse.x;
    const dy = this.mouse.y - this.prevMouse.y;
    this.speed = Math.hypot(dx, dy) * 40.0;
    this.velocity.set(dx, dy).multiplyScalar(0.92);
    this.prevMouse.copy(this.mouse);

    // 3. Update Uniforms
    this.material.uniforms.uTime.value += 0.016;
    this.material.uniforms.uMouse.value.copy(this.mouse);
    this.material.uniforms.uVelocity.value.copy(this.velocity);
    this.material.uniforms.uSpeed.value = this.speed;

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.render());
  }
}
```

---

## Recipe 4: Hybrid Canvas Video Frame Scrubber with 3D Spatial DOM Overlays

The ORYZO AI / Apple paradigm: preloading an offline-rendered image sequence onto a 2D canvas scrubber synchronized with 3D perspective DOM layers.

```html
<section class="hybrid-hero">
  <canvas id="scrubCanvas"></canvas>
  <div class="perspective-layer">
    <h1 class="hero-text">REDEFINING MOTION</h1>
    <div class="feature-card">
      <h2>01 / ARCHITECTURE</h2>
      <p>Photorealistic pre-rendered CGI combined with real-time UI.</p>
    </div>
  </div>
</section>

<style>
  .hybrid-hero {
    position: relative;
    width: 100vw;
    height: 100svh;
    overflow: hidden;
    background: #000000;
  }
  #scrubCanvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
  }
  .perspective-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 20;
    perspective: 1000px;
    transform-style: preserve-3d;
    pointer-events: none;
  }
  .hero-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) translateZ(0px);
    color: #ffffff;
    font-size: 5vw;
    will-change: transform, opacity;
  }
  .feature-card {
    position: absolute;
    bottom: 20%;
    right: 10%;
    transform: translateZ(800px);
    opacity: 0;
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 28px;
    border-radius: 16px;
    will-change: transform, opacity;
  }
</style>

<script type="module">
  import gsap from 'gsap';
  import { ScrollTrigger } from 'gsap/ScrollTrigger';
  import Lenis from 'lenis';

  gsap.registerPlugin(ScrollTrigger);

  const lenis = new Lenis();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  const canvas = document.getElementById('scrubCanvas');
  const ctx = canvas.getContext('2d');
  const frameCount = 150;
  const images = [];
  const dpr = Math.min(window.devicePixelRatio || 1, 2.0);

  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  let loaded = 0;
  for (let i = 1; i <= frameCount; i++) {
    const img = new Image();
    img.src = `/frames/frame_${i.toString().padStart(4, '0')}.jpg`;
    img.onload = () => { if (++loaded === frameCount) startScrub(); };
    img.onerror = () => { if (++loaded === frameCount) startScrub(); };
    images.push(img);
  }

  function drawFrame(img) {
    if (!img || !img.complete) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    
    // Context Object-Fit Cover Math
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = w / h;
    let dw = w, dh = h, dx = 0, dy = 0;
    if (imgRatio > canvasRatio) {
      dw = h * imgRatio;
      dx = (w - dw) / 2;
    } else {
      dh = w / imgRatio;
      dy = (h - dh) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function startScrub() {
    drawFrame(images[0]);

    ScrollTrigger.create({
      trigger: '.hybrid-hero',
      start: 'top top',
      end: '+=400%',
      pin: true,
      scrub: 1.0,
      onUpdate: (self) => {
        // Scrub frames settling at 90% progress
        const p = Math.min(self.progress / 0.90, 1.0);
        const frameIdx = Math.floor(p * (frameCount - 1));
        drawFrame(images[frameIdx]);

        // DOM Layer 1: Recede text into 3D distance
        if (self.progress < 0.4) {
          const tp = self.progress / 0.4;
          gsap.set('.hero-text', {
            transform: `translate(-50%, -50%) translateZ(${-tp * 600}px)`,
            opacity: 1 - tp,
          });
        }

        // DOM Layer 2: Bring card forward from foreground
        if (self.progress >= 0.4 && self.progress <= 0.85) {
          const cp = (self.progress - 0.4) / 0.45;
          gsap.set('.feature-card', {
            transform: `translateZ(${(1 - cp) * 800}px)`,
            opacity: cp,
          });
        }
      },
    });
  }
</script>
```

---

## Recipe 5: Seamless Multi-Page Cinematic Shutter Transition

A complete, Promise-based page transition intercepting navigation and orchestrating dual-opposing curtain wipes with zero layout shift.

```html
<div class="transition-container" aria-hidden="true">
  <div class="transition-row row-top">
    <div class="shutter-block"></div>
    <div class="shutter-block"></div>
    <div class="shutter-block"></div>
    <div class="shutter-block"></div>
    <div class="shutter-block"></div>
  </div>
  <div class="transition-row row-bottom">
    <div class="shutter-block"></div>
    <div class="shutter-block"></div>
    <div class="shutter-block"></div>
    <div class="shutter-block"></div>
    <div class="shutter-block"></div>
  </div>
</div>

<style>
  .transition-container {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    z-index: 99999;
    pointer-events: none;
  }
  .transition-row {
    display: flex;
    flex: 1;
    width: 100%;
  }
  .shutter-block {
    flex: 1;
    background: #09090b;
    transform: scaleY(1);
    will-change: transform;
  }
  .row-top .shutter-block { transform-origin: top center; }
  .row-bottom .shutter-block { transform-origin: bottom center; }
</style>

<script>
  function revealPage() {
    return new Promise((resolve) => {
      gsap.set('.shutter-block', { scaleY: 1, visibility: 'visible' });
      const tl = gsap.timeline({
        onComplete: () => {
          gsap.set('.shutter-block', { visibility: 'hidden' });
          resolve();
        },
      });

      tl.to('.row-top .shutter-block', {
        scaleY: 0,
        duration: 0.85,
        stagger: { each: 0.07, from: 'start' },
        ease: 'expo.inOut',
      })
      .to('.row-bottom .shutter-block', {
        scaleY: 0,
        duration: 0.85,
        stagger: { each: 0.07, from: 'start' },
        ease: 'expo.inOut',
      }, '<');
    });
  }

  function exitPage() {
    return new Promise((resolve) => {
      gsap.set('.shutter-block', { visibility: 'visible' });
      const tl = gsap.timeline({ onComplete: resolve });

      tl.fromTo('.row-top .shutter-block', { scaleY: 0 }, {
        scaleY: 1,
        duration: 0.85,
        stagger: { each: 0.07, from: 'end' },
        ease: 'expo.inOut',
      })
      .fromTo('.row-bottom .shutter-block', { scaleY: 0 }, {
        scaleY: 1,
        duration: 0.85,
        stagger: { each: 0.07, from: 'end' },
        ease: 'expo.inOut',
      }, '<');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    revealPage();

    document.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('mailto:') || link.target === '_blank' || href === window.location.pathname) {
          return;
        }

        e.preventDefault();
        exitPage().then(() => {
          window.location.href = href;
        });
      });
    });
  });
</script>
```

---

## Recipe 6: Procedural Web Audio Synthesizer (Escapement Ticks, Chimes & Scroll Audio)

Synthesizes tactile acoustic feedback for micro-interactions without loading external MP3 files:

```typescript
export class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = false;

  public toggle(): boolean {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isEnabled = !this.isEnabled;
    if (this.isEnabled) this.playHarmonicChime(520);
    return this.isEnabled;
  }

  public playTick(frequency: number = 2400, decay: number = 0.02, gainVal: number = 0.12) {
    if (!this.isEnabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'highpass';
    filter.frequency.value = 1800;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + decay);

    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + decay);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + decay);
  }

  public playHarmonicChime(rootFreq: number = 520) {
    if (!this.isEnabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(rootFreq, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 1.2);
  }
}
```
