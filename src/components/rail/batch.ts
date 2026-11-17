import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Static scenery in a handful of draw calls: every box / cylinder / cone is
// baked into ONE geometry per "group" with its colour stored per vertex, so a
// whole train, station or city block draws as a few meshes instead of
// hundreds. Groups exist only where the MATERIAL must differ (matte paint,
// glass, things that glow at night).

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3(1, 1, 1);
const _p = new THREE.Vector3();
const _c = new THREE.Color();

export class Batch {
  private parts: Record<string, THREE.BufferGeometry[]> = {};

  private push(group: string, g: THREE.BufferGeometry, color: string, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    _m.compose(_p.set(x, y, z), _q, _s);
    g.applyMatrix4(_m);
    _c.set(color);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (this.parts[group] ??= []).push(g);
    return this;
  }

  /** A box of size (w, h, d) centred at (x, y, z), optionally turned about Y. */
  box(group: string, color: string, w: number, h: number, d: number, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
    return this.push(group, new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz);
  }
  /** A cylinder (or cone, if the radii differ) standing on Y; `rx`/`rz` tip it over. */
  cyl(group: string, color: string, rTop: number, rBot: number, h: number, x: number, y: number, z: number, seg = 10, rx = 0, rz = 0, ry = 0) {
    return this.push(group, new THREE.CylinderGeometry(rTop, rBot, h, seg), color, x, y, z, rx, ry, rz);
  }
  /** A faceted blob (tree crowns, rock piles). */
  blob(group: string, color: string, r: number, x: number, y: number, z: number, sy = 1) {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1, sy, 1);
    // Icosahedron is non-indexed; give it an index so it merges with boxes.
    const n = g.getAttribute('position').count;
    g.setIndex(Array.from({ length: n }, (_, i) => i));
    return this.push(group, g, color, x, y, z);
  }

  build(): Record<string, THREE.BufferGeometry> {
    const out: Record<string, THREE.BufferGeometry> = {};
    for (const [k, list] of Object.entries(this.parts)) {
      const g = mergeGeometries(list, false);
      if (g) out[k] = g;
      for (const part of list) part.dispose();
    }
    return out;
  }
}

/** Matte vertex-coloured material (paint, concrete, wood…). */
export function paint(roughness = 0.75, metalness = 0.05, extra?: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness, ...extra });
}

/**
 * Vertex-coloured material that can GLOW in its own colours: set
 * `emissiveIntensity` (0 = off) and each part lights up in the colour it was
 * painted — a lit train interior, shop windows, lamp globes.
 */
export function glowPaint(roughness = 0.8, extra?: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, emissive: '#ffffff', emissiveIntensity: 0, ...extra });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n  totalEmissiveRadiance *= vColor.rgb;\n#endif',
    );
  };
  return m;
}

/** See-through window glass. */
export function glass(color = '#9fc4d8', opacity = 0.2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.08, metalness: 0.3, depthWrite: false });
}
