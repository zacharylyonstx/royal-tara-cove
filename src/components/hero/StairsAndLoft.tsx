import { mat } from '../../world/materials';
import { Dresser } from './Dresser';

const STORY_H = 3.0;

// HOUSE-LOCAL coords. width 24 (x=-12..12), depth 18 (z=-9..9). Facing in (+Z) the
// RIGHT is -X (garage / family + bedrooms above), the LEFT is +X (front door, great
// room + game room above).
//
// The staircase lives IN the great room, against the garage wall (the right-spine,
// x=-4), OPEN to the two-story space — exactly like the real entry photo. You see it
// the moment you walk in: it rises FRONT→BACK (+Z) and lands on the game-room loft
// over the kitchen. (It must climb toward the back because that's where the loft is.)
const STAIR_X0 = -3.9;          // against the garage wall (spine x=-4)
const STAIR_X1 = -2.3;          // open side faces the great room (1.6m tread)
const STAIR_Z0 = -7.3;          // bottom (front, by the entry)
const STAIR_Z1 = -4.0;          // top (back), lands on the game-room loft edge
const STAIR_RUN = STAIR_Z1 - STAIR_Z0;
const STAIR_WIDTH = STAIR_X1 - STAIR_X0;
const STAIR_STEPS = 13;
const STAIR_XC = (STAIR_X0 + STAIR_X1) / 2;   // -3.1

// Two-story VOID (open great room you walk into): the front, x=-4..12, z=-9..-4.
const VOID_X1 = 12.0;
const VOID_Z1 = -4.0;           // back edge of the void = game-room loft railing

const UP_Y = STORY_H;           // upstairs floor level
const WALL_TOP = 5.3;
const UP_WALL_H = WALL_TOP - UP_Y;
const UP_WALL_YC = (UP_Y + WALL_TOP) / 2;
const CREAM = '#efe8d8';
const RAIL_WHITE = '#f2eee4';
const RAIL_WOOD = '#5a3a22';
const WT = 0.14;

/** Open staircase in the great room (against the garage wall), white railing on the
 *  great-room side, rising front→back up to the loft. */
export function Stairs() {
  const railX = STAIR_X1 - 0.05;   // open (+X) side
  return (
    <group>
      {Array.from({ length: STAIR_STEPS }, (_, i) => {
        const t = i / STAIR_STEPS;
        const next = (i + 1) / STAIR_STEPS;
        const z = STAIR_Z0 + (t + (next - t) / 2) * STAIR_RUN;
        const stepH = STORY_H / STAIR_STEPS;
        const yTop = next * STORY_H;
        return (
          <mesh key={i} position={[STAIR_XC, yTop - stepH / 2, z]} castShadow receiveShadow>
            <boxGeometry args={[STAIR_WIDTH, stepH, STAIR_RUN / STAIR_STEPS]} />
            <primitive object={mat.woodFloor()} attach="material" />
          </mesh>
        );
      })}
      {/* Wood handrail along the open side, tilted up the run */}
      <mesh
        position={[railX, STORY_H / 2 + 0.95, (STAIR_Z0 + STAIR_Z1) / 2]}
        rotation={[-Math.atan2(STORY_H, STAIR_RUN), 0, 0]}
        castShadow
      >
        <boxGeometry args={[0.08, 0.08, Math.hypot(STAIR_RUN, STORY_H)]} />
        <meshStandardMaterial color={RAIL_WOOD} />
      </mesh>
      {/* White balusters rising with the run */}
      {Array.from({ length: 9 }, (_, i) => {
        const t = (i + 0.5) / 9;
        const z = STAIR_Z0 + t * STAIR_RUN;
        const yTop = t * STORY_H + 0.95;
        return (
          <mesh key={`b${i}`} position={[railX, yTop / 2, z]} castShadow>
            <boxGeometry args={[0.035, yTop, 0.035]} />
            <meshStandardMaterial color={RAIL_WHITE} />
          </mesh>
        );
      })}
      {/* Newel post at the bottom of the run */}
      <mesh position={[railX, 0.55, STAIR_Z0]} castShadow>
        <boxGeometry args={[0.11, 1.1, 0.11]} />
        <meshStandardMaterial color={RAIL_WOOD} />
      </mesh>
    </group>
  );
}

/** Open white railing run (top rail + balusters) along an edge of a void. */
function Railing({ axis, at, from, to }: { axis: 'x' | 'z'; at: number; from: number; to: number }) {
  const len = to - from;
  const mid = (from + to) / 2;
  const n = Math.max(2, Math.round(len / 0.26));
  const topPos: [number, number, number] = axis === 'z' ? [mid, UP_Y + 0.92, at] : [at, UP_Y + 0.92, mid];
  const topArgs: [number, number, number] = axis === 'z' ? [len, 0.07, 0.12] : [0.12, 0.07, len];
  return (
    <group>
      <mesh position={topPos} castShadow>
        <boxGeometry args={topArgs} />
        <meshStandardMaterial color={RAIL_WOOD} />
      </mesh>
      {Array.from({ length: n }, (_, i) => {
        const p = from + (i + 0.5) * (len / n);
        const pos: [number, number, number] = axis === 'z' ? [p, UP_Y + 0.46, at] : [at, UP_Y + 0.46, p];
        return (
          <mesh key={i} position={pos} castShadow>
            <boxGeometry args={[0.04, 0.9, 0.04]} />
            <meshStandardMaterial color={RAIL_WHITE} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Cream upstairs wall segment (y from UP_Y to WALL_TOP). */
function UpWall({ axis, at, from, to }: { axis: 'x' | 'z'; at: number; from: number; to: number }) {
  const len = to - from;
  const mid = (from + to) / 2;
  const pos: [number, number, number] = axis === 'z' ? [at, UP_WALL_YC, mid] : [mid, UP_WALL_YC, at];
  const args: [number, number, number] = axis === 'z' ? [WT, UP_WALL_H, len] : [len, UP_WALL_H, WT];
  return (
    <mesh position={pos} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={CREAM} roughness={0.95} />
    </mesh>
  );
}

/** A flat second-floor slab piece (wood top, cream underside so it reads from below). */
function FloorPiece({ cx, cz, sx, sz }: { cx: number; cz: number; sx: number; sz: number }) {
  return (
    <group>
      <mesh position={[cx, UP_Y - 0.05, cz]} receiveShadow castShadow>
        <boxGeometry args={[sx, 0.1, sz]} />
        <primitive object={mat.woodFloor()} attach="material" />
      </mesh>
      <mesh position={[cx, UP_Y - 0.12, cz]}>
        <boxGeometry args={[sx, 0.02, sz]} />
        <meshStandardMaterial color={CREAM} emissive={CREAM} emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}

/** Simple bed: mattress + headboard. */
function Bed({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <group position={position}>
      <mesh position={[0, UP_Y + 0.3, 0]} castShadow>
        <boxGeometry args={[1.4, 0.35, 2.0]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, UP_Y + 0.45, -0.95]} castShadow>
        <boxGeometry args={[0.3, 0.45, 0.6]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      <mesh position={[0, UP_Y + 0.62, 0.85]} castShadow>
        <boxGeometry args={[1.42, 0.5, 0.1]} />
        <meshStandardMaterial color="#6a4a32" />
      </mesh>
    </group>
  );
}

/** A backyard window on the upstairs back (yard) wall. */
function YardWindow({ x }: { x: number }) {
  return (
    <group position={[x, UP_Y + 1.1, 8.72]}>
      <mesh>
        <boxGeometry args={[1.5, 1.3, 0.05]} />
        <meshStandardMaterial color="#9fd0e6" emissive="#bfe2f0" emissiveIntensity={0.4} metalness={0.1} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[0.07, 1.34, 0.06]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <boxGeometry args={[1.54, 0.07, 0.06]} />
        <meshStandardMaterial color="#fff" />
      </mesh>
    </group>
  );
}

/**
 * The entire second floor. The right column (x=-12..-4) is one solid slab: MASTER
 * over the garage (front), an open hall over the old stair landing (mid), PENNY +
 * LUKE over the green family room (back) with backyard windows. The left/center slab
 * is the open GAME ROOM over the kitchen + back of the great room; its front edge is
 * the white loft railing overlooking the two-story void you walk into. The open
 * staircase rises in that void on the right and lands on the game-room edge.
 */
export function Upstairs() {
  return (
    <group>
      {/* Right column (master + hall + kids) — one solid slab, no stairwell. */}
      <FloorPiece cx={-8} cz={0} sx={8} sz={18} />
      {/* Game room over the kitchen + back of the great room (z=-4..9). */}
      <FloorPiece cx={4} cz={2.5} sx={16} sz={13} />

      {/* ---- Loft railing along the game-room front edge (over the great room) ---- */}
      {/* gap at x=-4..-2.3 where the staircase emerges */}
      <Railing axis="z" at={VOID_Z1} from={-2.3} to={VOID_X1} />

      {/* ---- Bedroom walls (cream, y=3..5.3) ---- */}
      {/* MASTER east wall facing the void/great room (x=-4, over the garage) */}
      <UpWall axis="z" at={-4} from={-9} to={-1.5} />
      {/* MASTER back wall (z=-1.5) with a door to the hall */}
      <UpWall axis="x" at={-1.5} from={-12} to={-7.0} />
      <UpWall axis="x" at={-1.5} from={-6.0} to={-4} />

      {/* PENNY + LUKE front wall (z=2, x=-12..-4) with two door gaps */}
      <UpWall axis="x" at={2.0} from={-12} to={-10.6} />
      <UpWall axis="x" at={2.0} from={-9.4} to={-6.6} />
      <UpWall axis="x" at={2.0} from={-5.4} to={-4} />
      {/* Penny / Luke divider (x=-7.75, z=2..9) */}
      <UpWall axis="z" at={-7.75} from={2.0} to={9} />
      {/* Kids ↔ game-room divider (x=-4, z=2..9) */}
      <UpWall axis="z" at={-4} from={2.0} to={9} />

      {/* ---- Beds + backyard windows ---- */}
      <Bed position={[-8, 0, -5.0]} color="#3a5a7a" />       {/* master (over garage) */}
      <Bed position={[-9.9, 0, 6.2]} color="#d94f8c" />       {/* Penny (pink) */}
      <YardWindow x={-9.9} />
      <Bed position={[-5.9, 0, 6.2]} color="#2f8f4f" />       {/* Luke (green) */}
      <YardWindow x={-5.9} />

      {/* ---- Wardrobe dressers (one per bedroom, against a wall facing in) ----
          y = UP_Y because Bed/FloorPiece add the upstairs height internally but
          Dresser builds from its own origin, so the GROUP must sit on the loft. */}
      <Dresser owner="dad" position={[-11.4, UP_Y, -6.5]} yaw={Math.PI / 2} accent="#3a6db0" />
      <Dresser owner="penny" position={[-11.4, UP_Y, 4.3]} yaw={Math.PI / 2} accent="#e26aa1" />
      <Dresser owner="luke" position={[-4.6, UP_Y, 4.3]} yaw={-Math.PI / 2} accent="#5cb85c" />

      {/* ---- Game-room props on the open loft (over the kitchen) ---- */}
      <mesh position={[7, UP_Y + 0.25, 0]} castShadow>
        <sphereGeometry args={[0.45, 14, 10]} />
        <meshStandardMaterial color="#e26aa1" roughness={0.85} />
      </mesh>
      <group position={[5, UP_Y + 0.05, -0.5]}>
        {['#a83a3a', '#3a5aa6', '#5cb85c', '#e6b94a'].map((c, i) => (
          <mesh key={i} position={[0, 0.05 + i * 0.06, 0]} castShadow>
            <boxGeometry args={[0.28, 0.06, 0.22]} />
            <meshStandardMaterial color={c} />
          </mesh>
        ))}
      </group>
      <mesh position={[9, UP_Y + 1.6, 8.9]}>
        <boxGeometry args={[2.0, 0.5, 0.04]} />
        <meshStandardMaterial color="#fff15a" emissive="#fff15a" emissiveIntensity={0.25} />
      </mesh>
      {/* warm light for the game room + soft ones for the bedroom hall + master */}
      <pointLight position={[5, UP_Y + 1.4, 2]} intensity={4} distance={12} decay={2} color="#fff2dc" />
      <pointLight position={[-8, UP_Y + 1.4, 5]} intensity={3.5} distance={10} decay={2} color="#fff2dc" />
      <pointLight position={[-8, UP_Y + 1.4, -5]} intensity={3} distance={9} decay={2} color="#fff2dc" />
    </group>
  );
}
