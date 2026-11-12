import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { Group } from 'three';

/**
 * A photo-real Meshy character (image-to-3d of the real person). Rendered from the
 * un-rigged base mesh (the rigged exports have a baked micro-scale that breaks
 * three.js skinning when resized), with smooth WHOLE-BODY procedural animation:
 * idle breathing, and a bounce + forward-lean + side-sway while moving. Auto-fits
 * to the game's per-character height with feet grounded. The parent Character group
 * still applies position/yaw and the riding (sit/flip) transforms.
 */
type Props = {
  baseUrl: string;
  height: number;
  rotationY?: number;
  speedRef: { current: number };
  riding: boolean;
};

interface WalkUniforms {
  uPhase: { value: number }; uAmp: { value: number };
  uHipY: { value: number }; uFootY: { value: number };
  uHalfW: { value: number }; uCenterX: { value: number };
}

/**
 * A walk cycle for an UNRIGGED mesh. The photo-real family models are single
 * static meshes (their rigged twins are the opt-in "Action Me" look), so they
 * used to glide like statues. This bends the mesh in the vertex shader instead:
 * everything below the hips shears forward on one side and back on the other,
 * fading to nothing at the hip line and across the centre — a continuous
 * deformation, so nothing can tear or balloon the way a bad skin bind does.
 * Skirts simply swish.
 */
function injectWalk(mat: THREE.Material, u: WalkUniforms, toModel: THREE.Matrix4): THREE.Material {
  const toModelInv = new THREE.Matrix4().copy(toModel).invert();
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u, { uToModel: { value: toModel }, uToModelInv: { value: toModelInv } });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uPhase; uniform float uAmp; uniform float uHipY; uniform float uFootY; uniform float uHalfW; uniform float uCenterX;
uniform mat4 uToModel; uniform mat4 uToModelInv;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
{
  vec3 mp = (uToModel * vec4(position, 1.0)).xyz;
  float legLen = max(0.0001, uHipY - uFootY);
  float below = clamp((uHipY - mp.y) / legLen, 0.0, 1.0);
  float side = clamp((mp.x - uCenterX) / uHalfW, -1.0, 1.0);
  float w = below * below * (3.0 - 2.0 * below);
  float sw = sin(uPhase) * side;
  vec3 d = vec3(0.0);
  d.z = -sw * uAmp * w * legLen;                        // stride (model faces -Z)
  d.y = max(0.0, sw) * uAmp * 0.32 * w * w * legLen;    // lift the leading foot
  transformed += (uToModelInv * vec4(d, 0.0)).xyz;
}`);
  };
  // One program per character instance (the uniforms differ per instance).
  mat.customProgramCacheKey = () => 'walk';
  return mat;
}

export function GLBCharacterModel({ baseUrl, height, rotationY = 0, speedRef, riding }: Props) {
  const { scene } = useGLTF(baseUrl);

  // Clone the scene AND its materials: each character gets its own "walk"
  // uniforms (see injectWalk) without touching the cached originals.
  const { root, walk } = useMemo(() => {
    const r = scene.clone(true);
    r.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(r);
    const h = box.max.y - box.min.y || 1;
    const walk: WalkUniforms = {
      uPhase: { value: 0 }, uAmp: { value: 0 },
      uHipY: { value: box.min.y + h * 0.47 }, uFootY: { value: box.min.y },
      uHalfW: { value: h * 0.055 }, uCenterX: { value: (box.min.x + box.max.x) / 2 },
    };
    const rootInv = new THREE.Matrix4().copy(r.matrixWorld).invert();
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        const toModel = new THREE.Matrix4().multiplyMatrices(rootInv, m.matrixWorld);
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        const cloned = mats.map((mat) => injectWalk((mat as THREE.Material).clone(), walk, toModel));
        m.material = cloned.length === 1 ? cloned[0] : cloned;
      }
    });
    return { root: r, walk };
  }, [scene]);

  const { scale, baseY } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(root);
    const h = box.max.y - box.min.y || 1;
    const s = height / h;
    return { scale: s, baseY: -box.min.y * s };
  }, [root, height]);

  const anim = useRef<Group>(null);
  const phase = useRef(0);

  useFrame((state, dtRaw) => {
    const g = anim.current;
    if (!g) return;
    const dt = Math.min(dtRaw, 0.05);
    const t = state.clock.elapsedTime;
    const sp = speedRef.current;
    // Legs: stride with speed, settle when standing or seated on a bike/car.
    const wantAmp = riding || sp < 0.3 ? 0 : Math.min(0.34, 0.12 + sp * 0.035);
    walk.uAmp.value += (wantAmp - walk.uAmp.value) * Math.min(1, dt * 10);
    walk.uPhase.value = phase.current;
    if (riding) {
      g.position.y += (0 - g.position.y) * 0.3;
      g.rotation.x += (0 - g.rotation.x) * 0.3;
      g.rotation.z += (0 - g.rotation.z) * 0.3;
      return;
    }
    if (sp > 0.3) {
      phase.current += dt * (5 + Math.min(sp, 6) * 1.4);
      const stride = Math.min(0.07, 0.012 + sp * 0.02);
      g.position.y = Math.abs(Math.sin(phase.current)) * stride; // bounce
      g.rotation.x = Math.min(0.14, 0.04 + sp * 0.02); // lean into the run
      g.rotation.z = Math.sin(phase.current) * Math.min(0.05, 0.02 + sp * 0.01); // sway
    } else {
      g.position.y = Math.sin(t * 1.6) * 0.008; // idle breathing
      g.rotation.x += (0 - g.rotation.x) * 0.08;
      g.rotation.z += (0 - g.rotation.z) * 0.08;
    }
  });

  return (
    <group rotation={[0, rotationY, 0]} scale={scale} position={[0, baseY, 0]}>
      <group ref={anim}>
        <primitive object={root} />
      </group>
    </group>
  );
}

// Warm the cache so the family doesn't pop in.
useGLTF.preload('/assets/models/dad-base.glb');
useGLTF.preload('/assets/models/penny-base.glb');
useGLTF.preload('/assets/models/luke-base.glb');
