import { useLayoutEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// "Baking": draw a whole static sub-tree (a house's trim, windows, shutters…)
// as a handful of meshes instead of hundreds.
//
// The houses are written as lots of little <mesh> pieces, nearly every one with
// its own material — lovely to author, but each piece is a separate draw call,
// and with 25 houses that (not triangle count) is what holds the frame rate
// down. <Baked> leaves the JSX exactly as it is and, once it has mounted,
// quietly stands in for it:
//
//   • pieces with a plain colour material are merged into one mesh per "kind of
//     surface" (same roughness / shadow flags / transparency…), their colours
//     baked per-vertex;
//   • pieces sharing one material INSTANCE (textured brick and siding, the six
//     shared window-glass materials the night lighting drives) are merged per
//     instance and keep that very material — so anything that animates the
//     material (windows lighting up at dusk) still works;
//   • the originals are moved to a layer no camera renders. They stay in the
//     scene, so un-baking is instant and loses nothing.
//
// Anything that moves or changes on its own must opt out: put
// `userData={{ noBake: true }}` on it (doors do), or nest it in its own <Baked>
// (the roof, which the tornado throws separately from the walls). Turn the
// whole thing off with `enabled={false}` — tornado mode does, so that map keeps
// every individual piece.

/** A layer the cameras never look at (0 is the default layer). */
const HIDDEN_LAYER = 30;
/** Only small pieces are worth merging (and safe to copy). */
const MAX_TRIS = 1500;

const _m = new THREE.Matrix4();
const _inv = new THREE.Matrix4();
const _c = new THREE.Color();

function isPlain(m: THREE.Material): m is THREE.MeshStandardMaterial {
  const s = m as THREE.MeshStandardMaterial;
  if (!s.isMeshStandardMaterial || (m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) return false;
  if (s.map || s.bumpMap || s.normalMap || s.roughnessMap || s.metalnessMap || s.alphaMap || s.aoMap || s.emissiveMap || s.envMap) return false;
  if (s.vertexColors || s.wireframe) return false;
  if (s.emissiveIntensity > 0 && s.emissive.r + s.emissive.g + s.emissive.b > 0) return false;
  return true;
}

function plainKey(m: THREE.MeshStandardMaterial): string {
  return [
    m.transparent ? `t${m.opacity.toFixed(3)}` : 'o', m.depthWrite ? 1 : 0, m.side, m.flatShading ? 1 : 0,
    m.roughness.toFixed(2), m.metalness.toFixed(2), m.envMapIntensity.toFixed(2), m.polygonOffset ? `${m.polygonOffsetFactor},${m.polygonOffsetUnits}` : '',
  ].join('|');
}

interface Bucket { meshes: THREE.Mesh[]; material: THREE.Material; plain: boolean; cast: boolean; recv: boolean; order: number }

/** Copy a mesh's geometry into `root` space with only the attributes we merge. */
function prepared(mesh: THREE.Mesh, withUv: boolean, color: THREE.Color | null): THREE.BufferGeometry | null {
  const src = mesh.geometry;
  const pos = src.getAttribute('position');
  if (!pos || (pos as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', (pos as THREE.BufferAttribute).clone());
  const nrm = src.getAttribute('normal');
  if (nrm && !(nrm as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) g.setAttribute('normal', (nrm as THREE.BufferAttribute).clone());
  if (withUv) {
    const uv = src.getAttribute('uv');
    if (!uv || (uv as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute) return null;
    g.setAttribute('uv', (uv as THREE.BufferAttribute).clone());
  }
  const n = pos.count;
  const idx = src.index ? Array.from(src.index.array as ArrayLike<number>) : Array.from({ length: n }, (_, i) => i);
  _m.multiplyMatrices(_inv, mesh.matrixWorld);
  // A mirrored piece (negative scale) would turn inside-out: flip its winding.
  if (_m.determinant() < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; }
  g.setIndex(idx);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  g.applyMatrix4(_m);
  if (color) {
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  return g;
}

/** Merge everything bake-able under `root`. Returns the undo. */
function bakeStatic(root: THREE.Object3D): () => void {
  root.updateWorldMatrix(true, true);
  _inv.copy(root.matrixWorld).invert();
  const buckets = new Map<string, Bucket>();

  const visit = (o: THREE.Object3D) => {
    if (o !== root && (o.userData.noBake || o.userData.bakeRoot || o.userData.baked)) return;
    if (!o.visible) return; // things that get switched on later (rubble, dust…) stay themselves
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh && !(mesh as THREE.InstancedMesh).isInstancedMesh && !(mesh as THREE.SkinnedMesh).isSkinnedMesh
      && mesh.geometry && !Array.isArray(mesh.material) && mesh.material && mesh.layers.mask === 1
      && !mesh.geometry.morphAttributes.position) {
      const g = mesh.geometry;
      const tris = (g.index ? g.index.count : g.getAttribute('position')?.count ?? 0) / 3;
      if (tris > 0 && tris <= MAX_TRIS) {
        const mat = mesh.material;
        const plain = isPlain(mat);
        // Plain colours merge by what the surface is LIKE; everything else only
        // with pieces that use the very same material object.
        const key = `${plain ? plainKey(mat) : mat.uuid}|${mesh.castShadow ? 1 : 0}${mesh.receiveShadow ? 1 : 0}|${mesh.renderOrder}`;
        let b = buckets.get(key);
        if (!b) { b = { meshes: [], material: mat, plain, cast: mesh.castShadow, recv: mesh.receiveShadow, order: mesh.renderOrder }; buckets.set(key, b); }
        b.meshes.push(mesh);
      }
    }
    for (const ch of o.children) visit(ch);
  };
  visit(root);

  const made: THREE.Mesh[] = [];
  const hidden: THREE.Mesh[] = [];
  for (const b of buckets.values()) {
    if (b.meshes.length < 2) continue;
    const withUv = !b.plain && b.meshes.every((m) => !!m.geometry.getAttribute('uv'));
    const parts: THREE.BufferGeometry[] = [];
    const used: THREE.Mesh[] = [];
    for (const m of b.meshes) {
      const g = prepared(m, withUv, b.plain ? _c.copy((m.material as THREE.MeshStandardMaterial).color) : null);
      if (g) { parts.push(g); used.push(m); }
    }
    if (parts.length < 2) { parts.forEach((p) => p.dispose()); continue; }
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    if (!merged) continue;
    let material = b.material;
    if (b.plain) {
      const src = b.material as THREE.MeshStandardMaterial;
      material = new THREE.MeshStandardMaterial({
        vertexColors: true, roughness: src.roughness, metalness: src.metalness, side: src.side, flatShading: src.flatShading,
        transparent: src.transparent, opacity: src.opacity, depthWrite: src.depthWrite, envMapIntensity: src.envMapIntensity,
        polygonOffset: src.polygonOffset, polygonOffsetFactor: src.polygonOffsetFactor, polygonOffsetUnits: src.polygonOffsetUnits,
      });
    }
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.recv;
    mesh.renderOrder = b.order;
    mesh.userData.baked = true;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    mesh.updateMatrix();
    made.push(mesh);
    for (const m of used) { m.layers.set(HIDDEN_LAYER); hidden.push(m); }
  }

  return () => {
    for (const m of hidden) m.layers.set(0);
    for (const mesh of made) {
      root.remove(mesh);
      mesh.geometry.dispose();
      if ((mesh.material as THREE.MeshStandardMaterial).vertexColors) (mesh.material as THREE.Material).dispose();
    }
  };
}

interface BakedProps {
  /** false = leave every piece as its own mesh (and un-bake if it was baked). */
  enabled?: boolean;
  children: ReactNode;
}

/** How many meshes under `root` are showing (ignoring our own merged ones).
 *  If this changes, something was mounted, removed, shown or hidden. */
function signature(root: THREE.Object3D): number {
  let n = 0;
  const visit = (o: THREE.Object3D) => {
    if (!o.visible || o.userData.baked) return;
    if (o !== root && (o.userData.noBake || o.userData.bakeRoot)) return;
    if ((o as THREE.Mesh).isMesh) n++;
    for (const ch of o.children) visit(ch);
  };
  visit(root);
  return n;
}

/** Wrap static scenery in this to draw it in a few calls (see the file header). */
export function Baked({ enabled = true, children }: BakedProps) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    let undo = bakeStatic(root);
    let sig = signature(root);
    // Scenery under here can still change now and then (a mode mounts or hides
    // something). A cheap head-count every couple of seconds spots that and
    // re-bakes, so a merged copy can never outlive the thing it was made from.
    const id = setInterval(() => {
      const now = signature(root);
      if (now === sig) return;
      undo();
      undo = bakeStatic(root);
      sig = signature(root);
    }, 2000);
    return () => { clearInterval(id); undo(); };
  }, [enabled]);
  return <group ref={ref} userData={{ bakeRoot: true }}>{children}</group>;
}
