# GLSL Shaders & GPU Visual Computation

An authoritative engineering manual for authoring hardware-accelerated vertex displacement shaders, fragment distortion force fields, procedural noise generators (Simplex, FBM, Curl), and mouse-velocity RGB chromatic aberration filters.

---

## 1. Uniform Interface & Aspect-Corrected Coordinates

Pass normalized mouse coordinates, decaying velocity vectors, resolution bounds, and textures to GPU shaders while preventing non-square coordinate distortion.

```javascript
import * as THREE from 'three';

export function createDistortionMaterial(texture, containerWidth, containerHeight) {
  return new THREE.ShaderMaterial({
    vertexShader: vertexShaderSource,
    fragmentShader: fragmentShaderSource,
    uniforms: {
      uTime: { value: 0.0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uVelocity: { value: new THREE.Vector2(0.0, 0.0) },
      uSpeed: { value: 0.0 },
      uTexture: { value: texture },
      uResolution: { value: new THREE.Vector2(containerWidth, containerHeight) },
      uImageResolution: { value: new THREE.Vector2(texture.image ? texture.image.width : 1920, texture.image ? texture.image.height : 1080) },
    },
    transparent: true,
  });
}
```

---

## 2. Vertex Displacement & Radial Wave Physics

Displace 3D mesh vertices dynamically along normal vectors based on distance to the cursor, time, and speed.

```glsl
// vertex.glsl
uniform float uTime;
uniform vec2 uMouse;
uniform float uSpeed;

varying vec2 vUv;
varying float vDisplacement;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vNormal = normal;

  // Calculate Euclidean distance to normalized cursor coordinates
  float dist = distance(uv, uMouse);

  // Compute decaying radial ripple
  float ripple = sin(dist * 20.0 - uTime * 4.0) * exp(-dist * 5.0);
  
  // Modulate displacement by cursor speed
  float displacement = ripple * clamp(uSpeed * 0.2, 0.0, 0.5);
  vDisplacement = displacement;

  // Offset vertex position along normal vector
  vec3 displacedPosition = position + normal * displacement;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
}
```

---

## 3. Procedural Noise Algorithms in GLSL

Embed pure GLSL 2D Simplex Noise, 4-Octave Fractional Brownian Motion (FBM), and divergence-free Curl Noise directly into your shader programs.

```glsl
// ==========================================
// 1. 2D Simplex Noise Kernel (Ashima / McEwan)
// ==========================================
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// ==========================================
// 2. 4-Octave Fractal Brownian Motion (FBM)
// ==========================================
float fbm(vec2 uv) {
  float value = 0.0;
  float amplitude = 0.5;
  float frequency = 1.0;
  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));

  for (int i = 0; i < 4; i++) {
    value += amplitude * snoise(uv * frequency);
    uv = rot * uv * 2.0 + vec2(100.0);
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return value;
}

// ==========================================
// 3. Divergence-Free 2D Curl Noise
// ==========================================
vec2 curlNoise(vec2 p) {
  const float e = 0.01;
  float n1 = snoise(vec2(p.x, p.y + e));
  float n2 = snoise(vec2(p.x, p.y - e));
  float n3 = snoise(vec2(p.x + e, p.y));
  float n4 = snoise(vec2(p.x - e, p.y));

  float x = (n1 - n2) / (2.0 * e);
  float y = -(n3 - n4) / (2.0 * e);
  return vec2(x, y);
}
```

---

## 4. Mouse-Velocity Distortion & RGB Chromatic Aberration

Sample texture color channels with differential spatial offsets proportional to cursor velocity and procedural noise turbulence.

```glsl
// fragment.glsl
uniform sampler2D uTexture;
uniform vec2 uMouse;
uniform vec2 uVelocity;
uniform float uSpeed;
uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uImageResolution;

varying vec2 vUv;
varying float vDisplacement;

// Aspect-ratio cover mapping prevents texture stretching
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
  vec2 uv = getCoverUv(vUv, uResolution, uImageResolution);

  // 1. Calculate Cursor Proximity Force Field
  float dist = distance(vUv, uMouse);
  float force = smoothstep(0.4, 0.0, dist);

  // 2. Compute Organic Noise Displacement
  float noise = fbm(uv * 4.0 + uTime * 0.2);
  vec2 distortion = (uVelocity * 0.08 + vec2(noise * 0.02)) * force;

  // 3. Chromatic Aberration (RGB Channel Splitting)
  float r = texture2D(uTexture, uv + distortion * 1.3).r;
  float g = texture2D(uTexture, uv + distortion).g;
  float b = texture2D(uTexture, uv + distortion * 0.7).b;
  float a = texture2D(uTexture, uv).a;

  // 4. Highlight Flash on Fast Cursor Swipe
  float flash = uSpeed * force * 0.15;
  vec3 finalColor = vec3(r, g, b) + vec3(flash);

  gl_FragColor = vec4(finalColor, a);
}
```

---

## 5. CPU Mouse Tracking & Decaying Velocity Engine

Drive shader uniforms by computing cursor delta vectors and applying continuous exponential decay in JavaScript.

```javascript
export class MouseVelocityTracker {
  constructor() {
    this.mouse = new THREE.Vector2(0.5, 0.5);
    this.targetMouse = new THREE.Vector2(0.5, 0.5);
    this.prevMouse = new THREE.Vector2(0.5, 0.5);
    this.velocity = new THREE.Vector2(0, 0);
    this.speed = 0;

    this.onMouseMove = this.onMouseMove.bind(this);
    window.addEventListener('mousemove', this.onMouseMove);
  }

  onMouseMove(event) {
    // Convert to normalized coordinates (0.0 to 1.0)
    this.targetMouse.x = event.clientX / window.innerWidth;
    this.targetMouse.y = 1.0 - (event.clientY / window.innerHeight); // Invert Y for WebGL UV space
  }

  update() {
    // 1. Interpolate mouse position toward target
    this.mouse.lerp(this.targetMouse, 0.12);

    // 2. Compute frame delta velocity
    const deltaX = this.mouse.x - this.prevMouse.x;
    const deltaY = this.mouse.y - this.prevMouse.y;

    this.velocity.set(deltaX, deltaY);
    this.speed = Math.hypot(deltaX, deltaY) * 50.0;
    this.prevMouse.copy(this.mouse);

    // 3. Apply exponential velocity decay
    this.velocity.multiplyScalar(0.92);
  }

  destroy() {
    window.removeEventListener('mousemove', this.onMouseMove);
  }
}
```
