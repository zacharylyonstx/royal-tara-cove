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
import {
  PUPS, PENS, TREAT_X, TREAT_Z, TRICKS, penSpot,
  type PupDef, type DogTrick,
} from '../../world/pets';
import type { PenDef } from '../../world/acrossBlvd';
import { PUP_SEAT, seatWorld } from '../../world/seats';
import { CHARACTERS, CHARACTER_ORDER } from '../../world/characters';
import { HeartBurst } from './HeartBurst';
import { Pomeranian, type PomAnim } from './Pomeranian';
import type { CharacterId } from '../../types';

// Woof Gang's adoptable puppies. Each pup is ONE component that is either
// waiting in its pen (E → "adopt Biscuit 🐶") or following its owner — every
// client simulates it from the owner's SYNCED position (like Sparky used to),
// so Dad sees Penny's pup trotting behind her too. Mounted in Free Play only.
//
// Two pens: the retriever pups, and the POMERANIANS (orange, white, black & tan
// — see Pomeranian.tsx). Between them sits the treat jar: grab treats, give one
// to any dog, and it does a trick for you (and loves you a lot more for it).

const HEEL = 1.4;
const WALK = 2.2;
const TROT = 4.8;
const SPRINT = 9.5;
const CATCH_UP = 28;
const PET_RADIUS = 2.2;
/** Pomeranians are little: draw the procedural model a touch under the retrievers. */
const POM_SIZE = 0.9;
const POM_HEIGHT = 0.52 * POM_SIZE;
/** Poms yip. */
const POM_BARK_PITCH = 1.9;
/** Yaw that faces WEST (−X), out of the pen toward the parking lot and the kids.
 *  (yaw = atan2(−dx, −dz); the old −π/2 had every pup staring at the shop wall.) */
const PEN_FACING = Math.PI / 2;

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export function Pups() {
  const gameMode = useGameStore((s) => s.gameMode);
  if (gameMode !== 'freeplay') return null;
  return (
    <group>
      {PENS.map((pen) => <Pen key={pen.id} pen={pen} />)}
      <TreatStand />
      {PUPS.map((p) => <Pup key={p.id} def={p} />)}
    </group>
  );
}

/** Low picket pen on the Woof Gang walkway + its sign. */
function Pen({ pen }: { pen: PenDef }) {
  const pickets = useMemo(() => {
    const out: { x: number; z: number; rot: number }[] = [];
    const hw = pen.w / 2, hd = pen.d / 2;
    for (let x = -hw; x <= hw + 0.01; x += 0.3) { out.push({ x, z: -hd, rot: 0 }); out.push({ x, z: hd, rot: 0 }); }
    for (let z = -hd + 0.3; z <= hd - 0.3 + 0.01; z += 0.3) { out.push({ x: hw, z, rot: Math.PI / 2 }); }
    // West side (toward the lot) has a gap in the middle so the pups can "come to you".
    for (let z = -hd + 0.3; z <= hd - 0.3 + 0.01; z += 0.3) { if (Math.abs(z) > 0.5) out.push({ x: -hw, z, rot: Math.PI / 2 }); }
    return out;
  }, [pen.w, pen.d]);
  const poms = pen.id === 'poms';
  return (
    <group position={[pen.x, 0, pen.z]}>
      {pickets.map((p, i) => (
        <mesh key={i} position={[p.x, 0.3, p.z]} rotation={[0, p.rot, 0]} castShadow>
          <boxGeometry args={[0.08, 0.6, 0.05]} />
          <meshStandardMaterial color={poms ? '#fff1e2' : '#f3eee4'} roughness={0.8} />
        </mesh>
      ))}
      {/* rails */}
      {[-pen.d / 2, pen.d / 2].map((z) => (
        <mesh key={`r${z}`} position={[0, 0.42, z]} castShadow>
          <boxGeometry args={[pen.w + 0.08, 0.06, 0.05]} />
          <meshStandardMaterial color="#e8e1d2" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[pen.w / 2, 0.42, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[pen.d, 0.06, 0.05]} />
        <meshStandardMaterial color="#e8e1d2" roughness={0.8} />
      </mesh>
      {/* floor: straw for the pups, a plush rug for the poms */}
      {/* (polygonOffset: the rug sits a hair above the walkway and used to z-fight in bands) */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[pen.w - 0.1, pen.d - 0.1]} />
        <meshStandardMaterial color={poms ? '#f0b7c4' : '#d9c48a'} roughness={1} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </mesh>
      {poms && (
        <>
          {/* a pom-sized cushion and a squeaky ball */}
          <mesh position={[0.8, 0.07, -0.9]} castShadow>
            <cylinderGeometry args={[0.42, 0.46, 0.12, 16]} />
            <meshStandardMaterial color="#8e6bbf" roughness={0.95} />
          </mesh>
          <mesh position={[0.3, 0.09, 0.95]} castShadow>
            <sphereGeometry args={[0.09, 12, 10]} />
            <meshStandardMaterial color="#ffd23f" roughness={0.6} />
          </mesh>
        </>
      )}
      {/* sign */}
      <group position={[-pen.w / 2 - 0.35, 0, poms ? pen.d / 2 + 0.2 : -pen.d / 2 - 0.2]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 1.1, 8]} />
          <meshStandardMaterial color="#6b4a2a" roughness={0.9} />
        </mesh>
        <Html position={[0, 1.25, 0]} center distanceFactor={10} zIndexRange={[80, 0]} occlude={false}>
          <div style={{ background: pen.accent, color: '#fff8ec', padding: '4px 12px', borderRadius: 10, fontSize: 15, fontWeight: 900, fontFamily: FONT, whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.35)', pointerEvents: 'none' }}>
            {pen.sign}
          </div>
        </Html>
      </group>
    </group>
  );
}

/** The treat jar on its little bakery stand (Woof Gang is a DOG BAKERY). */
function TreatStand() {
  useEffect(() => {
    useZoneStore.getState().register({ id: 'treat-jar', kind: 'treats', label: 'grab dog treats 🦴', x: TREAT_X - 0.55, z: TREAT_Z, radius: 2.0 });
    return () => useZoneStore.getState().unregister('treat-jar');
  }, []);
  return (
    <group position={[TREAT_X, 0, TREAT_Z]}>
      {/* stand */}
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.34, 0.8, 14]} />
        <meshStandardMaterial color="#3a6db0" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.82, 0]} castShadow>
        <cylinderGeometry args={[0.38, 0.38, 0.05, 18]} />
        <meshStandardMaterial color="#f3eee4" roughness={0.6} />
      </mesh>
      {/* glass jar full of bone biscuits */}
      <mesh position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.34, 16]} />
        <meshStandardMaterial color="#cfe9f5" roughness={0.1} metalness={0.1} transparent opacity={0.38} />
      </mesh>
      {[[0, 0.93, 0, 0.3], [0.05, 0.99, 0.03, 1.4], [-0.05, 1.05, -0.02, 2.6], [0.02, 1.1, 0.04, 0.9]].map(([x, y, z, r], i) => (
        <group key={i} position={[x, y, z]} rotation={[0.4, r, 0.3]}>
          <mesh><boxGeometry args={[0.14, 0.04, 0.045]} /><meshStandardMaterial color="#d9a866" roughness={0.9} /></mesh>
          {[-0.07, 0.07].map((ex) => (
            <mesh key={ex} position={[ex, 0, 0]}><sphereGeometry args={[0.034, 8, 6]} /><meshStandardMaterial color="#d9a866" roughness={0.9} /></mesh>
          ))}
        </group>
      ))}
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.185, 0.185, 0.04, 16]} />
        <meshStandardMaterial color="#e2483d" roughness={0.5} />
      </mesh>
      <Html position={[0, 1.62, 0]} center distanceFactor={10} zIndexRange={[80, 0]} occlude={false}>
        <div style={{ background: '#fff8ec', color: '#7a4a1a', padding: '3px 11px', borderRadius: 10, fontSize: 14, fontWeight: 900, fontFamily: FONT, whiteSpace: 'nowrap', border: '2px solid #d9a866', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', pointerEvents: 'none' }}>
          🦴 TREATS
        </div>
      </Html>
    </group>
  );
}

const ease = (p: number) => p * p * (3 - 2 * p);
/** 0→1→0 envelope: quick up, hold, quick down. */
const hold = (p: number) => Math.min(1, p / 0.18, (1 - p) / 0.15);

function Pup({ def }: { def: PupDef }) {
  const rootRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null);
  const spot = useMemo(() => penSpot(def), [def]);
  const isPom = def.breed === 'pomeranian';
  const height = isPom ? POM_HEIGHT * def.scale : MODELS.dog.fitHeight * def.scale;
  const barkPitch = isPom ? POM_BARK_PITCH : 1.25;
  // Plain mutable boxes (not React refs) so child components can read them in useFrame.
  const petUntil = useMemo(() => ({ current: 0 }), []);
  const pomAnim = useMemo<PomAnim>(() => ({ moving: false, pace: 0, excited: false }), []);
  const state = useRef({
    x: spot.x, z: spot.z, y: 0, yaw: PEN_FACING,
    lastSeenPetAt: 0, lastSeenTrickAt: 0, posPushAccum: 0, idlePhase: Math.random() * 6,
    justAdopted: false,
    trick: null as DogTrick | null, trickStart: 0,
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
    else zs.register({ id: zoneId, kind: 'adopt', label: `adopt ${def.name} 🐶`, x: spot.x, z: spot.z, radius: 2.4 });
    return () => useZoneStore.getState().unregister(zoneId);
  }, [owner, zoneId, def.name, spot.x, spot.z]);

  // Freshly adopted: pop out of the pen next to the new owner (with a yip).
  const prevOwner = useRef<CharacterId | null>(null);
  useEffect(() => {
    if (owner && owner !== prevOwner.current) {
      const p = useGameStore.getState().positions[owner];
      const s = state.current;
      s.x = p.x + 0.8; s.z = p.z + 0.8; s.y = 0;
      // NOTE: petUntil is in CLOCK seconds (three's clock.elapsedTime), not
      // performance.now()/1000 — mixing them left pups wiggling for minutes.
      s.justAdopted = true;
      dogBark(barkPitch);
    } else if (!owner && prevOwner.current) {
      const s = state.current;
      s.x = spot.x; s.z = spot.z; s.y = 0;
    }
    prevOwner.current = owner;
  }, [owner, spot.x, spot.z, barkPitch]);

  useFrame(({ clock }, dtRaw) => {
    const s = state.current;
    const dt = Math.min(dtRaw, 0.1);
    const t = clock.elapsedTime;
    const game = useGameStore.getState();

    // Fresh adoption: happy wiggle (timestamp needs the CLOCK, only known here).
    if (s.justAdopted) { s.justAdopted = false; petUntil.current = t + 1.2; }
    const zs = useZoneStore.getState();
    // A treat! → do the trick everyone was told about.
    const lt = zs.lastTrick;
    if (lt && lt.at !== s.lastSeenTrickAt && lt.id === zoneId) {
      s.lastSeenTrickAt = lt.at;
      s.lastSeenPetAt = zs.lastPetAt; // the treat's own pet event is part of this
      s.trick = lt.trick;
      s.trickStart = t;
      petUntil.current = t + TRICKS[lt.trick].duration + 0.7;
      dogBark(barkPitch);
      petChime();
    }
    // Petted?
    if (zs.lastPetAt !== s.lastSeenPetAt && zs.lastPetId === zoneId) {
      s.lastSeenPetAt = zs.lastPetAt;
      petUntil.current = t + 1.2;
      dogBark(barkPitch);
      petChime();
    }
    let trickP = -1;
    if (s.trick) {
      trickP = (t - s.trickStart) / TRICKS[s.trick].duration;
      if (trickP >= 1) { s.trick = null; trickP = -1; }
    }
    const petting = t < petUntil.current;

    let moving = false;
    let pace = 0;
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
          // Catch up to a spot behind the owner — but never inside a wall.
          const tx = op.x + Math.sin(yaw) * 3, tz = op.z + Math.cos(yaw) * 3;
          const r = resolveMotion(op.x, op.z, tx, tz, game.staticColliders);
          s.x = r.x; s.z = r.z;
          petUntil.current = t + 0.5;
        } else if (!petting && d > HEEL) {
          moving = true;
          const speed = d > 9 ? SPRINT : d > 4 ? TROT : WALK;
          pace = d > 9 ? 1 : d > 4 ? 0.55 : 0.15;
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
    } else if (!s.trick) {
      // In the pen: face the lot (west), little curious head turns.
      s.y = 0;
      s.yaw = PEN_FACING + Math.sin(t * 0.5 + s.idlePhase) * 0.35;
    }

    s.posPushAccum += dt;
    if (s.posPushAccum > 0.2) { s.posPushAccum = 0; zs.updatePos(zoneId, s.x, s.z); }

    // ---- pose ----
    let offX = 0, offZ = 0, hop = 0, bodyYaw = 0, pitch = 0, roll = 0;
    let yaw = s.yaw;
    if (s.trick && trickP >= 0 && !riding) {
      const p = trickP;
      switch (s.trick) {
        case 'spin':
          bodyYaw = ease(p) * Math.PI * 4;
          hop = Math.sin(p * Math.PI) * 0.1;
          break;
        case 'flip':
          pitch = ease(p) * Math.PI * 2;          // nose up and over backwards
          hop = Math.sin(p * Math.PI) * (0.55 + height * 0.5);
          break;
        case 'beg': {
          const e = hold(p);
          pitch = 0.85 * e;
          hop = Math.abs(Math.sin(t * 11)) * 0.035 * e;
          break;
        }
        case 'roll':
          roll = ease(p) * Math.PI * 2;
          hop = 0.03;
          break;
        case 'zoomies': {
          // Two flat-out laps of a little circle (smaller in the pen).
          const r = (owner ? 1.0 : 0.42) * Math.min(1, p / 0.12, (1 - p) / 0.12);
          const a = p * Math.PI * 4;
          offX = Math.cos(a) * r - r;
          offZ = Math.sin(a) * r;
          yaw = Math.atan2(Math.sin(a), -Math.cos(a));
          moving = true; pace = 1;
          hop = Math.abs(Math.sin(t * 22)) * 0.03;
          break;
        }
        case 'dance': {
          const e = hold(p);
          pitch = 1.0 * e;                         // up on the hind legs…
          bodyYaw = ease(p) * Math.PI * 4;         // …and twirl
          hop = Math.abs(Math.sin(t * 9)) * 0.05 * e;
          break;
        }
      }
    } else if (petting) {
      hop = Math.abs(Math.sin(t * 15)) * 0.12;
      bodyYaw = Math.sin(t * 19) * 0.35;
    } else if (riding) {
      hop = Math.abs(Math.sin(t * 9)) * 0.025;
      bodyYaw = Math.sin(t * 0.8) * 0.2;
    } else if (moving) {
      hop = Math.abs(Math.sin(t * 14)) * (isPom ? 0.035 : 0.06);
    } else {
      // Puppy idle: wiggly + the occasional hop when waiting to be adopted.
      const idleHop = !owner && Math.sin(t * 1.3 + s.idlePhase) > 0.93 ? 0.08 : 0;
      hop = Math.sin(t * 3 + s.idlePhase) * 0.012 + idleHop;
      bodyYaw = Math.sin(t * 0.7 + s.idlePhase) * 0.1;
      // Pomeranians can't sit still: every so often, a happy little twirl.
      if (isPom && !owner) {
        const k = (t * 0.16 + s.idlePhase) % 1;
        if (k < 0.07) { bodyYaw = ease(k / 0.07) * Math.PI * 2; hop += 0.05; }
      }
    }

    const root = rootRef.current, body = bodyRef.current, pivot = pivotRef.current;
    if (root) { root.position.set(s.x + offX, s.y, s.z + offZ); root.rotation.y = yaw; }
    if (body) { body.position.y = hop; body.rotation.y = bodyYaw; }
    if (pivot) { pivot.rotation.x = pitch; pivot.rotation.z = roll; }
    pomAnim.moving = moving;
    pomAnim.pace = pace;
    pomAnim.excited = petting || !!s.trick;
  });

  const ownerDef = owner ? CHARACTERS[owner] : null;
  return (
    <group ref={rootRef} position={[spot.x, 0, spot.z]}>
      <group ref={bodyRef}>
        {/* Flips / rolls / sit-pretty pivot about the pup's middle, not its paws. */}
        <group ref={pivotRef} position={[0, height / 2, 0]}>
          <group position={[0, -height / 2, 0]}>
            {isPom
              ? <Pomeranian coat={def.coat ?? 'orange'} scale={def.scale * POM_SIZE} anim={pomAnim} />
              : <GLBModel url={MODELS.dog.url} fitHeight={MODELS.dog.fitHeight * def.scale} rotationY={MODELS.dog.rotationY} tint={def.tint} />}
          </group>
        </group>
      </group>
      <HeartBurst until={petUntil} y={0.45} radius={0.28} />
      <group position={[0, height + 0.38, 0]}>
        <Html center distanceFactor={5} zIndexRange={[85, 0]} occlude={false}>
          <div style={{ background: 'rgba(20,28,38,0.72)', color: 'white', padding: '2px 9px', borderRadius: 999, fontSize: 13, fontWeight: 800, fontFamily: FONT, border: `2px solid ${ownerDef ? ownerDef.bodyColor : isPom ? '#e07a2e' : '#3a6db0'}`, whiteSpace: 'nowrap', pointerEvents: 'none', textAlign: 'center' }}>
            🐶 {def.name}{ownerDef ? ` · ${ownerDef.name}'s` : ''}
            {!ownerDef && <div style={{ fontSize: 10, fontWeight: 600, opacity: 0.85 }}>{def.blurb}</div>}
          </div>
        </Html>
      </group>
    </group>
  );
}
