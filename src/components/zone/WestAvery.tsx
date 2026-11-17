import { Baked } from '../Baked';
import { Track } from '../rail/Track';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { GLBModel } from '../GLBModel';
import { MODELS } from '../../world/models';
import { mat } from '../../world/materials';
import {
  RAIL_TRAIL_X, RAIL_TRAIL_Z_N, RAIL_TRAIL_Z_S, TRAIL_W,
  CAMPUS, POOL, CREEK_SOUTH, CREEK_NORTH, CREEK_HALF_W, CULVERT_Z0, CULVERT_Z1,
  GREEN_TRAIL, NORTH_TRAIL, CONNECTOR_Z, BRIDGE_X0, BRIDGE_X1, BRIDGE_Y, TRAILHEAD,
} from '../../world/westAvery';
import { GableRoof, METAL_ROOF } from './campusParts';

// The west expansion's visuals (layout + sources: world/westAvery.ts).
// Mounted from AcrossTheBoulevard; static scenery in every mode, the train and
// its crossing only run in Free Play.

const std = (color: string, roughness = 0.9, extra?: THREE.MeshStandardMaterialParameters) =>
  new THREE.MeshStandardMaterial({ color, roughness, ...extra });

export function WestAvery() {
  return (
    <group>
      <Baked>
        <Trails />
      </Baked>
      <Creek />
      <Track />
      <Pool />
      <Baked>
        <Campus />
      </Baked>
    </group>
  );
}

// ------------------------------------------------------------ ribbons --

/** A flat ribbon along a polyline (trail / creek water). */
function ribbonGeometry(pts: [number, number][], halfW: number, skip?: (z: number) => boolean): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  let n = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    if (skip && skip((az + bz) / 2)) continue;
    const dx = bx - ax, dz = bz - az;
    const l = Math.hypot(dx, dz) || 1;
    const nx = (-dz / l) * halfW, nz = (dx / l) * halfW;
    // Overlap each segment a touch so bends don't show gaps.
    const ex = (dx / l) * halfW * 0.6, ez = (dz / l) * halfW * 0.6;
    pos.push(ax - ex + nx, 0, az - ez + nz, ax - ex - nx, 0, az - ez - nz, bx + ex + nx, 0, bz + ez + nz, bx + ex - nx, 0, bz + ez - nz);
    idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
    n += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function Trails() {
  const { green, north, gravel, wood, woodDark } = useMemo(() => ({
    green: ribbonGeometry(GREEN_TRAIL, 1.1),
    north: ribbonGeometry(NORTH_TRAIL, 1.1),
    gravel: std('#c9b48c', 1, { side: THREE.DoubleSide }),
    wood: std('#9a7448', 0.85),
    woodDark: std('#6b4a2a', 0.9),
  }), []);
  const connLen = BRIDGE_X0 - 1.6 - (RAIL_TRAIL_X + TRAIL_W / 2);
  const railLen = RAIL_TRAIL_Z_S - RAIL_TRAIL_Z_N;
  const bridgeLen = BRIDGE_X1 - BRIDGE_X0;
  return (
    <group>
      <mesh geometry={green} material={gravel} position={[0, 0.022, 0]} receiveShadow />
      <mesh geometry={north} material={gravel} position={[0, 0.022, 0]} receiveShadow />
      {/* Connector: greenbelt trail → footbridge → Red Line Trail. */}
      <mesh position={[(BRIDGE_X1 + 1.6 + -46.4) / 2, 0.022, CONNECTOR_Z]} rotation={[-Math.PI / 2, 0, 0]} material={gravel} receiveShadow>
        <planeGeometry args={[Math.abs(-46.4 - (BRIDGE_X1 + 1.6)), 2.2]} />
      </mesh>
      <mesh position={[RAIL_TRAIL_X + TRAIL_W / 2 + connLen / 2, 0.022, CONNECTOR_Z]} rotation={[-Math.PI / 2, 0, 0]} material={gravel} receiveShadow>
        <planeGeometry args={[connLen, 2.2]} />
      </mesh>
      {/* Red Line Trail: paved, with a dashed centre line. */}
      <mesh position={[RAIL_TRAIL_X, 0.023, RAIL_TRAIL_Z_N + railLen / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[TRAIL_W, railLen + 2.2]} />
        <meshStandardMaterial color="#b9b4a8" roughness={0.95} />
      </mesh>
      {Array.from({ length: Math.floor(railLen / 5) }, (_, i) => (
        <mesh key={i} position={[RAIL_TRAIL_X, 0.027, RAIL_TRAIL_Z_N + 2 + i * 5]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.1, 1.8]} />
          <meshBasicMaterial color="#f2e9c8" />
        </mesh>
      ))}
      <TrailSign x={RAIL_TRAIL_X + 2.1} z={RAIL_TRAIL_Z_N + 2.5} yaw={Math.PI / 2} title="RED LINE TRAIL" sub="hike + bike" />
      <TrailSign x={-44.2} z={12} yaw={Math.PI} title="GREENBELT TRAIL" sub="to the creek + pond" />
      <TrailSign x={TRAILHEAD.x + 2.2} z={TRAILHEAD.z} yaw={Math.PI / 2} title="BRUSHY CREEK TRAIL" sub="lake + sports park  ➜" />

      {/* Footbridge over the creek. */}
      <group position={[(BRIDGE_X0 + BRIDGE_X1) / 2, 0, CONNECTOR_Z]}>
        <mesh position={[0, BRIDGE_Y - 0.06, 0]} material={wood} castShadow receiveShadow>
          <boxGeometry args={[bridgeLen + 3.2, 0.12, 2.2]} />
        </mesh>
        {[-1.12, 1.12].map((z) => (
          <group key={z}>
            <mesh position={[0, BRIDGE_Y + 0.95, z]} material={woodDark} castShadow>
              <boxGeometry args={[bridgeLen, 0.09, 0.09]} />
            </mesh>
            <mesh position={[0, BRIDGE_Y + 0.5, z]} material={woodDark}>
              <boxGeometry args={[bridgeLen, 0.06, 0.06]} />
            </mesh>
            {Array.from({ length: 6 }, (_, i) => (
              <mesh key={i} position={[-bridgeLen / 2 + (i * bridgeLen) / 5, BRIDGE_Y + 0.5, z]} material={woodDark} castShadow>
                <boxGeometry args={[0.1, 1.0, 0.1]} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
}

function TrailSign({ x, z, yaw, title, sub }: { x: number; z: number; yaw: number; title: string; sub: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {[-0.75, 0.75].map((px) => (
        <mesh key={px} position={[px, 0.75, 0]} castShadow>
          <boxGeometry args={[0.1, 1.5, 0.1]} />
          <meshStandardMaterial color="#5a3a22" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, 1.25, 0]} castShadow>
        <boxGeometry args={[1.75, 0.62, 0.06]} />
        <meshStandardMaterial color="#35543c" roughness={0.8} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s} rotation={[0, s === 1 ? 0 : Math.PI, 0]}>
          <Text position={[0, 1.34, 0.04]} fontSize={0.17} color="#f6efd8" anchorX="center" anchorY="middle" letterSpacing={0.04}>{title}</Text>
          <Text position={[0, 1.1, 0.04]} fontSize={0.1} color="#d9e6c8" anchorX="center" anchorY="middle">{sub}</Text>
        </group>
      ))}
    </group>
  );
}

// -------------------------------------------------------------- creek --

function Creek() {
  const waterRef = useRef<THREE.MeshStandardMaterial>(null);
  const { south, north, bed, stones } = useMemo(() => {
    const underRoad = (z: number) => z < CULVERT_Z0 && z > CULVERT_Z1;
    const stones: { x: number; z: number; s: number; r: number }[] = [];
    const rnd = (n: number) => { const v = Math.sin(n * 91.7 + 13.1) * 43758.5; return v - Math.floor(v); };
    [CREEK_SOUTH, CREEK_NORTH].forEach((line, li) => {
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, az] = line[i], [bx, bz] = line[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const steps = Math.max(1, Math.floor(len / 2.6));
        for (let k = 0; k < steps; k++) {
          const t = (k + rnd(i * 31 + k + li * 7)) / steps;
          const z = az + (bz - az) * t;
          if (underRoad(z)) continue;
          const side = rnd(i * 17 + k * 3 + li) > 0.5 ? 1 : -1;
          const nx = -(bz - az) / len, nz = (bx - ax) / len;
          const off = (CREEK_HALF_W + 0.25 + rnd(i + k * 5) * 0.5) * side;
          stones.push({ x: ax + (bx - ax) * t + nx * off, z: z + nz * off, s: 0.35 + rnd(i * 3 + k) * 0.5, r: rnd(k + i) * 3 });
        }
      }
    });
    return {
      south: ribbonGeometry(CREEK_SOUTH, CREEK_HALF_W, underRoad),
      north: ribbonGeometry(CREEK_NORTH, CREEK_HALF_W),
      bed: [ribbonGeometry(CREEK_SOUTH, CREEK_HALF_W + 0.55, underRoad), ribbonGeometry(CREEK_NORTH, CREEK_HALF_W + 0.55)],
      stones,
    };
  }, []);
  const stoneRef = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = stoneRef.current;
    if (!m) return;
    const o = new THREE.Object3D();
    stones.forEach((s, i) => {
      o.position.set(s.x, s.s * 0.18, s.z);
      o.rotation.set(0, s.r, 0);
      o.scale.set(s.s, s.s * 0.5, s.s * 0.8);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  }, [stones]);
  useFrame(({ clock }) => {
    if (waterRef.current) waterRef.current.opacity = 0.74 + Math.sin(clock.elapsedTime * 1.3) * 0.05;
  });
  const cz = (CULVERT_Z0 + CULVERT_Z1) / 2;
  return (
    <group>
      {bed.map((g, i) => (
        <mesh key={i} geometry={g} position={[0, 0.018, 0]} receiveShadow>
          <meshStandardMaterial color="#b8ab8e" roughness={1} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {[south, north].map((g, i) => (
        <mesh key={i} geometry={g} position={[0, 0.03, 0]}>
          <meshStandardMaterial ref={i === 0 ? waterRef : undefined} color="#5f9fb0" roughness={0.18} metalness={0.25} transparent opacity={0.78} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <instancedMesh ref={stoneRef} args={[undefined, undefined, stones.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#d6cdb6" roughness={0.95} flatShading />
      </instancedMesh>
      {/* Culvert headwalls where the creek goes under the boulevard. */}
      {[CULVERT_Z0 + 0.6, CULVERT_Z1 - 0.6].map((z) => (
        <group key={z} position={[-49, 0, z]}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[4.4, 0.7, 0.4]} />
            <meshStandardMaterial color="#d8d0bd" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.2, z > cz ? 0.18 : -0.18]}>
            <circleGeometry args={[0.55, 20]} />
            <meshBasicMaterial color="#1c2226" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// --------------------------------------------------------------- pool --

function Pool() {
  const waterRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (waterRef.current) waterRef.current.position.y = 0.07 + Math.sin(clock.elapsedTime * 1.7) * 0.012;
  });
  const d = POOL.deck, w = POOL.water;
  const dcx = (d.minX + d.maxX) / 2, dcz = (d.minZ + d.maxZ) / 2;
  const wcx = (w.minX + w.maxX) / 2, wcz = (w.minZ + w.maxZ) / 2;
  const ww = w.maxX - w.minX, wd = w.maxZ - w.minZ;
  const posts = useMemo(() => {
    const out: [number, number][] = [];
    for (let x = d.minX; x <= d.maxX + 0.01; x += 2) { out.push([x, d.minZ]); out.push([x, d.maxZ]); }
    for (let z = d.minZ + 2; z < d.maxZ - 0.01; z += 2) { out.push([d.minX, z]); out.push([d.maxX, z]); }
    return out;
  }, [d]);
  const fenceMat = useMemo(() => std('#23262b', 0.5, { metalness: 0.6 }), []);
  return (
    <group>
      <mesh position={[dcx, 0.04, dcz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[d.maxX - d.minX, d.maxZ - d.minZ]} />
        <meshStandardMaterial color="#e3dccb" roughness={0.95} />
      </mesh>
      {/* tiled basin + water */}
      <mesh position={[wcx, 0.05, wcz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ww + 0.7, wd + 0.7]} />
        <meshStandardMaterial color="#f4f1e8" roughness={0.6} />
      </mesh>
      <mesh position={[wcx, 0.06, wcz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ww, wd]} />
        <meshStandardMaterial color="#1f7f9c" roughness={0.6} />
      </mesh>
      <mesh ref={waterRef} position={[wcx, 0.07, wcz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ww, wd]} />
        <meshStandardMaterial color="#4fc3e0" roughness={0.08} metalness={0.2} transparent opacity={0.72} />
      </mesh>
      {/* lane rope */}
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[w.minX + 0.6 + i * ((ww - 1.2) / 11), 0.12, wcz]}>
          <sphereGeometry args={[0.1, 8, 6]} />
          <meshStandardMaterial color={i % 2 ? '#e2483d' : '#f4f1e8'} roughness={0.6} />
        </mesh>
      ))}
      {/* fence */}
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.7, z]} material={fenceMat} castShadow>
          <boxGeometry args={[0.07, 1.4, 0.07]} />
        </mesh>
      ))}
      <mesh position={[dcx, 1.32, d.minZ]} material={fenceMat}><boxGeometry args={[d.maxX - d.minX, 0.05, 0.05]} /></mesh>
      <mesh position={[d.minX, 1.32, dcz]} material={fenceMat}><boxGeometry args={[0.05, 0.05, d.maxZ - d.minZ]} /></mesh>
      {/* pool house */}
      <group position={[POOL.house.x, 0, POOL.house.z]}>
        <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[POOL.house.w, 2.6, POOL.house.d]} />
          <meshStandardMaterial color="#d9c6a3" roughness={0.9} />
        </mesh>
        <GableRoof w={POOL.house.d + 0.7} len={POOL.house.w + 0.7} y={2.6} rise={0.9} ridgeAlong="x" />
      </group>
      {/* loungers + umbrellas */}
      {[-80.5, -77, -73.5].map((x, i) => (
        <group key={x} position={[x, 0.04, d.maxZ - 1.5]}>
          <mesh position={[0, 0.28, 0]} castShadow><boxGeometry args={[0.7, 0.1, 1.9]} /><meshStandardMaterial color={['#f6c945', '#3aa6a0', '#e26aa1'][i]} roughness={0.8} /></mesh>
          <mesh position={[0, 0.5, 0.75]} rotation={[-0.7, 0, 0]}><boxGeometry args={[0.7, 0.1, 0.8]} /><meshStandardMaterial color={['#f6c945', '#3aa6a0', '#e26aa1'][i]} roughness={0.8} /></mesh>
          <mesh position={[0.9, 1.1, 0]}><cylinderGeometry args={[0.035, 0.035, 2.2, 8]} /><meshStandardMaterial color="#e8e2d2" /></mesh>
          <mesh position={[0.9, 2.15, 0]} castShadow><coneGeometry args={[1.25, 0.5, 8]} /><meshStandardMaterial color={['#e8463f', '#f6f2e8', '#3a6db0'][i]} roughness={0.8} /></mesh>
        </group>
      ))}
      {/* diving board */}
      <mesh position={[w.maxX + 0.2, 0.42, wcz]} castShadow><boxGeometry args={[2.4, 0.08, 0.5]} /><meshStandardMaterial color="#f4f1e8" roughness={0.5} /></mesh>
      <mesh position={[w.maxX + 1.0, 0.22, wcz]}><boxGeometry args={[0.5, 0.4, 0.5]} /><meshStandardMaterial color="#8a8f96" roughness={0.5} metalness={0.5} /></mesh>
      <Text position={[POOL.gateSouthX, 2.0, d.maxZ + 0.05]} fontSize={0.42} color="#1f5f7c" anchorX="center" anchorY="middle" letterSpacing={0.06} outlineWidth={0.02} outlineColor="#ffffff">AVERY RANCH POOL</Text>
    </group>
  );
}

// ------------------------------------------------------------- campus --

function Campus() {
  const brick = useMemo(() => std('#c9a97c', 0.95), []);
  const stone = useMemo(() => std('#e2d8c2', 0.95), []);
  const white = useMemo(() => std('#f2f0ea', 0.8), []);
  const blue = useMemo(() => std('#2f6fd0', 0.55, { metalness: 0.3 }), []);
  const glass = useMemo(() => std('#27323c', 0.15, { metalness: 0.4 }), []);
  const wb = CAMPUS.wingB, lk = CAMPUS.link, lot = CAMPUS.lot, f = CAMPUS.field, ct = CAMPUS.court;
  const wbW = wb.maxX - wb.minX, wbD = wb.maxZ - wb.minZ;
  return (
    <group>
      {/* Wing B: brick on a limestone base, ribbon windows, silver gable roof. */}
      <group position={[(wb.minX + wb.maxX) / 2, 0, (wb.minZ + wb.maxZ) / 2]}>
        <mesh position={[0, 2.1, 0]} material={brick} castShadow receiveShadow><boxGeometry args={[wbW, 4.2, wbD]} /></mesh>
        <mesh position={[0, 0.45, 0]} material={stone}><boxGeometry args={[wbW + 0.12, 0.9, wbD + 0.12]} /></mesh>
        {Array.from({ length: 7 }, (_, i) => (
          <group key={i}>
            <mesh position={[-wbW / 2 + 2.6 + i * 4.1, 2.3, wbD / 2 + 0.03]} material={glass}><boxGeometry args={[2.6, 1.5, 0.06]} /></mesh>
            <mesh position={[-wbW / 2 + 2.6 + i * 4.1, 2.3, -wbD / 2 - 0.03]} material={glass}><boxGeometry args={[2.6, 1.5, 0.06]} /></mesh>
          </group>
        ))}
        <GableRoof w={wbD + 0.9} len={wbW + 0.9} y={4.2} rise={1.9} ridgeAlong="x" />
      </group>
      {/* Connector (flat roof with rooftop units, like the real one). */}
      <group position={[(lk.minX + lk.maxX) / 2, 0, (lk.minZ + lk.maxZ) / 2]}>
        <mesh position={[0, 1.9, 0]} material={brick} castShadow><boxGeometry args={[lk.maxX - lk.minX, 3.8, lk.maxZ - lk.minZ]} /></mesh>
        <mesh position={[0, 3.9, 0]}><boxGeometry args={[lk.maxX - lk.minX + 0.4, 0.2, lk.maxZ - lk.minZ + 0.2]} /><meshStandardMaterial color="#8d9299" roughness={0.8} /></mesh>
        {[-1.6, 1.4].map((x) => (
          <mesh key={x} position={[x, 4.4, 0]} castShadow><boxGeometry args={[1.5, 0.8, 1.6]} /><meshStandardMaterial color="#b4b8be" roughness={0.6} metalness={0.4} /></mesh>
        ))}
      </group>
      {/* Portable classrooms. */}
      {CAMPUS.portables.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 1.85, 0]} material={white} castShadow receiveShadow><boxGeometry args={[p.w, 2.9, p.d]} /></mesh>
          <mesh position={[0, 0.2, 0]}><boxGeometry args={[p.w - 0.3, 0.4, p.d - 0.3]} /><meshStandardMaterial color="#6b6f75" roughness={0.9} /></mesh>
          <mesh position={[0, 3.36, 0]}><boxGeometry args={[p.w + 0.3, 0.12, p.d + 0.3]} /><meshStandardMaterial color="#c9ced3" roughness={0.5} metalness={0.4} /></mesh>
          <mesh position={[-1.4, 1.6, p.d / 2 + 0.03]}><boxGeometry args={[0.9, 2.0, 0.06]} /><meshStandardMaterial color="#3a6db0" roughness={0.7} /></mesh>
          <mesh position={[1.3, 2.0, p.d / 2 + 0.03]} material={glass}><boxGeometry args={[1.4, 0.9, 0.06]} /></mesh>
          {/* wooden ramp + deck */}
          <mesh position={[-1.4, 0.3, p.d / 2 + 0.75]}><boxGeometry args={[1.6, 0.12, 1.5]} /><meshStandardMaterial color="#9a7448" roughness={0.9} /></mesh>
          <Text position={[1.3, 2.85, p.d / 2 + 0.04]} fontSize={0.26} color="#2a2f36" anchorX="center" anchorY="middle">{`P${i + 1}`}</Text>
        </group>
      ))}

      {/* Front parking lot. */}
      <mesh position={[(lot.minX + lot.maxX) / 2, 0.018, (lot.minZ + lot.maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[lot.maxX - lot.minX, lot.maxZ - lot.minZ]} />
        <primitive object={mat.asphalt()} attach="material" />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[lot.minX + 1.4 + i * 2.6, 0.024, lot.minZ + 2.3]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.12, 4.2]} />
          <meshBasicMaterial color="#f1eee2" />
        </mesh>
      ))}
      {[[lot.minX + 2.7, '#8a8f96'], [lot.minX + 7.9, '#b03a2e'], [lot.minX + 15.7, '#2e5a8a']].map(([x, c]) => (
        <GLBModel key={x as number} url={MODELS.sedan.url} fitHeight={MODELS.sedan.fitHeight} rotationY={0} position={[x as number, 0, lot.minZ + 2.3]} tint={c as string} />
      ))}

      {/* Marquee at the driveway. */}
      <group position={[CAMPUS.marquee.x, 0, CAMPUS.marquee.z]}>
        <mesh position={[0, 0.45, 0]} material={stone} castShadow><boxGeometry args={[3.4, 0.9, 0.7]} /></mesh>
        <mesh position={[0, 1.55, 0]} castShadow><boxGeometry args={[3.0, 1.3, 0.3]} /><meshStandardMaterial color="#1f3a5f" roughness={0.7} /></mesh>
        {[1, -1].map((s) => (
          <group key={s} rotation={[0, s === 1 ? 0 : Math.PI, 0]}>
            <Text position={[0, 1.92, 0.16]} fontSize={0.26} color="#ffffff" anchorX="center" anchorY="middle" letterSpacing={0.05}>RUTLEDGE ELEMENTARY</Text>
            <mesh position={[0, 1.38, 0.16]}><planeGeometry args={[2.7, 0.62]} /><meshBasicMaterial color="#f4f1e6" /></mesh>
            <Text position={[0, 1.5, 0.17]} fontSize={0.15} color="#1a1a1a" anchorX="center" anchorY="middle" letterSpacing={0.06}>WELCOME PENNY + LUKE!</Text>
            <Text position={[0, 1.26, 0.17]} fontSize={0.12} color="#1a1a1a" anchorX="center" anchorY="middle" letterSpacing={0.06}>RECESS EVERY DAY</Text>
          </group>
        ))}
      </group>

      {/* Recess side: play structure, blue shade pavilions, court, field + track. */}
      <GLBModel url={MODELS.playground.url} fitHeight={MODELS.playground.fitHeight} position={[CAMPUS.playground.x, 0, CAMPUS.playground.z]} rotationY={0.4} />
      <mesh position={[CAMPUS.playground.x, 0.02, CAMPUS.playground.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.4, 28]} />
        <meshStandardMaterial color="#b98a55" roughness={1} />
      </mesh>
      {CAMPUS.pavilions.map((pv, i) => (
        <group key={i} position={[pv.x, 0, pv.z]}>
          {[[-2.6, -2.6], [2.6, -2.6], [-2.6, 2.6], [2.6, 2.6]].map(([dx, dz]) => (
            <mesh key={`${dx}${dz}`} position={[dx, 1.55, dz]} castShadow><boxGeometry args={[0.2, 3.1, 0.2]} /><meshStandardMaterial color="#e8e2d2" roughness={0.7} /></mesh>
          ))}
          <mesh position={[0, 3.75, 0]} rotation={[0, Math.PI / 4, 0]} material={blue} castShadow><coneGeometry args={[4.6, 1.5, 4]} /></mesh>
          <GLBModel url={MODELS.picnictable.url} fitHeight={MODELS.picnictable.fitHeight} position={[0, 0, 0]} />
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[6.2, 6.2]} /><meshStandardMaterial color="#d6d0c2" roughness={0.95} /></mesh>
        </group>
      ))}
      <group position={[ct.x, 0, ct.z]}>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[ct.w, ct.d]} /><meshStandardMaterial color="#5f7f9c" roughness={0.9} /></mesh>
        <mesh position={[0, 0.026, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.5, 1.6, 28]} /><meshBasicMaterial color="#f4f1e6" /></mesh>
        {[-1, 1].map((s) => (
          <group key={s} position={[0, 0, s * (ct.d / 2 + 0.4)]}>
            <mesh position={[0, 1.8, 0]} castShadow><cylinderGeometry args={[0.07, 0.07, 3.6, 8]} /><meshStandardMaterial color="#3a3d42" metalness={0.5} roughness={0.5} /></mesh>
            <mesh position={[0, 3.2, -s * 0.5]}><boxGeometry args={[1.5, 1.0, 0.06]} /><meshStandardMaterial color="#f4f1e6" roughness={0.6} /></mesh>
            <mesh position={[0, 2.85, -s * 0.85]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.24, 0.025, 8, 18]} /><meshStandardMaterial color="#e8632a" roughness={0.5} /></mesh>
          </group>
        ))}
      </group>
      <group position={[f.x, 0, f.z]} scale={[1, 1, f.rz / f.rx]}>
        <mesh position={[0, 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><circleGeometry args={[f.rx, 48]} /><meshStandardMaterial color="#6fae58" roughness={1} /></mesh>
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><ringGeometry args={[f.rx - 2.2, f.rx, 48]} /><meshStandardMaterial color="#c9a678" roughness={1} /></mesh>
      </group>
      {[-1, 1].map((s) => (
        <group key={s} position={[f.x + s * (f.rx - 4.5), 0, f.z]}>
          {[-1.6, 1.6].map((dz) => (
            <mesh key={dz} position={[0, 0.9, dz]} castShadow><cylinderGeometry args={[0.05, 0.05, 1.8, 8]} /><meshStandardMaterial color="#f4f1e6" /></mesh>
          ))}
          <mesh position={[0, 1.8, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.05, 0.05, 3.2, 8]} /><meshStandardMaterial color="#f4f1e6" /></mesh>
        </group>
      ))}
      {CAMPUS.oaks.map(([x, z], i) => (
        <GLBModel key={i} url={MODELS.oak.url} fitHeight={5.2 + (i % 3) * 0.6} position={[x, 0, z]} rotationY={(i * 53) % 6} />
      ))}
    </group>
  );
}

export { METAL_ROOF };
