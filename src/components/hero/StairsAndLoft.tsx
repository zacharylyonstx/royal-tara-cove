import { mat } from '../../world/materials';

const STORY_H = 3.0;

// HOUSE-LOCAL coords (+X right-in-world, -Z front/street, +Z back).
// Walking in you face +Z; the right wall is at -X. The staircase runs along that
// right wall and climbs FRONT→BACK (+Z) up to the loft (matches the entry photo).
const STAIR_X0 = -8.85;          // against the right wall
const STAIR_X1 = -7.6;           // 1.25m tread width
const STAIR_Z0 = -3.7;           // bottom (front)
const STAIR_Z1 = -0.3;           // top (back), meets the loft
const STAIR_RUN = STAIR_Z1 - STAIR_Z0;     // along +Z
const STAIR_WIDTH = STAIR_X1 - STAIR_X0;   // along X
const STAIR_STEPS = 12;
const STAIR_XC = (STAIR_X0 + STAIR_X1) / 2;

// Loft / game room: the open second floor goes ALL THE WAY ACROSS the great room
// width, over its back portion, at y = STORY_H. Its front edge (z = LOFT_Z0) is an
// OPEN white handrail overlooking the two-story living/dining below — no wall.
const LOFT_X0 = -9.0;
const LOFT_X1 = 2.0;
const LOFT_Z0 = -3.0;            // front edge (railing here)
const LOFT_Z1 = 0.0;            // back edge
const LOFT_W = LOFT_X1 - LOFT_X0;
const LOFT_D = LOFT_Z1 - LOFT_Z0;

const RAIL_WHITE = '#f2eee4';
const RAIL_WOOD = '#5a3a22';

/** Stepped staircase climbing front→back along the right wall, with a white rail. */
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
      {/* White balusters under the stair rail */}
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

/** Open loft / game room across the back of the great room, with a white railing. */
export function Loft() {
  const cx = (LOFT_X0 + LOFT_X1) / 2;
  const cz = (LOFT_Z0 + LOFT_Z1) / 2;
  const nBalusters = Math.round(LOFT_W / 0.26);
  return (
    <group>
      {/* Loft floor (wood top) */}
      <mesh position={[cx, STORY_H - 0.05, cz]} receiveShadow castShadow>
        <boxGeometry args={[LOFT_W, 0.1, LOFT_D]} />
        <primitive object={mat.woodFloor()} attach="material" />
      </mesh>
      {/* Cream underside so from below it reads as a clean second-floor edge, not a dark band */}
      <mesh position={[cx, STORY_H - 0.12, cz]}>
        <boxGeometry args={[LOFT_W, 0.02, LOFT_D]} />
        <meshStandardMaterial color="#efe8d8" emissive="#efe8d8" emissiveIntensity={0.2} />
      </mesh>

      {/* OPEN white handrail along the front edge (z = LOFT_Z0), full width. */}
      <mesh position={[cx, STORY_H + 0.92, LOFT_Z0]} castShadow>
        <boxGeometry args={[LOFT_W, 0.07, 0.12]} />
        <meshStandardMaterial color={RAIL_WOOD} />
      </mesh>
      {Array.from({ length: nBalusters }, (_, i) => {
        const x = LOFT_X0 + (i + 0.5) * (LOFT_W / nBalusters);
        return (
          <mesh key={`lb${i}`} position={[x, STORY_H + 0.46, LOFT_Z0]} castShadow>
            <boxGeometry args={[0.04, 0.9, 0.04]} />
            <meshStandardMaterial color={RAIL_WHITE} />
          </mesh>
        );
      })}

      {/* Game-room props on the loft */}
      <mesh position={[LOFT_X0 + 1.5, STORY_H + 0.25, LOFT_Z1 - 0.7]} castShadow>
        <sphereGeometry args={[0.45, 14, 10]} />
        <meshStandardMaterial color="#e26aa1" roughness={0.85} />
      </mesh>
      <group position={[LOFT_X0 + 3.0, STORY_H + 0.05, LOFT_Z1 - 0.9]}>
        {['#a83a3a', '#3a5aa6', '#5cb85c', '#e6b94a'].map((c, i) => (
          <mesh key={i} position={[0, 0.05 + i * 0.06, 0]} castShadow>
            <boxGeometry args={[0.28, 0.06, 0.22]} />
            <meshStandardMaterial color={c} />
          </mesh>
        ))}
      </group>
      <mesh position={[-1.5, STORY_H + 1.6, LOFT_Z1 - 0.05]}>
        <boxGeometry args={[1.6, 0.4, 0.04]} />
        <meshStandardMaterial color="#fff15a" emissive="#fff15a" emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}
