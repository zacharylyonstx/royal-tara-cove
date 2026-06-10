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
const FOLLOW_RANGE = 13;
const HEEL_DIST = 1.7;
const WALK_SPEED = 2.0;
const TROT_SPEED = 4.6;
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
    const petAt = useZoneStore.getState().lastPetAt;
    if (petAt !== s.lastSeenPetAt) {
      s.lastSeenPetAt = petAt;
      s.petUntil = t + 1.3;
      dogBark();
      petChime();
    }
    const petting = t < s.petUntil;

    // --- Brain: follow the nearest claimed family member, else wander home ---
    let nearestD = Infinity;
    let nearX = 0, nearZ = 0;
    const peers = useNetStore.getState().peers;
    const claimed = new Set<string>();
    for (const p of Object.values(peers)) if (p.characterId) claimed.add(p.characterId);
    // Solo fallback: in single-player your active character may be the only claim.
    if (claimed.size === 0) claimed.add(game.activeCharacterId);
    for (const id of CHARACTER_ORDER) {
      if (!claimed.has(id)) continue;
      const p = game.positions[id];
      if (!p) continue;
      const d = Math.hypot(p.x - s.x, p.z - s.z);
      if (d < nearestD) { nearestD = d; nearX = p.x; nearZ = p.z; }
    }

    if (!petting) {
      if (nearestD < FOLLOW_RANGE && nearestD > HEEL_DIST) {
        s.targetX = nearX;
        s.targetZ = nearZ;
      } else if (nearestD >= FOLLOW_RANGE && t > s.nextWanderAt) {
        s.nextWanderAt = t + 5 + Math.random() * 6;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * WANDER_R;
        s.targetX = HOME_X + Math.cos(a) * r;
        s.targetZ = HOME_Z + Math.sin(a) * r;
      }
    }

    const toX = s.targetX - s.x;
    const toZ = s.targetZ - s.z;
    const dist = Math.hypot(toX, toZ);
    const chasing = nearestD < FOLLOW_RANGE;
    const stopAt = chasing ? HEEL_DIST : 0.4;
    let moving = false;
    if (!petting && dist > stopAt) {
      moving = true;
      const speed = chasing && nearestD > 5 ? TROT_SPEED : WALK_SPEED;
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
      const desiredYaw = Math.atan2(-(nearX - s.x), -(nearZ - s.z));
      let diff = desiredYaw - s.yaw;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      s.yaw += diff * Math.min(1, 5 * dt);
    }

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
      root.position.set(s.x, 0, s.z);
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
        const speedK = chasing && nearestD > 5 ? 13 : 9;
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
