import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RAIL_BED_W, RAIL_MID_X, RAIL_X, RAIL_X_B, RAIL_Z_N, GATE_DX, WEST_BLVD_Z } from '../../world/westAvery';
import { TRACK_X, TRACK_Z_S, LAKELINE_BLVD_Z, PARMER_Z, rail, TRAIN_LEN, trainPlan } from '../../world/redLine';
import { SOUTH_BRIDGES } from '../../world/terrain';
import { useGameStore } from '../../state/gameStore';
import { useNetStore } from '../../state/netStore';
import { crossingBell } from '../../audio';

// The permanent way: two tracks from the north edge of the map to the haze
// south of the Domain, the road crossings (gates + bells) and the bridges.
// Static scenery in every mode; the gates only work when the trains run.

const TIE_GAP = 1.15;
/** Roads the line crosses at grade: z, and how wide the road is. */
const ROAD_CROSSINGS = [
  { z: WEST_BLVD_Z, w: 14.4, colliders: true },
  { z: LAKELINE_BLVD_Z, w: 11, colliders: false },
  { z: PARMER_Z, w: 13, colliders: false },
];

export function Track() {
  const len = TRACK_Z_S - RAIL_Z_N;
  const cz = (TRACK_Z_S + RAIL_Z_N) / 2;
  const tieRef = useRef<THREE.InstancedMesh>(null);
  const perTrack = Math.floor(len / TIE_GAP);
  useLayoutEffect(() => {
    const m = tieRef.current;
    if (!m) return;
    const o = new THREE.Object3D();
    let n = 0;
    for (const x of TRACK_X) {
      for (let i = 0; i < perTrack; i++) {
        const z = RAIL_Z_N + 0.5 + i * TIE_GAP;
        // No ties through a road crossing (concrete panels there).
        const inRoad = ROAD_CROSSINGS.some((r) => Math.abs(z - r.z) < r.w / 2 + 0.3);
        o.position.set(x, inRoad ? -1 : 0.09, z);
        o.updateMatrix();
        m.setMatrixAt(n++, o.matrix);
      }
    }
    m.instanceMatrix.needsUpdate = true;
  }, [perTrack]);
  const mats = useMemo(() => ({
    ballast: new THREE.MeshStandardMaterial({ color: '#8d877c', roughness: 1 }),
    rail: new THREE.MeshStandardMaterial({ color: '#8a8f96', roughness: 0.35, metalness: 0.8 }),
    panel: new THREE.MeshStandardMaterial({ color: '#b9b6ad', roughness: 0.95 }),
    girder: new THREE.MeshStandardMaterial({ color: '#5c6e68', roughness: 0.7, metalness: 0.3 }),
    pier: new THREE.MeshStandardMaterial({ color: '#b5b0a4', roughness: 0.95 }),
  }), []);
  return (
    <group>
      {/* One ballast bed under both tracks + the strip between them. */}
      <mesh position={[RAIL_MID_X, 0.03, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={mats.ballast}>
        <planeGeometry args={[RAIL_X_B - RAIL_X + RAIL_BED_W, len]} />
      </mesh>
      <instancedMesh ref={tieRef} args={[undefined, undefined, perTrack * 2]} receiveShadow frustumCulled={false}>
        <boxGeometry args={[2.5, 0.12, 0.24]} />
        <meshStandardMaterial color="#4c3a2a" roughness={0.95} />
      </instancedMesh>
      {TRACK_X.map((x) => [-0.72, 0.72].map((dx) => (
        <mesh key={`${x}:${dx}`} position={[x + dx, 0.2, cz]} material={mats.rail}>
          <boxGeometry args={[0.09, 0.14, len]} />
        </mesh>
      )))}
      {/* Road crossings: concrete panels, stop bars, gates. */}
      {ROAD_CROSSINGS.map((r) => (
        <group key={r.z}>
          <mesh position={[RAIL_MID_X, 0.045, r.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={mats.panel}>
            <planeGeometry args={[RAIL_X_B - RAIL_X + RAIL_BED_W + 1.2, r.w]} />
          </mesh>
          {[RAIL_X - GATE_DX - 1.3, RAIL_X_B + GATE_DX + 1.3].map((x) => (
            <mesh key={x} position={[x, 0.034, r.z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[0.45, r.w - 2.4]} />
              <meshBasicMaterial color="#f4f1e6" />
            </mesh>
          ))}
          <LevelCrossing z={r.z} halfRoad={r.w / 2} colliders={r.colliders} />
        </group>
      ))}
      {/* Bridges: plate girders either side, piers down into the cut. */}
      {SOUTH_BRIDGES.map(([z0, z1]) => {
        const L = z1 - z0, mz = (z0 + z1) / 2, halfW = (RAIL_X_B - RAIL_X) / 2 + RAIL_BED_W / 2 + 0.5;
        return (
          <group key={z0}>
            <mesh position={[RAIL_MID_X, -0.45, mz]} material={mats.pier} receiveShadow>
              <boxGeometry args={[halfW * 2, 0.9, L]} />
            </mesh>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[RAIL_MID_X + s * halfW, 0.25, mz]} material={mats.girder} castShadow>
                <boxGeometry args={[0.3, 1.5, L]} />
              </mesh>
            ))}
            {[z0 + 4, z1 - 4].map((pz) => (
              <mesh key={pz} position={[RAIL_MID_X, -5, pz]} material={mats.pier} castShadow>
                <boxGeometry args={[halfW * 2 - 1, 9, 1.4]} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

/** Signal masts, flashing reds, gate arms and the bell for one road crossing. */
function LevelCrossing({ z, halfRoad, colliders }: { z: number; halfRoad: number; colliders: boolean }) {
  const arms = useRef<(THREE.Group | null)[]>([]);
  const lamps = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const st = useRef({ gate: 0, bellAt: 0, lastWarn: false });
  const armLen = halfRoad;

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const game = useGameStore.getState();
    const s = st.current;
    // Down for a train on (or seconds from) this road.
    let warn = false;
    if (rail.live) {
      if (colliders) warn = rail.gateWarning;
      else {
        for (let i = 0; i < 2 && !warn; i++) {
          for (const look of [0, 3, 6]) {
            const tz = look === 0 ? rail.trains[i].z : trainPlan(i, rail.T + look).z;
            if (Math.abs(tz - z) < TRAIN_LEN / 2 + 8) { warn = true; break; }
          }
        }
      }
    }
    s.gate += ((warn ? 1 : 0) - s.gate) * Math.min(1, dt * 2.6);
    for (const a of arms.current) if (a) a.rotation.x = -(1 - s.gate) * 1.35;
    if (colliders && warn !== s.lastWarn) {
      s.lastWarn = warn;
      for (const c of game.staticColliders) if (c.tag === 'rail-gate') c.passable = !warn;
    }
    const blink = warn ? (Math.floor(clock.elapsedTime * 2.4) % 2) : -1;
    lamps.current.forEach((m, i) => { if (m) m.emissiveIntensity = blink >= 0 && (i % 2 === blink) ? 2.4 : 0.05; });
    // The bell — only if I'm close enough to hear it.
    if (warn && !game.welcomeOpen) {
      const me = useNetStore.getState().myCharacterId ?? game.activeCharacterId;
      const p = game.positions[me];
      const d = Math.hypot(p.x - RAIL_MID_X, p.z - z);
      if (d < 75 && clock.elapsedTime - s.bellAt > 0.46) {
        s.bellAt = clock.elapsedTime;
        crossingBell(Math.max(0.12, 1 - d / 75));
      }
    }
  });

  return (
    <group>
      {[-1, 1].map((sx, gi) => (
        <group key={sx} position={[sx < 0 ? RAIL_X - GATE_DX : RAIL_X_B + GATE_DX, 0, z + sx * (halfRoad + 0.4)]}>
          <mesh position={[0, 2.1, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.11, 4.2, 10]} />
            <meshStandardMaterial color="#c9ccd1" roughness={0.4} metalness={0.6} />
          </mesh>
          {/* crossbuck */}
          {[0.5, -0.5].map((r) => (
            <mesh key={r} position={[0, 3.7, 0]} rotation={[0, Math.PI / 2, r]} castShadow>
              <boxGeometry args={[1.5, 0.2, 0.05]} />
              <meshStandardMaterial color="#f4f1e6" roughness={0.6} />
            </mesh>
          ))}
          {/* flashing reds */}
          {[-0.4, 0.4].map((dz, li) => (
            <mesh key={dz} position={[0, 2.9, dz]} rotation={[0, Math.PI / 2, 0]}>
              <cylinderGeometry args={[0.17, 0.17, 0.12, 14]} />
              <meshStandardMaterial ref={(m) => { lamps.current[gi * 2 + li] = m; }} color="#3a0d0d" emissive="#ff1e1e" emissiveIntensity={0.05} />
            </mesh>
          ))}
          {/* gate arm: pivots at the mast, reaches out over its side of the road */}
          <group ref={(g) => { arms.current[gi] = g; }} position={[0, 1.15, 0]} rotation={[-1.35, 0, 0]}>
            <group position={[0, 0, -sx * armLen / 2]}>
              <mesh castShadow>
                <boxGeometry args={[0.1, 0.14, armLen]} />
                <meshStandardMaterial color="#f4f1e6" roughness={0.6} />
              </mesh>
              {[-0.36, -0.18, 0, 0.18, 0.36].map((k) => (
                <mesh key={k} position={[0, 0, k * armLen]}>
                  <boxGeometry args={[0.11, 0.15, 0.6]} />
                  <meshStandardMaterial color="#d92b2b" roughness={0.6} />
                </mesh>
              ))}
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}
