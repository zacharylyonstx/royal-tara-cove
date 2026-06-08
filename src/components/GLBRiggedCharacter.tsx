import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import * as THREE from 'three';
import type { Group, AnimationClip } from 'three';

/**
 * Photo-real Meshy character with a REAL skeletal rig — legs/arms actually move
 * via baked walk/run clips. Proven path: SkeletonUtils.clone (per-instance
 * skeleton) + drei useAnimations (robust mixer + name-binding) + a single UNIFORM
 * fit-scale on the outer group. (The old monster bug was a hand-rolled Armature
 * wrap with a ~100× scale + broken bind — NOT uniform scale itself. The rig GLBs
 * are also baked to ~game height offline so the fit-scale is ≈1.) Crossfades
 * idle ↔ walk ↔ run by speed; cadence tracks speed so feet don't skate.
 */
type Props = {
  baseUrl: string; // rigged mesh + skeleton
  walkUrl: string;
  runUrl: string;
  height: number;
  rotationY?: number;
  speedRef: { current: number };
  riding: boolean;
};

const WALK_SPEED = 0.4;
const RUN_SPEED = 4.2;

export function GLBRiggedCharacter({ baseUrl, walkUrl, runUrl, height, rotationY = 0, speedRef, riding }: Props) {
  const { scene } = useGLTF(baseUrl);
  const walkGltf = useGLTF(walkUrl);
  const runGltf = useGLTF(runUrl);

  const cloned = useMemo(() => {
    const c = SkeletonUtils.clone(scene) as Group;
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; }
    });
    return c;
  }, [scene]);

  const clips = useMemo(() => {
    const out: AnimationClip[] = [];
    const w = walkGltf.animations[0];
    const r = runGltf.animations[0];
    if (w) { const c = w.clone(); c.name = 'walk'; out.push(c); }
    if (r) { const c = r.clone(); c.name = 'run'; out.push(c); }
    return out;
  }, [walkGltf.animations, runGltf.animations]);

  const { actions, mixer } = useAnimations(clips, cloned);

  const fit = useMemo(() => {
    cloned.updateMatrixWorld(true); // ensure node transforms applied before measuring (Meshy rigs nest a scale)
    const box = new THREE.Box3().setFromObject(cloned);
    const h = box.max.y - box.min.y || 1;
    const s = height / h;
    return { scale: s, baseY: -box.min.y * s };
  }, [cloned, height]);

  const current = useRef('');

  useEffect(() => {
    const a = actions.walk;
    if (a) { a.reset().play(); a.paused = true; }
    return () => { mixer.stopAllAction(); };
  }, [actions, mixer]);

  useFrame(() => {
    const sp = speedRef.current;
    let want: string;
    if (riding) want = 'walk';
    else if (sp > RUN_SPEED) want = 'run';
    else if (sp > WALK_SPEED) want = 'walk';
    else want = 'idle';

    const walkA = actions.walk;
    const runA = actions.run;
    if (!walkA) return;

    if (want === 'idle') {
      if (current.current !== 'idle') {
        runA?.fadeOut(0.2);
        walkA.reset().fadeIn(0.2).play();
        current.current = 'idle';
      }
      walkA.paused = false;
      walkA.timeScale = 0.25; // gentle weight-shift in place (no stiff A-pose)
    } else {
      const act = want === 'run' ? (runA ?? walkA) : walkA;
      const other = want === 'run' ? walkA : runA;
      if (current.current !== want) {
        other?.fadeOut(0.22);
        act.reset().fadeIn(0.22).play();
        current.current = want;
      }
      act.paused = false;
      act.timeScale = want === 'run' ? Math.min(1.6, 0.7 + sp * 0.12) : Math.min(1.7, 0.8 + sp * 0.22);
    }
  });

  return (
    <group rotation={[0, rotationY, 0]} scale={fit.scale} position={[0, fit.baseY, 0]}>
      <primitive object={cloned} />
    </group>
  );
}
