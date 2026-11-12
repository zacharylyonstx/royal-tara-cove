import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MAZE_BLOCKS, GARAGE_DOOR_PLUG, type MazeBlock } from '../../world/munchiesMap';
import { HERO_PIVOT_X, HERO_PIVOT_Z, HERO_YAW } from '../../world/heroPlace';
import { INTERIOR_WALLS, WALL_THICK } from '../hero/floorPlan';
import { useGameStore } from '../../state/gameStore';
import { useMunchiesStore } from '../../state/munchiesStore';
import { activePlayers } from '../../world/munchiesRoster';
import { CHARACTERS, CHARACTER_ORDER } from '../../world/characters';

// Everything that turns the real 10600 ground floor into the Midnight Munchies
// maze. Mounted in munchies mode only.
//
//  • <MunchiesCutaway/> slices the whole scene off at head height with a global
//    clipping plane, so the top-down camera looks INTO the house like a
//    dollhouse (roof, second floor, ceilings and door headers all vanish) and
//    caps every wall with a dark band so walls still read from directly above.
//  • <MazeForts/> builds the kids' midnight fort walls (toy bricks, cushion
//    forts, moving boxes) from world/munchiesMap.ts MAZE_BLOCKS — the same
//    rects the player collides with and the sleepwalkers path around.

/** Everything above this height is sliced away (Dad is 1.85 m tall). */
const CUT_Y = 2.05;
const CAP_COLOR = '#2b2340';

export function MunchiesCutaway() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const prev = gl.clippingPlanes;
    gl.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT_Y)];
    return () => { gl.clippingPlanes = prev; };
  }, [gl]);

  const caps = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number }[] = [
      // exterior shell (24 × 18, walls 0.2 thick)
      { x: 0, z: -9, w: 24.3, d: 0.3 },
      { x: 0, z: 9, w: 24.3, d: 0.3 },
      { x: -12, z: 0, w: 0.3, d: 18.3 },
      { x: 12, z: 0, w: 0.3, d: 18.3 },
    ];
    for (const w of INTERIOR_WALLS) {
      const ops = [...w.openings].sort((a, b) => a.from - b.from);
      let cursor = w.from;
      const push = (from: number, to: number) => {
        if (to - from < 0.001) return;
        const c = (from + to) / 2, span = to - from;
        if (w.axis === 'x') out.push({ x: c, z: w.at, w: span, d: WALL_THICK + 0.06 });
        else out.push({ x: w.at, z: c, w: WALL_THICK + 0.06, d: span });
      };
      for (const op of ops) { push(cursor, op.from); cursor = op.to; }
      push(cursor, w.to);
    }
    return out;
  }, []);

  return (
    <group position={[HERO_PIVOT_X, 0, HERO_PIVOT_Z]} rotation={[0, HERO_YAW, 0]}>
      {caps.map((c, i) => (
        <mesh key={i} position={[c.x, CUT_Y - 0.04, c.z]}>
          <boxGeometry args={[c.w, 0.06, c.d]} />
          <meshBasicMaterial color={CAP_COLOR} />
        </mesh>
      ))}
      {/* The garage is shut for the night: a closed door in its doorway. */}
      <mesh position={[(GARAGE_DOOR_PLUG.minX + GARAGE_DOOR_PLUG.maxX) / 2, 1.0, (GARAGE_DOOR_PLUG.minZ + GARAGE_DOOR_PLUG.maxZ) / 2]} castShadow>
        <boxGeometry args={[GARAGE_DOOR_PLUG.maxX - GARAGE_DOOR_PLUG.minX, 2.0, 0.09]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.75} />
      </mesh>
      <mesh position={[(GARAGE_DOOR_PLUG.minX + GARAGE_DOOR_PLUG.maxX) / 2 + 0.36, 1.0, GARAGE_DOOR_PLUG.maxZ + 0.02]}>
        <sphereGeometry args={[0.05, 10, 10]} />
        <meshStandardMaterial color="#d8c27a" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

// ------------------------------------------------------------------ forts --

interface Piece {
  shape: 'box' | 'pillow' | 'stud';
  x: number; y: number; z: number;
  sx: number; sy: number; sz: number;
  rotY: number;
  color: string;
}

/** Tiny deterministic hash → [0, 1). Same fort every session, on every client. */
function rand(seed: number): number {
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const BRICK_COLORS = ['#e2483d', '#2f7fd6', '#f2c230', '#3fae5a', '#f08a2c'];
const PILLOW_COLORS = ['#f6efe6', '#f2b8c6', '#b9d7f0', '#f7e3a1', '#cfe8c9'];
const CUSHION_COLORS = ['#8c6f5a', '#7d8fa8', '#a7785f'];
const BOX_COLORS = ['#c69c6a', '#b98c5a', '#d0a978'];

function piecesFor(b: MazeBlock, salt: number): Piece[] {
  const out: Piece[] = [];
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const nx = Math.max(1, Math.round(w / 0.75));
  const nz = Math.max(1, Math.round(d / 0.75));
  const cw = w / nx;
  const cd = d / nz;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const seed = salt * 97 + i * 13 + j * 7;
      const x = b.minX + (i + 0.5) * cw;
      const z = b.minZ + (j + 0.5) * cd;
      if (b.kind === 'blocks') {
        // Two courses of chunky toy bricks with studs on top.
        const h = 0.48;
        for (let layer = 0; layer < 2; layer++) {
          const color = BRICK_COLORS[Math.floor(rand(seed + layer * 31) * BRICK_COLORS.length)];
          out.push({ shape: 'box', x, y: h / 2 + layer * h, z, sx: cw - 0.04, sy: h - 0.02, sz: cd - 0.04, rotY: 0, color });
          if (layer === 1) {
            for (const [ox, oz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]] as const) {
              out.push({ shape: 'stud', x: x + ox * cw, y: h * 2 + 0.04, z: z + oz * cd, sx: cw * 0.17, sy: 0.08, sz: cd * 0.17, rotY: 0, color });
            }
          }
        }
      } else if (b.kind === 'boxes') {
        // Moving boxes, a little askew, some stacked two high.
        const tall = rand(seed + 5) > 0.45;
        const yaw = (rand(seed + 9) - 0.5) * 0.3;
        const color = BOX_COLORS[Math.floor(rand(seed) * BOX_COLORS.length)];
        const s = Math.min(cw, cd) - 0.06;
        out.push({ shape: 'box', x, y: 0.36, z, sx: s, sy: 0.72, sz: s, rotY: yaw, color });
        out.push({ shape: 'box', x, y: 0.725, z, sx: s * 0.22, sy: 0.012, sz: s + 0.01, rotY: yaw, color: '#8f6d42' });
        if (tall) {
          const yaw2 = yaw + (rand(seed + 21) - 0.5) * 0.5;
          out.push({ shape: 'box', x, y: 0.72 + 0.27, z, sx: s * 0.78, sy: 0.54, sz: s * 0.78, rotY: yaw2, color: BOX_COLORS[(Math.floor(rand(seed + 3) * 3) + 1) % 3] });
        }
      } else {
        // Couch-cushion fort: a cushion wall with pillows piled on top.
        const cushion = CUSHION_COLORS[Math.floor(rand(seed + 2) * CUSHION_COLORS.length)];
        out.push({ shape: 'box', x, y: 0.33, z, sx: cw - 0.05, sy: 0.66, sz: cd - 0.05, rotY: 0, color: cushion });
        const pillow = PILLOW_COLORS[Math.floor(rand(seed + 11) * PILLOW_COLORS.length)];
        out.push({
          shape: 'pillow', x: x + (rand(seed + 4) - 0.5) * 0.12, y: 0.66 + 0.17, z: z + (rand(seed + 6) - 0.5) * 0.12,
          sx: cw * 0.46, sy: 0.19, sz: cd * 0.46, rotY: rand(seed + 8) * Math.PI, color: pillow,
        });
      }
    }
  }
  return out;
}

const _obj = new THREE.Object3D();
const _col = new THREE.Color();

function Pieces({ pieces, geometry }: { pieces: Piece[]; geometry: 'box' | 'sphere' | 'cylinder' }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    pieces.forEach((p, i) => {
      _obj.position.set(p.x, p.y, p.z);
      _obj.rotation.set(0, p.rotY, 0);
      _obj.scale.set(p.sx, p.sy, p.sz);
      _obj.updateMatrix();
      m.setMatrixAt(i, _obj.matrix);
      m.setColorAt(i, _col.set(p.color));
    });
    m.count = pieces.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [pieces]);
  if (pieces.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, pieces.length]} castShadow receiveShadow frustumCulled={false}>
      {geometry === 'box' && <boxGeometry args={[1, 1, 1]} />}
      {geometry === 'sphere' && <sphereGeometry args={[1, 14, 10]} />}
      {geometry === 'cylinder' && <cylinderGeometry args={[1, 1, 1, 12]} />}
      <meshStandardMaterial roughness={geometry === 'sphere' ? 0.95 : 0.7} />
    </instancedMesh>
  );
}

export function MazeForts() {
  const { boxes, pillows, studs } = useMemo(() => {
    const all = MAZE_BLOCKS
      .filter((b) => b.kind === 'blocks' || b.kind === 'pillows' || b.kind === 'boxes')
      .flatMap((b, i) => piecesFor(b, i + 1));
    return {
      boxes: all.filter((p) => p.shape === 'box'),
      pillows: all.filter((p) => p.shape === 'pillow'),
      studs: all.filter((p) => p.shape === 'stud'),
    };
  }, []);
  return (
    <group position={[HERO_PIVOT_X, 0.13, HERO_PIVOT_Z]} rotation={[0, HERO_YAW, 0]}>
      <Pieces pieces={boxes} geometry="box" />
      <Pieces pieces={pillows} geometry="sphere" />
      <Pieces pieces={studs} geometry="cylinder" />
    </group>
  );
}

// ---------------------------------------------------------------- markers --

/** A glowing ring under each cookie sneaker so the kids can always find
 *  themselves from the bird's-eye camera (it flashes while they're safe after a
 *  respawn, and turns milky-blue while the milk power is on). */
export function SneakerMarkers() {
  const refs = useRef<Record<string, THREE.Mesh | null>>({});
  useFrame(({ clock }) => {
    const gs = useGameStore.getState();
    const ms = useMunchiesStore.getState();
    const players = activePlayers();
    const now = performance.now() / 1000;
    const t = clock.elapsedTime;
    const powered = gs.phase === 'munchies-powered';
    const safe = now < ms.invincibleUntil;
    for (const id of CHARACTER_ORDER) {
      const m = refs.current[id];
      if (!m) continue;
      const on = players.includes(id);
      m.visible = on && (!safe || Math.sin(t * 18) > -0.2);
      if (!on) continue;
      const p = gs.positions[id];
      m.position.set(p.x, 0.17, p.z);
      const pulse = 1 + Math.sin(t * 4 + p.x) * 0.08;
      m.scale.setScalar(pulse);
      (m.material as THREE.MeshBasicMaterial).color.set(powered ? '#bfe6ff' : CHARACTERS[id].bodyColor);
    }
  });
  return (
    <>
      {CHARACTER_ORDER.map((id) => (
        <mesh key={id} ref={(m) => { refs.current[id] = m; }} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.42, 0.56, 28]} />
          <meshBasicMaterial color={CHARACTERS[id].bodyColor} transparent opacity={0.9} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}
