// Shared look: one lighting model for everything solid in the world, so stones, ruins,
// rock, the tower and Kite all read as the same painted storybook dusk.
//
// Global uniforms are shared by reference; updating G.uTime.value updates every material.

import * as THREE from 'three-afternote';
import { COLORS, WORLD } from '../core/Constants.js';

export const G = {
  uTime: { value: 0 },
  uFogColor: { value: new THREE.Color(COLORS.FOG) },
  uFogDensity: { value: WORLD.FOG_DENSITY },
  uSunDir: { value: new THREE.Vector3(-0.35, 0.42, -0.84).normalize() },
  uSunColor: { value: new THREE.Color(0xffc9a8).multiplyScalar(0.95) },
  uSkyColor: { value: new THREE.Color(0x6a6fa8).multiplyScalar(0.62) },
  uGroundColor: { value: new THREE.Color(0x1d2a3c).multiplyScalar(0.7) },
  uEmberPos: { value: new THREE.Vector3(0, -1000, 0) },
  uEmberColor: { value: new THREE.Color(COLORS.EMBER) },
  uEmberPower: { value: 1.0 },
  uBeamPos: { value: new THREE.Vector3(0, -1000, 0) }, // the lit lens, once awake
  uBeamPower: { value: 0.0 },
  uAwake: { value: 0.0 }, // 0 = unfinished world, 1 = restored
  uContrast: { value: 0.0 }, // high-contrast accessibility: dims scenery
};

export const GLSL_COMMON = /* glsl */ `
uniform float uTime;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uEmberPos;
uniform vec3 uEmberColor;
uniform float uEmberPower;
uniform vec3 uBeamPos;
uniform float uBeamPower;
uniform float uAwake;
uniform float uContrast;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}

// Painted three-tone lighting: wrapped sun, hemisphere fill, warm ember, cool rim.
vec3 stylizedLight(vec3 albedo, vec3 shade, vec3 N, vec3 V, vec3 wpos, float rimAmount) {
  float ndl = dot(N, uSunDir);
  float wrap = smoothstep(-0.35, 0.75, ndl);
  vec3 hemi = mix(uGroundColor, uSkyColor, N.y * 0.5 + 0.5);
  vec3 col = mix(shade, albedo, wrap) * (uSunColor * (0.35 + 0.65 * wrap) + hemi);

  // Kite's ember: a small warm light that makes nearby stone feel close and safe.
  vec3 toEmber = uEmberPos - wpos;
  float d2 = dot(toEmber, toEmber);
  float emberAtt = uEmberPower / (1.0 + d2 * 0.4);
  float emberNdl = max(dot(N, normalize(toEmber)), 0.0) * 0.75 + 0.25;
  col += albedo * uEmberColor * emberAtt * emberNdl * 0.75;

  // The awakened lens washes the tower and island in gold.
  vec3 toBeam = uBeamPos - wpos;
  float bd2 = dot(toBeam, toBeam);
  col += albedo * vec3(1.0, 0.82, 0.55) * uBeamPower * (60.0 / (60.0 + bd2)) * (max(dot(N, normalize(toBeam)), 0.0) * 0.7 + 0.3);

  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += uSkyColor * fres * rimAmount * (0.6 + 0.6 * max(N.y, 0.0));
  return col;
}

vec3 applyFog(vec3 col, vec3 wpos, vec3 camPos) {
  float dist = length(wpos - camPos);
  float f = 1.0 - exp(-pow(dist * uFogDensity, 1.6));
  // mist hugs the water
  float low = exp(-max(wpos.y, 0.0) * 0.045);
  f = clamp(f * (0.55 + 0.45 * low), 0.0, 1.0);
  return mix(col, uFogColor, f);
}
`;

const STYLIZED_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv2;
varying float vLocalY;
#ifdef USE_INSTANCING_COLOR
varying vec3 vInstColor;
#endif
void main() {
  vLocalY = position.y;
  vec4 wp = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
    n = mat3(instanceMatrix) * n;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vInstColor = instanceColor;
  #endif
  wp = modelMatrix * wp;
  vWorldPos = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * n);
  vUv2 = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const STYLIZED_FRAG = /* glsl */ `
${GLSL_COMMON}
uniform vec3 uColor;
uniform vec3 uShade;
uniform vec3 uEmissive;
uniform float uGlow;        // animated emissive multiplier
uniform float uRim;
uniform float uGrain;       // amount of painted mottling
uniform float uGrainScale;
uniform float uOpacity;
uniform float uEdgeGlow;    // glowing band around the top face (built stones)
uniform vec3 uEdgeColor;
uniform float uWarm;        // how much this object wakes with the world
#ifdef USE_MAP
uniform sampler2D uMap;
#endif
varying vec3 vWorldPos;
varying vec3 vNormalW;
varying vec2 vUv2;
varying float vLocalY;
#ifdef USE_INSTANCING_COLOR
varying vec3 vInstColor;
#endif

void main() {
  vec3 N = normalize(vNormalW);
  #ifdef FLAT_SHADED
    N = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
  #endif
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 albedo = uColor;
  vec3 shade = uShade;
  #ifdef USE_INSTANCING_COLOR
    albedo *= vInstColor;
    shade *= vInstColor;
  #endif
  #ifdef USE_MAP
    vec3 tex = texture2D(uMap, vUv2).rgb;
    albedo *= tex;
    shade *= mix(vec3(1.0), tex, 0.6);
  #endif
  // hand-painted mottling in world space so neighbouring pieces do not tile
  float g = fbm(vWorldPos.xz * uGrainScale + vWorldPos.y * 0.7);
  float g2 = vnoise(vWorldPos.xy * uGrainScale * 2.3 + vWorldPos.z);
  albedo *= 1.0 + (g - 0.5) * uGrain + (g2 - 0.5) * uGrain * 0.5;
  // the unfinished world is drained; it warms as it wakes
  float lum = dot(albedo, vec3(0.3, 0.5, 0.2));
  albedo = mix(mix(vec3(lum), albedo, 0.45), albedo, clamp(uAwake + uWarm, 0.0, 1.0));
  albedo *= 1.0 - uContrast * 0.45 * (1.0 - uWarm);

  vec3 col = stylizedLight(albedo, shade, N, V, vWorldPos, uRim);

  vec3 emissive = uEmissive * uGlow;
  #ifdef EDGE_GLOW
    // player-built stone: a fine line of light around the rim, gold veins in the marble,
    // and warmth spilling down the sides
    vec2 q = abs(vUv2 - 0.5) * 2.0;
    float top = step(0.55, N.y);
    float m = max(q.x, q.y);
    float rimLine = smoothstep(0.8, 0.93, m) * (1.0 - smoothstep(0.985, 1.0, m));
    float wash = smoothstep(0.35, 1.0, m) * 0.22;
    float vn = fbm(vWorldPos.xz * 1.9 + 7.3);
    float vein = smoothstep(0.03, 0.0, abs(vn - 0.5)) * (0.4 + 0.6 * vnoise(vWorldPos.xz * 0.9));
    float side = (1.0 - top) * smoothstep(-0.55, 0.0, vLocalY) * step(-0.2, N.y);
    emissive += uEdgeColor * uEdgeGlow * (top * (rimLine * 1.5 + wash + vein * 0.55) + side * 0.5 + 0.03);
  #endif
  col += emissive;
  col = applyFog(col, vWorldPos, cameraPosition);
  gl_FragColor = vec4(col, uOpacity);
}
`;

/**
 * The shared solid material.
 * @param {object} o color, shade, emissive, glow, rim, grain, grainScale, map, flat, edgeGlow, edgeColor,
 *                   warm (0..1: 1 = always fully coloured, e.g. player-built things), transparent, opacity
 */
export function makeStylized(o = {}) {
  const color = new THREE.Color(o.color ?? 0x808080);
  const shade = o.shade !== undefined ? new THREE.Color(o.shade) : color.clone().multiplyScalar(0.42).lerp(new THREE.Color(0x1c2040), 0.35);
  const defines = {};
  if (o.map) defines.USE_MAP = '';
  if (o.flat) defines.FLAT_SHADED = '';
  if (o.edgeGlow !== undefined) defines.EDGE_GLOW = '';
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      ...G,
      uColor: { value: color },
      uShade: { value: shade },
      uEmissive: { value: new THREE.Color(o.emissive ?? 0x000000) },
      uGlow: { value: o.glow ?? 1 },
      uRim: { value: o.rim ?? 0.5 },
      uGrain: { value: o.grain ?? 0.35 },
      uGrainScale: { value: o.grainScale ?? 0.9 },
      uOpacity: { value: o.opacity ?? 1 },
      uEdgeGlow: { value: o.edgeGlow ?? 0 },
      uEdgeColor: { value: new THREE.Color(o.edgeColor ?? COLORS.GOLD) },
      uWarm: { value: o.warm ?? 0 },
      uMap: { value: o.map ?? null },
    },
    defines,
    vertexShader: STYLIZED_VERT,
    fragmentShader: STYLIZED_FRAG,
    transparent: !!o.transparent,
    depthWrite: o.depthWrite ?? !o.transparent,
    side: o.side ?? THREE.FrontSide,
  });
  return mat;
}

// ---------------------------------------------------------------------------------
// Additive glow material for ribbons, rings and light: colour * intensity, soft edges.
// ---------------------------------------------------------------------------------
export function makeGlow(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: G.uTime,
      uColor: { value: new THREE.Color(o.color ?? COLORS.GOLD) },
      uIntensity: { value: o.intensity ?? 1 },
      uOpacity: { value: o.opacity ?? 1 },
      uFlow: { value: o.flow ?? 0 },
      uMap: { value: o.map ?? null },
    },
    defines: o.map ? { USE_MAP: '' } : {},
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying float vNear;
      void main() {
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNear = smoothstep(2.5, 9.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vNear;
      uniform float uTime; uniform vec3 uColor; uniform float uIntensity; uniform float uOpacity; uniform float uFlow;
      #ifdef USE_MAP
      uniform sampler2D uMap;
      #endif
      varying vec2 vUv;
      void main() {
        float a = 1.0;
        #ifdef USE_MAP
          vec4 t = texture2D(uMap, vUv);
          a = t.a;
        #else
          // soft across the width (v), with a travelling shimmer along the length (u)
          float across = 1.0 - abs(vUv.y - 0.5) * 2.0;
          a = smoothstep(0.0, 0.7, across);
          a *= 0.75 + 0.25 * sin(vUv.x * 40.0 - uTime * uFlow);
        #endif
        a *= vNear;
        gl_FragColor = vec4(uColor * uIntensity * a * uOpacity, a * uOpacity);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ---------------------------------------------------------------------------------
// Canvas textures
// ---------------------------------------------------------------------------------
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

let _soft = null;
/** A soft round falloff, for halos and motes. */
export function softDotTexture() {
  if (_soft) return _soft;
  const c = canvas(128, 128);
  const g = c.getContext('2d');
  const img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const d = Math.hypot(x - 63.5, y - 63.5) / 64;
      // gaussian core with a long quiet tail that reaches exactly zero at the edge
      const v = Math.max(0, Math.exp(-d * d * 5.5) - Math.exp(-5.5)) / (1 - Math.exp(-5.5));
      const a = Math.round(255 * v * (1 - Math.min(1, d) ** 6));
      const i = (y * 128 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a;
    }
  }
  g.putImageData(img, 0, 0);
  _soft = new THREE.CanvasTexture(c);
  _soft.colorSpace = THREE.NoColorSpace;
  return _soft;
}

const _letters = new Map();
/** A pitch letter, engraved-serif style, white on transparent. */
export function letterTexture(letter, font = 'italic 600 150px "Cormorant Garamond", "Times New Roman", serif') {
  const key = letter + font;
  if (_letters.has(key)) return _letters.get(key);
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  // (a note with a sharp or a flat is two signs wide: drawn a little smaller so it stays on the stone)
  g.font = letter.length > 1 ? font.replace('150px', '112px') : font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#ffffff';
  g.fillText(letter, 128, 138);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  _letters.set(key, t);
  return t;
}

const _caps = new Map();
/**
 * A physical-looking keycap with a label: the in-world sign for "press this key".
 * Deliberately unlike a note letter: squared, light, bold sans-serif.
 */
export function keycapTexture(label) {
  if (_caps.has(label)) return _caps.get(label);
  const c = canvas(160, 160);
  const g = c.getContext('2d');
  const rr = (x, y, w, h, r) => {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  };
  // the lip of the key, then its face
  rr(22, 34, 116, 112, 24);
  g.fillStyle = '#8f8776';
  g.fill();
  rr(22, 20, 116, 112, 24);
  const face = g.createLinearGradient(0, 20, 0, 132);
  face.addColorStop(0, '#fffdf6');
  face.addColorStop(1, '#ddd5c5');
  g.fillStyle = face;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(60,50,70,0.35)';
  g.stroke();
  g.fillStyle = '#2b2436';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = label.length > 1 ? 54 : 78;
  g.font = `700 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  g.fillText(label, 80, 79);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  _caps.set(label, t);
  return t;
}

/** Call once fonts are ready so letters are redrawn in the real typeface. */
export function refreshLetterTextures() {
  for (const [key, tex] of _letters) {
    const letter = key[0];
    const font = key.slice(1);
    const g = tex.image.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffffff';
    g.fillText(letter, 128, 138);
    tex.needsUpdate = true;
  }
}

let _marble = null;
/** Pale veined marble for player-built stones. */
export function marbleTexture() {
  if (_marble) return _marble;
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#f4efe6';
  g.fillRect(0, 0, 256, 256);
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 900; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = 2 + rnd() * 16;
    g.fillStyle = `rgba(${200 + rnd() * 40 | 0},${195 + rnd() * 40 | 0},${200 + rnd() * 40 | 0},${0.04 + rnd() * 0.06})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 16; i++) {
    g.strokeStyle = `rgba(120,112,130,${0.1 + rnd() * 0.16})`;
    g.lineWidth = 0.6 + rnd() * 1.6;
    g.beginPath();
    let x = rnd() * 256, y = rnd() * 256;
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (rnd() - 0.5) * 120;
      y += (rnd() - 0.5) * 120;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  _marble = new THREE.CanvasTexture(c);
  _marble.colorSpace = THREE.NoColorSpace;
  _marble.wrapS = _marble.wrapT = THREE.RepeatWrapping;
  return _marble;
}

/** A thin ring (or a double ring for resonance), white on transparent. */
export function ringTexture(double = false) {
  const c = canvas(256, 256);
  const g = c.getContext('2d');
  g.strokeStyle = '#fff';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(128, 128, 112, 0, Math.PI * 2);
  g.stroke();
  if (double) {
    g.lineWidth = 5;
    g.beginPath();
    g.arc(128, 128, 88, 0, Math.PI * 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// ---------------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------------

/** A chunky chamfered slab: top face at y=0, 1x1 footprint, 1 thick, tapering underneath. */
export function slabGeometry(seed = 1) {
  let s = seed * 9301 + 49297;
  const rnd = () => {
    s = (s * 233280 + 12345) % 2147483647;
    return (s % 10000) / 10000;
  };
  const c = () => 0.13 + rnd() * 0.1;
  const j = () => (rnd() - 0.5) * 0.05;
  const shape = new THREE.Shape();
  const pts = [
    [-0.5 + c(), -0.5 + j()], [0.5 - c(), -0.5 + j()], [0.5 + j(), -0.5 + c()], [0.5 + j(), 0.5 - c()],
    [0.5 - c(), 0.5 + j()], [-0.5 + c(), 0.5 + j()], [-0.5 + j(), 0.5 - c()], [-0.5 + j(), -0.5 + c()],
  ];
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.86, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.045, bevelSegments: 2, steps: 2 });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, -0.07, 0); // top face exactly at y = 0, where feet land
  // taper and roughen the underside so it reads as a floating chunk of rock
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const x = pos.getX(i), z = pos.getZ(i);
    uv.setXY(i, x + 0.5, z + 0.5);
    if (y < -0.2) {
      const t = Math.min(1, (-y - 0.2) / 0.8);
      const k = 1 - 0.34 * t * t;
      pos.setX(i, x * k);
      pos.setZ(i, z * k);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * A flat ribbon following a list of points. UV.x runs along the length (0..1), UV.y across.
 * `ups` optional per-point up vectors; defaults to world up.
 */
export function ribbonGeometry(points, width, widths = null) {
  const n = points.length;
  const pos = new Float32Array(n * 2 * 3);
  const uv = new Float32Array(n * 2 * 2);
  const idx = [];
  const tan = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    tan.subVectors(b, a).normalize();
    side.crossVectors(tan, up).normalize();
    const w = (widths ? widths[i] : width) * 0.5;
    const p = points[i];
    pos.set([p.x - side.x * w, p.y - side.y * w, p.z - side.z * w, p.x + side.x * w, p.y + side.y * w, p.z + side.z * w], i * 6);
    uv.set([i / (n - 1), 0, i / (n - 1), 1], i * 4);
    if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material && !o.material.userData?.shared) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
  if (obj.parent) obj.parent.remove(obj);
}
