import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';
import { useGameStore } from '../../state/gameStore';
import { usePlayStore } from '../../state/playStore';
import { usePetStore } from '../../state/petStore';
import { useZoneStore } from '../../state/zoneStore';
import { resolveMotion } from '../../systems/collision';
import { dogBark, petChime } from '../../audio';
import { PUPS, PEN_SPOTS, PEN_X, PEN_Z, PEN_W, PEN_D, type PupDef } from '../../world/pets';
import { PUP_SEAT, seatWorld } from '../../world/seats';
import { CHARACTERS, CHARACTER_ORDER } from '../../world/characters';
import { HeartBurst } from './HeartBurst';
import type { CharacterId } from '../../types';

// Woof Gang's adoptable puppies. Each pup is ONE component that is either
// waiting in the pen (E → "adopt Biscuit 🐶") or following its owner — every
// client simulates it from the owner's SYNCED position (like Sparky used to),
// so Dad sees Penny's pup trotting behind her too. Mounted in Free Play only.

const HEEL = 1.4;
const WALK = 2.2;
const TROT = 4.8;
const SPRINT = 9.5;
const CATCH_UP = 28;
const PET_RADIUS = 2.2;

export function Pups() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'freeplay') return null;
  return (
    <group>
      <Pen />
      {PUPS.map((p, i) => (
        <Pup key={p.id} def={p} penSpot={PEN_SPOTS[i]} />
      ))}
    </group>
  );
}

/** Low picket pen on the Woof Gang walkway + a little "ADOPT ME" sign. */
function Pen() {
  const pickets = useMemo(() => {
    const out: { x: number; z: number; rot: number }[] = [];
    const hw = PEN_W / 2, hd = PEN_D / 2;
    for (let x = -hw; x <= hw + 0.01; x += 0.3) { out.push({ x, z: -hd, rot: 0 }); out.push({ x, z: hd, rot: 0 }); }
    for (let z = -hd + 0.3; z <= hd - 0.3 + 0.01; z += 0.3) { out.push({ x: hw, z, rot: Math.PI / 2 }); }
    // West side (toward the lot) has a gap in the middle so the pups can "come to you".
    for (let z = -hd + 0.3; z <= hd - 0.3 + 0.01; z += 0.3) { if (Math.abs(z) > 0.5) out.push({ x: -hw, z, rot: Math.PI / 2 }); }
    return out;
  }, []);
  return (
    <group position={[PEN_X, 0, PEN_Z]}>
      {pickets.map((p, i) => (
        <mesh key={i} position={[p.x, 0.3, p.z]} rotation={[0, p.rot, 0]} castShadow>
          <boxGeometry args={[0.08, 0.6, 0.05]} />
          <meshStandardMaterial color="#f3eee4" roughness={0.8} />
        </mesh>
      ))}
      {/* rails */}
      {[-PEN_D / 2, PEN_D / 2].map((z) => (
        <mesh key={`r${z}`} position={[0, 0.42, z]} castShadow>
          <boxGeometry args={[PEN_W + 0.08, 0.06, 0.05]} />
          <meshStandardMaterial color="#e8e1d2" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[PEN_W / 2, 0.42, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[PEN_D, 0.06, 0.05]} />
        <meshStandardMaterial color="#e8e1d2" roughness={0.8} />
      </mesh>
      {/* straw floor */}
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[PEN_W - 0.1, PEN_D - 0.1]} />
        <meshStandardMaterial color="#d9c48a" roughness={1} />
      </mesh>
      {/* sign */}
      <group position={[-PEN_W / 2 - 0.35, 0, -PEN_D / 2 - 0.2]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 1.1, 8]} />
          <meshStandardMaterial color="#6b4a2a" roughness={0.9} />
        </mesh>
        <Html position={[0, 1.25, 0]} center distanceFactor={10} zIndexRange={[80, 0]} occlude={false}>
          <div style={{ background: '#3a6db0', color: '#fff8ec', padding: '4px 12px', borderRadius: 10, fontSize: 15, fontWeight: 900, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', pointerEvents: 'none' }}>
            🐶 ADOPT ME!
          </div>
        </Html>
      </group>
    </group>
  );
}

function Pup({ def, penSpot }: { def: PupDef; penSpot: { x: number; z: number } }) {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  // A plain mutable box (not a React ref) so HeartBurst can read it in useFrame.
  const petUntil = useMemo(() => ({ current: 0 }), []);
  const state = useRef({
    x: penSpot.x, z: penSpot.z, y: 0, yaw: -Math.PI / 2,
    lastSeenPetAt: 0, posPushAccum: 0, idlePhase: Math.random() * 6,
  });
  // Who owns me (first owner in family order wins if two adopted the same pup at once).
  const pets = usePetStore((s) => s.pets);
  const owner = (CHARACTER_ORDER.find((id) => pets[id] === def.id) ?? null) as CharacterId | null;
  const zoneId = `pup-${def.id}`;

  // Registry: in the pen I'm adoptable; once adopted I'm pettable.
  useEffect(() => {
    const zs = useZoneStore.getState();
    const s = state.current;
    if (owner) zs.register({ id: zoneId, kind: 'pet', label: `pet ${def.name} 🐶`, x: s.x, z: s.z, radius: PET_RADIUS });
    else zs.register({ id: zoneId, kind: 'adopt', label: `adopt ${def.name} 🐶`, x: penSpot.x, z: penSpot.z, radius: 2.6 });
    return () => useZoneStore.getState().unregister(zoneId);
  }, [owner, zoneId, def.name, penSpot.x, penSpot.z]);

  // Freshly adopted: pop out of the pen next to the new owner (with a yip).
  const prevOwner = useRef<CharacterId | null>(null);
  useEffect(() => {
    if (owner && owner !== prevOwner.current) {
      const p = useGameStore.getState().positions[owner];
      const s = state.current;
      s.x = p.x + 0.8; s.z = p.z + 0.8; s.y = 0;
      petUntil.current = performance.now() / 1000 + 1.2; // (clock-based below; harmless)
      dogBark();
    } else if (!owner && prevOwner.current) {
      const s = state.current;
      s.x = penSpot.x; s.z = penSpot.z; s.y = 0;
    }
    prevOwner.current = owner;
  }, [owner, penSpot.x, penSpot.z, petUntil]);

  useFrame(({ clock }, dtRaw) => {
    const s = state.current;
    const dt = Math.min(dtRaw, 0.1);
    const t = clock.elapsedTime;
    const game = useGameStore.getState();

    // Petted?
    const zs = useZoneStore.getState();
    if (zs.lastPetAt !== s.lastSeenPetAt && zs.lastPetId === zoneId) {
      s.lastSeenPetAt = zs.lastPetAt;
      petUntil.current = t + 1.2;
      dogBark();
      petChime();
    }
    const petting = t < petUntil.current;

    let moving = false;
    let riding = false;
    if (owner) {
      const op = game.positions[owner];
      const rs = usePlayStore.getState().riding;
      const orid = rs[owner];
      const drvId = orid ? (orid.passengerOf ?? owner) : null;
      const dr = drvId ? rs[drvId] : null;
      if (dr && dr.vehicle === 'car' && !dr.passengerOf && drvId) {
        // Ride along in the back.
        riding = true;
        const dp = game.positions[drvId];
        const w = seatWorld(dp.x, dr.y, dp.z, dr.heading, PUP_SEAT[dr.carKind ?? 'sedan']);
        s.x = w.x; s.y = w.y; s.z = w.z; s.yaw = dr.heading + Math.PI;
      } else {
        s.y = 0;
        const dx = op.x - s.x, dz = op.z - s.z;
        const d = Math.hypot(dx, dz);
        if (d > CATCH_UP) {
          const yaw = game.yaws[owner] ?? 0;
          s.x = op.x + Math.sin(yaw) * 3; s.z = op.z + Math.cos(yaw) * 3;
          petUntil.current = t + 0.5;
        } else if (!petting && d > HEEL) {
          moving = true;
          const speed = d > 9 ? SPRINT : d > 4 ? TROT : WALK;
          const step = Math.min(speed * dt, d - HEEL + 0.05);
          const nx = s.x + (dx / d) * step, nz = s.z + (dz / d) * step;
          const r = resolveMotion(s.x, s.z, nx, nz, game.staticColliders);
          s.x = r.x; s.z = r.z;
          const want = Math.atan2(-dx, -dz);
          let diff = want - s.yaw; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
          s.yaw += diff * Math.min(1, 9 * dt);
        } else if (!petting) {
          const want = Math.atan2(-dx, -dz);
          let diff = want - s.yaw; while (diff > Math.PI) diff -= 2 * Math.PI; while (diff < -Math.PI) diff += 2 * Math.PI;
          s.yaw += diff * Math.min(1, 5 * dt);
        }
      }
    } else {
      // In the pen: face the lot (west), little curious head turns.
      s.y = 0;
      s.yaw = -Math.PI / 2 + Math.sin(t * 0.5 + s.idlePhase) * 0.35;
    }

    s.posPushAccum += dt;
    if (s.posPushAccum > 0.2) { s.posPushAccum = 0; zs.updatePos(zoneId, s.x, s.z); }

    const root = rootRef.current, body = bodyRef.current;
    if (root) { root.position.set(s.x, s.y, s.z); root.rotation.y = s.yaw; }
    if (body) {
      if (petting) {
        body.position.y = Math.abs(Math.sin(t * 15)) * 0.12;
        body.rotation.y = Math.sin(t * 19) * 0.35;
      } else if (riding) {
        body.position.y = Math.abs(Math.sin(t * 9)) * 0.025;
        body.rotation.y = Math.sin(t * 0.8) * 0.2;
      } else if (moving) {
        body.position.y = Math.abs(Math.sin(t * 14)) * 0.06;
        body.rotation.y = 0;
      } else {
        // Puppy idle: wiggly + the occasional hop when waiting to be adopted.
        const hop = !owner && Math.sin(t * 1.3 + s.idlePhase) > 0.93 ? 0.08 : 0;
        body.position.y = Math.sin(t * 3 + s.idlePhase) * 0.012 + hop;
        body.rotation.y = Math.sin(t * 0.7 + s.idlePhase) * 0.1;
      }
    }
  });

  const ownerDef = owner ? CHARACTERS[owner] : null;
  return (
    <group ref={rootRef} position={[penSpot.x, 0, penSpot.z]}>
      <group ref={bodyRef}>
        <GLBModel url={MODELS.dog.url} fitHeight={MODELS.dog.fitHeight * def.scale} rotationY={MODELS.dog.rotationY} tint={def.tint} />
      </group>
      <HeartBurst until={petUntil} y={0.45} radius={0.28} />
      <group position={[0, 0.95 * def.scale + 0.35, 0]}>
        <Html center distanceFactor={11} zIndexRange={[85, 0]} occlude={false}>
          <div style={{ background: 'rgba(20,28,38,0.72)', color: 'white', padding: '2px 9px', borderRadius: 999, fontSize: 13, fontWeight: 800, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', border: `2px solid ${ownerDef ? ownerDef.bodyColor : '#3a6db0'}`, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            🐶 {def.name}{ownerDef ? ` · ${ownerDef.name}'s` : ''}
          </div>
        </Html>
      </group>
    </group>
  );
}
