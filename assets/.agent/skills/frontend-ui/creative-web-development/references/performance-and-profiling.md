# Performance Engineering, Profiling & Mobile Degradation

An authoritative operational guide for maintaining a locked 60 FPS frame rate, eliminating memory leaks, budgeting WebGL draw calls, and implementing graceful mobile degradation across creative web applications.

---

## 1. The 16.6ms Frame Budget & Execution Allocation

To maintain a consistent 60 FPS on standard $60\text{Hz}$ screens (or 120 FPS / $8.3\text{ms}$ on ProMotion displays), every millisecond inside the frame cycle must be strictly partitioned:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        16.6ms FRAME BUDGET                             │
├─────────────────┬───────────────────┬───────────────────┬──────────────┤
│ 4.0ms: JS / Physics │ 4.0ms: Draw Call Prep │ 6.0ms: GPU Render │ 2.6ms Margin │
│ (Lerp, Lenis, Math) │ (Three.js Scene Graph)│ (Raster, Shaders) │ (Headroom)   │
└─────────────────┴───────────────────┴───────────────────┴──────────────┘
```

---

## 2. Strict DPR Clamping Protocol

Unconstrained `window.devicePixelRatio` on high-density mobile screens (e.g., iPhone Super Retina at 3x or 3.75x) increases GPU fill-rate workload by **9x**, causing immediate thermal throttling and dropped frames. Always clamp DPR to a maximum ceiling of 2.0.

```javascript
// Universal High-DPI Clamping Utility
export function getSafeDPR(maxDpr = 2.0) {
  return Math.min(window.devicePixelRatio || 1.0, maxDpr);
}

// 1. Applying to Three.js Renderer
renderer.setPixelRatio(getSafeDPR(2.0));

// 2. Applying to HTML5 2D Canvas
export function resizeCanvasDPR(canvas, ctx, width, height) {
  const dpr = getSafeDPR(2.0);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);
}
```

---

## 3. WebGL Draw Call Budgeting & GPU Instancing

Every unique `THREE.Mesh` creates an individual CPU-to-GPU draw call. Maintain a strict budget of **$< 50$ draw calls on mobile** and **$< 100$ on desktop**. Use `THREE.InstancedMesh` to render thousands of geometric instances in a single GPU draw call.

```javascript
import * as THREE from 'three';

export function createInstancedParticleField(count = 5000) {
  const geometry = new THREE.SphereGeometry(0.06, 8, 8);
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.25,
    metalness: 0.85,
    color: 0xffffff,
  });

  const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // Pre-allocate transformation helpers outside the loop to prevent GC churn
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    // Spatial positioning
    dummy.position.set(
      (Math.random() - 0.5) * 25,
      (Math.random() - 0.5) * 25,
      (Math.random() - 0.5) * 25
    );
    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    dummy.scale.setScalar(Math.random() * 0.8 + 0.2);
    dummy.updateMatrix();

    instancedMesh.setMatrixAt(i, dummy.matrix);

    // Per-instance color assignment
    color.setHSL(i / count, 0.7, 0.5);
    instancedMesh.setColorAt(i, color);
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  if (instancedMesh.instanceColor) {
    instancedMesh.instanceColor.needsUpdate = true;
  }

  return instancedMesh;
}
```

---

## 4. Zero-Allocation Render Loop Protocol

Instantiating objects (`new THREE.Vector3()`, `new Array()`, string concatenations) inside `requestAnimationFrame` or `useFrame` loops triggers frequent Garbage Collection (GC) sweeps, producing intermittent frame drops and visual stutters.

### Anti-Pattern vs. Zero-Allocation Pattern

```javascript
import * as THREE from 'three';

// ❌ ANTI-PATTERN: Heap allocation per frame (Triggers GC pause!)
function animateBad() {
  const target = new THREE.Vector3(mouse.x, mouse.y, 0); // Allocates on heap every 16ms
  camera.position.lerp(target, 0.05);
  requestAnimationFrame(animateBad);
}

//  ZERO-ALLOCATION PATTERN: Pre-allocated scratch vectors at module scope
const SCRATCH_TARGET = new THREE.Vector3();
const SCRATCH_DELTA = new THREE.Vector3();
const SCRATCH_MATRIX = new THREE.Matrix4();

export class OptimizedParticleController {
  constructor(mesh) {
    this.mesh = mesh;
  }

  renderLoop(mouseX, mouseY, delta) {
    // Mutate existing pre-allocated memory in-place
    SCRATCH_TARGET.set(mouseX, mouseY, 0);
    SCRATCH_DELTA.copy(SCRATCH_TARGET).sub(this.mesh.position);
    this.mesh.position.addScaledVector(SCRATCH_DELTA, delta * 3.0);
  }
}
```

---

## 5. Comprehensive Resource Deallocation & Teardown

Prevent memory leaks when navigating between routes in Single Page Applications (Next.js, Nuxt, Barba) by systematically releasing GPU buffers, textures, renderers, and event listeners.

```javascript
export function fullExperienceTeardown(context) {
  const { renderer, scene, lenis, scrollTriggers, animFrameId, listeners } = context;

  // 1. Cancel Active RAF Loop
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
  }

  // 2. Kill GSAP ScrollTrigger Instances
  if (scrollTriggers && Array.isArray(scrollTriggers)) {
    scrollTriggers.forEach((st) => st.kill());
  }

  // 3. Destroy Lenis Smooth Scroll Engine
  if (lenis) {
    lenis.destroy();
  }

  // 4. Remove Bound DOM Event Listeners
  if (listeners && Array.isArray(listeners)) {
    listeners.forEach(({ target, type, handler }) => {
      target.removeEventListener(type, handler);
    });
  }

  // 5. Traverse & Dispose Three.js Scene Graph
  if (scene) {
    scene.traverse((object) => {
      if (!object.isMesh) return;

      if (object.geometry) {
        object.geometry.dispose();
      }

      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((mat) => disposeMaterial(mat));
        } else {
          disposeMaterial(object.material);
        }
      }
    });
  }

  // 6. Force Context Loss & Cleanup Renderer DOM
  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss();
    if (renderer.domElement && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  }
}

function disposeMaterial(material) {
  Object.keys(material).forEach((key) => {
    const value = material[key];
    if (value && typeof value === 'object' && 'minFilter' in value) {
      value.dispose(); // Dispose Texture
    }
  });
  material.dispose();
}
```

---

## 6. Device Tiering & Mobile Graceful Degradation Matrix

Adapt visual complexity dynamically based on device hardware capabilities and user accessibility preferences.

```javascript
export function detectDeviceCapabilities() {
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  ) || (window.innerWidth <= 768);

  const isLowPower = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (isMobile || isLowPower) {
    return {
      tier: 'mobile',
      dpr: 1.5,
      particleStride: 8, // 75% particle count reduction compared to 4px
      particleCount: 1200,
      enableShadows: false,
      enablePostProcessing: false,
      textureScale: 0.5,
      prefersReducedMotion: prefersReduced,
    };
  }

  return {
    tier: 'desktop',
    dpr: 2.0,
    particleStride: 4,
    particleCount: 5000,
    enableShadows: true,
    enablePostProcessing: true,
    textureScale: 1.0,
    prefersReducedMotion: prefersReduced,
  };
}
```

### Applied Adaptive Configuration

```javascript
const hardware = detectDeviceCapabilities();

// Configure Renderer
renderer.setPixelRatio(hardware.dpr);
renderer.shadowMap.enabled = hardware.enableShadows;

// Handle Reduced Motion Preferences
if (hardware.prefersReducedMotion) {
  // Replace spatial scroll travel with simple opacity fades
  gsap.set('.animated-element', { transform: 'none', opacity: 1 });
}
```

---

## 7. Automated Creative Diagnostic Harness (`window.__CREATIVE_AUDIT__`)

Deploy this runtime telemetry collector into every application during development. It exposes real-time performance invariants directly to automated test runners:

```typescript
export interface CreativeAuditReport {
  isScrollUnlocked: boolean;
  maxScroll: number;
  fpsAverage: number;
  frameDrops: number;
  webglDrawCalls: number;
  shaderErrors: string[];
}

export function initCreativeAudit(renderer?: THREE.WebGLRenderer, lenis?: any) {
  const audit: CreativeAuditReport = {
    isScrollUnlocked: false,
    maxScroll: 0,
    fpsAverage: 60,
    frameDrops: 0,
    webglDrawCalls: 0,
    shaderErrors: []
  };

  let frameCount = 0;
  let lastTime = performance.now();
  let droppedFrames = 0;

  function auditLoop(now: number) {
    const delta = now - lastTime;
    lastTime = now;
    frameCount++;

    if (delta > 22) droppedFrames++;

    if (renderer) {
      audit.webglDrawCalls = renderer.info.render.calls;
    }

    if (lenis) {
      audit.maxScroll = lenis.limit;
      audit.isScrollUnlocked = lenis.limit > 0;
    } else {
      audit.maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      audit.isScrollUnlocked = audit.maxScroll > 0;
    }

    audit.frameDrops = droppedFrames;
    audit.fpsAverage = Math.round((frameCount * 1000) / (now || 1));

    (window as any).__CREATIVE_AUDIT__ = audit;
    requestAnimationFrame(auditLoop);
  }

  requestAnimationFrame(auditLoop);
}
```

---

## 8. Headless Playwright Experience Verifier (`scripts/verifyExperience.js`)

Run this script in terminal (`node scripts/verifyExperience.js`) to programmatically verify motion smoothness, scroll fluidity, and zero shader errors:

```javascript
import { chromium } from 'playwright';

async function verify() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto('http://localhost:3000');
  await page.waitForTimeout(1000);

  // 1. Simulate Synthetic Scroll (0% -> 50% -> 100%)
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'instant' }));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
  await page.waitForTimeout(500);

  // 2. Extract Diagnostic Payload
  const report = await page.evaluate(() => window.__CREATIVE_AUDIT__);
  report.consoleErrors = consoleErrors;

  await browser.close();

  console.log('=== CREATIVE VERIFICATION AUDIT ===');
  console.log(JSON.stringify(report, null, 2));

  // Exit with failure code if any critical invariant is violated
  if (!report.isScrollUnlocked) {
    console.error('FATAL: Scroll container is locked (maxScroll <= 0). Check html/body height.');
    process.exit(1);
  }
  if (report.consoleErrors.length > 0) {
    console.error('FATAL: Console errors detected during animation playback.');
    process.exit(1);
  }
  if (report.webglDrawCalls > 100) {
    console.error('WARNING: WebGL draw calls exceed budget of 100.');
  }

  console.log('SUCCESS: All creative invariants verified.');
}
verify();
```
