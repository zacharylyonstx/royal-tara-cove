import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * A photo-real Meshy character (image-to-3d likeness of the real person), now
 * driven by a real skeleton: idle / walk / run skeletal clips that move the
 * legs and arms, crossfaded by movement speed.
 *
 * Why this works where naive scaling "explodes": the rig's mesh (`char1`) and
 * its bone root (`Hips`) are SIBLINGS under one `Armature` node. Scaling an
 * ANCESTOR of the Armature (our wrapper group) scales mesh + bones together, so
 * the skin stays bound. (Scaling the SkinnedMesh node alone is what shatters it.)
 *
 * The walk/run clips ship from Meshy with the same skeleton, so their clips bind
 * onto the cloned rig by bone name. We zero the Hips' horizontal translation so
 * the character animates in place — the game owns world position.
 */
type CharId = 'dad' | 'penny' | 'luke';
type Props = {
  id: CharId;
  height: number;
  rotationY?: number;
  speedRef: { current: number };
  riding: boolean;
};

const RUN_SPEED = 3.6; // m/s above which we crossfade to the run cycle
const WALK_SPEED = 0.35; // m/s above which we leave idle

/** Strip horizontal root motion from a clip (keep the vertical bob) so the
 *  character doesn't drift away from the position the game is driving. */
function sanitize(clip: THREE.AnimationClip): THREE.AnimationClip {
  const c = clip.clone();
  for (const tr of c.tracks) {
    if (/(^|[|/.])Hips\.position$/.test(tr.name) || /Hips\.position$/.test(tr.name)) {
      const v = tr.values as Float32Array | number[];
      for (let i = 0; i < v.length; i += 3) {
        v[i] = 0; // X
        v[i + 2] = 0; // Z
      }
    }
  }
  return c;
}

export function GLBCharacterModel({ id, height, rotationY = 0, speedRef, riding }: Props) {
  const rig = useGLTF(`/assets/models/${id}-rig.glb`);
  const walkGltf = useGLTF(`/assets/models/${id}-walk.glb`);
  const runGltf = useGLTF(`/assets/models/${id}-run.glb`);

  // Clone the rigged scene (SkeletonUtils re-binds the cloned skeleton correctly).
  const model = useMemo(() => {
    const m = skeletonClone(rig.scene);
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false; // skinned bounds go stale after scaling
      }
    });
    return m;
  }, [rig.scene]);

  // Fit to the character's height and ground the feet. Measured on the bind pose.
  // The matrices must be flushed first — a freshly-cloned skinned mesh otherwise
  // measures as a degenerate box (which blew the preview up into a closeup).
  const { scale, baseY } = useMemo(() => {
    model.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(model);
    const h = box.max.y - box.min.y;
    if (!(h > 1e-4)) return { scale: 1, baseY: 0 };
    const s = height / h;
    return { scale: s, baseY: -box.min.y * s };
  }, [model, height]);

  const { mixer, actions } = useMemo(() => {
    const mx = new THREE.AnimationMixer(model);
    const make = (clip?: THREE.AnimationClip) => {
      if (!clip) return null;
      const a = mx.clipAction(sanitize(clip));
      a.enabled = true;
      a.setEffectiveWeight(1);
      return a;
    };
    return {
      mixer: mx,
      actions: {
        idle: make(rig.animations[0]),
        walk: make(walkGltf.animations[0]),
        run: make(runGltf.animations[0]),
      },
    };
  }, [model, rig.animations, walkGltf.animations, runGltf.animations]);

  const activeRef = useRef<THREE.AnimationAction | null>(null);

  const fadeTo = (next: THREE.AnimationAction | null) => {
    if (!next || next === activeRef.current) return;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.22).play();
    if (activeRef.current) activeRef.current.fadeOut(0.22);
    activeRef.current = next;
  };

  // Start in idle (or whatever clip exists).
  useEffect(() => {
    fadeTo(actions.idle ?? actions.walk ?? actions.run);
    return () => {
      mixer.stopAllAction();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const sp = speedRef.current;
    if (riding || sp <= WALK_SPEED) fadeTo(actions.idle ?? actions.walk);
    else if (sp > RUN_SPEED) fadeTo(actions.run ?? actions.walk);
    else fadeTo(actions.walk ?? actions.idle);
    // Speed the cycle slightly with pace so fast walks don't look like a moonwalk.
    if (activeRef.current === actions.walk && actions.walk) actions.walk.setEffectiveTimeScale(Math.min(1.6, 0.85 + sp * 0.12));
    mixer.update(dt);
  });

  return (
    <group rotation={[0, rotationY, 0]} scale={scale} position={[0, baseY, 0]}>
      <primitive object={model} />
    </group>
  );
}

/**
 * A still portrait of the real-you likeness from the un-rigged base mesh — used
 * by the wardrobe preview, where a fixed clean camera and an auto-spin make the
 * static mesh read better (and sidesteps the skinned-bounds quirks of framing a
 * rig in a tiny offscreen canvas). In-world we use the animated rig above.
 */
export function GLBPortrait({ id, height, rotationY = 0 }: { id: CharId; height: number; rotationY?: number }) {
  const { scene } = useGLTF(`/assets/models/${id}-base.glb`);
  const model = useMemo(() => {
    const m = scene.clone(true);
    m.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false;
      }
    });
    return m;
  }, [scene]);
  const { scale, baseY } = useMemo(() => {
    model.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(model);
    const h = box.max.y - box.min.y;
    if (!(h > 1e-4)) return { scale: 1, baseY: 0 };
    const s = height / h;
    return { scale: s, baseY: -box.min.y * s };
  }, [model, height]);
  return (
    <group rotation={[0, rotationY, 0]} scale={scale} position={[0, baseY, 0]}>
      <primitive object={model} />
    </group>
  );
}

// Warm the cache so the family doesn't pop in.
for (const id of ['dad', 'penny', 'luke'] as const) {
  useGLTF.preload(`/assets/models/${id}-rig.glb`);
  useGLTF.preload(`/assets/models/${id}-walk.glb`);
  useGLTF.preload(`/assets/models/${id}-run.glb`);
  useGLTF.preload(`/assets/models/${id}-base.glb`);
}
