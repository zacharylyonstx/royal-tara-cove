import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Vector3 } from 'three';
import type { CharacterDef } from '../types';
import { usePlayStore } from '../state/playStore';
import { useWardrobeStore } from '../state/wardrobeStore';
import { CharacterModel, charDims } from './CharacterModel';
import { GLBCharacterModel } from './GLBCharacterModel';
import { GLBRiggedCharacter } from './GLBRiggedCharacter';
import { defaultAppearance } from '../world/wardrobe';

interface CharacterProps {
  def: CharacterDef;
  positionRef: Vector3;
  yawRef: { current: number };
  isActive: boolean;
}

/** In-world character. Default = the real photo-real "you" GLB (looks like the
 *  person). Dress-up mode swaps in the customizable procedural avatar + its walk
 *  rig. Either way the outer group carries position/yaw + the riding (sit/flip/
 *  wipeout) transforms, so driving is unaffected. */
export function Character({ def, positionRef, yawRef, isActive }: CharacterProps) {
  const groupRef = useRef<Group>(null);
  const riding = usePlayStore((s) => s.riding[def.id]);
  const appearance = useWardrobeStore((s) => s.appearances[def.id]) ?? defaultAppearance(def.id);
  const real = useWardrobeStore((s) => s.realMode[def.id]);
  const action = useWardrobeStore((s) => s.actionMode[def.id]);
  const lastPos = useRef({ x: positionRef.x, z: positionRef.z });
  const phase = useRef(0);
  const speedRef = useRef(0);

  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const torso = useRef<Group>(null);

  const d = charDims(def.height);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const g = groupRef.current;
    if (!g) return;
    g.position.copy(positionRef);
    g.rotation.order = 'YXZ';
    // Model front is +Z; the game's yaw convention is -Z-forward (yaw=π faces +Z).
    g.rotation.y = yawRef.current + Math.PI;

    const live = usePlayStore.getState().riding[def.id];
    // Sink the driver into the car seat (bikes stay at ground level).
    if (live?.vehicle === 'car') g.position.y -= 0.45;
    g.rotation.x = live?.flip ? live.flip.angle : 0;
    const wipeActive = !!live && live.wipeoutUntil > performance.now();
    g.rotation.z += ((wipeActive ? 1.15 : 0) - g.rotation.z) * Math.min(1, dt * 12);

    const dx = positionRef.x - lastPos.current.x;
    const dz = positionRef.z - lastPos.current.z;
    const speed = Math.hypot(dx, dz) / Math.max(dt, 0.001);
    speedRef.current = speed;
    lastPos.current.x = positionRef.x;
    lastPos.current.z = positionRef.z;

    // Procedural limb swing — only when the dress-up avatar is shown (the photo-real
    // GLB does whole-body procedural animation; the rigged Action character plays
    // real skeletal clips).
    if (real || action) return;
    if (speed > 0.1) phase.current += dt * Math.min(12, 4 + speed);
    else phase.current += dt * 1.5 * -Math.sin(phase.current);
    const swing = Math.sin(phase.current) * Math.min(0.5, speed * 0.08);

    if (live) {
      if (leftLeg.current) leftLeg.current.rotation.x = 0.7;
      if (rightLeg.current) rightLeg.current.rotation.x = 0.7;
      if (leftArm.current) leftArm.current.rotation.x = 0.55;
      if (rightArm.current) rightArm.current.rotation.x = 0.55;
    } else {
      if (leftLeg.current) leftLeg.current.rotation.x = swing;
      if (rightLeg.current) rightLeg.current.rotation.x = -swing;
      if (leftArm.current) leftArm.current.rotation.x = -swing * 0.9;
      if (rightArm.current) rightArm.current.rotation.x = swing * 0.9;
    }
    if (torso.current) torso.current.position.y = d.torsoY + Math.sin(state.clock.elapsedTime * 1.4) * 0.012;
  });

  return (
    <group ref={groupRef} visible={!isActive || !!riding}>
      {action ? (
        <GLBRiggedCharacter
          baseUrl={`/assets/models/${def.id}-rig.glb`}
          walkUrl={`/assets/models/${def.id}-walk.glb`}
          runUrl={`/assets/models/${def.id}-run.glb`}
          height={def.height}
          rotationY={0}
          speedRef={speedRef}
          riding={!!riding}
        />
      ) : real ? (
        <GLBCharacterModel
          baseUrl={`/assets/models/${def.id}-base.glb`}
          height={def.height}
          rotationY={0}
          speedRef={speedRef}
          riding={!!riding}
        />
      ) : (
        <CharacterModel def={def} appearance={appearance} rig={{ leftLeg, rightLeg, leftArm, rightArm, torso }} />
      )}
      {isActive && (
        <mesh position={[0, d.headY + d.headR * 1.7, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[d.headR * 0.7, d.headR * 0.85, 32]} />
          <meshBasicMaterial color="#ffd866" transparent opacity={0.92} />
        </mesh>
      )}
    </group>
  );
}
