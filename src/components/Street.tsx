import {
  STREET_RADIUS,
  SIDEWALK_WIDTH,
  STRAIGHT_START_Z,
  STRAIGHT_END_Z,
  STRAIGHT_HALF_ROAD,
} from '../world/streetLayout';

// The cul-de-sac itself: bulb pavement disc + sidewalk ring at the south end,
// the long straight section running north up to Avery Ranch Blvd, sidewalks
// flanking the straight section, and a yellow center stripe.
export function Street() {
  const straightLen = Math.abs(STRAIGHT_END_Z - STRAIGHT_START_Z);
  const straightCenterZ = (STRAIGHT_START_Z + STRAIGHT_END_Z) / 2;
  const sidewalkOuter = STRAIGHT_HALF_ROAD + SIDEWALK_WIDTH;
  const sidewalkCenter = STRAIGHT_HALF_ROAD + SIDEWALK_WIDTH / 2;

  // A short stub of Avery Ranch Blvd visible at the entry, perpendicular to
  // Royal Tara Cove. Sits 4m north of the entry edge of the straight section.
  const avenueZ = STRAIGHT_END_Z - 4;
  const avenueWidth = 12;

  return (
    <group>
      {/* Cul-de-sac bulb pavement */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[STREET_RADIUS, 64]} />
        <meshStandardMaterial color="#3a3a40" />
      </mesh>

      {/* Sidewalk ring around the bulb */}
      <mesh position={[0, 0.013, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[STREET_RADIUS, STREET_RADIUS + SIDEWALK_WIDTH, 64]} />
        <meshStandardMaterial color="#bcb5a8" />
      </mesh>

      {/* Straight road section */}
      <mesh position={[0, 0.01, straightCenterZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[STRAIGHT_HALF_ROAD * 2, straightLen]} />
        <meshStandardMaterial color="#3a3a40" />
      </mesh>

      {/* Sidewalks flanking the straight section */}
      <mesh
        position={[-sidewalkCenter, 0.013, straightCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[SIDEWALK_WIDTH, straightLen]} />
        <meshStandardMaterial color="#bcb5a8" />
      </mesh>
      <mesh
        position={[sidewalkCenter, 0.013, straightCenterZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[SIDEWALK_WIDTH, straightLen]} />
        <meshStandardMaterial color="#bcb5a8" />
      </mesh>

      {/* Yellow center stripe (broken into segments for realism) */}
      {Array.from({ length: 12 }, (_, i) => {
        const t = (i + 0.5) / 12;
        const z = STRAIGHT_START_Z + (STRAIGHT_END_Z - STRAIGHT_START_Z) * t;
        return (
          <mesh key={i} position={[0, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.18, 2.5]} />
            <meshStandardMaterial color="#f0d040" />
          </mesh>
        );
      })}

      {/* Curb returns where straight section meets the bulb (small filler triangles) */}
      <mesh position={[0, 0.01, STRAIGHT_START_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[sidewalkOuter * 2, 0.5]} />
        <meshStandardMaterial color="#3a3a40" />
      </mesh>

      {/* Avery Ranch Blvd stub (perpendicular street at the entry) */}
      <mesh position={[0, 0.009, avenueZ]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[120, avenueWidth]} />
        <meshStandardMaterial color="#3a3a40" />
      </mesh>
      {/* Avery Ranch sidewalks */}
      <mesh position={[0, 0.012, avenueZ + avenueWidth / 2 + SIDEWALK_WIDTH / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[120, SIDEWALK_WIDTH]} />
        <meshStandardMaterial color="#bcb5a8" />
      </mesh>
      <mesh position={[0, 0.012, avenueZ - avenueWidth / 2 - SIDEWALK_WIDTH / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[120, SIDEWALK_WIDTH]} />
        <meshStandardMaterial color="#bcb5a8" />
      </mesh>
      {/* Avery Ranch yellow double-line */}
      {Array.from({ length: 14 }, (_, i) => (
        <mesh
          key={`av${i}`}
          position={[-55 + i * 8.5, 0.011, avenueZ - 0.2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[3, 0.18]} />
          <meshStandardMaterial color="#f0d040" />
        </mesh>
      ))}
      {Array.from({ length: 14 }, (_, i) => (
        <mesh
          key={`av${i}b`}
          position={[-55 + i * 8.5, 0.011, avenueZ + 0.2]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[3, 0.18]} />
          <meshStandardMaterial color="#f0d040" />
        </mesh>
      ))}

      {/* "Royal Tara Cv" street sign at the entry corner */}
      <group position={[6, 0, STRAIGHT_END_Z + 1]}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 2.8, 6]} />
          <meshStandardMaterial color="#2c2c2c" />
        </mesh>
        <mesh position={[0, 2.7, 0]} castShadow>
          <boxGeometry args={[2.6, 0.5, 0.06]} />
          <meshStandardMaterial color="#2a5d8f" />
        </mesh>
      </group>
    </group>
  );
}
