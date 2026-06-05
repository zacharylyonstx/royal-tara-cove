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

export function GLBCharacterModel({ baseUrl, height, rotationY = 0, speedRef, riding }: Props) {
  const { scene } = useGLTF(baseUrl);

  const root = useMemo(() => {
    const r = scene.clone(true);
    r.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
      }
    });
    return r;
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
