import { mat } from '../../world/materials';

const STORY_H = 3.0;

// HOUSE-LOCAL coords. Stairs run along the west wall of the great room,
// climbing east (so as you face -Z, the stairs are on your right).
// Footprint: x = -8.4..-5.0 (3.4m run), z = -2.5..-1.4 (1.1m wide).
// Rises 0 → STORY_H (3m) over 3.4m → ~41° slope.
const STAIR_X0 = -8.4;
const STAIR_X1 = -5.0;
const STAIR_Z0 = -2.5;
const STAIR_Z1 = -1.4;
const STAIR_RUN = STAIR_X1 - STAIR_X0;
const STAIR_WIDTH = STAIR_Z1 - STAIR_Z0;
const STAIR_STEPS = 12;

// Loft: back-half of upstairs, sits at y = STORY_H.
const LOFT_X0 = -9.0;
const LOFT_X1 = -2.0;
const LOFT_Z0 = -3.0;
const LOFT_Z1 = 3.5;

/** Stepped staircase with handrail. Visual only — collision uses the ramp Floor. */
export function Stairs() {
  return (
    <group>
      {/* Step blocks — discrete steps for the visual climb */}
      {Array.from({ length: STAIR_STEPS }, (_, i) => {
        const t = i / STAIR_STEPS;
        const next = (i + 1) / STAIR_STEPS;
        const x = STAIR_X0 + (t + (next - t) / 2) * STAIR_RUN;
        const stepH = STORY_H / STAIR_STEPS;
        const yTop = next * STORY_H;
        return (
          <mesh
            key={i}
            position={[x, yTop - stepH / 2, (STAIR_Z0 + STAIR_Z1) / 2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[STAIR_RUN / STAIR_STEPS, stepH, STAIR_WIDTH]} />
            <primitive object={mat.woodFloor()} attach="material" />
          </mesh>
        );
      })}
      {/* Handrail (south side, away from wall) */}
      <mesh
        position={[(STAIR_X0 + STAIR_X1) / 2, STORY_H / 2 + 0.95, STAIR_Z1 - 0.05]}
        rotation={[0, 0, Math.atan2(STORY_H, STAIR_RUN)]}
        castShadow
      >
        <boxGeometry args={[Math.hypot(STAIR_RUN, STORY_H), 0.06, 0.06]} />
        <meshStandardMaterial color="#5a3a22" />
      </mesh>
      {/* Handrail posts */}
      {[0, 0.33, 0.66, 1.0].map((t, i) => {
        const x = STAIR_X0 + t * STAIR_RUN;
        const yTop = t * STORY_H + 0.95;
        return (
          <mesh key={i} position={[x, yTop / 2, STAIR_Z1 - 0.05]} castShadow>
            <boxGeometry args={[0.06, yTop, 0.06]} />
            <meshStandardMaterial color="#5a3a22" />
          </mesh>
        );
      })}
      {/* Top landing visual cap (where stairs meet loft) */}
      <mesh position={[STAIR_X1, STORY_H - 0.02, (STAIR_Z0 + STAIR_Z1) / 2]} receiveShadow>
        <boxGeometry args={[0.4, 0.04, STAIR_WIDTH]} />
        <primitive object={mat.woodFloor()} attach="material" />
      </mesh>
    </group>
  );
}

/** Upstairs loft: floor + perimeter walls + railing along the open side. */
export function Loft() {
  const w = LOFT_X1 - LOFT_X0;
  const d = LOFT_Z1 - LOFT_Z0;
  const cx = (LOFT_X0 + LOFT_X1) / 2;
  const cz = (LOFT_Z0 + LOFT_Z1) / 2;
  return (
    <group>
      {/* Loft floor */}
      <mesh position={[cx, STORY_H - 0.05, cz]} receiveShadow>
        <boxGeometry args={[w, 0.1, d]} />
        <primitive object={mat.woodFloor()} attach="material" />
      </mesh>
      {/* Railing along the open south edge (z = LOFT_Z0), with a gap at the
          stair landing (x = -5.5..-4.5) */}
      <mesh position={[(LOFT_X0 + -5.5) / 2, STORY_H + 0.55, LOFT_Z0 + 0.05]} castShadow>
        <boxGeometry args={[Math.abs(LOFT_X0 - -5.5), 1.1, 0.08]} />
        <meshStandardMaterial color="#5a3a22" />
      </mesh>
      <mesh position={[(-4.5 + LOFT_X1) / 2, STORY_H + 0.55, LOFT_Z0 + 0.05]} castShadow>
        <boxGeometry args={[Math.abs(-4.5 - LOFT_X1), 1.1, 0.08]} />
        <meshStandardMaterial color="#5a3a22" />
      </mesh>
      {/* Railing top cap pieces */}
      <mesh position={[(LOFT_X0 + -5.5) / 2, STORY_H + 1.1, LOFT_Z0 + 0.05]} castShadow>
        <boxGeometry args={[Math.abs(LOFT_X0 - -5.5), 0.05, 0.16]} />
        <meshStandardMaterial color="#3a2a1c" />
      </mesh>
      <mesh position={[(-4.5 + LOFT_X1) / 2, STORY_H + 1.1, LOFT_Z0 + 0.05]} castShadow>
        <boxGeometry args={[Math.abs(-4.5 - LOFT_X1), 0.05, 0.16]} />
        <meshStandardMaterial color="#3a2a1c" />
      </mesh>

      {/* A small "play loft" area: bean bag + stack of books + a window-glow rectangle */}
      {/* Bean bag */}
      <mesh position={[LOFT_X0 + 1.5, STORY_H + 0.25, LOFT_Z1 - 0.8]} castShadow>
        <sphereGeometry args={[0.45, 14, 10]} />
        <meshStandardMaterial color="#e26aa1" roughness={0.85} />
      </mesh>
      {/* Stack of books */}
      <group position={[LOFT_X0 + 3.0, STORY_H + 0.05, LOFT_Z1 - 1.2]}>
        {['#a83a3a', '#3a5aa6', '#5cb85c', '#e6b94a'].map((c, i) => (
          <mesh key={i} position={[0, 0.05 + i * 0.06, 0]} castShadow>
            <boxGeometry args={[0.28, 0.06, 0.22]} />
            <meshStandardMaterial color={c} />
          </mesh>
        ))}
      </group>
      {/* Wall-light to brighten loft */}
      <pointLight position={[cx, STORY_H + 1.6, cz]} intensity={0.6} color="#fff0c8" distance={9} decay={2} />

      {/* "PLAY LOFT" sign (small colored plaque on the back wall) */}
      <mesh position={[cx, STORY_H + 1.8, LOFT_Z1 - 0.06]}>
        <boxGeometry args={[1.4, 0.4, 0.04]} />
        <meshStandardMaterial color="#fff15a" emissive="#fff15a" emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
}
