import { rail, trainAboard } from '../world/redLine';
import { useRailStore } from '../state/railStore';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import type { CharacterDef } from '../types';
import { usePlayStore } from '../state/playStore';
import { useWardrobeStore } from '../state/wardrobeStore';
import { CharacterModel, charDims } from './CharacterModel';
import { GLBCharacterModel } from './GLBCharacterModel';
import { GLBRiggedCharacter } from './GLBRiggedCharacter';
import { defaultAppearance } from '../world/wardrobe';
import { useGameStore } from '../state/gameStore';
import { SEATS, seatWorld } from '../world/seats';
import { useChatStore, EMOTES } from '../state/chatStore';

/** How long an emote's body move lasts (s). */
const EMOTE_MOVE_S = 1.5;

interface CharacterProps {
  def: CharacterDef;
  positionRef: Vector3;
  yawRef: { current: number };
  isActive: boolean;
}

/** Integration slice for the squash-and-stretch spring (seconds). */
const SPRING_STEP = 1 / 120;

/** In-world character. Default = the real photo-real "you" GLB (looks like the
 *  person). Dress-up mode swaps in the customizable procedural avatar + its walk
 *  rig. Either way the outer group carries position/yaw + the riding (sit/flip/
 *  wipeout) transforms, so driving is unaffected. */
export function Character({ def, positionRef, yawRef, isActive }: CharacterProps) {
  // The hide-your-own-body gate exists for the FIRST-PERSON rig. Munchies
  // (top-down) and Treehouse (behind-the-back) are third-person, so there the
  // kid must SEE themself — this was the "we disappeared!" bug.
  const gameMode = useGameStore((s) => s.gameMode);
  const tpFree = usePlayStore((s) => s.thirdPerson);
  // Inside a Red Line car the view is always first-person (a chase camera
  // can't fit in a 2.9 m wide carriage), so my own body hides there too.
  const onTrain = useRailStore((st) => st.aboard >= 0);
  const thirdPerson = gameMode === 'munchies' || gameMode === 'treehouse' || ((gameMode === 'freeplay' || gameMode === 'aliens') && tpFree && !(isActive && onTrain));
  const shadowRef = useRef<Mesh>(null);
  // Body-language state (all visual — the real position/yaw are untouched).
  const body = useRef({
    init: false, lastY: 0, vy: 0, groundY: 0, squash: 1, squashV: 0,
    faceYaw: 0, lastYaw: 0, bank: 0,
    emote: '' as string, emoteId: '' as string, emoteAt: -10,
  });
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
    const live = usePlayStore.getState().riding[def.id];
    if (live?.passengerOf) {
      // Passenger: sit rigidly in the driver's vehicle on EVERY client (local or
      // remote) — derived from the driver's position, never from this character's
      // own (lagging) network position, so nobody trails behind the truck.
      const drv = live.passengerOf;
      const dr = usePlayStore.getState().riding[drv];
      const dp = useGameStore.getState().positions[drv];
      if (dr && dr.vehicle === 'car' && dp) {
        const seats = SEATS[dr.carKind ?? 'sedan'];
        const seat = seats[live.seat ?? 0] ?? seats[0];
        const w = seatWorld(dp.x, dr.y, dp.z, dr.heading, seat);
        positionRef.set(w.x, w.y, w.z);
        yawRef.current = dr.heading;
      }
    }
    const b = body.current;
    if (!b.init) {
      b.init = true;
      b.lastY = b.groundY = positionRef.y;
      b.faceYaw = b.lastYaw = yawRef.current;
    }
    const t = state.clock.elapsedTime;
    const dx = positionRef.x - lastPos.current.x;
    let dz = positionRef.z - lastPos.current.z;
    // Standing in a moving Red Line car isn't running: measure my steps against
    // the CAR, not the ground (riders used to jog on the spot the whole trip).
    const car = trainAboard(positionRef.x, positionRef.y, positionRef.z);
    if (car >= 0) dz -= rail.trains[car].dz;
    const speed = Math.hypot(dx, dz) / Math.max(dt, 0.001);
    speedRef.current = speed;
    lastPos.current.x = positionRef.x;
    lastPos.current.z = positionRef.z;

    // --- which way the body faces ---
    // Over-the-shoulder Free Play (my own character): turn to face the way I'm
    // walking, and hold that pose when I stop — so I can swing the camera round
    // and actually see my face. Everyone else just follows their synced yaw.
    const ownTP = isActive && gameMode === 'freeplay' && tpFree && !live;
    let targetYaw = yawRef.current;
    if (ownTP) targetYaw = speed > 0.7 && speed < 40 ? Math.atan2(-dx, -dz) : b.faceYaw;
    let dyaw = targetYaw - b.faceYaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    b.faceYaw += dyaw * (ownTP ? Math.min(1, 11 * dt) : 1);

    // --- squash & stretch on jumps, a bank into turns ---
    const vy = (positionRef.y - b.lastY) / Math.max(dt, 0.001);
    b.lastY = positionRef.y;
    if (Math.abs(vy) < 0.2) b.groundY = positionRef.y;
    if (!live) {
      if (b.vy < -3.5 && vy > -0.5) b.squashV -= Math.min(5.5, -b.vy * 0.45);   // landed: squish
      else if (b.vy < 1 && vy > 4) b.squashV += 2.2;                              // took off: stretch
    }
    b.vy = vy;
    // Damped spring back to 1 — stepped in small fixed slices. Taken in ONE step
    // per frame this spring is unstable below ~12 fps (a slow iPad, or a laptop
    // busy screen-sharing): after a single jump the body flipped between squashed
    // and stretched every frame, forever.
    for (let rem = dt; rem > 1e-5; rem -= SPRING_STEP) {
      const h = Math.min(rem, SPRING_STEP);
      b.squashV += ((1 - b.squash) * 190 - b.squashV * 21) * h;
      b.squash += b.squashV * h;
    }
    b.squash = Math.max(0.72, Math.min(1.2, b.squash));
    if (b.squash === 0.72 || b.squash === 1.2) b.squashV = 0;
    let yawRate = (b.faceYaw - b.lastYaw) / Math.max(dt, 0.001);
    b.lastYaw = b.faceYaw;
    if (Math.abs(yawRate) > 30) yawRate = 0; // wrap / teleport
    const bankWant = live ? 0 : Math.max(-0.16, Math.min(0.16, -yawRate * Math.min(speed, 10) * 0.012));
    b.bank += (bankWant - b.bank) * Math.min(1, 8 * dt);

    // --- emotes move the whole body (everyone sees it: it rides the chat bubble) ---
    const bubble = useChatStore.getState().recentBubbleFor(def.id, Date.now());
    if (bubble && bubble.id !== b.emoteId) {
      b.emoteId = bubble.id;
      if ((EMOTES as readonly string[]).includes(bubble.text)) { b.emote = bubble.text; b.emoteAt = t; }
    }
    const ep = (t - b.emoteAt) / EMOTE_MOVE_S;
    let hop = 0, spin = 0, lean = 0, sway = 0;
    if (ep >= 0 && ep < 1 && !live) {
      const env = Math.sin(ep * Math.PI);
      if (b.emote === '👋') { sway = Math.sin(t * 13) * 0.16 * env; hop = Math.abs(Math.sin(t * 6.5)) * 0.08 * env; }
      else if (b.emote === '❤️') { hop = Math.abs(Math.sin(ep * Math.PI * 3)) * 0.2 * env; sway = Math.sin(ep * Math.PI * 3) * 0.1; }
      else if (b.emote === '😂') { sway = Math.sin(t * 34) * 0.07 * env; lean = -0.2 * env; hop = Math.abs(Math.sin(t * 17)) * 0.04 * env; }
      else if (b.emote === '🤩') { hop = Math.sin(ep * Math.PI) * 0.75; spin = ep * ep * (3 - 2 * ep) * Math.PI * 2; }
    }

    g.position.copy(positionRef);
    g.position.y += hop;
    g.rotation.order = 'YXZ';
    // Model front is +Z; the game's yaw convention is -Z-forward (yaw=π faces +Z).
    g.rotation.y = b.faceYaw + Math.PI + spin;
    const sq = live ? 1 : b.squash;
    const wide = 1 / Math.sqrt(sq);
    g.scale.set(wide, sq, wide);

    // Sink the driver into the car seat (bikes stay at ground level).
    if (live?.vehicle === 'car') g.position.y -= 0.45;
    g.rotation.x = live?.flip ? live.flip.angle : lean;
    const wipeActive = !!live && live.wipeoutUntil > performance.now();
    g.rotation.z += ((wipeActive ? 1.15 : b.bank + sway) - g.rotation.z) * Math.min(1, dt * 12);

    // Soft contact shadow: stays on the ground and shrinks as you leave it.
    const sh = shadowRef.current;
    if (sh) {
      const up = Math.max(0, positionRef.y + hop - b.groundY);
      sh.visible = g.visible && live?.vehicle !== 'car' && up < 6;
      sh.position.set(positionRef.x, b.groundY + 0.035, positionRef.z);
      const k = 1 / (1 + up * 0.55);
      sh.scale.setScalar(k);
      (sh.material as MeshBasicMaterial).opacity = 0.3 * k;
    }

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
    <>
    <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <circleGeometry args={[def.height * 0.24, 20]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.3} depthWrite={false} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
    </mesh>
    <group ref={groupRef} visible={!isActive || !!riding || thirdPerson}>
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
    </>
  );
}
