import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';
import { useZoneStore } from '../../state/zoneStore';
import { resolveMotion } from '../../systems/collision';
import { dogBark, petChime } from '../../audio';
import { CHARACTER_ORDER } from '../../world/characters';
import { usePlayStore } from '../../state/playStore';
import { PET_SEAT, seatWorld } from '../../world/seats';
import type { CharacterId } from '../../types';

// Sparky — the friendly little dog from the treehouse letters — lives at
// 10600 in Free Play. He wanders the front yard, trots after whoever comes
// close, and E-to-pet showers hearts. Mounted in FREEPLAY ONLY so he never
// duplicates the "Where's Sparky?" treehouse mission version of himself.
//
// Multiplayer: every client simulates him from the SYNCED family positions
// (deterministic inputs → roughly converging behavior; he's a dog, a little
// disagreement about exactly where he sniffs is in character).

const HOME_X = 4;
const HOME_Z = 24; // 10600 front yard
const WANDER_R = 7;
const FOLLOW_RANGE = 13;   // comes over + bonds when you're this close
const LOSE_RANGE = 120;    // bond breaks only if you're REALLY gone (he'd have caught up by then)
const CATCH_UP_RANGE = 28; // fell this far behind → pops in behind you
const HOP_IN_RANGE = 16;   // close enough to hop in the car as you pull away
const HEEL_DIST = 1.7;
const WALK_SPEED = 2.0;
const TROT_SPEED = 4.6;
const SPRINT_SPEED = 9.5;  // faster than a walking kid, slower than a running one
const PET_RADIUS = 2.4;

const HEART_COUNT = 7;
const HEART_LIFE = 1.4;

export function FamilyDog() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'freeplay') return null;
  return <FamilyDogInner />;
}

function FamilyDogInner() {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const heartsRef = useRef<THREE.Group>(null);
  const state = useRef({
    x: HOME_X, z: HOME_Z, yaw: Math.PI,
    targetX: HOME_X, targetZ: HOME_Z,
    nextWanderAt: 0,
    petUntil: 0,
    lastSeenPetAt: 0,
    posPushAccum: 0,
    y: 0,
    bondId: null as CharacterId | null,   // the family member he's sticking with
    rideWith: null as CharacterId | null, // the DRIVER whose vehicle he's riding in
  });

  // Register the pettable spot (position kept live below).
  useEffect(() => {
    useZoneStore.getState().register({
      id: 'sparky',
      kind: 'pet',
      label: 'pet Sparky 🐶',
      x: HOME_X, z: HOME_Z,
      radius: PET_RADIUS,
    });
    return () => useZoneStore.getState().unregister('sparky');
  }, []);

  const heartMats = useMemo(
    () => Array.from({ length: HEART_COUNT }, () => new THREE.MeshStandardMaterial({
      color: '#ff5a8a',
      emissive: '#ff5a8a',
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0,
    })),
    [],
  );

  useFrame(({ clock }, dtRaw) => {
    const s = state.current;
    const dt = Math.min(dtRaw, 0.1);
    const t = clock.elapsedTime;
    const game = useGameStore.getState();

    // React to a fresh pet event (fired by PlayerController on E).
    // Only react when it was SPARKY who got petted (the ducks share the event).
    const zsNow = useZoneStore.getState();
    const petAt = zsNow.lastPetAt;
    if (petAt !== s.lastSeenPetAt && zsNow.lastPetId === 'sparky') {
      s.lastSeenPetAt = petAt;
      s.petUntil = t + 1.3;
      dogBark();
      petChime();
    }
    const petting = t < s.petUntil;

    // --- Brain: follow YOUR person (bond), ride along when they drive, else wander home ---
    // Who is claimed (so he ignores the frozen unclaimed family)?
    const peers = useNetStore.getState().peers;
    const claimed = new Set<string>();
    for (const p of Object.values(peers)) if (p.characterId) claimed.add(p.characterId);
    // Solo fallback: in single-player your active character may be the only claim.
    if (claimed.size === 0) claimed.add(game.activeCharacterId);
    let nearestD = Infinity;
    let nearId: CharacterId | null = null;
    for (const id of CHARACTER_ORDER) {
      if (!claimed.has(id)) continue;
      const p = game.positions[id];
      if (!p) continue;
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < nearestD) { nearestD = d; nearId = id; }
    }
    // Bond: he latches onto whoever comes close and STAYS with them — across
    // the map, into the truck, wherever — until they're truly gone (or someone
    // else is right next to him). The kids drove to the Plaza and "Sparky
    // didn't make it"; now he does.
    if (nearId && nearestD < FOLLOW_RANGE) s.bondId = nearId;
    if (s.bondId && !claimed.has(s.bondId)) s.bondId = null;
    let bondD = Infinity;
    let bondX = 0, bondZ = 0;
    if (s.bondId) {
      const bp = game.positions[s.bondId];
      bondX = bp.x; bondZ = bp.z;
      bondD = Math.hypot(bp.x - s.x, bp.z - s.z);
      if (bondD > LOSE_RANGE) s.bondId = null; // they left him way behind → home
    }

    // Ride along: when my person is in a car (driving OR riding), hop in the
    // back. Snap to the pet seat each frame (the vehicle is already resolved).
    const riding = usePlayStore.getState().riding;
    const br = s.bondId ? riding[s.bondId] : null;
    const drvId = br ? (br.passengerOf ?? s.bondId) : null;
    const dr = drvId ? riding[drvId] : null;
    if (s.bondId && dr && dr.vehicle === 'car' && !dr.passengerOf) {
      if (!s.rideWith) {
        // Hop in only if he's reasonably close — otherwise he sprints after you.
        if (bondD < HOP_IN_RANGE) s.rideWith = drvId;
      } else if (s.rideWith !== drvId) {
        s.rideWith = drvId;
      }
    } else if (s.rideWith) {
      // Ride over: hop out beside where the vehicle stopped.
      s.rideWith = null;
      s.y = 0;
      const offsets: [number, number][] = [[1.6, 0], [-1.6, 0], [0, 1.6], [0, -1.6]];
      for (const [ox, oz] of offsets) {
        const tx = s.x + ox, tz = s.z + oz;
        const r = resolveMotion(s.x, s.z, tx, tz, game.staticColliders);
        if (Math.hypot(r.x - tx, r.z - tz) < 0.05) { s.x = r.x; s.z = r.z; break; }
      }
      s.petUntil = t + 0.8; // happy wiggle on arrival
    }

    let moving = false;
    const chasing = !!s.bondId && !s.rideWith;
    if (s.rideWith && dr) {
      const dp = game.positions[s.rideWith];
      const seat = PET_SEAT[dr.carKind ?? 'sedan'];
      const w = seatWorld(dp.x, dr.y, dp.z, dr.heading, seat);
      s.x = w.x; s.z = w.z; s.y = w.y;
      s.yaw = dr.heading + Math.PI; // look out the back, ears in the wind
      s.targetX = s.x; s.targetZ = s.z;
    } else {
      s.y = 0;
      if (!petting) {
        if (chasing && bondD > HEEL_DIST) {
          s.targetX = bondX;
          s.targetZ = bondZ;
        } else if (!chasing && t > s.nextWanderAt) {
          s.nextWanderAt = t + 5 + Math.random() * 6;
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * WANDER_R;
          s.targetX = HOME_X + Math.cos(a) * r;
          s.targetZ = HOME_Z + Math.sin(a) * r;
        }
      }

      // Way behind (wedged on a fence, or you ran): he "catches up" — pops in a
      // few metres behind you rather than being lost forever.
      if (chasing && bondD > CATCH_UP_RANGE) {
        const bp = game.positions[s.bondId as CharacterId];
        const yaw = game.yaws[s.bondId as CharacterId] ?? 0;
        s.x = bp.x + Math.sin(yaw) * 4; // 4 m behind the facing direction
        s.z = bp.z + Math.cos(yaw) * 4;
        s.petUntil = t + 0.6;
      }

      const toX = s.targetX - s.x;
      const toZ = s.targetZ - s.z;
      const dist = Math.hypot(toX, toZ);
      const stopAt = chasing ? HEEL_DIST : 0.4;
      if (!petting && dist > stopAt) {
        moving = true;
        const speed = chasing ? (bondD > 9 ? SPRINT_SPEED : bondD > 5 ? TROT_SPEED : WALK_SPEED) : WALK_SPEED;
        const step = Math.min(speed * dt, dist);
        const nx = s.x + (toX / dist) * step;
        const nz = s.z + (toZ / dist) * step;
        const resolved = resolveMotion(s.x, s.z, nx, nz, game.staticColliders);
        s.x = resolved.x;
        s.z = resolved.z;
        const desiredYaw = Math.atan2(-(toX / dist), -(toZ / dist));
        let diff = desiredYaw - s.yaw;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        s.yaw += diff * Math.min(1, 8 * dt);
      } else if (!petting && chasing) {
        // Heeling: face your person.
        const desiredYaw = Math.atan2(-(bondX - s.x), -(bondZ - s.z));
        let diff = desiredYaw - s.yaw;
        while (diff > Math.PI) diff -= 2 * Math.PI;
        while (diff < -Math.PI) diff += 2 * Math.PI;
        s.yaw += diff * Math.min(1, 5 * dt);
      }
    }
    const nearestDForAnim = bondD;

    // Keep the pettable spot tracking him (~5x/sec is plenty).
    s.posPushAccum += dt;
    if (s.posPushAccum > 0.2) {
      s.posPushAccum = 0;
      useZoneStore.getState().updatePos('sparky', s.x, s.z);
    }

    // --- Body animation (whole-group procedural — no skeleton, no monsters) ---
    const root = rootRef.current;
    const body = bodyRef.current;
    if (root) {
      root.position.set(s.x, s.y, s.z);
      root.rotation.y = s.yaw;
    }
    if (body) {
      if (petting) {
        // Happy wiggle + hop.
        const k = (s.petUntil - t) / 1.3;
        body.position.y = Math.abs(Math.sin(t * 14)) * 0.16 * k;
        body.rotation.y = Math.sin(t * 18) * 0.3 * k;
        body.rotation.x = 0;
      } else if (moving) {
        const speedK = chasing && nearestDForAnim > 5 ? 13 : 9;
        body.position.y = Math.abs(Math.sin(t * speedK)) * 0.07;
        body.rotation.x = Math.sin(t * speedK) * 0.05;
        body.rotation.y = 0;
      } else {
        // Idle breathing + the occasional ear-perk tilt.
        body.position.y = Math.sin(t * 2.2) * 0.015;
        body.rotation.x = 0;
        body.rotation.y = Math.sin(t * 0.4) * 0.08;
      }
    }

    // --- Hearts burst while petting ---
    const hearts = heartsRef.current;
    if (hearts) {
      for (let i = 0; i < hearts.children.length; i++) {
        const h = hearts.children[i];
        const mat = heartMats[i];
        if (petting) {
          const age = ((t * 0.9 + i / HEART_COUNT) % 1) * HEART_LIFE;
          const a = (i / HEART_COUNT) * Math.PI * 2 + t * 0.6;
          h.visible = true;
          h.position.set(Math.cos(a) * 0.45, 0.7 + age * 0.9, Math.sin(a) * 0.45);
          h.rotation.y = t * 2 + i;
          const fade = 1 - age / HEART_LIFE;
          mat.opacity = Math.max(0, Math.min(1, fade * 1.4));
          h.scale.setScalar(0.7 + age * 0.4);
        } else {
          h.visible = false;
          mat.opacity = 0;
        }
      }
    }
  });

  return (
    <group ref={rootRef} position={[HOME_X, 0, HOME_Z]}>
      <group ref={bodyRef}>
        <GLBModel url={MODELS.dog.url} fitHeight={MODELS.dog.fitHeight} rotationY={MODELS.dog.rotationY} />
      </group>
      <group ref={heartsRef}>
        {heartMats.map((mat, i) => (
          <group key={i} visible={false}>
            {/* Tiny heart: two spheres + a rotated box point. */}
            <mesh material={mat} position={[-0.035, 0.02, 0]}>
              <sphereGeometry args={[0.05, 8, 8]} />
            </mesh>
            <mesh material={mat} position={[0.035, 0.02, 0]}>
              <sphereGeometry args={[0.05, 8, 8]} />
            </mesh>
            <mesh material={mat} position={[0, -0.04, 0]} rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[0.08, 0.08, 0.05]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
