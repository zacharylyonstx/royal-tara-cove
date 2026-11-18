import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Geometry + textures for Siren Head (components/horror/SirenHead.tsx).
//
// Everything is generated — no model file. The old creature was boxes and
// six-sided cylinders; this builds ORGANIC shapes instead: limbs swept along a
// path with a radius that swells at the joints and ripples with sinew, a lofted
// rib-cage with a hollow belly and a knuckled spine, flared horn bells turned on
// a lathe, and canvas-painted skin / rust maps (colour + bump) so the surface
// reads as dried flesh and weathered metal rather than flat paint.

// ------------------------------------------------------------------ noise --
function hash(x: number, y: number, z: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
/** Smooth 3-D value noise, 0..1. */
export function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
    l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------------------------------------------- sweeps --
export interface SweepOpts {
  radial?: number;
  /** Sinew: how many cords run down the limb, and how proud they stand. */
  ridges?: number; ridgeAmp?: number;
  /** Lumpy irregularity (fraction of the radius). */
  lump?: number;
  /** Cross-section stretch (flat palms, deep chests). */
  sx?: number; sz?: number;
  /** Texture repeats: around, and metres per repeat along. */
  uAround?: number; vPer?: number;
  seed?: number;
  /** Darkening 0..1 along the length (grime toward hands, feet, finger tips). */
  shade?: (t: number) => number;
}

/** Fraction of a sweep's length over which each end rounds off. */
const CAP = 0.035;

/**
 * A tube swept along `path` whose radius is `radius(t)` (t = 0..1 along it).
 * The frame is parallel-transported, so bent paths (fingers, necks) don't twist.
 */
export function sweep(path: THREE.Vector3[], radius: (t: number) => number, o: SweepOpts = {}): THREE.BufferGeometry {
  const N = o.radial ?? 10, K = path.length - 1;
  const ridges = o.ridges ?? 3, ridgeAmp = o.ridgeAmp ?? 0.1, lump = o.lump ?? 0.1;
  const sx = o.sx ?? 1, sz = o.sz ?? 1, seed = o.seed ?? 1;
  const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const T = new THREE.Vector3(), Nn = new THREE.Vector3(1, 0, 0), B = new THREE.Vector3(), prevT = new THREE.Vector3();
  const q = new THREE.Quaternion(), p = new THREE.Vector3();
  let len = 0;
  for (let k = 0; k <= K; k++) {
    const a = path[Math.max(0, k - 1)], b = path[Math.min(K, k + 1)];
    T.subVectors(b, a).normalize();
    if (k === 0) {
      // Any normal that isn't along the tangent.
      Nn.set(1, 0, 0);
      if (Math.abs(T.x) > 0.9) Nn.set(0, 0, 1);
      Nn.addScaledVector(T, -Nn.dot(T)).normalize();
    } else {
      q.setFromUnitVectors(prevT, T);
      Nn.applyQuaternion(q).addScaledVector(T, -Nn.dot(T)).normalize();
      len += path[k].distanceTo(path[k - 1]);
    }
    prevT.copy(T);
    B.crossVectors(T, Nn);
    const t = k / K;
    // Round both ends off to a point, so no tube is ever an open pipe.
    const capT = Math.min(t, 1 - t) / CAP;
    const cap = capT >= 1 ? 1 : Math.sqrt(Math.max(0.0004, 1 - (1 - capT) * (1 - capT)));
    const r = radius(t) * cap;
    const sh = 1 - (o.shade ? o.shade(t) : 0);
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      // Cords of sinew + lumps; valleys between cords read darker.
      const cord = Math.sin(th * ridges + seed * 1.7 + t * 1.3);
      const n = noise3(c * 1.7 + seed * 3.1, t * (len + 1) * 2.2 + seed, s * 1.7) - 0.5;
      const rr = r * (1 + ridgeAmp * cord + lump * n * 2);
      p.copy(path[k]).addScaledVector(Nn, c * rr * sx).addScaledVector(B, s * rr * sz);
      pos.push(p.x, p.y, p.z);
      uv.push((i / N) * (o.uAround ?? 2), len / (o.vPer ?? 1.4));
      const ao = sh * (0.8 + 0.2 * (cord * 0.5 + 0.5)) * (0.86 + 0.28 * (n + 0.5));
      col.push(ao, ao, ao);
    }
  }
  const W = N + 1;
  for (let k = 0; k < K; k++) for (let i = 0; i < N; i++) {
    const a = k * W + i, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  weldSeam(g, W, K + 1);
  return g;
}

/** Make the two edges of a wrapped grid share normals (no visible seam). */
function weldSeam(g: THREE.BufferGeometry, W: number, rows: number) {
  const n = g.getAttribute('normal') as THREE.BufferAttribute;
  for (let k = 0; k < rows; k++) {
    const a = k * W, b = a + W - 1;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l);
    n.setXYZ(b, x / l, y / l, z / l);
  }
}

/** Straight points from (0,0,0) down −Y for `len`, bowed a little along Z. */
export function boneLine(len: number, steps = 12, bow = 0): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push(new THREE.Vector3(0, -len * t, Math.sin(t * Math.PI) * bow));
  }
  return out;
}

/** A wasted limb: thin shaft, swollen knobs at both joints. */
export function limbRadius(r0: number, r1: number, knob0 = 0.5, knob1 = 0.45) {
  return (t: number) => {
    const shaft = r0 + (r1 - r0) * t;
    const k0 = Math.exp(-((t / 0.085) ** 2)) * knob0;
    const k1 = Math.exp(-(((1 - t) / 0.075) ** 2)) * knob1;
    // A trace of muscle a third of the way down.
    const belly = Math.exp(-(((t - 0.3) / 0.2) ** 2)) * 0.16;
    return shaft * (1 + k0 + k1 + belly);
  };
}

/** A knobby lump (joints, hip bones, shoulder blades). */
export function knob(r: number, sx = 1, sy = 1, sz = 1, seed = 1, shade = 0.12): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(r, 14, 10);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = noise3(x * 5 / r * 0.3 + seed, y * 5 / r * 0.3, z * 5 / r * 0.3 + seed * 2) - 0.5;
    const k = 1 + n * 0.35;
    pos.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
    const c = (1 - shade) * (0.85 + 0.3 * (n + 0.5));
    col[i * 3] = c; col[i * 3 + 1] = c; col[i * 3 + 2] = c;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ torso --
/** Torso height (pelvis floor → shoulder line), in the creature's own units. */
export const TORSO_H = 2.15;

const KEYS: [number, number, number][] = [
  // t, half-width, half-depth
  [0.0, 0.27, 0.17], [0.07, 0.36, 0.2], [0.14, 0.33, 0.18], [0.24, 0.2, 0.125], [0.33, 0.24, 0.15],
  [0.42, 0.34, 0.23], [0.58, 0.4, 0.275], [0.74, 0.42, 0.27], [0.88, 0.39, 0.22], [0.96, 0.33, 0.17], [1.0, 0.2, 0.12],
];
function key(t: number): [number, number] {
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i], b = KEYS[i + 1];
    if (t <= b[0]) {
      const k = (t - a[0]) / (b[0] - a[0]), s = k * k * (3 - 2 * k);
      return [a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
    }
  }
  return [KEYS[KEYS.length - 1][1], KEYS[KEYS.length - 1][2]];
}
/** How far the spine curls forward at height t (the hunch). */
export function spineCurl(t: number): number {
  return 0.3 * t * t;
}

/**
 * The trunk: bony pelvis, a waist you could close a hand round, a starved
 * rib-cage (every rib standing out, the belly sucked in beneath it) and a row
 * of vertebrae down the back. Origin = pelvis floor, +Z = chest.
 */
export function torsoGeometry(): THREE.BufferGeometry {
  const J = 46, N = 28;
  const pos: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  for (let j = 0; j <= J; j++) {
    const t = j / J;
    const [hw, hd] = key(t);
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI * 2;       // 0 = chest, π = spine
      const c = Math.cos(th), s = Math.sin(th);
      const front = Math.max(0, c);
      let rx = hw, rz = hd, shade = 0;
      // Ribs: raised hoops round the cage, fading at the breastbone and spine.
      const inCage = smooth(0.38, 0.45, t) * (1 - smooth(0.86, 0.93, t));
      // (They slope: each rib sits lower at the breastbone than at the spine.)
      const rib = Math.sin(((t + 0.05 * c - 0.38) / 0.5) * Math.PI * 9);
      const ribMask = inCage * (1 - Math.pow(Math.abs(c), 6) * 0.8);
      const ribLift = ribMask * (rib > 0 ? Math.pow(rib, 2.2) * 0.04 : rib * 0.012);
      shade += ribMask * (rib < 0.25 ? (0.25 - rib) * 0.42 : 0);
      // The belly: hollowed out under the ribs.
      const belly = smooth(0.1, 0.22, t) * (1 - smooth(0.3, 0.42, t)) * front;
      rz *= 1 - belly * 0.42;
      shade += belly * 0.3;
      // Breastbone: a flat plate down the middle of the chest.
      const sternum = inCage * Math.exp(-(((th > Math.PI ? th - Math.PI * 2 : th) / 0.16) ** 2));
      // Vertebrae: a knuckled ridge down the back.
      const dSpine = Math.abs(th - Math.PI);
      const vert = Math.exp(-((dSpine / 0.17) ** 2)) * (0.03 + 0.03 * Math.max(0, Math.sin(t * Math.PI * 17)));
      const n = noise3(c * 2 + 5, t * 9, s * 2 + 2) - 0.5;
      const grow = 1 + ribLift / Math.max(0.1, hd) + n * 0.035;
      rx *= grow; rz *= grow;
      const x = s * rx;
      const z = c * rz + sternum * 0.012 + spineCurl(t) - (c < 0 ? vert : 0);
      pos.push(x, t * TORSO_H, z);
      uv.push((i / N) * 3, t * 2.2);
      const ao = Math.max(0.3, (1 - shade) * (0.84 + 0.3 * (n + 0.5)));
      col.push(ao, ao, ao);
    }
  }
  const W = N + 1;
  for (let j = 0; j < J; j++) for (let i = 0; i < N; i++) {
    const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  weldSeam(g, W, J + 1);
  return g;
}
function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ------------------------------------------------------------------ hands --
/** One long finger, already crooked at both knuckles. Points down −Y from its base. */
export function fingerGeometry(len: number, r: number, curl: number, seed: number): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  const segs = [0.42, 0.33, 0.25];
  let y = 0, z = 0, ang = 0;
  pts.push(new THREE.Vector3(0, 0, 0));
  for (let sgi = 0; sgi < 3; sgi++) {
    ang += curl * (sgi === 0 ? 0.5 : 1);
    for (let k = 1; k <= 4; k++) {
      const d = (segs[sgi] * len) / 4;
      y -= Math.cos(ang) * d; z += Math.sin(ang) * d;
      pts.push(new THREE.Vector3(0, y, z));
    }
  }
  return sweep(pts, (t) => {
    // Swollen knuckles at each joint, tapering to a point (the nail).
    const kn = Math.exp(-(((t - 0.42) / 0.05) ** 2)) * 0.45 + Math.exp(-(((t - 0.75) / 0.045) ** 2)) * 0.4 + Math.exp(-((t / 0.06) ** 2)) * 0.5;
    const taper = t > 0.86 ? Math.max(0.04, (1 - t) / 0.14) : 1;
    return r * (1 - t * 0.45) * (1 + kn) * taper;
  }, { radial: 7, ridges: 2, ridgeAmp: 0.06, lump: 0.08, seed, uAround: 1, vPer: 0.5, shade: (t) => 0.1 + smooth(0.8, 1, t) * 0.75 });
}

// ------------------------------------------------------------------ sirens --
/** Bell of a horn loudspeaker, mouth toward +Y. `inner` = the flesh lining. */
export function hornGeometry(inner = false): THREE.BufferGeometry {
  const prof: [number, number][] = inner
    ? [[0.02, 0.1], [0.095, 0.22], [0.135, 0.42], [0.195, 0.62], [0.25, 0.75], [0.3, 0.84]]
    : [[0.1, 0], [0.115, 0.2], [0.15, 0.42], [0.21, 0.64], [0.31, 0.86], [0.45, 1.05], [0.6, 1.2], [0.72, 1.3], [0.78, 1.345], [0.8, 1.36]];
  const pts = prof.map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(new THREE.SplineCurve(pts).getPoints(inner ? 14 : 26), 30);
  g.computeVertexNormals();
  return g;
}

/** A ragged ring of teeth for the inside of a horn (mouth toward +Y). */
export function teethGeometry(seed: number): THREE.BufferGeometry {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const COUNT = 17;
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion(), m = new THREE.Matrix4();
  for (let i = 0; i < COUNT; i++) {
    if (r() < 0.13) continue;                       // a few are missing
    const a = (i / COUNT) * Math.PI * 2 + (r() - 0.5) * 0.12;
    const h = 0.12 + r() * 0.2, w = 0.028 + r() * 0.02;
    const c = new THREE.ConeGeometry(w, h, 5);
    c.translate(0, h / 2, 0);
    // Rooted in the bell wall; the point leans in toward the middle of the
    // mouth and a little out of it.
    dir.set(-Math.cos(a) * 0.82, 0.5 + (r() - 0.5) * 0.3, -Math.sin(a) * 0.82).normalize();
    q.setFromUnitVectors(up, dir);
    const ring = 0.238, y = 0.72 + (r() - 0.5) * 0.07;
    m.compose(new THREE.Vector3(Math.cos(a) * ring, y, Math.sin(a) * ring), q, new THREE.Vector3(1, 1, 1));
    c.applyMatrix4(m);
    parts.push(c);
  }
  const g = mergeGeometries(parts, false)!;
  parts.forEach((p) => p.dispose());
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- textures --
function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')!];
}
function tex(c: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Desiccated skin the colour of old rust: colour map + matching bump map. */
export function skinTextures(): { map: THREE.Texture; bump: THREE.Texture } {
  const S = 512;
  const [cc, c] = canvas(S);
  const [bc, b] = canvas(S);
  const r = rng(41);
  c.fillStyle = '#857a6c'; c.fillRect(0, 0, S, S);
  b.fillStyle = '#808080'; b.fillRect(0, 0, S, S);
  // Mottling: bruised darks, rust-brown stains, pale dried-out patches.
  const blot = (n: number, colors: string[], rMin: number, rMax: number, alpha: string, bump: number) => {
    for (let i = 0; i < n; i++) {
      const x = r() * S, y = r() * S, rad = rMin + r() * (rMax - rMin);
      for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
        const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
        const col = colors[Math.floor(r() * colors.length)];
        g.addColorStop(0, col + alpha); g.addColorStop(1, col + '00');
        c.fillStyle = g; c.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
        if (bump) {
          const gb = b.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
          const v = bump > 0 ? '255,255,255' : '0,0,0';
          gb.addColorStop(0, `rgba(${v},${Math.abs(bump)})`); gb.addColorStop(1, `rgba(${v},0)`);
          b.fillStyle = gb; b.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
        }
      }
    }
  };
  blot(70, ['#3a2a1f', '#2e221b', '#4a3526'], 18, 70, '66', -0.18);
  blot(34, ['#7c4a2c', '#84502e', '#6e4530'], 14, 52, '44', 0);
  blot(30, ['#5d6258', '#6a6a5c', '#4f5750'], 16, 60, '40', 0);
  blot(40, ['#a89a84', '#b3a590', '#9c8d76'], 10, 44, '50', 0.2);
  // Sinew / dried tendon: long wavering vertical cords.
  for (let i = 0; i < 46; i++) {
    let x = r() * S;
    const dark = r() < 0.6;
    c.strokeStyle = dark ? `rgba(40,30,24,${0.08 + r() * 0.16})` : `rgba(176,166,150,${0.07 + r() * 0.12})`;
    b.strokeStyle = dark ? `rgba(0,0,0,${0.2 + r() * 0.25})` : `rgba(255,255,255,${0.2 + r() * 0.25})`;
    c.lineWidth = b.lineWidth = 1 + r() * 3.5;
    c.beginPath(); b.beginPath();
    c.moveTo(x, -4); b.moveTo(x, -4);
    for (let y = 0; y <= S + 4; y += 16) { x += (r() - 0.5) * 7; c.lineTo(x, y); b.lineTo(x, y); }
    c.stroke(); b.stroke();
  }
  // Cracks where the hide has split.
  for (let i = 0; i < 60; i++) {
    let x = r() * S, y = r() * S, a = r() * Math.PI * 2;
    c.strokeStyle = `rgba(22,14,10,${0.35 + r() * 0.35})`; b.strokeStyle = 'rgba(0,0,0,0.75)';
    c.lineWidth = b.lineWidth = 0.7 + r() * 1.3;
    c.beginPath(); b.beginPath(); c.moveTo(x, y); b.moveTo(x, y);
    const n = 4 + Math.floor(r() * 9);
    for (let k = 0; k < n; k++) { a += (r() - 0.5) * 1.3; x += Math.cos(a) * (5 + r() * 9); y += Math.sin(a) * (5 + r() * 9); c.lineTo(x, y); b.lineTo(x, y); }
    c.stroke(); b.stroke();
  }
  // Pores / grit.
  const img = c.getImageData(0, 0, S, S), bim = b.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 26;
    img.data[i] += n; img.data[i + 1] += n * 0.9; img.data[i + 2] += n * 0.8;
    const m = (r() - 0.5) * 44;
    bim.data[i] += m; bim.data[i + 1] += m; bim.data[i + 2] += m;
  }
  c.putImageData(img, 0, 0); b.putImageData(bim, 0, 0);
  return { map: tex(cc, true), bump: tex(bc, false) };
}

/** Weathered loudspeaker paint: chalky grey with rust blooming through. */
export function rustTextures(): { map: THREE.Texture; bump: THREE.Texture } {
  const S = 512;
  const [cc, c] = canvas(S);
  const [bc, b] = canvas(S);
  const r = rng(907);
  c.fillStyle = '#9a978b'; c.fillRect(0, 0, S, S);
  b.fillStyle = '#909090'; b.fillRect(0, 0, S, S);
  for (let i = 0; i < 150; i++) {
    const x = r() * S, y = r() * S, rad = 8 + r() * 46;
    const col = ['#6b3216', '#7d3d18', '#51260f', '#8a4a1c', '#3b2416'][Math.floor(r() * 5)];
    for (const [dx, dy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
      const g = c.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      g.addColorStop(0, col + 'cc'); g.addColorStop(0.6, col + '66'); g.addColorStop(1, col + '00');
      c.fillStyle = g; c.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
      const gb = b.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      gb.addColorStop(0, 'rgba(0,0,0,0.45)'); gb.addColorStop(1, 'rgba(0,0,0,0)');
      b.fillStyle = gb; b.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2);
    }
  }
  // Rain streaks of rust and grime running along the bell.
  for (let i = 0; i < 70; i++) {
    const x = r() * S, y = r() * S, l = 30 + r() * 150;
    const g = c.createLinearGradient(x, y, x, y + l);
    const col = r() < 0.6 ? '74,38,18' : '30,28,26';
    g.addColorStop(0, `rgba(${col},${0.3 + r() * 0.3})`); g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g; c.fillRect(x, y, 1.5 + r() * 4, l);
  }
  const img = c.getImageData(0, 0, S, S), bim = b.getImageData(0, 0, S, S);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 30;
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    const m = (r() - 0.5) * 70;
    bim.data[i] += m; bim.data[i + 1] += m; bim.data[i + 2] += m;
  }
  c.putImageData(img, 0, 0); b.putImageData(bim, 0, 0);
  return { map: tex(cc, true), bump: tex(bc, false) };
}
