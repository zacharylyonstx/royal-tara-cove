import { mat } from '../../world/materials';

const STORY_H = 3.0;

// HOUSE-LOCAL coords. width 20 (x=-10..10), depth 18 (z=-9..9). Facing in (+Z) the
// RIGHT is -X (garage/stairs/family + bedrooms above), the LEFT is +X (front door,
// great room + game room above).
//
// Stairs live in the stairhall behind the garage (x=-10..-4, z=-1.5..2), running
// along the right (-X) wall and climbing FRONT→BACK (+Z) up to the loft.
const STAIR_X0 = -9.7;          // against the right wall
const STAIR_X1 = -8.3;          // 1.4m tread width
const STAIR_Z0 = -1.3;          // bottom (front of stairhall)
const STAIR_Z1 = 2.0;           // top (back), meets the loft level
const STAIR_RUN = STAIR_Z1 - STAIR_Z0;
const STAIR_WIDTH = STAIR_X1 - STAIR_X0;
const STAIR_STEPS = 13;
const STAIR_XC = (STAIR_X0 + STAIR_X1) / 2;

// The two-story VOID (open to the great room below): the front-center/right area.
const VOID_X0 = -4.0;           // left edge of void (right-spine line)
const VOID_Z0 = -9.0;           // front (street wall)
const VOID_Z1 = -4.0;           // back edge of void (balcony railing here)

const UP_Y = STORY_H;           // upstairs floor level
const WALL_TOP = 5.3;           // upstairs wall top (just under the 5.5 ceiling seal)
const UP_WALL_H = WALL_TOP - UP_Y;
const UP_WALL_YC = (UP_Y + WALL_TOP) / 2;
const CREAM = '#efe8d8';
const RAIL_WHITE = '#f2eee4';
const RAIL_WOOD = '#5a3a22';
const WT = 0.14;                // upstairs wall thickness

/** Stepped staircase in the stairhall (behind the garage), white rail. */
export function Stairs() {
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
      {/* White handrail along the open (+X) side, tilted up the run */}
      <mesh
        position={[STAIR_X1 - 0.04, STORY_H / 2 + 0.95, (STAIR_Z0 + STAIR_Z1) / 2]}
        rotation={[-Math.atan2(STORY_H, STAIR_RUN), 0, 0]}
        castShadow
      >
        <boxGeometry args={[0.07, 0.07, Math.hypot(STAIR_RUN, STORY_H)]} />
        <meshStandardMaterial color={RAIL_WOOD} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => {
        const t = (i + 0.5) / 7;
        const z = STAIR_Z0 + t * STAIR_RUN;
        const yTop = t * STORY_H + 0.95;
        return (
          <mesh key={`b${i}`} position={[STAIR_X1 - 0.04, yTop / 2, z]} castShadow>
            <boxGeometry args={[0.035, yTop, 0.035]} />
            <meshStandardMaterial color={RAIL_WHITE} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Open white railing run along one edge of the two-story void. */
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
    <group position={[x, UP_Y + 1.1, 8.76]}>
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
 * The entire second floor: floor (footprint minus the two-story void), the
 * L-shaped white balcony railing around the void, the bedrooms (master over the
 * garage; Penny far-right against the exterior wall; Luke to her left; game room
 * open over the great room), and a little walkway in front of the bedroom doors.
 */
export function Upstairs() {
  return (
    <group>
      {/* ---- Floor: two pieces tile the footprint minus the void ---- */}
      {/* A: right (-X) column over garage / stairhall / family (master + Penny + Luke) */}
      <mesh position={[-7, UP_Y - 0.05, 0]} receiveShadow castShadow>
        <boxGeometry args={[6, 0.1, 18]} />
        <primitive object={mat.woodFloor()} attach="material" />
      </mesh>
      {/* B: left/center (+X) over great-room back + kitchen (game room) */}
      <mesh position={[3, UP_Y - 0.05, 2.5]} receiveShadow castShadow>
        <boxGeometry args={[14, 0.1, 13]} />
        <primitive object={mat.woodFloor()} attach="material" />
      </mesh>
      {/* Cream undersides so the second floor reads cleanly from below */}
      <mesh position={[-7, UP_Y - 0.12, 0]}>
        <boxGeometry args={[6, 0.02, 18]} />
        <meshStandardMaterial color={CREAM} emissive={CREAM} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[3, UP_Y - 0.12, 2.5]}>
        <boxGeometry args={[14, 0.02, 13]} />
        <meshStandardMaterial color={CREAM} emissive={CREAM} emissiveIntensity={0.2} />
      </mesh>

      {/* ---- Balcony railing: L-shape around the two-story void ---- */}
      {/* back edge of void (z=-4), full width of the void */}
      <Railing axis="z" at={VOID_Z1} from={VOID_X0} to={10} />
      {/* left edge of void (x=-4), front portion */}
      <Railing axis="x" at={VOID_X0} from={VOID_Z0} to={VOID_Z1} />

      {/* ---- Bedroom walls ---- */}
      {/* MASTER (over garage, x=-10..-4, z=-9..-2): back wall with a door gap */}
      <UpWall axis="x" at={-2} from={-10} to={-6.7} />
      <UpWall axis="x" at={-2} from={-5.5} to={-4} />
      {/* master east short wall (x=-4, z=-4..-2) closing it off from the game room */}
      <UpWall axis="z" at={-4} from={-4} to={-2} />

      {/* PENNY + LUKE front wall (z=2, x=-10..-4) with two door gaps */}
      <UpWall axis="x" at={2} from={-10} to={-9.0} />
      <UpWall axis="x" at={2} from={-8.0} to={-6.2} />   {/* between Penny & Luke doors */}
      <UpWall axis="x" at={2} from={-5.2} to={-4} />
      {/* Penny / Luke divider (x=-7, z=2..9) */}
      <UpWall axis="z" at={-7} from={2} to={9} />
      {/* Luke east wall (x=-4, z=2..9) separating bedrooms from the game room */}
      <UpWall axis="z" at={-4} from={2} to={9} />

      {/* ---- Beds + backyard windows ---- */}
      <Bed position={[-7, 0, -5.5]} color="#3a5a7a" />       {/* master */}
      <Bed position={[-8.6, 0, 6.0]} color="#d94f8c" />       {/* Penny (pink) */}
      <YardWindow x={-8.5} />
      <Bed position={[-5.5, 0, 6.0]} color="#2f8f4f" />       {/* Luke (green) */}
      <YardWindow x={-5.5} />

      {/* ---- Game-room props on the open loft (over the great room) ---- */}
      <mesh position={[6, UP_Y + 0.25, -1.5]} castShadow>
        <sphereGeometry args={[0.45, 14, 10]} />
        <meshStandardMaterial color="#e26aa1" roughness={0.85} />
      </mesh>
      <group position={[4, UP_Y + 0.05, -1.8]}>
        {['#a83a3a', '#3a5aa6', '#5cb85c', '#e6b94a'].map((c, i) => (
          <mesh key={i} position={[0, 0.05 + i * 0.06, 0]} castShadow>
            <boxGeometry args={[0.28, 0.06, 0.22]} />
            <meshStandardMaterial color={c} />
          </mesh>
        ))}
      </group>
      <mesh position={[8, UP_Y + 1.6, 8.9]}>
        <boxGeometry args={[2.0, 0.5, 0.04]} />
        <meshStandardMaterial color="#fff15a" emissive="#fff15a" emissiveIntensity={0.25} />
      </mesh>
      {/* warm light for the game room + a soft one for the bedroom hall */}
      <pointLight position={[4, UP_Y + 1.4, 2]} intensity={4} distance={12} decay={2} color="#fff2dc" />
      <pointLight position={[-7, UP_Y + 1.4, 4]} intensity={3.5} distance={10} decay={2} color="#fff2dc" />
      <pointLight position={[-7, UP_Y + 1.4, -5]} intensity={3} distance={9} decay={2} color="#fff2dc" />
    </group>
  );
}
